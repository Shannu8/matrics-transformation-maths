#pragma once

#include <cmath>
#include <algorithm>
#include <string>

namespace MathEngine {

/**
 * Numerical tolerances and scale-aware comparison policy.
 * Adheres to Section 9 & 10 of the Mathematical Formula Handbook:
 * |a - b| <= eps * max(1.0, |a|, |b|)
 */
struct NumericalPolicy {
    // Default relative tolerance for double-precision floating point comparisons
    static constexpr double DEFAULT_EPSILON = 1e-9;
    // Tight tolerance for algebraic identities
    static constexpr double TIGHT_EPSILON = 1e-12;
    // Pivot threshold relative to matrix norm for numerical singularity detection
    static constexpr double PIVOT_TOLERANCE = 1e-12;
    // Condition number threshold beyond which a matrix is flagged as ill-conditioned
    static constexpr double ILL_CONDITIONED_THRESHOLD = 1e8;
    // Severe ill-conditioning threshold
    static constexpr double SEVERELY_ILL_CONDITIONED_THRESHOLD = 1e12;

    static inline bool isFinite(double v) noexcept {
        return std::isfinite(v);
    }

    static inline bool approxEqual(double a, double b, double eps = DEFAULT_EPSILON) noexcept {
        if (!std::isfinite(a) || !std::isfinite(b)) return false;
        double diff = std::abs(a - b);
        double scale = std::max({1.0, std::abs(a), std::abs(b)});
        return diff <= eps * scale;
    }

    static inline bool isZero(double a, double eps = DEFAULT_EPSILON) noexcept {
        if (!std::isfinite(a)) return false;
        return std::abs(a) <= eps;
    }
};

} // namespace MathEngine
