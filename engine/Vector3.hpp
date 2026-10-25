#pragma once

#include "NumericalPolicy.hpp"
#include <cmath>
#include <string>
#include <sstream>
#include <iomanip>
#include <array>
#include <stdexcept>

namespace MathEngine {

/**
 * 3D Column Vector representation: v = [x, y, z]^T
 * Conforms to Sections 1, 2.3, 9.2, 9.6, and 11 of the Handbook.
 */
class Vector3 {
public:
    double x{0.0};
    double y{0.0};
    double z{0.0};

    constexpr Vector3() noexcept : x(0.0), y(0.0), z(0.0) {}
    constexpr Vector3(double x_, double y_, double z_) noexcept : x(x_), y(y_), z(z_) {}

    explicit Vector3(const std::array<double, 3>& arr) noexcept : x(arr[0]), y(arr[1]), z(arr[2]) {}

    double operator[](size_t index) const {
        if (index == 0) return x;
        if (index == 1) return y;
        if (index == 2) return z;
        throw std::out_of_range("Vector3 index out of range (must be 0, 1, or 2)");
    }

    double& operator[](size_t index) {
        if (index == 0) return x;
        if (index == 1) return y;
        if (index == 2) return z;
        throw std::out_of_range("Vector3 index out of range (must be 0, 1, or 2)");
    }

    bool isFinite() const noexcept {
        return NumericalPolicy::isFinite(x) &&
               NumericalPolicy::isFinite(y) &&
               NumericalPolicy::isFinite(z);
    }

    Vector3 operator+(const Vector3& o) const noexcept {
        return {x + o.x, y + o.y, z + o.z};
    }

    Vector3 operator-(const Vector3& o) const noexcept {
        return {x - o.x, y - o.y, z - o.z};
    }

    Vector3 operator-() const noexcept {
        return {-x, -y, -z};
    }

    Vector3 operator*(double scalar) const noexcept {
        return {x * scalar, y * scalar, z * scalar};
    }

    friend Vector3 operator*(double scalar, const Vector3& v) noexcept {
        return v * scalar;
    }

    Vector3 operator/(double scalar) const {
        if (scalar == 0.0) {
            throw std::runtime_error("Division by zero in Vector3 scalar division");
        }
        return {x / scalar, y / scalar, z / scalar};
    }

    double dot(const Vector3& o) const noexcept {
        return x * o.x + y * o.y + z * o.z;
    }

    Vector3 cross(const Vector3& o) const noexcept {
        return {
            y * o.z - z * o.y,
            z * o.x - x * o.z,
            x * o.y - y * o.x
        };
    }

    /**
     * Stable Euclidean norm ||v||_2 = sqrt(x^2 + y^2 + z^2)
     * Avoids intermediate overflow for very large values by scaling by max absolute component.
     * Handbook Section 9.6.
     */
    double norm2() const noexcept {
        double ax = std::abs(x);
        double ay = std::abs(y);
        double az = std::abs(z);
        double maxComp = std::max({ax, ay, az});
        if (maxComp == 0.0) return 0.0;
        double sx = ax / maxComp;
        double sy = ay / maxComp;
        double sz = az / maxComp;
        return maxComp * std::sqrt(sx * sx + sy * sy + sz * sz);
    }

    /**
     * Infinity norm ||v||_inf = max(|x|, |y|, |z|)
     * Handbook Section 9.6.
     */
    double normInf() const noexcept {
        return std::max({std::abs(x), std::abs(y), std::abs(z)});
    }

    /**
     * 1-norm ||v||_1 = |x| + |y| + |z|
     */
    double norm1() const noexcept {
        return std::abs(x) + std::abs(y) + std::abs(z);
    }

    /**
     * Scale-aware vector equality.
     * Handbook Section 9.2:
     * For every component i: |u_i - v_i| <= eps * max(1, |u_i|, |v_i|)
     */
    bool approxEqual(const Vector3& o, double eps = NumericalPolicy::DEFAULT_EPSILON) const noexcept {
        return NumericalPolicy::approxEqual(x, o.x, eps) &&
               NumericalPolicy::approxEqual(y, o.y, eps) &&
               NumericalPolicy::approxEqual(z, o.z, eps);
    }

    std::array<double, 3> toArray() const noexcept {
        return {x, y, z};
    }

    std::string toJSON() const {
        std::ostringstream ss;
        ss << "[" << std::setprecision(12) << x << "," << y << "," << z << "]";
        return ss.str();
    }
};

} // namespace MathEngine
