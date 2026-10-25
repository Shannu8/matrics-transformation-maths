// Verification test suite for 3D Transformation Animation mathematics & interpolation
const assert = require('assert');

// Implement same mathematical routines as Viewport3D
function multiplyMat(A, B) {
  const C = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r * 3 + c] =
        A[r * 3 + 0] * B[0 * 3 + c] +
        A[r * 3 + 1] * B[1 * 3 + c] +
        A[r * 3 + 2] * B[2 * 3 + c];
    }
  }
  return C;
}

function multiplyVec(A, v) {
  return [
    A[0] * v[0] + A[1] * v[1] + A[2] * v[2],
    A[3] * v[0] + A[4] * v[1] + A[5] * v[2],
    A[6] * v[0] + A[7] * v[1] + A[8] * v[2]
  ];
}

function transpose(A) {
  return [
    A[0], A[3], A[6],
    A[1], A[4], A[7],
    A[2], A[5], A[8]
  ];
}

function determinant(A) {
  const a = A[0], b = A[1], c = A[2];
  const d = A[3], e = A[4], f = A[5];
  const g = A[6], h = A[7], i = A[8];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function isRotationMatrix(M) {
  if (!M || M.length !== 9) return { isRotation: false };

  const det = determinant(M);
  if (Math.abs(det - 1.0) > 1e-4) {
    return { isRotation: false };
  }

  const MtM = multiplyMat(transpose(M), M);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const expected = (r === c) ? 1.0 : 0.0;
      if (Math.abs(MtM[r * 3 + c] - expected) > 1e-4) {
        return { isRotation: false };
      }
    }
  }

  const tr = M[0] + M[4] + M[8];
  const cosAngle = Math.max(-1.0, Math.min(1.0, (tr - 1.0) / 2.0));
  const angle = Math.acos(cosAngle);

  if (angle < 1e-6) {
    return { isRotation: true, axis: [0, 1, 0], angle: 0.0 };
  }

  if (Math.abs(angle - Math.PI) < 1e-4) {
    const MplusI = [
      M[0] + 1, M[1],     M[2],
      M[3],     M[4] + 1, M[5],
      M[6],     M[7],     M[8] + 1
    ];
    let bestCol = 0;
    let maxLen = -1;
    for (let c = 0; c < 3; c++) {
      const len = Math.hypot(MplusI[c], MplusI[3 + c], MplusI[6 + c]);
      if (len > maxLen) {
        maxLen = len;
        bestCol = c;
      }
    }
    const axis = [
      MplusI[bestCol] / maxLen,
      MplusI[3 + bestCol] / maxLen,
      MplusI[6 + bestCol] / maxLen
    ];
    return { isRotation: true, axis, angle: Math.PI };
  }

  const rawAxis = [
    M[7] - M[5],
    M[2] - M[6],
    M[3] - M[1]
  ];
  const axisLen = Math.hypot(rawAxis[0], rawAxis[1], rawAxis[2]);
  if (axisLen < 1e-9) {
    return { isRotation: true, axis: [0, 1, 0], angle: 0.0 };
  }
  const axis = [rawAxis[0] / axisLen, rawAxis[1] / axisLen, rawAxis[2] / axisLen];
  return { isRotation: true, axis, angle };
}

function rotateVectorAroundAxis(v, u, phi) {
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0]
  ];
  return [
    v[0] * cosP + cross[0] * sinP + u[0] * dot * (1.0 - cosP),
    v[1] * cosP + cross[1] * sinP + u[1] * dot * (1.0 - cosP),
    v[2] * cosP + cross[2] * sinP + u[2] * dot * (1.0 - cosP)
  ];
}

function interpolateSegment(segment, t) {
  if (t <= 0.0) {
    return { vector: [...segment.fromVector], matrix: [...segment.fromAccumMatrix] };
  }
  if (t >= 1.0) {
    return { vector: [...segment.toVector], matrix: [...segment.toAccumMatrix] };
  }

  if (segment.isRotation) {
    const phi = t * segment.rotationAngle;
    const v = rotateVectorAroundAxis(segment.fromVector, segment.rotationAxis, phi);
    return { vector: v };
  }

  const M_step = new Array(9);
  for (let i = 0; i < 9; i++) {
    const identityVal = (i === 0 || i === 4 || i === 8) ? 1.0 : 0.0;
    M_step[i] = (1.0 - t) * identityVal + t * segment.stepMatrix[i];
  }
  const v = multiplyVec(M_step, segment.fromVector);
  return { vector: v };
}

console.log("========================================================");
console.log("  3D Transformation Animation Verification Test Suite   ");
console.log("========================================================");

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (!cond) {
    console.error("[-] FAILED: " + msg);
    failed++;
  } else {
    console.log("[PASS] " + msg);
    passed++;
  }
}

const EPSILON = 1e-9;

// Case 1: Identity: (1,1,1) remains (1,1,1)
const v0_case1 = [1, 1, 1];
const I = [1, 0, 0,  0, 1, 0,  0, 0, 1];
const seg1 = {
  fromVector: v0_case1,
  toVector: multiplyVec(I, v0_case1),
  stepMatrix: I,
  fromAccumMatrix: I,
  toAccumMatrix: I,
  isRotation: isRotationMatrix(I).isRotation,
  rotationAxis: isRotationMatrix(I).axis,
  rotationAngle: isRotationMatrix(I).angle
};

const res1_start = interpolateSegment(seg1, 0.0).vector;
const res1_mid = interpolateSegment(seg1, 0.5).vector;
const res1_end = interpolateSegment(seg1, 1.0).vector;
check(Math.abs(res1_start[0] - 1) < EPSILON && Math.abs(res1_start[1] - 1) < EPSILON && Math.abs(res1_start[2] - 1) < EPSILON, "Case 1: Identity start is (1,1,1)");
check(Math.abs(res1_mid[0] - 1) < EPSILON && Math.abs(res1_mid[1] - 1) < EPSILON && Math.abs(res1_mid[2] - 1) < EPSILON, "Case 1: Identity midpoint is (1,1,1)");
check(Math.abs(res1_end[0] - 1) < EPSILON && Math.abs(res1_end[1] - 1) < EPSILON && Math.abs(res1_end[2] - 1) < EPSILON, "Case 1: Identity endpoint is (1,1,1)");

// Case 2: Rotation about Y by 45°: (1,1,1) becomes approximately (1.4142, 1, 0)
const rad45 = 45 * Math.PI / 180;
const c45 = Math.cos(rad45);
const s45 = Math.sin(rad45);
const rotY45 = [
  c45,  0, s45,
  0,    1,   0,
 -s45,  0, c45
];
const v0_case2 = [1, 1, 1];
const v_end_case2 = multiplyVec(rotY45, v0_case2);
const rotInfo2 = isRotationMatrix(rotY45);
check(rotInfo2.isRotation === true, "Case 2: RotY(45°) correctly identified as pure rotation in SO(3)");
check(Math.abs(rotInfo2.axis[0]) < EPSILON && Math.abs(rotInfo2.axis[1] - 1.0) < EPSILON && Math.abs(rotInfo2.axis[2]) < EPSILON, "Case 2: Rotation axis is exactly +Y [0, 1, 0]");
check(Math.abs(rotInfo2.angle - rad45) < 1e-6, "Case 2: Rotation angle is 45° in radians");

const seg2 = {
  fromVector: v0_case2,
  toVector: v_end_case2,
  stepMatrix: rotY45,
  fromAccumMatrix: I,
  toAccumMatrix: rotY45,
  isRotation: rotInfo2.isRotation,
  rotationAxis: rotInfo2.axis,
  rotationAngle: rotInfo2.angle
};

const expectedV2 = [Math.SQRT2, 1.0, 0.0];
check(Math.abs(v_end_case2[0] - expectedV2[0]) < 1e-6, "Case 2: RotY(45°) final x is ~1.4142 (sqrt(2))");
check(Math.abs(v_end_case2[1] - 1.0) < EPSILON, "Case 2: RotY(45°) final y is 1.0");
check(Math.abs(v_end_case2[2] - 0.0) < 1e-6, "Case 2: RotY(45°) final z is 0.0");

// Check arc smoothness and constant norm throughout rotation
const initialNorm = Math.hypot(...v0_case2);
for (let t = 0.0; t <= 1.0; t += 0.1) {
  const v_t = interpolateSegment(seg2, t).vector;
  const norm_t = Math.hypot(...v_t);
  check(Math.abs(norm_t - initialNorm) < 1e-6, `Case 2: RotY(45°) vector norm at t=${t.toFixed(1)} is constant (${initialNorm.toFixed(4)})`);
}

// Case 3: Scaling by 2: (1,1,1) becomes (2,2,2)
const scale2 = [
  2, 0, 0,
  0, 2, 0,
  0, 0, 2
];
const v0_case3 = [1, 1, 1];
const v_end_case3 = multiplyVec(scale2, v0_case3);
const seg3 = {
  fromVector: v0_case3,
  toVector: v_end_case3,
  stepMatrix: scale2,
  fromAccumMatrix: I,
  toAccumMatrix: scale2,
  isRotation: false
};
const res3_end = interpolateSegment(seg3, 1.0).vector;
const res3_mid = interpolateSegment(seg3, 0.5).vector;
check(Math.abs(res3_end[0] - 2.0) < EPSILON && Math.abs(res3_end[1] - 2.0) < EPSILON && Math.abs(res3_end[2] - 2.0) < EPSILON, "Case 3: Scaling by 2 endpoint is exactly (2,2,2)");
check(Math.abs(res3_mid[0] - 1.5) < EPSILON && Math.abs(res3_mid[1] - 1.5) < EPSILON && Math.abs(res3_mid[2] - 1.5) < EPSILON, "Case 3: Scaling by 2 midpoint is smoothly (1.5,1.5,1.5)");

// Case 4: Reflection across YZ plane: (1,1,1) becomes (-1,1,1)
const reflectYZ = [
  -1, 0, 0,
   0, 1, 0,
   0, 0, 1
];
const v0_case4 = [1, 1, 1];
const v_end_case4 = multiplyVec(reflectYZ, v0_case4);
const seg4 = {
  fromVector: v0_case4,
  toVector: v_end_case4,
  stepMatrix: reflectYZ,
  fromAccumMatrix: I,
  toAccumMatrix: reflectYZ,
  isRotation: false
};
const res4_end = interpolateSegment(seg4, 1.0).vector;
const res4_mid = interpolateSegment(seg4, 0.5).vector;
check(Math.abs(res4_end[0] - (-1.0)) < EPSILON && Math.abs(res4_end[1] - 1.0) < EPSILON && Math.abs(res4_end[2] - 1.0) < EPSILON, "Case 4: Reflection YZ endpoint is (-1, 1, 1)");
check(Math.abs(res4_mid[0] - 0.0) < EPSILON && Math.abs(res4_mid[1] - 1.0) < EPSILON && Math.abs(res4_mid[2] - 1.0) < EPSILON, "Case 4: Reflection YZ midpoint crosses mirror plane at x=0 (0, 1, 1)");

// Case 5: Two sequential transformations
// T1 = diag(2,1,1), T2 = diag(1,1,-1), v0 = (1,2,3)
const T1 = [2,0,0, 0,1,0, 0,0,1];
const T2 = [1,0,0, 0,1,0, 0,0,-1];
const v0_case5 = [1, 2, 3];
const v1_case5 = multiplyVec(T1, v0_case5); // [2, 2, 3]
const v2_case5 = multiplyVec(T2, v1_case5); // [2, 2, -3]
check(Math.abs(v1_case5[0] - 2) < EPSILON && Math.abs(v1_case5[1] - 2) < EPSILON && Math.abs(v1_case5[2] - 3) < EPSILON, "Case 5: Intermediate step 1 is [2, 2, 3]");
check(Math.abs(v2_case5[0] - 2) < EPSILON && Math.abs(v2_case5[1] - 2) < EPSILON && Math.abs(v2_case5[2] - (-3)) < EPSILON, "Case 5: Intermediate step 2 is [2, 2, -3]");

// Case 6: Inverse recovery: C^-1 * (Cv) returns to v0
const C = multiplyMat(T2, T1);
const C_inv = [0.5, 0, 0, 0, 1, 0, 0, 0, -1];
const v_rec = multiplyVec(C_inv, v2_case5);
check(Math.abs(v_rec[0] - v0_case5[0]) < EPSILON &&
      Math.abs(v_rec[1] - v0_case5[1]) < EPSILON &&
      Math.abs(v_rec[2] - v0_case5[2]) < EPSILON,
      "Case 6: Inverse recovery returns vector to initial endpoint [1, 2, 3]");

console.log("========================================================");
console.log(`  ANIMATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================");

if (failed > 0) process.exit(1);
