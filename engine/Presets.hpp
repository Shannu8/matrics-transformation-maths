#pragma once

#include "Matrix3x3.hpp"
#include <cmath>
#include <stdexcept>

namespace MathEngine {

enum class ShearType {
    X_BY_Y,
    X_BY_Z,
    Y_BY_X,
    Y_BY_Z,
    Z_BY_X,
    Z_BY_Y
};

enum class ReflectionPlane {
    XY,
    XZ,
    YZ
};

class Presets {
public:
    static constexpr double PI = 3.141592653589793238462643383279502884;

    static inline double degreesToRadians(double degrees) noexcept {
        return degrees * (PI / 180.0);
    }

    static inline double radiansToDegrees(double radians) noexcept {
        return radians * (180.0 / PI);
    }

    /**
     * Scaling Matrix S = diag(sx, sy, sz)
     * Handbook Section 6.1
     */
    static Matrix3x3 scale(double sx, double sy, double sz) {
        if (!NumericalPolicy::isFinite(sx) || !NumericalPolicy::isFinite(sy) || !NumericalPolicy::isFinite(sz)) {
            throw std::invalid_argument("Scale factors must be finite");
        }
        return Matrix3x3::diagonal(sx, sy, sz);
    }

    /**
     * Uniform Scaling Matrix S = s * I
     * Handbook Section 6.2
     */
    static Matrix3x3 uniformScale(double s) {
        return scale(s, s, s);
    }

    /**
     * Rotation about X-axis by angle in radians
     * Handbook Section 7.1
     */
    static Matrix3x3 rotateX(double radians) {
        if (!NumericalPolicy::isFinite(radians)) {
            throw std::invalid_argument("Rotation angle must be finite");
        }
        double c = std::cos(radians);
        double s = std::sin(radians);
        return Matrix3x3(
            1.0, 0.0, 0.0,
            0.0,   c,  -s,
            0.0,   s,   c
        );
    }

    static Matrix3x3 rotateXDegrees(double degrees) {
        return rotateX(degreesToRadians(degrees));
    }

    /**
     * Rotation about Y-axis by angle in radians
     * Handbook Section 7.2
     * Note: [cos, 0, sin; 0, 1, 0; -sin, 0, cos]
     */
    static Matrix3x3 rotateY(double radians) {
        if (!NumericalPolicy::isFinite(radians)) {
            throw std::invalid_argument("Rotation angle must be finite");
        }
        double c = std::cos(radians);
        double s = std::sin(radians);
        return Matrix3x3(
             c, 0.0,  s,
            0.0, 1.0, 0.0,
            -s, 0.0,  c
        );
    }

    static Matrix3x3 rotateYDegrees(double degrees) {
        return rotateY(degreesToRadians(degrees));
    }

    /**
     * Rotation about Z-axis by angle in radians
     * Handbook Section 7.3
     */
    static Matrix3x3 rotateZ(double radians) {
        if (!NumericalPolicy::isFinite(radians)) {
            throw std::invalid_argument("Rotation angle must be finite");
        }
        double c = std::cos(radians);
        double s = std::sin(radians);
        return Matrix3x3(
             c,  -s, 0.0,
             s,   c, 0.0,
            0.0, 0.0, 1.0
        );
    }

    static Matrix3x3 rotateZDegrees(double degrees) {
        return rotateZ(degreesToRadians(degrees));
    }

    /**
     * Reflection across coordinate plane
     * Handbook Section 8.1
     */
    static Matrix3x3 reflection(ReflectionPlane plane) {
        switch (plane) {
            case ReflectionPlane::XY: // z -> -z
                return Matrix3x3::diagonal(1.0, 1.0, -1.0);
            case ReflectionPlane::XZ: // y -> -y
                return Matrix3x3::diagonal(1.0, -1.0, 1.0);
            case ReflectionPlane::YZ: // x -> -x
                return Matrix3x3::diagonal(-1.0, 1.0, 1.0);
        }
        return Matrix3x3::identity();
    }

    /**
     * Individual directional shear
     * Handbook Section 8.3
     */
    static Matrix3x3 shear(ShearType type, double k) {
        if (!NumericalPolicy::isFinite(k)) {
            throw std::invalid_argument("Shear factor must be finite");
        }
        switch (type) {
            case ShearType::X_BY_Y: // x' = x + ky
                return Matrix3x3(
                    1.0,   k, 0.0,
                    0.0, 1.0, 0.0,
                    0.0, 0.0, 1.0
                );
            case ShearType::X_BY_Z: // x' = x + kz
                return Matrix3x3(
                    1.0, 0.0,   k,
                    0.0, 1.0, 0.0,
                    0.0, 0.0, 1.0
                );
            case ShearType::Y_BY_X: // y' = y + kx
                return Matrix3x3(
                    1.0, 0.0, 0.0,
                      k, 1.0, 0.0,
                    0.0, 0.0, 1.0
                );
            case ShearType::Y_BY_Z: // y' = y + kz
                return Matrix3x3(
                    1.0, 0.0, 0.0,
                    0.0, 1.0,   k,
                    0.0, 0.0, 1.0
                );
            case ShearType::Z_BY_X: // z' = z + kx
                return Matrix3x3(
                    1.0, 0.0, 0.0,
                    0.0, 1.0, 0.0,
                      k, 0.0, 1.0
                );
            case ShearType::Z_BY_Y: // z' = z + ky
                return Matrix3x3(
                    1.0, 0.0, 0.0,
                    0.0, 1.0, 0.0,
                    0.0,   k, 1.0
                );
        }
        return Matrix3x3::identity();
    }

    /**
     * General parameterized shear
     * Handbook Section 8.2
     */
    static Matrix3x3 generalShear(double h12, double h13,
                                  double h21, double h23,
                                  double h31, double h32) {
        if (!NumericalPolicy::isFinite(h12) || !NumericalPolicy::isFinite(h13) ||
            !NumericalPolicy::isFinite(h21) || !NumericalPolicy::isFinite(h23) ||
            !NumericalPolicy::isFinite(h31) || !NumericalPolicy::isFinite(h32)) {
            throw std::invalid_argument("Shear parameters must be finite");
        }
        return Matrix3x3(
            1.0, h12, h13,
            h21, 1.0, h23,
            h31, h32, 1.0
        );
    }
};

} // namespace MathEngine
