#pragma once

#include "Matrix3x3.hpp"
#include "NumericalPolicy.hpp"
#include <string>
#include <cmath>
#include <algorithm>
#include <sstream>

namespace MathEngine {

enum class InversionStatus {
    OK,
    ILL_CONDITIONED_WARNING,
    SINGULAR_EXACT,
    SINGULAR_NUMERICAL,
    NON_FINITE_INPUT,
    OVERFLOW_OCCURRED
};

inline const char* inversionStatusToString(InversionStatus s) {
    switch (s) {
        case InversionStatus::OK: return "OK";
        case InversionStatus::ILL_CONDITIONED_WARNING: return "ILL_CONDITIONED_WARNING";
        case InversionStatus::SINGULAR_EXACT: return "SINGULAR_EXACT";
        case InversionStatus::SINGULAR_NUMERICAL: return "SINGULAR_NUMERICAL";
        case InversionStatus::NON_FINITE_INPUT: return "NON_FINITE_INPUT";
        case InversionStatus::OVERFLOW_OCCURRED: return "OVERFLOW_OCCURRED";
        default: return "UNKNOWN";
    }
}

struct InversionResult {
    bool success{false};
    Matrix3x3 inverse;
    double determinant{0.0};
    double normA{0.0};
    double normAInv{0.0};
    double conditionNumber{0.0};
    Matrix3x3 residualE1; // I - A * A^-1
    Matrix3x3 residualE2; // I - A^-1 * A
    double residualE1Norm{0.0};
    double residualE2Norm{0.0};
    double relativeResidual{0.0};
    InversionStatus status{InversionStatus::SINGULAR_EXACT};
    std::string message;

    std::string toJSON() const {
        std::ostringstream ss;
        ss << "{"
           << "\"success\":" << (success ? "true" : "false") << ","
           << "\"status\":\"" << inversionStatusToString(status) << "\","
           << "\"message\":\"" << message << "\","
           << "\"determinant\":" << std::setprecision(12) << determinant << ","
           << "\"normA\":" << normA << ","
           << "\"normAInv\":" << normAInv << ","
           << "\"conditionNumber\":" << conditionNumber << ","
           << "\"residualE1Norm\":" << residualE1Norm << ","
           << "\"residualE2Norm\":" << residualE2Norm << ","
           << "\"relativeResidual\":" << relativeResidual << ","
           << "\"inverse\":" << (success ? inverse.toJSON() : "null") << ","
           << "\"residualE1\":" << (success ? residualE1.toJSON() : "null") << ","
           << "\"residualE2\":" << (success ? residualE2.toJSON() : "null")
           << "}";
        return ss.str();
    }
};

class InverseSolver {
public:
    /**
     * Invert 3x3 matrix using Gauss-Jordan elimination with partial pivoting.
     * Evaluates scale-aware pivot threshold, residual matrices E1 = I - A*A^-1, E2 = I - A^-1*A,
     * and condition number kappa = ||A||_inf * ||A^-1||_inf.
     * Conforms to Handbook Sections 4, 9.5, 10.1, 10.2, 10.3, 10.4.
     */
    static InversionResult invertGaussian(const Matrix3x3& A, double pivotTol = NumericalPolicy::PIVOT_TOLERANCE) {
        InversionResult res;
        res.determinant = A.determinant();

        // 1. Check finite inputs
        if (!A.isFinite()) {
            res.success = false;
            res.status = InversionStatus::NON_FINITE_INPUT;
            res.message = "Matrix contains non-finite entries (NaN or Infinity).";
            return res;
        }

        res.normA = A.normInf();
        if (res.normA == 0.0) {
            res.success = false;
            res.status = InversionStatus::SINGULAR_EXACT;
            res.message = "Matrix is the zero matrix and is exactly singular.";
            return res;
        }

        // Exact zero determinant check
        if (res.determinant == 0.0) {
            res.success = false;
            res.status = InversionStatus::SINGULAR_EXACT;
            res.message = "Determinant is exactly zero; matrix is mathematically singular.";
            return res;
        }

        // Augmented matrix [A | I]
        double aug[3][6];
        for (size_t r = 0; r < 3; ++r) {
            for (size_t c = 0; c < 3; ++c) {
                aug[r][c] = A(r, c);
                aug[r][c + 3] = (r == c) ? 1.0 : 0.0;
            }
        }

        const double absPivotThreshold = pivotTol * res.normA;

        // Perform Gauss-Jordan elimination with partial pivoting
        for (size_t col = 0; col < 3; ++col) {
            // Find pivot in column col from row col to 2
            size_t pivotRow = col;
            double maxPivot = std::abs(aug[col][col]);
            for (size_t r = col + 1; r < 3; ++r) {
                double val = std::abs(aug[r][col]);
                if (val > maxPivot) {
                    maxPivot = val;
                    pivotRow = r;
                }
            }

            // Check pivot against scale-aware threshold (Handbook Section 10.4)
            if (maxPivot <= absPivotThreshold) {
                res.success = false;
                res.status = InversionStatus::SINGULAR_NUMERICAL;
                std::ostringstream msg;
                msg << "Pivot in column " << col << " (" << maxPivot 
                    << ") falls below scale-aware threshold (" << absPivotThreshold 
                    << "). Matrix is numerically singular.";
                res.message = msg.str();
                return res;
            }

            // Swap rows if needed
            if (pivotRow != col) {
                for (size_t c = 0; c < 6; ++c) {
                    std::swap(aug[col][c], aug[pivotRow][c]);
                }
            }

            // Normalize pivot row
            double pivotVal = aug[col][col];
            for (size_t c = 0; c < 6; ++c) {
                aug[col][c] /= pivotVal;
            }

            // Eliminate column entries in other rows
            for (size_t r = 0; r < 3; ++r) {
                if (r != col) {
                    double factor = aug[r][col];
                    if (factor != 0.0) {
                        for (size_t c = 0; c < 6; ++c) {
                            aug[r][c] -= factor * aug[col][c];
                        }
                    }
                }
            }
        }

        // Extract inverse matrix
        Matrix3x3 inv;
        for (size_t r = 0; r < 3; ++r) {
            for (size_t c = 0; c < 3; ++c) {
                inv(r, c) = aug[r][c + 3];
            }
        }

        // Verify that computed inverse is finite
        if (!inv.isFinite()) {
            res.success = false;
            res.status = InversionStatus::OVERFLOW_OCCURRED;
            res.message = "Computed inverse contains non-finite entries due to numeric overflow.";
            return res;
        }

        res.inverse = inv;
        res.normAInv = inv.normInf();

        // Condition number: kappa(A) = ||A||_inf * ||A^-1||_inf (Handbook Section 10.2)
        res.conditionNumber = res.normA * res.normAInv;

        // Residual matrices (Handbook Section 9.5)
        // E1 = I - A * A^-1
        // E2 = I - A^-1 * A
        const Matrix3x3 I = Matrix3x3::identity();
        res.residualE1 = I - (A * inv);
        res.residualE2 = I - (inv * A);
        res.residualE1Norm = res.residualE1.normInf();
        res.residualE2Norm = res.residualE2.normInf();

        // Relative residual r = ||I - A * A^-1||_inf / (||A||_inf * ||A^-1||_inf) (Handbook 10.3)
        if (res.conditionNumber > 0.0) {
            res.relativeResidual = res.residualE1Norm / res.conditionNumber;
        } else {
            res.relativeResidual = 0.0;
        }

        // Assess conditioning
        if (res.conditionNumber > NumericalPolicy::ILL_CONDITIONED_THRESHOLD) {
            res.success = true; // Technically inverted, but caution required
            res.status = InversionStatus::ILL_CONDITIONED_WARNING;
            std::ostringstream msg;
            msg << "Matrix is ill-conditioned (condition number kappa = " 
                << std::scientific << res.conditionNumber 
                << " > " << NumericalPolicy::ILL_CONDITIONED_THRESHOLD 
                << "). Inversion may suffer from significant loss of numerical precision.";
            res.message = msg.str();
        } else {
            res.success = true;
            res.status = InversionStatus::OK;
            res.message = "Matrix successfully inverted and verified well-conditioned.";
        }

        return res;
    }

    /**
     * Mathematical adjugate inverse: A^-1 = adj(A) / det(A)
     * Useful for educational display of cofactors and comparison against Gauss-Jordan.
     * Handbook Section 4.1.
     */
    static InversionResult invertAdjugate(const Matrix3x3& A) {
        InversionResult res;
        res.determinant = A.determinant();

        if (!A.isFinite()) {
            res.success = false;
            res.status = InversionStatus::NON_FINITE_INPUT;
            res.message = "Matrix contains non-finite values.";
            return res;
        }

        res.normA = A.normInf();

        if (res.determinant == 0.0) {
            res.success = false;
            res.status = InversionStatus::SINGULAR_EXACT;
            res.message = "Determinant is exactly zero; cannot invert using adjugate formula.";
            return res;
        }

        Matrix3x3 adj = A.adjugate();
        double invDet = 1.0 / res.determinant;

        if (!NumericalPolicy::isFinite(invDet)) {
            res.success = false;
            res.status = InversionStatus::OVERFLOW_OCCURRED;
            res.message = "Reciprocal of determinant is non-finite (underflow/overflow).";
            return res;
        }

        Matrix3x3 inv = adj * invDet;
        if (!inv.isFinite()) {
            res.success = false;
            res.status = InversionStatus::OVERFLOW_OCCURRED;
            res.message = "Adjugate inversion produced non-finite values.";
            return res;
        }

        res.inverse = inv;
        res.normAInv = inv.normInf();
        res.conditionNumber = res.normA * res.normAInv;

        const Matrix3x3 I = Matrix3x3::identity();
        res.residualE1 = I - (A * inv);
        res.residualE2 = I - (inv * A);
        res.residualE1Norm = res.residualE1.normInf();
        res.residualE2Norm = res.residualE2.normInf();
        res.relativeResidual = (res.conditionNumber > 0.0) ? (res.residualE1Norm / res.conditionNumber) : 0.0;

        if (res.conditionNumber > NumericalPolicy::ILL_CONDITIONED_THRESHOLD) {
            res.success = true;
            res.status = InversionStatus::ILL_CONDITIONED_WARNING;
            res.message = "Matrix is ill-conditioned under adjugate inversion.";
        } else {
            res.success = true;
            res.status = InversionStatus::OK;
            res.message = "Matrix inverted via adjugate method.";
        }

        return res;
    }
};

} // namespace MathEngine
