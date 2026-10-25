// Comprehensive Verification Test Suite for Unit Cube Mapping and Alignment
import assert from 'assert';
import * as THREE from '../frontend/node_modules/three/build/three.module.js';
import { Viewport3D } from '../frontend/src/visualization/viewport3d.js';
import { JsMathEngine } from '../frontend/src/math/engineClient.js';
import { PracticeGenerator } from '../frontend/src/practice/practiceGenerator.js';

// Setup minimal document mock for CanvasTexture creation in Node.js
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 64,
          height: 64,
          getContext: () => ({
            clearRect() {},
            fillText() {},
            beginPath() {},
            roundRect() {},
            fill() {},
            stroke() {}
          })
        };
      }
      return {};
    }
  };
}

console.log('================================================================');
console.log('  Unit Cube Mapping, Alignment & Transformation Test Suite       ');
console.log('================================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[-] FAILED: ${name}`);
    console.error(err);
    failed++;
  }
}

const EPSILON = 1e-6;
function approxEqual(a, b, tol = EPSILON) {
  return Math.abs(a - b) < tol;
}

function assertVec3Approx(actual, expected, msg = '', tol = EPSILON) {
  assert.ok(
    approxEqual(actual[0], expected[0], tol) &&
    approxEqual(actual[1], expected[1], tol) &&
    approxEqual(actual[2], expected[2], tol),
    `${msg} -> Expected [${expected.map(n => n.toFixed(4)).join(', ')}], got [${actual.map(n => n.toFixed(4)).join(', ')}]`
  );
}

// Independent Reference Matrix Multiplication for 3D column vectors: v' = M * v
function refTransformVertex(M, v) {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2]
  ];
}

// Independent Reference Matrix Composition: C = B * A
function refMultiplyMat(B, A) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r * 3 + c] = 
        B[r * 3 + 0] * A[0 * 3 + c] +
        B[r * 3 + 1] * A[1 * 3 + c] +
        B[r * 3 + 2] * A[2 * 3 + c];
    }
  }
  return C;
}

// Helper to create a functional Viewport3D instance in Node environment
function createMockViewport() {
  const vp = Object.create(Viewport3D.prototype);
  vp.minAxisExtent = 5.0;
  vp.axisMargin = 1.0;
  vp.axisExtents = { x: 5.8, y: 5.8, z: 5.8 };
  vp.showUnitCube = false;
  vp.currentCubeMatrix = [1, 0, 0,  0, 1, 0,  0, 0, 1];

  vp.updateAxes = function(extents) {
    if (extents) this.axisExtents = { ...extents };
  };
  vp.updateGrid = function() {};
  vp.updateCameraFraming = function() {};

  // Build real Three.js objects
  vp.scene = new THREE.Scene();
  vp.buildCube();
  return vp;
}

// -------------------------------------------------------------------
// SECTION 0: Canonical Unit Cube Geometry & Topological Consistency
// -------------------------------------------------------------------
test('0. Canonical Unit Cube Definition: 8 vertices in [0, 1]^3, 12 edges, 12 triangles', () => {
  const verts = Viewport3D.UNIT_CUBE_VERTICES;
  assert.strictEqual(verts.length, 8, 'Must have exactly 8 vertices');

  // Verify all 8 combinations of {0, 1}^3 are present
  const expectedVerts = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
  ];
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(verts[i], expectedVerts[i], `Canonical vertex ${i}`);
  }

  // Verify edges (12 edges -> 24 indices)
  const edges = Viewport3D.CUBE_EDGE_INDICES;
  assert.strictEqual(edges.length, 24, 'Must have 24 edge indices (12 line segments)');
  edges.forEach(idx => {
    assert.ok(idx >= 0 && idx < 8, `Edge index ${idx} must reference valid vertex [0..7]`);
  });

  // Verify faces (12 triangles -> 36 indices)
  const tris = Viewport3D.CUBE_TRIANGLE_INDICES;
  assert.strictEqual(tris.length, 36, 'Must have 36 face triangle indices (6 faces x 2 triangles)');
  tris.forEach(idx => {
    assert.ok(idx >= 0 && idx < 8, `Triangle index ${idx} must reference valid vertex [0..7]`);
  });
});

// -------------------------------------------------------------------
// CASE 1: Identity Transformation
// -------------------------------------------------------------------
test('1. Identity Transformation: Every vertex stays in its exact original canonical position', () => {
  const identityMat = [1, 0, 0,  0, 1, 0,  0, 0, 1];
  const transformed = Viewport3D.getTransformedCubeVertices(identityMat);

  for (let i = 0; i < 8; i++) {
    assertVec3Approx(transformed[i], Viewport3D.UNIT_CUBE_VERTICES[i], `Identity vertex ${i}`);
  }

  // Verify inside a mock Viewport3D
  const vp = createMockViewport();
  vp.updateUnitCube(identityMat);
  const meshPos = vp.cubeMeshGeom.attributes.position.array;
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(
      [meshPos[i * 3 + 0], meshPos[i * 3 + 1], meshPos[i * 3 + 2]],
      Viewport3D.UNIT_CUBE_VERTICES[i],
      `Mesh position attribute for vertex ${i}`
    );
  }
});

// -------------------------------------------------------------------
// CASE 2: Scaling Transformations (Uniform, Non-uniform, Zero-scale)
// -------------------------------------------------------------------
test('2a. Scaling: Uniform scaling moves each vertex to mathematically expected position', () => {
  const scale2 = [2, 0, 0,  0, 2, 0,  0, 0, 2];
  const transformed = Viewport3D.getTransformedCubeVertices(scale2);

  const expected = [
    [0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0],
    [0, 0, 2], [2, 0, 2], [2, 2, 2], [0, 2, 2]
  ];
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(transformed[i], expected[i], `Uniform scale 2x vertex ${i}`);
  }
});

test('2b. Scaling: Non-uniform scaling (sx=2.5, sy=0.5, sz=3.0)', () => {
  const nonUniform = [2.5, 0, 0,  0, 0.5, 0,  0, 0, 3.0];
  const transformed = Viewport3D.getTransformedCubeVertices(nonUniform);

  for (let i = 0; i < 8; i++) {
    const orig = Viewport3D.UNIT_CUBE_VERTICES[i];
    const expected = [orig[0] * 2.5, orig[1] * 0.5, orig[2] * 3.0];
    assertVec3Approx(transformed[i], expected, `Non-uniform scale vertex ${i}`);
  }
});

// -------------------------------------------------------------------
// CASE 3: Reflection Transformations
// -------------------------------------------------------------------
test('3a. Reflection in XY Plane: z coordinates invert sign', () => {
  const reflectXY = [1, 0, 0,  0, 1, 0,  0, 0, -1];
  const transformed = Viewport3D.getTransformedCubeVertices(reflectXY);

  for (let i = 0; i < 8; i++) {
    const orig = Viewport3D.UNIT_CUBE_VERTICES[i];
    const expected = [orig[0], orig[1], -orig[2]];
    assertVec3Approx(transformed[i], expected, `Reflect XY vertex ${i}`);
  }
});

test('3b. Reflection in XZ Plane: y coordinates invert sign', () => {
  const reflectXZ = [1, 0, 0,  0, -1, 0,  0, 0, 1];
  const transformed = Viewport3D.getTransformedCubeVertices(reflectXZ);

  for (let i = 0; i < 8; i++) {
    const orig = Viewport3D.UNIT_CUBE_VERTICES[i];
    const expected = [orig[0], -orig[1], orig[2]];
    assertVec3Approx(transformed[i], expected, `Reflect XZ vertex ${i}`);
  }
});

test('3c. Reflection in YZ Plane: x coordinates invert sign', () => {
  const reflectYZ = [-1, 0, 0,  0, 1, 0,  0, 0, 1];
  const transformed = Viewport3D.getTransformedCubeVertices(reflectYZ);

  for (let i = 0; i < 8; i++) {
    const orig = Viewport3D.UNIT_CUBE_VERTICES[i];
    const expected = [-orig[0], orig[1], orig[2]];
    assertVec3Approx(transformed[i], expected, `Reflect YZ vertex ${i}`);
  }
});

test('3d. Negative determinant and winding order: BufferGeometry updates without crash or NaNs', () => {
  const reflectYZ = [-1, 0, 0,  0, 1, 0,  0, 0, 1];
  const vp = createMockViewport();
  vp.updateUnitCube(reflectYZ);

  const pos = vp.cubeMeshGeom.attributes.position.array;
  for (let i = 0; i < pos.length; i++) {
    assert.ok(Number.isFinite(pos[i]), `Position entry ${i} must be finite`);
  }
  const norm = vp.cubeMeshGeom.attributes.normal.array;
  for (let i = 0; i < norm.length; i++) {
    assert.ok(Number.isFinite(norm[i]), `Normal entry ${i} must be finite`);
  }
});

// -------------------------------------------------------------------
// CASE 4: Rotations (Around X, Y, and Z Axes)
// -------------------------------------------------------------------
test('4a. Rotation around Z axis by 90 deg (pi/2)', () => {
  // RotZ(90): x' = -y, y' = x, z' = z
  const rotZ90 = [
    0, -1, 0,
    1,  0, 0,
    0,  0, 1
  ];
  const transformed = Viewport3D.getTransformedCubeVertices(rotZ90);

  // V1 (1, 0, 0) -> (0, 1, 0)
  assertVec3Approx(transformed[1], [0, 1, 0], 'V1 rotated around Z');
  // V2 (1, 1, 0) -> (-1, 1, 0)
  assertVec3Approx(transformed[2], [-1, 1, 0], 'V2 rotated around Z');
  // V3 (0, 1, 0) -> (-1, 0, 0)
  assertVec3Approx(transformed[3], [-1, 0, 0], 'V3 rotated around Z');
  // V6 (1, 1, 1) -> (-1, 1, 1)
  assertVec3Approx(transformed[6], [-1, 1, 1], 'V6 rotated around Z');
});

test('4b. Rotation around X axis by 90 deg (pi/2)', () => {
  // RotX(90): x' = x, y' = -z, z' = y
  const rotX90 = [
    1,  0,  0,
    0,  0, -1,
    0,  1,  0
  ];
  const transformed = Viewport3D.getTransformedCubeVertices(rotX90);

  // V3 (0, 1, 0) -> (0, 0, 1)
  assertVec3Approx(transformed[3], [0, 0, 1], 'V3 rotated around X');
  // V4 (0, 0, 1) -> (0, -1, 0)
  assertVec3Approx(transformed[4], [0, -1, 0], 'V4 rotated around X');
  // V6 (1, 1, 1) -> (1, -1, 1)
  assertVec3Approx(transformed[6], [1, -1, 1], 'V6 rotated around X');
});

test('4c. Rotation around Y axis by 90 deg (pi/2)', () => {
  // RotY(90): x' = z, y' = y, z' = -x
  const rotY90 = [
     0, 0, 1,
     0, 1, 0,
    -1, 0, 0
  ];
  const transformed = Viewport3D.getTransformedCubeVertices(rotY90);

  // V1 (1, 0, 0) -> (0, 0, -1)
  assertVec3Approx(transformed[1], [0, 0, -1], 'V1 rotated around Y');
  // V4 (0, 0, 1) -> (1, 0, 0)
  assertVec3Approx(transformed[4], [1, 0, 0], 'V4 rotated around Y');
  // V6 (1, 1, 1) -> (1, 1, -1)
  assertVec3Approx(transformed[6], [1, 1, -1], 'V6 rotated around Y');
});

// -------------------------------------------------------------------
// CASE 5: Composed Transformations (Multiplication Order C = T2 * T1)
// -------------------------------------------------------------------
test('5. Composed Transformations: C = T2 * T1 preserves exact composition order', () => {
  // T1: Scale X by 2, Y by 3, Z by 1
  const T1 = [
    2, 0, 0,
    0, 3, 0,
    0, 0, 1
  ];
  // T2: Rotate 90 deg around Z
  const T2 = [
    0, -1, 0,
    1,  0, 0,
    0,  0, 1
  ];

  // Composed matrix C = T2 * T1
  const C = refMultiplyMat(T2, T1);
  // Expected C:
  // [ 0*2 + -1*0 + 0*0,   0*0 + -1*3 + 0*0,   0*0 + -1*0 + 0*1 ] = [ 0, -3, 0 ]
  // [ 1*2 +  0*0 + 0*0,   1*0 +  0*3 + 0*0,   1*0 +  0*0 + 0*1 ] = [ 2,  0, 0 ]
  // [ 0*2 +  0*0 + 1*0,   0*0 +  0*3 + 1*0,   0*0 +  0*0 + 1*1 ] = [ 0,  0, 1 ]

  const expectedC = [
    0, -3, 0,
    2,  0, 0,
    0,  0, 1
  ];
  for (let i = 0; i < 9; i++) {
    assert.ok(approxEqual(C[i], expectedC[i]), `C[${i}] mismatch`);
  }

  // Transform cube by C directly
  const transformedByC = Viewport3D.getTransformedCubeVertices(C);

  // Transform cube sequentially: T1 first, then T2
  const step1 = Viewport3D.getTransformedCubeVertices(T1);
  const step2 = step1.map(v => refTransformVertex(T2, v));

  for (let i = 0; i < 8; i++) {
    assertVec3Approx(transformedByC[i], step2[i], `Composed vertex ${i}`);
  }

  // Also verify that reverse order T1 * T2 gives DIFFERENT result (non-commutative)
  const C_reverse = refMultiplyMat(T1, T2);
  const transformedReverse = Viewport3D.getTransformedCubeVertices(C_reverse);
  // Vertex 6 is (1, 1, 1). In C: [0 - 3, 2 + 0, 1] = [-3, 2, 1]
  // In C_reverse: T1 * T2 = [0, -2, 0; 3, 0, 0; 0, 0, 1]. V6 -> [-2, 3, 1]
  assertVec3Approx(transformedByC[6], [-3, 2, 1], 'V6 in C = T2 * T1');
  assertVec3Approx(transformedReverse[6], [-2, 3, 1], 'V6 in reverse C = T1 * T2');
});

// -------------------------------------------------------------------
// CASE 6: Singular Transformations (det = 0, zero scale, projections)
// -------------------------------------------------------------------
test('6a. Singular Transformation: Projection onto XY plane (det = 0)', () => {
  // ProjXY: z -> 0
  const projXY = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 0
  ];
  const transformed = Viewport3D.getTransformedCubeVertices(projXY);

  // Top vertices (z=1) collapse onto bottom vertices (z=0)
  for (let i = 0; i < 4; i++) {
    assertVec3Approx(transformed[i + 4], transformed[i], `Top vertex ${i + 4} collapses to bottom vertex ${i}`);
    assert.strictEqual(transformed[i][2], 0, `z must be 0 for vertex ${i}`);
  }
});

test('6b. Singular Transformation in Viewport3D: No NaN normals, no crashes', () => {
  const projXY = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 0
  ];
  const vp = createMockViewport();
  vp.updateUnitCube(projXY);

  const pos = vp.cubeMeshGeom.attributes.position.array;
  const normals = vp.cubeMeshGeom.attributes.normal.array;

  for (let i = 0; i < pos.length; i++) {
    assert.ok(Number.isFinite(pos[i]), `Position index ${i} must be finite`);
  }
  for (let i = 0; i < normals.length; i++) {
    assert.ok(Number.isFinite(normals[i]), `Normal index ${i} must be finite`);
  }
  assert.ok(Number.isFinite(vp.cubeMeshGeom.boundingSphere.radius), 'Bounding sphere radius must be finite');
});

test('6c. Rank-1 Projection (det = 0): All 8 vertices collapse along diagonal line', () => {
  // Matrix where all rows are [1/3, 1/3, 1/3]
  const rank1 = [
    1/3, 1/3, 1/3,
    1/3, 1/3, 1/3,
    1/3, 1/3, 1/3
  ];
  const transformed = Viewport3D.getTransformedCubeVertices(rank1);

  transformed.forEach((v, idx) => {
    assert.ok(approxEqual(v[0], v[1]) && approxEqual(v[1], v[2]), `Vertex ${idx} must lie on line x = y = z`);
    assert.ok(Number.isFinite(v[0]), `Vertex ${idx} must be finite`);
  });
});

// -------------------------------------------------------------------
// CASE 7: Reset, Repeated Updates & Freedom from Accumulated Drift
// -------------------------------------------------------------------
test('7a. Repeated updates: 50 consecutive transforms maintain zero accumulated drift', () => {
  const vp = createMockViewport();
  const rotMat = [
    Math.cos(0.3), -Math.sin(0.3), 0,
    Math.sin(0.3),  Math.cos(0.3), 0,
    0,              0,             1
  ];

  // Update 50 times with the same matrix
  for (let i = 0; i < 50; i++) {
    vp.updateUnitCube(rotMat);
  }

  const expected = Viewport3D.getTransformedCubeVertices(rotMat);
  const meshPos = vp.cubeMeshGeom.attributes.position.array;
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(
      [meshPos[i * 3 + 0], meshPos[i * 3 + 1], meshPos[i * 3 + 2]],
      expected[i],
      `Vertex ${i} after 50 updates`,
      1e-5
    );
  }
});

test('7b. Reset transformation returns vertices exactly to canonical [0, 1]^3', () => {
  const vp = createMockViewport();
  // Apply heavy arbitrary transformation
  vp.updateUnitCube([
    2.5, -1.2, 0.4,
    0.7,  3.1, -1.5,
    1.1,  0.8,  2.2
  ]);

  // Now reset to identity
  vp.updateUnitCube([1, 0, 0,  0, 1, 0,  0, 0, 1]);

  const meshPos = vp.cubeMeshGeom.attributes.position.array;
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(
      [meshPos[i * 3 + 0], meshPos[i * 3 + 1], meshPos[i * 3 + 2]],
      Viewport3D.UNIT_CUBE_VERTICES[i],
      `Reset vertex ${i}`,
      1e-5
    );
  }
});

// -------------------------------------------------------------------
// CASE 8: Decoupling from Camera, Axis Resizing, Viewport & Sidebar Resizing
// -------------------------------------------------------------------
test('8a. Axis extent resizing does not alter mathematical cube vertex coordinates', () => {
  const vp = createMockViewport();
  const M = [2, 0, 0,  0, 1.5, 0,  0, 0, 3];
  vp.updateUnitCube(M);

  const initialVerts = vp.getTransformedCubeVertices();

  // Simulate dynamic axis expansion from vector or cube
  vp.updateAxes({ x: 20.0, y: 25.0, z: 30.0 });
  const afterResizeVerts = vp.getTransformedCubeVertices();

  for (let i = 0; i < 8; i++) {
    assertVec3Approx(afterResizeVerts[i], initialVerts[i], `Vertex ${i} after axis expansion`);
  }
});

test('8b. Viewport3D setShowUnitCube toggle synchronizes matrix and preserves state', () => {
  const vp = createMockViewport();
  const M = [0, -1, 0,  1, 0, 0,  0, 0, 1];
  vp.updateUnitCube(M);

  // Toggle off
  vp.setShowUnitCube(false);
  assert.strictEqual(vp.getShowUnitCube(), false);
  assert.strictEqual(vp.geometryGroup.visible, false);

  // Toggle on
  vp.setShowUnitCube(true);
  assert.strictEqual(vp.getShowUnitCube(), true);
  assert.strictEqual(vp.geometryGroup.visible, true);

  // Transformed vertices must remain synchronized to M
  const expected = Viewport3D.getTransformedCubeVertices(M);
  for (let i = 0; i < 8; i++) {
    assertVec3Approx(vp.getTransformedCubeVertices()[i], expected[i], `Toggled vertex ${i}`);
  }
});

// -------------------------------------------------------------------
// CASE 9: Randomized Examples Agreement with Math Engine
// -------------------------------------------------------------------
test('9a. 20 Randomized practice challenge matrices agree with JsMathEngine transformations', () => {
  for (let k = 0; k < 20; k++) {
    const diff = k % 3 === 0 ? 'easy' : (k % 3 === 1 ? 'medium' : 'hard');
    const challenge = PracticeGenerator.generateChallenge(diff);
    assert.ok(challenge && challenge.given && challenge.given.transformations.length > 0, 'Must generate valid practice challenge');

    // Multiply pipeline matrices to find composed transformation C
    let C = [1, 0, 0,  0, 1, 0,  0, 0, 1];
    for (const item of challenge.given.transformations) {
      C = JsMathEngine.multiplyMat(item.matrix, C);
    }

    // 1. Verify cube vertices transformed by Viewport3D match reference multiplication
    const cubeVerts = Viewport3D.getTransformedCubeVertices(C);
    for (let i = 0; i < 8; i++) {
      const orig = Viewport3D.UNIT_CUBE_VERTICES[i];
      const expected = refTransformVertex(C, orig);
      assertVec3Approx(cubeVerts[i], expected, `Random challenge ${k} vertex ${i}`);
    }

    // 2. Verify that basis vector columns of C correspond to cube edges from origin:
    // C * (1, 0, 0) = column 0 of C = Vertex 1
    // C * (0, 1, 0) = column 1 of C = Vertex 3
    // C * (0, 0, 1) = column 2 of C = Vertex 4
    assertVec3Approx(cubeVerts[1], [C[0], C[3], C[6]], `Column 0 of C matches V1`);
    assertVec3Approx(cubeVerts[3], [C[1], C[4], C[7]], `Column 1 of C matches V3`);
    assertVec3Approx(cubeVerts[4], [C[2], C[5], C[8]], `Column 2 of C matches V4`);
  }
});

test('9b. Static reference cube remains invariant at canonical [0, 1]^3', () => {
  const vp = createMockViewport();
  // Transform unit cube by an arbitrary transformation
  vp.updateUnitCube([3, -1, 0,  0, 2, 1,  1, 1, 4]);

  // Find refCubeWireframe in geometryGroup
  const refCube = vp.geometryGroup.getObjectByName('refCubeWireframe');
  assert.ok(refCube, 'Reference cube wireframe must exist');

  // Verify reference cube positions still match canonical [0, 1]^3
  const refPos = refCube.geometry.attributes.position.array;
  for (let e = 0; e < Viewport3D.CUBE_EDGE_INDICES.length; e++) {
    const vIdx = Viewport3D.CUBE_EDGE_INDICES[e];
    const expected = Viewport3D.UNIT_CUBE_VERTICES[vIdx];
    assertVec3Approx(
      [refPos[e * 3 + 0], refPos[e * 3 + 1], refPos[e * 3 + 2]],
      expected,
      `Reference cube edge vertex ${e} (vIdx ${vIdx})`
    );
  }
});

console.log('\n================================================================');
console.log(`  Tests Completed: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
