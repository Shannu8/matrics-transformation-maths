#pragma once

#include "Matrix3x3.hpp"
#include "Vector3.hpp"
#include "InverseSolver.hpp"
#include "NumericalPolicy.hpp"
#include <vector>
#include <string>
#include <sstream>
#include <iomanip>

namespace MathEngine {

struct TransformationStep {
    size_t index{0};
    std::string name;
    Matrix3x3 matrix;
    InversionResult inverseResult;
    Vector3 outputVector; // Intermediate vector after this step: v_k = T_k * v_{k-1}
};

struct PipelineResult {
    bool success{false};
    std::string errorMessage;

    Vector3 initialVector;
    std::vector<TransformationStep> steps;

    // Sequential final vector
    Vector3 finalSequentialVector;

    // Composed matrix C = T_n ... T_2 T_1
    Matrix3x3 composedMatrix;
    // Composed vector C * v
    Vector3 composedVector;

    // Inversion of composed matrix C
    InversionResult composedInverseResult;

    // Product of inverses: T_1^-1 * T_2^-1 * ... * T_n^-1
    Matrix3x3 productOfInverses;
    bool productOfInversesValid{false};

    // Vector recovered using C^-1: v_rec = C^-1 * (C * v)
    Vector3 recoveredVector;
    bool vectorRecoverySuccessful{false};
    double recoveryError{0.0};

    // Composition verification
    double compositionError{0.0};
    bool compositionVerified{false};

    // Equivalence of direct inverse C^-1 and product of inverses
    bool inverseProductMatchesDirect{false};
    double inverseProductDifferenceNorm{0.0};

    std::string toJSON() const {
        std::ostringstream ss;
        ss << "{"
           << "\"success\":" << (success ? "true" : "false") << ","
           << "\"errorMessage\":\"" << errorMessage << "\","
           << "\"initialVector\":" << initialVector.toJSON() << ","
           << "\"steps\":[";
        for (size_t i = 0; i < steps.size(); ++i) {
            const auto& st = steps[i];
            ss << "{"
               << "\"index\":" << st.index << ","
               << "\"name\":\"" << st.name << "\","
               << "\"matrix\":" << st.matrix.toJSON() << ","
               << "\"inverse\":" << st.inverseResult.toJSON() << ","
               << "\"outputVector\":" << st.outputVector.toJSON()
               << "}";
            if (i + 1 < steps.size()) ss << ",";
        }
        ss << "],"
           << "\"finalSequentialVector\":" << finalSequentialVector.toJSON() << ","
           << "\"composedMatrix\":" << composedMatrix.toJSON() << ","
           << "\"composedVector\":" << composedVector.toJSON() << ","
           << "\"composedInverse\":" << composedInverseResult.toJSON() << ","
           << "\"productOfInverses\":" << (productOfInversesValid ? productOfInverses.toJSON() : "null") << ","
           << "\"recoveredVector\":" << recoveredVector.toJSON() << ","
           << "\"vectorRecoverySuccessful\":" << (vectorRecoverySuccessful ? "true" : "false") << ","
           << "\"recoveryError\":" << std::setprecision(12) << recoveryError << ","
           << "\"compositionError\":" << compositionError << ","
           << "\"compositionVerified\":" << (compositionVerified ? "true" : "false") << ","
           << "\"inverseProductMatchesDirect\":" << (inverseProductMatchesDirect ? "true" : "false") << ","
           << "\"inverseProductDifferenceNorm\":" << inverseProductDifferenceNorm
           << "}";
        return ss.str();
    }
};

class TransformationPipeline {
public:
    /**
     * Executes composition and verification of 2 or 3 transformations.
     * Conforms to Handbook Sections 5, 9, 10, 11.
     *
     * Order of application:
     * v_1 = T_1 * v
     * v_2 = T_2 * v_1
     * v_3 = T_3 * v_2
     *
     * Composed Matrix:
     * For 2: C = T_2 * T_1
     * For 3: C = T_3 * T_2 * T_1
     *
     * Inverse:
     * C^-1 = T_1^-1 * T_2^-1 (* T_3^-1)
     */
    static PipelineResult execute(const std::vector<Matrix3x3>& transformations,
                                  const std::vector<std::string>& names,
                                  const Vector3& v0,
                                  double tolerance = NumericalPolicy::DEFAULT_EPSILON) {
        PipelineResult res;
        res.initialVector = v0;

        // 1. Validate transformation count: at least 1 transformation required
        size_t n = transformations.size();
        if (n < 1) {
            res.success = false;
            res.errorMessage = "At least one transformation matrix is required.";
            return res;
        }

        // 2. Validate finite initial vector (Handbook Section 11.2)
        if (!v0.isFinite()) {
            res.success = false;
            res.errorMessage = "Initial vector contains non-finite entries (NaN or Infinity).";
            return res;
        }

        // 3. Validate finite matrices
        for (size_t i = 0; i < n; ++i) {
            if (!transformations[i].isFinite()) {
                res.success = false;
                std::ostringstream msg;
                msg << "Transformation matrix T" << (i + 1) << " contains non-finite entries.";
                res.errorMessage = msg.str();
                return res;
            }
        }

        // 4. Sequential transformation application & individual inverses
        Vector3 currentV = v0;
        res.steps.resize(n);

        for (size_t i = 0; i < n; ++i) {
            res.steps[i].index = i + 1;
            res.steps[i].name = (i < names.size() && !names[i].empty()) 
                                ? names[i] 
                                : ("T" + std::to_string(i + 1));
            res.steps[i].matrix = transformations[i];
            
            // Apply transformation: v_k = T_k * v_{k-1}
            currentV = transformations[i] * currentV;
            res.steps[i].outputVector = currentV;

            // Invert individual matrix
            res.steps[i].inverseResult = InverseSolver::invertGaussian(transformations[i]);
        }
        res.finalSequentialVector = currentV;

        // 5. Composed matrix calculation: C = T_n * ... * T_2 * T_1
        res.composedMatrix = transformations[0];
        for (size_t i = 1; i < n; ++i) {
            res.composedMatrix = transformations[i] * res.composedMatrix;
        }

        // Composed vector: C * v
        res.composedVector = res.composedMatrix * v0;

        // 6. Composition verification (Handbook Section 9.4)
        // error_composition = ||C*v - v_sequential||_inf
        Vector3 compDiff = res.composedVector - res.finalSequentialVector;
        res.compositionError = compDiff.normInf();
        double compScale = std::max({1.0, res.composedVector.normInf(), res.finalSequentialVector.normInf()});
        res.compositionVerified = (res.compositionError <= tolerance * compScale);

        // 7. Inversion of composed matrix C
        res.composedInverseResult = InverseSolver::invertGaussian(res.composedMatrix);

        // 8. Product of individual inverses: (T_n * ... * T_1)^-1 = T_1^-1 * ... * T_n^-1
        bool allIndividualInvertible = true;
        for (size_t i = 0; i < n; ++i) {
            if (!res.steps[i].inverseResult.success) {
                allIndividualInvertible = false;
                break;
            }
        }

        if (allIndividualInvertible) {
            res.productOfInversesValid = true;
            res.productOfInverses = res.steps[0].inverseResult.inverse;
            for (size_t i = 1; i < n; ++i) {
                res.productOfInverses = res.productOfInverses * res.steps[i].inverseResult.inverse;
            }

            if (res.composedInverseResult.success) {
                Matrix3x3 diff = res.composedInverseResult.inverse - res.productOfInverses;
                res.inverseProductDifferenceNorm = diff.normInf();
                double scaleInv = std::max({1.0, res.composedInverseResult.inverse.normInf(), res.productOfInverses.normInf()});
                res.inverseProductMatchesDirect = (res.inverseProductDifferenceNorm <= tolerance * scaleInv);
            }
        } else {
            res.productOfInversesValid = false;
            res.inverseProductMatchesDirect = false;
        }

        // 9. Inverse vector recovery (Handbook Section 4.2)
        // v_recovered = C^-1 * (C * v)
        if (res.composedInverseResult.success) {
            res.recoveredVector = res.composedInverseResult.inverse * res.composedVector;
            Vector3 recDiff = res.recoveredVector - v0;
            res.recoveryError = recDiff.normInf();
            double recScale = std::max({1.0, res.recoveredVector.normInf(), v0.normInf()});
            res.vectorRecoverySuccessful = (res.recoveryError <= tolerance * recScale);
        } else {
            res.vectorRecoverySuccessful = false;
            res.recoveryError = -1.0;
        }

        res.success = true;
        res.errorMessage = "";
        return res;
    }
};

} // namespace MathEngine
