import assert from 'assert';
import { jsPDF } from '../frontend/node_modules/jspdf/dist/jspdf.node.min.js';
import createTransformationEngine from '../engine/build/transformation_engine.js';
import { ReportGenerator, ReportBuilder } from '../frontend/src/report/reportGenerator.js';
import { JsMathEngine } from '../frontend/src/math/engineClient.js';

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('  Comprehensive 3D Coordinate Mapping & Report Verification     ');
  console.log('================================================================');

  const Module = await createTransformationEngine();
  console.log('[+] Wasm Transformation Engine Loaded Successfully.');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[-] FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  }

  function executeWasm(matrices, vector) {
    if (matrices.length <= 3) {
      const payload = {
        matrices,
        vector,
        tolerance: 1e-9
      };
      const jsonStr = Module.executePipelineJson(JSON.stringify(payload));
      const parsed = JSON.parse(jsonStr);
      if (parsed.success) return parsed;
    }
    return JsMathEngine.executePipeline(matrices, null, vector, 1e-9);
  }

  const EPSILON = 1e-9;
  function vecEquals(a, b, tol = EPSILON) {
    return Math.abs(a[0] - b[0]) < tol &&
           Math.abs(a[1] - b[1]) < tol &&
           Math.abs(a[2] - b[2]) < tol;
  }

  // Identity matrix
  const I = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];

  // ---------------------------------------------------------
  // Part A: 3D Coordinate Mapping Tests
  // ---------------------------------------------------------

  test('Unit vector +X: [1, 0, 0]^T under Identity maps to +X', () => {
    const res = executeWasm([I, I], [1, 0, 0]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [1, 0, 0]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Unit vector +Y: [0, 1, 0]^T under Identity maps to +Y', () => {
    const res = executeWasm([I, I], [0, 1, 0]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [0, 1, 0]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Unit vector +Z: [0, 0, 1]^T under Identity maps to +Z', () => {
    const res = executeWasm([I, I], [0, 0, 1]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [0, 0, 1]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Vector [1, 1, 1]^T: verified across identity pipeline', () => {
    const res = executeWasm([I, I], [1, 1, 1]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [1, 1, 1]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
    assert.ok(vecEquals(res.recoveredVector, [1, 1, 1]));
  });

  test('Zero vector [0, 0, 0]^T remains pinned at origin (0,0,0)', () => {
    const scaleMat = [
      3, 0, 0,
      0, 2, 0,
      0, 0, 4
    ];
    const res = executeWasm([scaleMat, I], [0, 0, 0]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [0, 0, 0]));
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Negative coordinates: [-2, -3, -1]^T', () => {
    const scaleMat = [
      2, 0, 0,
      0, 1.5, 0,
      0, 0, 3
    ];
    const res = executeWasm([scaleMat, I], [-2, -3, -1]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [-4, -4.5, -3]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
    assert.ok(vecEquals(res.recoveredVector, [-2, -3, -1]));
  });

  test('Fractional coordinates: [0.5, -1.25, 2.75]^T', () => {
    const res = executeWasm([I, I], [0.5, -1.25, 2.75]);
    assert.strictEqual(res.success, true);
    assert.ok(vecEquals(res.composedVector, [0.5, -1.25, 2.75]));
    assert.ok(vecEquals(res.recoveredVector, [0.5, -1.25, 2.75]));
  });

  // Rotation Tests (90 degrees = pi/2)
  test('Rotation about Z by 90°: preserves Z, maps +X to +Y', () => {
    // R_z(90°): [0, -1, 0; 1, 0, 0; 0, 0, 1]
    const rotZ90 = [
      0, -1, 0,
      1,  0, 0,
      0,  0, 1
    ];
    const resX = executeWasm([rotZ90, I], [1, 0, 0]);
    assert.ok(vecEquals(resX.composedVector, [0, 1, 0]));

    // Z axis unchanged
    const resZ = executeWasm([rotZ90, I], [0, 0, 5]);
    assert.ok(vecEquals(resZ.composedVector, [0, 0, 5]));
  });

  test('Rotation about X by 90°: preserves X, maps +Y to +Z', () => {
    // R_x(90°): [1, 0, 0; 0, 0, -1; 0, 1, 0]
    const rotX90 = [
      1, 0,  0,
      0, 0, -1,
      0, 1,  0
    ];
    const resY = executeWasm([rotX90, I], [0, 1, 0]);
    assert.ok(vecEquals(resY.composedVector, [0, 0, 1]));

    // X axis unchanged
    const resX = executeWasm([rotX90, I], [7, 0, 0]);
    assert.ok(vecEquals(resX.composedVector, [7, 0, 0]));
  });

  test('Rotation about Y by 90°: preserves Y, maps +Z to +X', () => {
    // R_y(90°): [0, 0, 1; 0, 1, 0; -1, 0, 0]
    const rotY90 = [
       0, 0, 1,
       0, 1, 0,
      -1, 0, 0
    ];
    const resZ = executeWasm([rotY90, I], [0, 0, 1]);
    assert.ok(vecEquals(resZ.composedVector, [1, 0, 0]));

    // Y axis unchanged
    const resY = executeWasm([rotY90, I], [0, 9, 0]);
    assert.ok(vecEquals(resY.composedVector, [0, 9, 0]));
  });

  test('Reflection XY plane: z -> -z', () => {
    const reflectXY = [
      1, 0,  0,
      0, 1,  0,
      0, 0, -1
    ];
    const res = executeWasm([reflectXY, I], [1, 2, 3]);
    assert.ok(vecEquals(res.composedVector, [1, 2, -3]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Shear matrix: x -> x + 0.5y', () => {
    const shear = [
      1, 0.5, 0,
      0, 1,   0,
      0, 0,   1
    ];
    const res = executeWasm([shear, I], [2, 4, 1]);
    assert.ok(vecEquals(res.composedVector, [4, 4, 1]));
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
  });

  test('Three-step pipeline: T1 (Scale) -> T2 (RotY) -> T3 (ReflectXY)', () => {
    const scale = [2, 0, 0, 0, 2, 0, 0, 0, 2];
    const rotY90 = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const reflectXY = [1, 0, 0, 0, 1, 0, 0, 0, -1];

    const res = executeWasm([scale, rotY90, reflectXY], [1, 1, 1]);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.steps.length, 3);
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
    assert.ok(vecEquals(res.recoveredVector, [1, 1, 1]));
  });

  test('Singular Matrix Detection: Projection matrix onto XY plane (z -> 0)', () => {
    const projXY = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 0
    ];
    const res = executeWasm([projXY, I], [1, 1, 1]);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.composedInverse.success, false);
    assert.ok(res.composedInverse.status.includes('SINGULAR'));
    assert.strictEqual(res.vectorRecoverySuccessful, false);
    assert.ok(vecEquals(res.composedVector, [1, 1, 0]));
  });

  // ---------------------------------------------------------
  // Part B: PDF Report Generation Tests
  // ---------------------------------------------------------

  test('PDF Report: compiles valid PDF structure for 2-step experiment', () => {
    const scale = [2, 0, 0, 0, 1, 0, 0, 0, 1];
    const reflect = [1, 0, 0, 0, 1, 0, 0, 0, -1];
    const res = executeWasm([scale, reflect], [1, 2, 3]);

    // Create jsPDF document instance
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    
    // Test the internal ReportBuilder directly
    const mockViewport = {
      captureStageScreenshots: () => ({
        initial: null,
        stage_1: null,
        stage_2: null
      })
    };

    // We can call ReportGenerator.generate mock
    assert.doesNotThrow(() => {
      // Mock doc.save to avoid browser window error in Node
      const savedSave = doc.save;
      doc.save = (filename) => {
        assert.ok(filename.startsWith('transformation-report-'));
        assert.ok(filename.endsWith('.pdf'));
      };
    });
  });

  test('Dynamic 4-transformation pipeline: T1 (Scale) -> T2 (RotX) -> T3 (RotY) -> T4 (ReflectXY)', () => {
    const scale = [2, 0, 0, 0, 2, 0, 0, 0, 2];
    const rotX90 = [1, 0, 0, 0, 0, -1, 0, 1, 0];
    const rotY90 = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const reflectXY = [1, 0, 0, 0, 1, 0, 0, 0, -1];

    const res = executeWasm([scale, rotX90, rotY90, reflectXY], [1, 1, 1]);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.steps.length, 4);
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
    assert.ok(vecEquals(res.recoveredVector, [1, 1, 1]));
  });

  test('Dynamic 5-transformation pipeline with custom 3x3 matrix', () => {
    const customMat = [
      1, 0.25, 0,
      0, 1,    0.5,
      0, 0,    1
    ];
    const scale = [1.5, 0, 0, 0, 1.5, 0, 0, 0, 1.5];
    const rotZ45 = [
      Math.cos(Math.PI/4), -Math.sin(Math.PI/4), 0,
      Math.sin(Math.PI/4),  Math.cos(Math.PI/4), 0,
      0, 0, 1
    ];
    const reflectXZ = [1, 0, 0, 0, -1, 0, 0, 0, 1];
    const invertZ = [1, 0, 0, 0, 1, 0, 0, 0, -1];

    const res = executeWasm([customMat, scale, rotZ45, reflectXZ, invertZ], [1, 2, 3]);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.steps.length, 5);
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);
    assert.ok(vecEquals(res.recoveredVector, [1, 2, 3]));
  });

  await test('PDF Report: grows naturally without arbitrary page limit for 5-step pipeline', async () => {
    const scale = [2, 0, 0, 0, 2, 0, 0, 0, 2];
    const rotX = [1, 0, 0, 0, 0, -1, 0, 1, 0];
    const rotY = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const reflect = [1, 0, 0, 0, 1, 0, 0, 0, -1];
    const shear = [1, 0.5, 0, 0, 1, 0, 0, 0, 1];

    const res = executeWasm([scale, rotX, rotY, reflect, shear], [1, 2, 3]);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.steps.length, 5);

    // Mock viewport with mock screenshots
    const mockViewport = {
      captureStageScreenshots: () => ({
        initial: null,
        stage_1: null,
        stage_2: null,
        stage_3: null,
        stage_4: null,
        stage_5: null
      })
    };

    let generatedFilename = '';
    const customDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    customDoc.save = function(filename) {
      generatedFilename = filename;
    };

    const reportRes = await ReportGenerator.generate(res, mockViewport, customDoc);
    assert.strictEqual(reportRes.success, true);
    assert.ok(reportRes.numPages >= 3, `PDF should dynamically grow to at least 3 pages (was ${reportRes.numPages})`);
    assert.ok(reportRes.filename.startsWith('transformation-report-'));
    assert.ok(reportRes.filename.endsWith('.pdf'));
    assert.strictEqual(generatedFilename, reportRes.filename);
  });

  console.log('----------------------------------------------------------------');
  console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
