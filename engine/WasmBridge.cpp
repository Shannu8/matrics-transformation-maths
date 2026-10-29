//This is the main cpp file that do the calculation


#include "TransformationPipeline.hpp"
#include "Presets.hpp"
#include "InverseSolver.hpp"
#include "Matrix3x3.hpp"
#include "Vector3.hpp"
#include "NumericalPolicy.hpp"

#include <emscripten/bind.h>
#include <string>
#include <vector>
#include <sstream>

using namespace emscripten;
using namespace MathEngine;

// Simple lightweight JSON parser helper for input arrays
namespace JsonHelper {
    static std::vector<double> parseNumberArray(const std::string& json, size_t& pos) {
        std::vector<double> numbers;
        pos = json.find('[', pos);
        if (pos == std::string::npos) return numbers;
        pos++; // Skip '['

        while (pos < json.size()) {
            // Skip whitespace
            while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\r' || json[pos] == '\n')) {
                pos++;
            }
            if (pos >= json.size() || json[pos] == ']') {
                if (pos < json.size()) pos++; // Skip ']'
                break;
            }

            char* endPtr = nullptr;
            const char* start = json.c_str() + pos;
            double val = std::strtod(start, &endPtr);
            if (endPtr != start) {
                numbers.push_back(val);
                pos += (endPtr - start);
                // Skip comma or whitespace
                while (pos < json.size() && (json[pos] == ' ' || json[pos] == ',')) {
                    pos++;
                }
            } else {
                pos++;
            }
        }
        return numbers;
    }
}

/**
 * Main WebAssembly interface function.
 * Takes a JSON string containing:
 * {
 *   "matrices": [ [m0..m8], [m0..m8], ([m0..m8]) ],
 *   "names": [ "T1", "T2", ("T3") ],
 *   "vector": [x, y, z],
 *   "tolerance": 1e-9
 * }
 * Returns structured JSON with calculation, verification, residuals, and diagnostics.
 */
std::string executePipelineJson(const std::string& inputJson) {
    try {
        if (inputJson.empty()) {
            return "{\"success\":false,\"errorMessage\":\"Empty input provided to Wasm engine.\"}";
        }

        // Parse vector
        size_t vecPos = inputJson.find("\"vector\"");
        if (vecPos == std::string::npos) {
            return "{\"success\":false,\"errorMessage\":\"Missing 'vector' array in input JSON.\"}";
        }
        std::vector<double> vecVals = JsonHelper::parseNumberArray(inputJson, vecPos);
        if (vecVals.size() != 3) {
            return "{\"success\":false,\"errorMessage\":\"Initial vector must contain exactly 3 coordinates [x, y, z].\"}";
        }
        Vector3 v0(vecVals[0], vecVals[1], vecVals[2]);

        // Parse matrices
        size_t matPos = inputJson.find("\"matrices\"");
        if (matPos == std::string::npos) {
            return "{\"success\":false,\"errorMessage\":\"Missing 'matrices' array in input JSON.\"}";
        }

        matPos = inputJson.find('[', matPos);
        if (matPos == std::string::npos) {
            return "{\"success\":false,\"errorMessage\":\"Malformed 'matrices' in input JSON.\"}";
        }
        matPos++; // Inside outer array

        std::vector<Matrix3x3> matrices;
        while (matPos < inputJson.size()) {
            size_t nextBracket = inputJson.find('[', matPos);
            size_t outerEnd = inputJson.find(']', matPos);
            if (nextBracket == std::string::npos || nextBracket > outerEnd) {
                break;
            }
            std::vector<double> mVals = JsonHelper::parseNumberArray(inputJson, nextBracket);
            if (mVals.size() != 9) {
                std::ostringstream err;
                err << "Matrix " << (matrices.size() + 1) << " must contain exactly 9 values (found " << mVals.size() << ").";
                return "{\"success\":false,\"errorMessage\":\"" + err.str() + "\"}";
            }
            std::array<double, 9> arr;
            for (size_t i = 0; i < 9; ++i) arr[i] = mVals[i];
            matrices.emplace_back(arr);
            matPos = nextBracket;
        }

        // Names
        std::vector<std::string> names;
        for (size_t i = 0; i < matrices.size(); ++i) {
            names.push_back("T" + std::to_string(i + 1));
        }

        // Tolerance
        double tol = NumericalPolicy::DEFAULT_EPSILON;
        size_t tolPos = inputJson.find("\"tolerance\"");
        if (tolPos != std::string::npos) {
            size_t colon = inputJson.find(':', tolPos);
            if (colon != std::string::npos) {
                char* endPtr = nullptr;
                double parsedTol = std::strtod(inputJson.c_str() + colon + 1, &endPtr);
                if (parsedTol > 0.0 && NumericalPolicy::isFinite(parsedTol)) {
                    tol = parsedTol;
                }
            }
        }

        // Execute pipeline
        PipelineResult result = TransformationPipeline::execute(matrices, names, v0, tol);
        return result.toJSON();

    } catch (const std::exception& ex) {
        std::ostringstream ss;
        ss << "{\"success\":false,\"errorMessage\":\"Engine exception: " << ex.what() << "\"}";
        return ss.str();
    } catch (...) {
        return "{\"success\":false,\"errorMessage\":\"Unknown fatal exception in C++ engine.\"}";
    }
}

/**
 * Invert arbitrary 3x3 matrix directly from JSON array [m0..m8]
 */
std::string invertMatrixJson(const std::string& matrixJson) {
    try {
        size_t pos = 0;
        std::vector<double> vals = JsonHelper::parseNumberArray(matrixJson, pos);
        if (vals.size() != 9) {
            return "{\"success\":false,\"errorMessage\":\"Input must be an array of exactly 9 numbers.\"}";
        }
        std::array<double, 9> arr;
        for (size_t i = 0; i < 9; ++i) arr[i] = vals[i];
        Matrix3x3 mat(arr);
        InversionResult res = InverseSolver::invertGaussian(mat);
        return res.toJSON();
    } catch (const std::exception& ex) {
        return "{\"success\":false,\"errorMessage\":\"" + std::string(ex.what()) + "\"}";
    }
}

/**
 * Generate Preset Transformation Matrix JSON
 * Types:
 * - "scale": [sx, sy, sz]
 * - "uniformScale": [s, 0, 0]
 * - "rotateX": [degrees, 0, 0]
 * - "rotateY": [degrees, 0, 0]
 * - "rotateZ": [degrees, 0, 0]
 * - "reflectXY", "reflectXZ", "reflectYZ"
 * - "shear": [typeIndex (0..5), k, 0]
 */
std::string getPresetMatrixJson(const std::string& presetType, double p1, double p2, double p3) {
    try {
        Matrix3x3 m = Matrix3x3::identity();
        if (presetType == "scale") {
            m = Presets::scale(p1, p2, p3);
        } else if (presetType == "uniformScale") {
            m = Presets::uniformScale(p1);
        } else if (presetType == "rotateX") {
            m = Presets::rotateXDegrees(p1);
        } else if (presetType == "rotateY") {
            m = Presets::rotateYDegrees(p1);
        } else if (presetType == "rotateZ") {
            m = Presets::rotateZDegrees(p1);
        } else if (presetType == "reflectXY") {
            m = Presets::reflection(ReflectionPlane::XY);
        } else if (presetType == "reflectXZ") {
            m = Presets::reflection(ReflectionPlane::XZ);
        } else if (presetType == "reflectYZ") {
            m = Presets::reflection(ReflectionPlane::YZ);
        } else if (presetType == "shear") {
            int typeIdx = static_cast<int>(p1);
            if (typeIdx < 0 || typeIdx > 5) typeIdx = 0;
            m = Presets::shear(static_cast<ShearType>(typeIdx), p2);
        } else {
            return "{\"success\":false,\"errorMessage\":\"Unknown preset type: " + presetType + "\"}";
        }

        std::ostringstream ss;
        ss << "{\"success\":true,\"matrix\":" << m.toJSON() << "}";
        return ss.str();
    } catch (const std::exception& ex) {
        return "{\"success\":false,\"errorMessage\":\"" + std::string(ex.what()) + "\"}";
    }
}

bool isEngineReady() {
    return true;
}

EMSCRIPTEN_BINDINGS(TransformationEngineModule) {
    function("executePipelineJson", &executePipelineJson);
    function("invertMatrixJson", &invertMatrixJson);
    function("getPresetMatrixJson", &getPresetMatrixJson);
    function("isEngineReady", &isEngineReady);
}
