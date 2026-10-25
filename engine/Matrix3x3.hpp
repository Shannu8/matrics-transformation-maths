#pragma once

#include "NumericalPolicy.hpp"
#include "Vector3.hpp"
#include <array>
#include <cmath>
#include <string>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <algorithm>

namespace MathEngine {

/**
 * 3x3 Matrix with Row-Major internal storage.
 * A = [[a, b, c],
 *      [d, e, f],
 *      [g, h, i]]
 * Flat array: [a, b, c, d, e, f, g, h, i]
 * Conforms to Handbook Sections 1, 2, 3, 9.3, 10, 11.
 */
class Matrix3x3 {
public:
    std::array<double, 9> m{
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0
    };

    constexpr Matrix3x3() noexcept = default;

    constexpr Matrix3x3(double m00, double m01, double m02,
                        double m10, double m11, double m12,
                        double m20, double m21, double m22) noexcept
        : m{m00, m01, m02,
            m10, m11, m12,
            m20, m21, m22} {}

    explicit constexpr Matrix3x3(const std::array<double, 9>& elements) noexcept
        : m(elements) {}

    static constexpr Matrix3x3 identity() noexcept {
        return Matrix3x3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
        );
    }

    static constexpr Matrix3x3 zero() noexcept {
        return Matrix3x3(
            0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.0, 0.0, 0.0
        );
    }

    static constexpr Matrix3x3 diagonal(double d0, double d1, double d2) noexcept {
        return Matrix3x3(
            d0,  0.0, 0.0,
            0.0, d1,  0.0,
            0.0, 0.0, d2
        );
    }

    double get(size_t row, size_t col) const {
        if (row >= 3 || col >= 3) {
            throw std::out_of_range("Matrix3x3::get indices out of range (row and col must be 0, 1, or 2)");
        }
        return m[row * 3 + col];
    }

    void set(size_t row, size_t col, double val) {
        if (row >= 3 || col >= 3) {
            throw std::out_of_range("Matrix3x3::set indices out of range (row and col must be 0, 1, or 2)");
        }
        m[row * 3 + col] = val;
    }

    double operator()(size_t row, size_t col) const {
        return m[row * 3 + col];
    }

    double& operator()(size_t row, size_t col) {
        return m[row * 3 + col];
    }

    double operator[](size_t flatIndex) const {
        if (flatIndex >= 9) {
            throw std::out_of_range("Matrix3x3 flat index out of range (must be 0..8)");
        }
        return m[flatIndex];
    }

    double& operator[](size_t flatIndex) {
        if (flatIndex >= 9) {
            throw std::out_of_range("Matrix3x3 flat index out of range (must be 0..8)");
        }
        return m[flatIndex];
    }

    const std::array<double, 9>& data() const noexcept {
        return m;
    }

    bool isFinite() const noexcept {
        for (double val : m) {
            if (!NumericalPolicy::isFinite(val)) return false;
        }
        return true;
    }

    // Handbook 2.1: Matrix addition
    Matrix3x3 operator+(const Matrix3x3& o) const noexcept {
        Matrix3x3 res;
        for (size_t i = 0; i < 9; ++i) {
            res.m[i] = m[i] + o.m[i];
        }
        return res;
    }

    // Matrix subtraction
    Matrix3x3 operator-(const Matrix3x3& o) const noexcept {
        Matrix3x3 res;
        for (size_t i = 0; i < 9; ++i) {
            res.m[i] = m[i] - o.m[i];
        }
        return res;
    }

    // Handbook 2.1: Scalar multiplication
    Matrix3x3 operator*(double scalar) const noexcept {
        Matrix3x3 res;
        for (size_t i = 0; i < 9; ++i) {
            res.m[i] = m[i] * scalar;
        }
        return res;
    }

    friend Matrix3x3 operator*(double scalar, const Matrix3x3& mat) noexcept {
        return mat * scalar;
    }

    // Handbook 2.2: Matrix multiplication C = A * B
    // c_ij = sum_{k=1}^3 a_ik * b_kj
    Matrix3x3 operator*(const Matrix3x3& o) const noexcept {
        Matrix3x3 res;
        for (size_t r = 0; r < 3; ++r) {
            for (size_t c = 0; c < 3; ++c) {
                res.m[r * 3 + c] =
                    m[r * 3 + 0] * o.m[0 * 3 + c] +
                    m[r * 3 + 1] * o.m[1 * 3 + c] +
                    m[r * 3 + 2] * o.m[2 * 3 + c];
            }
        }
        return res;
    }

    // Handbook 2.3: Matrix-vector multiplication v' = A * v
    Vector3 operator*(const Vector3& v) const noexcept {
        return Vector3(
            m[0] * v.x + m[1] * v.y + m[2] * v.z,
            m[3] * v.x + m[4] * v.y + m[5] * v.z,
            m[6] * v.x + m[7] * v.y + m[8] * v.z
        );
    }

    // Handbook 2.4: Transpose A^T
    Matrix3x3 transpose() const noexcept {
        return Matrix3x3(
            m[0], m[3], m[6],
            m[1], m[4], m[7],
            m[2], m[5], m[8]
        );
    }

    // Handbook 2.5: Trace tr(A) = a + e + i
    double trace() const noexcept {
        return m[0] + m[4] + m[8];
    }

    // Handbook 3.1: Determinant
    // det(A) = a(ei - fh) - b(di - fg) + c(dh - eg)
    double determinant() const noexcept {
        const double a = m[0], b = m[1], c = m[2];
        const double d = m[3], e = m[4], f = m[5];
        const double g = m[6], h = m[7], i = m[8];

        return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    }

    // Handbook 3.2: 2x2 Minor Mij
    // Determinant of 2x2 matrix formed by deleting row r and column c
    double minor(size_t r, size_t c) const {
        if (r >= 3 || c >= 3) {
            throw std::out_of_range("Minor index out of range");
        }
        double sub[4];
        size_t idx = 0;
        for (size_t i = 0; i < 3; ++i) {
            if (i == r) continue;
            for (size_t j = 0; j < 3; ++j) {
                if (j == c) continue;
                sub[idx++] = m[i * 3 + j];
            }
        }
        // det([[p, q], [r, s]]) = ps - qr
        return sub[0] * sub[3] - sub[1] * sub[2];
    }

    // Handbook 3.3: Cofactor Kij = (-1)^(i+j) * Mij
    double cofactor(size_t r, size_t c) const {
        double mVal = minor(r, c);
        return ((r + c) % 2 == 1) ? -mVal : mVal;
    }

    // Cofactor matrix
    Matrix3x3 cofactorMatrix() const {
        Matrix3x3 res;
        for (size_t r = 0; r < 3; ++r) {
            for (size_t c = 0; c < 3; ++c) {
                res.m[r * 3 + c] = cofactor(r, c);
            }
        }
        return res;
    }

    // Handbook 3.4: Adjugate adj(A) = cofactor(A)^T
    Matrix3x3 adjugate() const {
        return cofactorMatrix().transpose();
    }

    /**
     * Infinity-norm ||A||_inf = max_i sum_j |A_ij| (maximum absolute row sum)
     */
    double normInf() const noexcept {
        double r0 = std::abs(m[0]) + std::abs(m[1]) + std::abs(m[2]);
        double r1 = std::abs(m[3]) + std::abs(m[4]) + std::abs(m[5]);
        double r2 = std::abs(m[6]) + std::abs(m[7]) + std::abs(m[8]);
        return std::max({r0, r1, r2});
    }

    /**
     * 1-norm ||A||_1 = max_j sum_i |A_ij| (maximum absolute column sum)
     */
    double norm1() const noexcept {
        double c0 = std::abs(m[0]) + std::abs(m[3]) + std::abs(m[6]);
        double c1 = std::abs(m[1]) + std::abs(m[4]) + std::abs(m[7]);
        double c2 = std::abs(m[2]) + std::abs(m[5]) + std::abs(m[8]);
        return std::max({c0, c1, c2});
    }

    /**
     * Stable Frobenius norm ||A||_F = sqrt(sum A_ij^2)
     */
    double normFrobenius() const noexcept {
        double maxVal = 0.0;
        for (double val : m) {
            maxVal = std::max(maxVal, std::abs(val));
        }
        if (maxVal == 0.0) return 0.0;
        double sumSq = 0.0;
        for (double val : m) {
            double s = val / maxVal;
            sumSq += s * s;
        }
        return maxVal * std::sqrt(sumSq);
    }

    /**
     * Scale-aware matrix equality.
     * Handbook Section 9.3:
     * For every entry i, j: |A_ij - B_ij| <= eps * max(1, |A_ij|, |B_ij|)
     */
    bool approxEqual(const Matrix3x3& o, double eps = NumericalPolicy::DEFAULT_EPSILON) const noexcept {
        for (size_t i = 0; i < 9; ++i) {
            if (!NumericalPolicy::approxEqual(m[i], o.m[i], eps)) {
                return false;
            }
        }
        return true;
    }

    std::string toJSON() const {
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < 9; ++i) {
            ss << std::setprecision(12) << m[i];
            if (i < 8) ss << ",";
        }
        ss << "]";
        return ss.str();
    }
};

} // namespace MathEngine
