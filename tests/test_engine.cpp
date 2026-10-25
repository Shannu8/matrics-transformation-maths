#include "../engine/NumericalPolicy.hpp"
#include "../engine/Vector3.hpp"
#include "../engine/Matrix3x3.hpp"
#include "../engine/InverseSolver.hpp"
#include "../engine/Presets.hpp"
#include "../engine/TransformationPipeline.hpp"

#include <iostream>
#include <cassert>
#include <cmath>
#include <string>
#include <vector>

using namespace MathEngine;

static int g_testsPassed = 0;
static int g_testsFailed = 0;

#define TEST_ASSERT(cond, msg) \
    do { \
        if (!(cond)) { \
            std::cerr << "[-] FAILED: " << msg << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            g_testsFailed++; \
        } else { \
            g_testsPassed++; \
        } \
    } while(0)

void testBasicVectorOperations() {
    std::cout << "[+] Running Vector Operations Tests...\n";

    Vector3 v(1.0, 2.0, 3.0);
    TEST_ASSERT(v.x == 1.0 && v.y == 2.0 && v.z == 3.0, "Vector components match");
    TEST_ASSERT(v.isFinite(), "Vector is finite");

    Vector3 v2(4.0, 5.0, 6.0);
    Vector3 sum = v + v2;
    TEST_ASSERT(sum.x == 5.0 && sum.y == 7.0 && sum.z == 9.0, "Vector addition");

    Vector3 diff = v2 - v;
    TEST_ASSERT(diff.x == 3.0 && diff.y == 3.0 && diff.z == 3.0, "Vector subtraction");

    Vector3 scaled = v * 2.0;
    TEST_ASSERT(scaled.x == 2.0 && scaled.y == 4.0 && scaled.z == 6.0, "Vector scalar multiplication");

    double dotProd = v.dot(v2); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    TEST_ASSERT(dotProd == 32.0, "Vector dot product");

    Vector3 crossProd = v.cross(v2); // (2*6 - 3*5, 3*4 - 1*6, 1*5 - 2*4) = (-3, 6, -3)
    TEST_ASSERT(crossProd.x == -3.0 && crossProd.y == 6.0 && crossProd.z == -3.0, "Vector cross product");

    // Norms
    Vector3 vNorm(3.0, 4.0, 0.0);
    TEST_ASSERT(NumericalPolicy::approxEqual(vNorm.norm2(), 5.0), "Vector 2-norm");
    TEST_ASSERT(vNorm.normInf() == 4.0, "Vector inf-norm");
    TEST_ASSERT(vNorm.norm1() == 7.0, "Vector 1-norm");

    // Scale-aware equality
    Vector3 vClose(1.0 + 1e-10, 2.0 - 1e-10, 3.0);
    TEST_ASSERT(v.approxEqual(vClose, 1e-8), "Scale-aware vector equality holds for small perturbation");
}

void testMatrixBasicOperations() {
    std::cout << "[+] Running Matrix Basic Operations Tests...\n";

    Matrix3x3 I = Matrix3x3::identity();
    Matrix3x3 Z = Matrix3x3::zero();

    TEST_ASSERT(I.trace() == 3.0, "Identity trace is 3");
    TEST_ASSERT(Z.trace() == 0.0, "Zero matrix trace is 0");
    TEST_ASSERT(I.determinant() == 1.0, "Identity determinant is 1");
    TEST_ASSERT(Z.determinant() == 0.0, "Zero matrix determinant is 0");

    Vector3 v(2.0, -3.0, 5.0);
    Vector3 Iv = I * v;
    TEST_ASSERT(Iv.approxEqual(v), "Handbook 12.1: I * v = v");

    Matrix3x3 A(
        1.0, 2.0, 3.0,
        0.0, 1.0, 4.0,
        5.0, 6.0, 0.0
    );

    Matrix3x3 AI = A * I;
    Matrix3x3 IA = I * A;
    TEST_ASSERT(AI.approxEqual(A), "Handbook 12.1: A * I = A");
    TEST_ASSERT(IA.approxEqual(A), "Handbook 12.1: I * A = A");

    // Transpose property: (AB)^T = B^T * A^T
    Matrix3x3 B(
        2.0, 0.0, -1.0,
        1.0, 3.0,  2.0,
        0.0, -2.0, 1.0
    );
    Matrix3x3 AB_T = (A * B).transpose();
    Matrix3x3 BT_AT = B.transpose() * A.transpose();
    TEST_ASSERT(AB_T.approxEqual(BT_AT), "Transpose property (AB)^T = B^T * A^T");
}

void testDeterminantCofactorsAdjugate() {
    std::cout << "[+] Running Determinant, Cofactors, and Adjugate Tests...\n";

    Matrix3x3 A(
        1.0, 2.0, 3.0,
        0.0, 4.0, 5.0,
        1.0, 0.0, 6.0
    );

    // det(A) = 1*(24 - 0) - 2*(0 - 5) + 3*(0 - 4) = 24 + 10 - 12 = 22
    double det = A.determinant();
    TEST_ASSERT(NumericalPolicy::approxEqual(det, 22.0), "Determinant matches exact analytical value");

    // Adjugate property: A * adj(A) = det(A) * I (Handbook Section 3.4)
    Matrix3x3 adjA = A.adjugate();
    Matrix3x3 prod1 = A * adjA;
    Matrix3x3 prod2 = adjA * A;
    Matrix3x3 detI = Matrix3x3::identity() * det;

    TEST_ASSERT(prod1.approxEqual(detI), "Handbook 3.4: A * adj(A) = det(A)*I");
    TEST_ASSERT(prod2.approxEqual(detI), "Handbook 3.4: adj(A) * A = det(A)*I");
}

void testHandbookReferenceExamples() {
    std::cout << "[+] Running Handbook Reference Examples (Section 12)...\n";

    // 12.2: Scaling followed by reflection
    // T1 = diag(2,1,1); T2 = diag(1,1,-1); C = T2*T1 = diag(2,1,-1)
    // v = [1,2,3]^T: T1*v = [2,2,3]^T; C*v = [2,2,-3]^T
    Matrix3x3 T1 = Matrix3x3::diagonal(2.0, 1.0, 1.0);
    Matrix3x3 T2 = Matrix3x3::diagonal(1.0, 1.0, -1.0);
    Matrix3x3 C = T2 * T1;
    Matrix3x3 expectedC = Matrix3x3::diagonal(2.0, 1.0, -1.0);
    TEST_ASSERT(C.approxEqual(expectedC), "Handbook 12.2: Composed matrix C = T2 * T1");

    Vector3 v(1.0, 2.0, 3.0);
    Vector3 v1 = T1 * v;
    Vector3 expectedV1(2.0, 2.0, 3.0);
    TEST_ASSERT(v1.approxEqual(expectedV1), "Handbook 12.2: Intermediate vector T1 * v");

    Vector3 Cv = C * v;
    Vector3 expectedCv(2.0, 2.0, -3.0);
    TEST_ASSERT(Cv.approxEqual(expectedCv), "Handbook 12.2: Composed vector C * v = [2, 2, -3]^T");

    // 12.3: Non-commuting example
    // R = [[0,-1,0],[1,0,0],[0,0,1]]; S = diag(2,1,1)
    Matrix3x3 R(
        0.0, -1.0, 0.0,
        1.0,  0.0, 0.0,
        0.0,  0.0, 1.0
    );
    Matrix3x3 S = Matrix3x3::diagonal(2.0, 1.0, 1.0);
    Matrix3x3 RS = R * S;
    Matrix3x3 SR = S * R;
    TEST_ASSERT(!RS.approxEqual(SR), "Handbook 12.3: Matrix multiplication is non-commutative (RS != SR)");

    Matrix3x3 expectedRS(
        0.0, -1.0, 0.0,
        2.0,  0.0, 0.0,
        0.0,  0.0, 1.0
    );
    Matrix3x3 expectedSR(
        0.0, -2.0, 0.0,
        1.0,  0.0, 0.0,
        0.0,  0.0, 1.0
    );
    TEST_ASSERT(RS.approxEqual(expectedRS), "Handbook 12.3: RS matches exact values");
    TEST_ASSERT(SR.approxEqual(expectedSR), "Handbook 12.3: SR matches exact values");

    // 12.4: Inverse of scaling
    // S = diag(2,3,4); S^-1 = diag(1/2, 1/3, 1/4)
    Matrix3x3 S_scale = Matrix3x3::diagonal(2.0, 3.0, 4.0);
    InversionResult invRes = InverseSolver::invertGaussian(S_scale);
    TEST_ASSERT(invRes.success, "Scaling matrix is invertible");
    Matrix3x3 expectedSInv = Matrix3x3::diagonal(0.5, 1.0 / 3.0, 0.25);
    TEST_ASSERT(invRes.inverse.approxEqual(expectedSInv), "Handbook 12.4: S^-1 = diag(1/2, 1/3, 1/4)");

    Vector3 sv = S_scale * v;
    Vector3 recoveredV = invRes.inverse * sv;
    TEST_ASSERT(recoveredV.approxEqual(v), "Handbook 12.4: S^-1 * (S * v) = v");

    // 12.5: Rotation inverse
    // Rz(theta)^-1 = Rz(-theta) = Rz(theta)^T
    double theta = 45.0 * (Presets::PI / 180.0);
    Matrix3x3 Rz = Presets::rotateZ(theta);
    Matrix3x3 Rz_neg = Presets::rotateZ(-theta);
    Matrix3x3 Rz_T = Rz.transpose();
    InversionResult rzInvRes = InverseSolver::invertGaussian(Rz);

    TEST_ASSERT(rzInvRes.success, "Rotation matrix is invertible");
    TEST_ASSERT(Rz_neg.approxEqual(Rz_T), "Handbook 12.5: Rz(-theta) = Rz(theta)^T");
    TEST_ASSERT(rzInvRes.inverse.approxEqual(Rz_T), "Handbook 12.5: Rz^-1 = Rz^T");
    TEST_ASSERT(rzInvRes.inverse.approxEqual(Rz_neg), "Handbook 12.5: Rz^-1 = Rz(-theta)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz.determinant(), 1.0), "Rotation determinant is +1");
}

void testInversionAndResiduals() {
    std::cout << "[+] Running Inversion, Residuals, and Conditioning Tests...\n";

    // General invertible matrix
    Matrix3x3 A(
        2.0, -1.0, 0.0,
       -1.0,  2.0, -1.0,
        0.0, -1.0, 2.0
    );

    InversionResult resG = InverseSolver::invertGaussian(A);
    TEST_ASSERT(resG.success, "Tridiagonal matrix inverted successfully");
    TEST_ASSERT(resG.status == InversionStatus::OK, "Status is OK");

    // Check inverse residuals: E1 = I - A*A^-1, E2 = I - A^-1*A (Handbook 9.5)
    TEST_ASSERT(resG.residualE1Norm < 1e-12, "E1 residual norm is small");
    TEST_ASSERT(resG.residualE2Norm < 1e-12, "E2 residual norm is small");

    // Compare with adjugate inversion
    InversionResult resAdj = InverseSolver::invertAdjugate(A);
    TEST_ASSERT(resAdj.success, "Adjugate inversion succeeded");
    TEST_ASSERT(resG.inverse.approxEqual(resAdj.inverse), "Gauss-Jordan matches Adjugate inverse");

    // Singular matrix: projection onto XY plane (z = 0)
    Matrix3x3 singularProj = Matrix3x3::diagonal(1.0, 1.0, 0.0);
    InversionResult resSing = InverseSolver::invertGaussian(singularProj);
    TEST_ASSERT(!resSing.success, "Singular projection matrix correctly rejected");
    TEST_ASSERT(resSing.status == InversionStatus::SINGULAR_EXACT ||
                resSing.status == InversionStatus::SINGULAR_NUMERICAL, "Singular status reported");

    // Collinear rows: Row 2 = 2 * Row 1
    Matrix3x3 collinearMat(
        1.0, 2.0, 3.0,
        2.0, 4.0, 6.0,
        0.0, 1.0, 1.0
    );
    InversionResult resCollinear = InverseSolver::invertGaussian(collinearMat);
    TEST_ASSERT(!resCollinear.success, "Collinear row matrix correctly detected as singular");

    // Ill-conditioned matrix: condition number kappa > 1e8
    Matrix3x3 illCond(
        1.0, 1.0, 1.0,
        1.0, 1.0 + 1e-9, 1.0,
        1.0, 1.0, 1.0 + 1e-9
    );
    InversionResult resIll = InverseSolver::invertGaussian(illCond);
    if (resIll.success) {
        TEST_ASSERT(resIll.status == InversionStatus::ILL_CONDITIONED_WARNING, 
                    "Ill-conditioned matrix triggers condition warning");
        TEST_ASSERT(resIll.conditionNumber > NumericalPolicy::ILL_CONDITIONED_THRESHOLD, 
                    "Condition number correctly exceeds threshold");
    }
}

void testPresets() {
    std::cout << "[+] Running Transformation Presets Tests...\n";

    // Reflections (Handbook Section 8.1)
    Matrix3x3 Fxy = Presets::reflection(ReflectionPlane::XY);
    Matrix3x3 Fxz = Presets::reflection(ReflectionPlane::XZ);
    Matrix3x3 Fyz = Presets::reflection(ReflectionPlane::YZ);

    TEST_ASSERT((Fxy * Fxy).approxEqual(Matrix3x3::identity()), "Handbook 8.1: Fxy^2 = I");
    TEST_ASSERT((Fxz * Fxz).approxEqual(Matrix3x3::identity()), "Handbook 8.1: Fxz^2 = I");
    TEST_ASSERT((Fyz * Fyz).approxEqual(Matrix3x3::identity()), "Handbook 8.1: Fyz^2 = I");
    TEST_ASSERT(NumericalPolicy::approxEqual(Fxy.determinant(), -1.0), "Handbook 8.1: det(Fxy) = -1");

    // Shears (Handbook Section 8.3)
    double k = 2.5;
    Matrix3x3 H_xy = Presets::shear(ShearType::X_BY_Y, k);
    Matrix3x3 H_xy_inv = Presets::shear(ShearType::X_BY_Y, -k);
    TEST_ASSERT(NumericalPolicy::approxEqual(H_xy.determinant(), 1.0), "Handbook 8.3: det(Shear) = 1");
    TEST_ASSERT((H_xy * H_xy_inv).approxEqual(Matrix3x3::identity()), "Handbook 8.3: Shear inverse by -k");

    Vector3 testV(1.0, 2.0, 3.0);
    Vector3 shearedV = H_xy * testV; // x' = x + k*y = 1 + 2.5*2 = 6, y'=2, z'=3
    Vector3 expectedShear(6.0, 2.0, 3.0);
    TEST_ASSERT(shearedV.approxEqual(expectedShear), "Handbook 8.3: Shear transformation effect x' = x + ky");
}

void testPipelineComposition() {
    std::cout << "[+] Running Transformation Pipeline Composition Tests...\n";

    // 3 transformations: T1 = Scale(2, 1, 1), T2 = RotateZ(90 deg), T3 = Reflection(XY)
    Matrix3x3 T1 = Presets::scale(2.0, 1.0, 1.0);
    Matrix3x3 T2 = Presets::rotateZDegrees(90.0);
    Matrix3x3 T3 = Presets::reflection(ReflectionPlane::XY);

    Vector3 v0(1.0, 0.0, 5.0);

    std::vector<Matrix3x3> transforms = {T1, T2, T3};
    std::vector<std::string> names = {"Scale_2x", "RotateZ_90", "Reflect_XY"};

    PipelineResult result = TransformationPipeline::execute(transforms, names, v0);

    TEST_ASSERT(result.success, "Pipeline execution succeeded");
    TEST_ASSERT(result.compositionVerified, "Composition equivalence verified: C*v == v_seq");
    TEST_ASSERT(result.vectorRecoverySuccessful, "Vector recovery successful: C^-1 * (C*v) == v0");
    TEST_ASSERT(result.inverseProductMatchesDirect, "Product of inverses matches direct C^-1");
    TEST_ASSERT(result.steps.size() == 3, "Pipeline recorded all 3 steps");

    // Check intermediate vectors:
    // v0 = [1, 0, 5]^T
    // v1 = T1 * v0 = [2, 0, 5]^T
    // v2 = T2 * v1 = [0, 2, 5]^T (rotateZ by 90: [x*cos - y*sin, x*sin + y*cos, z] = [0, 2, 5])
    // v3 = T3 * v2 = [0, 2, -5]^T (reflect XY: z -> -z)
    Vector3 expectedV1(2.0, 0.0, 5.0);
    Vector3 expectedV2(0.0, 2.0, 5.0);
    Vector3 expectedV3(0.0, 2.0, -5.0);

    TEST_ASSERT(result.steps[0].outputVector.approxEqual(expectedV1), "Intermediate step 1 vector");
    TEST_ASSERT(result.steps[1].outputVector.approxEqual(expectedV2), "Intermediate step 2 vector");
    TEST_ASSERT(result.steps[2].outputVector.approxEqual(expectedV3), "Intermediate step 3 vector");
    TEST_ASSERT(result.composedVector.approxEqual(expectedV3), "Composed vector matches final sequential vector");
}

void testErrorHandlingAndNonFinite() {
    std::cout << "[+] Running Error Handling and Non-Finite Input Tests...\n";

    // 1. Invalid sequence count (n=1 and n=4)
    Matrix3x3 T = Matrix3x3::identity();
    PipelineResult res1 = TransformationPipeline::execute({T}, {"T1"}, Vector3(1, 1, 1));
    TEST_ASSERT(!res1.success, "Reject n=1 transformations (requires n in {2, 3})");

    PipelineResult res4 = TransformationPipeline::execute({T, T, T, T}, {"T1", "T2", "T3", "T4"}, Vector3(1, 1, 1));
    TEST_ASSERT(!res4.success, "Reject n=4 transformations (requires n in {2, 3})");

    // 2. NaN input in vector
    Vector3 nanV(1.0, std::numeric_limits<double>::quiet_NaN(), 3.0);
    PipelineResult resNaN = TransformationPipeline::execute({T, T}, {"T1", "T2"}, nanV);
    TEST_ASSERT(!resNaN.success, "Reject NaN in initial vector");

    // 3. Inf input in matrix
    Matrix3x3 infMat = Matrix3x3::identity();
    infMat.set(0, 0, std::numeric_limits<double>::infinity());
    PipelineResult resInf = TransformationPipeline::execute({T, infMat}, {"T1", "T2"}, Vector3(1, 1, 1));
    TEST_ASSERT(!resInf.success, "Reject Infinity in transformation matrix");
}

void testVector111AndRotationX45() {
    std::cout << "[+] Running Focused Vector (1,1,1) & RotationX 45deg Tests...\n";

    // 1. Initial vector (1,1,1) with Identity
    Vector3 v0(1.0, 1.0, 1.0);
    Matrix3x3 I = Matrix3x3::identity();
    PipelineResult resIdent = TransformationPipeline::execute({I, I}, {"Identity1", "Identity2"}, v0);
    TEST_ASSERT(resIdent.success, "Pipeline succeeds for v=(1,1,1) with Identity");
    TEST_ASSERT(resIdent.finalSequentialVector.approxEqual(v0), "v=(1,1,1) unchanged by Identity");
    TEST_ASSERT(resIdent.composedVector.approxEqual(v0), "Composed vector is exactly (1,1,1)");
    TEST_ASSERT(resIdent.vectorRecoverySuccessful, "Vector recovery succeeds for v=(1,1,1)");

    // 2. 45 deg rotation about X
    // R_x(45 deg) = [1, 0, 0; 0, cos(45), -sin(45); 0, sin(45), cos(45)]
    // For v = [1, 1, 1]^T:
    // x' = 1
    // y' = cos(45) - sin(45) = 0
    // z' = sin(45) + cos(45) = sqrt(2) approx 1.414213562373095
    Matrix3x3 rotX45 = Presets::rotateXDegrees(45.0);
    Vector3 vTransformed = rotX45 * v0;
    Vector3 expected(1.0, 0.0, std::sqrt(2.0));

    TEST_ASSERT(NumericalPolicy::approxEqual(vTransformed.x, 1.0), "RotX(45): x component is 1.0");
    TEST_ASSERT(std::abs(vTransformed.y) < 1e-12, "RotX(45): y component is 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(vTransformed.z, std::sqrt(2.0)), "RotX(45): z component is sqrt(2) (~1.41421356)");
    TEST_ASSERT(vTransformed.approxEqual(expected, 1e-9), "RotX(45) matches (1, 0, 1.41421356)");

    // 3. Pipeline execution with RotX45 and Identity
    PipelineResult resRot = TransformationPipeline::execute({rotX45, I}, {"RotateX_45", "Identity"}, v0);
    TEST_ASSERT(resRot.success, "Pipeline execution succeeds for RotX45");
    TEST_ASSERT(resRot.composedVector.approxEqual(expected, 1e-9), "Pipeline composed vector matches (1, 0, 1.41421356)");
    TEST_ASSERT(resRot.compositionVerified, "Composition equivalence verified for RotX45");
    TEST_ASSERT(resRot.vectorRecoverySuccessful, "Inverse recovery succeeds: C^-1 * (C * v0) == v0");
}

void testRotationsXYZ45() {
    std::cout << "[+] Running Focused Rotations X, Y, Z at 45 deg Verification Suite...\n";

    const double c45 = std::cos(45.0 * Presets::PI / 180.0);
    const double s45 = std::sin(45.0 * Presets::PI / 180.0);

    // 1. Rotation about X by 45°
    // Expected:
    // [ 1,    0,    0   ]
    // [ 0,  cos, -sin   ]
    // [ 0,  sin,  cos   ]
    Matrix3x3 Rx45 = Presets::rotateXDegrees(45.0);
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.get(0, 0), 1.0), "Rx45(0,0) == 1.0");
    TEST_ASSERT(std::abs(Rx45.get(0, 1)) < 1e-12, "Rx45(0,1) == 0.0");
    TEST_ASSERT(std::abs(Rx45.get(0, 2)) < 1e-12, "Rx45(0,2) == 0.0");
    TEST_ASSERT(std::abs(Rx45.get(1, 0)) < 1e-12, "Rx45(1,0) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.get(1, 1), c45), "Rx45(1,1) == cos(45)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.get(1, 2), -s45), "Rx45(1,2) == -sin(45)");
    TEST_ASSERT(std::abs(Rx45.get(2, 0)) < 1e-12, "Rx45(2,0) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.get(2, 1), s45), "Rx45(2,1) == sin(45)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.get(2, 2), c45), "Rx45(2,2) == cos(45)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rx45.determinant(), 1.0), "det(Rx45) == +1");
    TEST_ASSERT((Rx45 * Rx45.transpose()).approxEqual(Matrix3x3::identity()), "Rx45 is orthogonal");

    // 2. Rotation about Y by 45°
    // Expected:
    // [  cos, 0, sin ]
    // [    0, 1,   0 ]
    // [ -sin, 0, cos ]
    Matrix3x3 Ry45 = Presets::rotateYDegrees(45.0);
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.get(0, 0), c45), "Ry45(0,0) == cos(45) (~0.7071)");
    TEST_ASSERT(std::abs(Ry45.get(0, 1)) < 1e-12, "Ry45(0,1) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.get(0, 2), s45), "Ry45(0,2) == sin(45) (~0.7071)");
    TEST_ASSERT(std::abs(Ry45.get(1, 0)) < 1e-12, "Ry45(1,0) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.get(1, 1), 1.0), "Ry45(1,1) == 1.0");
    TEST_ASSERT(std::abs(Ry45.get(1, 2)) < 1e-12, "Ry45(1,2) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.get(2, 0), -s45), "Ry45(2,0) == -sin(45) (~-0.7071)");
    TEST_ASSERT(std::abs(Ry45.get(2, 1)) < 1e-12, "Ry45(2,1) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.get(2, 2), c45), "Ry45(2,2) == cos(45) (~0.7071)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Ry45.determinant(), 1.0), "det(Ry45) == +1");
    TEST_ASSERT((Ry45 * Ry45.transpose()).approxEqual(Matrix3x3::identity()), "Ry45 is orthogonal");

    // Requirement 8: Verify that a Y rotation transforms (1,0,0) to approximately (0.7071, 0, -0.7071)
    Vector3 vX(1.0, 0.0, 0.0);
    Vector3 vYRotated = Ry45 * vX;
    Vector3 expectedYRot(c45, 0.0, -s45);
    TEST_ASSERT(NumericalPolicy::approxEqual(vYRotated.x, c45), "Ry45 * (1,0,0) -> x = cos(45) (~0.70710678)");
    TEST_ASSERT(std::abs(vYRotated.y) < 1e-12, "Ry45 * (1,0,0) -> y = 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(vYRotated.z, -s45), "Ry45 * (1,0,0) -> z = -sin(45) (~-0.70710678)");
    TEST_ASSERT(vYRotated.approxEqual(expectedYRot, 1e-9), "Ry45 transforms (1,0,0) to approx (0.7071, 0, -0.7071)");

    // 3. Rotation about Z by 45°
    // Expected:
    // [ cos, -sin, 0 ]
    // [ sin,  cos, 0 ]
    // [   0,    0, 1 ]
    Matrix3x3 Rz45 = Presets::rotateZDegrees(45.0);
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.get(0, 0), c45), "Rz45(0,0) == cos(45) (~0.7071)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.get(0, 1), -s45), "Rz45(0,1) == -sin(45) (~-0.7071)");
    TEST_ASSERT(std::abs(Rz45.get(0, 2)) < 1e-12, "Rz45(0,2) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.get(1, 0), s45), "Rz45(1,0) == sin(45) (~0.7071)");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.get(1, 1), c45), "Rz45(1,1) == cos(45) (~0.7071)");
    TEST_ASSERT(std::abs(Rz45.get(1, 2)) < 1e-12, "Rz45(1,2) == 0.0");
    TEST_ASSERT(std::abs(Rz45.get(2, 0)) < 1e-12, "Rz45(2,0) == 0.0");
    TEST_ASSERT(std::abs(Rz45.get(2, 1)) < 1e-12, "Rz45(2,1) == 0.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.get(2, 2), 1.0), "Rz45(2,2) == 1.0");
    TEST_ASSERT(NumericalPolicy::approxEqual(Rz45.determinant(), 1.0), "det(Rz45) == +1");
    TEST_ASSERT((Rz45 * Rz45.transpose()).approxEqual(Matrix3x3::identity()), "Rz45 is orthogonal");

    // Verify Rz45 transforms (1,0,0) to (cos, sin, 0)
    Vector3 vZRotated = Rz45 * vX;
    Vector3 expectedZRot(c45, s45, 0.0);
    TEST_ASSERT(vZRotated.approxEqual(expectedZRot, 1e-9), "Rz45 transforms (1,0,0) to (0.7071, 0.7071, 0)");
}

int main() {
    std::cout << "========================================================\n";
    std::cout << "  C++17 Mathematical Engine - Native Verification Suite \n";
    std::cout << "========================================================\n";

    testBasicVectorOperations();
    testMatrixBasicOperations();
    testDeterminantCofactorsAdjugate();
    testHandbookReferenceExamples();
    testInversionAndResiduals();
    testPresets();
    testPipelineComposition();
    testErrorHandlingAndNonFinite();
    testVector111AndRotationX45();
    testRotationsXYZ45();

    std::cout << "========================================================\n";
    std::cout << "  RESULTS: " << g_testsPassed << " PASSED, " << g_testsFailed << " FAILED\n";
    std::cout << "========================================================\n";

    return (g_testsFailed == 0) ? 0 : 1;
}
