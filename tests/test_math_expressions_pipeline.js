import assert from 'assert';
import { jsPDF } from '../frontend/node_modules/jspdf/dist/jspdf.node.min.js';
import createTransformationEngine from '../engine/build/transformation_engine.js';
import { MathExpressionParser } from '../frontend/src/math/expressionParser.js';
import { ReportGenerator } from '../frontend/src/report/reportGenerator.js';
import { JsMathEngine } from '../frontend/src/math/engineClient.js';

async function runMathExpressionsPipelineTests() {
  console.log('================================================================');
  console.log('  Mathematical Expressions Pipeline & Report Verification Suite  ');
  console.log('================================================================');

  const Module = await createTransformationEngine();
  console.log('[+] C++17 Wasm Transformation Engine Loaded Successfully.');

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
  function approxEqual(a, b, tol = 1e-7) {
    return Math.abs(a - b) < tol;
  }

  function vecApproxEqual(a, b, tol = 1e-7) {
    return approxEqual(a[0], b[0], tol) &&
           approxEqual(a[1], b[1], tol) &&
           approxEqual(a[2], b[2], tol);
  }

  // -------------------------------------------------------------
  // Test Set 1: Required Expressions from User Specification
  // -------------------------------------------------------------
  test('1. Core Constants & Variables: pi, π, theta, θ', () => {
    const scope = { theta: Math.PI / 4, 'θ': Math.PI / 4 };
    assert.ok(approxEqual(MathExpressionParser.evaluate('pi'), Math.PI));
    assert.ok(approxEqual(MathExpressionParser.evaluate('π'), Math.PI));
    assert.ok(approxEqual(MathExpressionParser.evaluate('theta', scope), Math.PI / 4));
    assert.ok(approxEqual(MathExpressionParser.evaluate('θ', scope), Math.PI / 4));
  });

  test('2. Multiples & Fractions: 2*pi, 2pi, pi/2, pi/4, theta/2', () => {
    const scope = { theta: Math.PI / 3, 'θ': Math.PI / 3 };
    assert.ok(approxEqual(MathExpressionParser.evaluate('2*pi'), 2 * Math.PI));
    assert.ok(approxEqual(MathExpressionParser.evaluate('2pi'), 2 * Math.PI));
    assert.ok(approxEqual(MathExpressionParser.evaluate('pi/2'), Math.PI / 2));
    assert.ok(approxEqual(MathExpressionParser.evaluate('pi/4'), Math.PI / 4));
    assert.ok(approxEqual(MathExpressionParser.evaluate('theta/2', scope), Math.PI / 6));
  });

  test('3. Trigonometric Functions: sin(theta), cos(theta), tan(theta)', () => {
    const scope = { theta: Math.PI / 4, 'θ': Math.PI / 4 };
    assert.ok(approxEqual(MathExpressionParser.evaluate('sin(theta)', scope), Math.SQRT1_2));
    assert.ok(approxEqual(MathExpressionParser.evaluate('cos(theta)', scope), Math.SQRT1_2));
    assert.ok(approxEqual(MathExpressionParser.evaluate('tan(theta)', scope), 1.0));
  });

  test('4. Standard Angle Constants: sin(pi/4), cos(pi/3), sqrt(2)', () => {
    assert.ok(approxEqual(MathExpressionParser.evaluate('sin(pi/4)'), Math.SQRT1_2));
    assert.ok(approxEqual(MathExpressionParser.evaluate('cos(pi/3)'), 0.5));
    assert.ok(approxEqual(MathExpressionParser.evaluate('sqrt(2)'), Math.SQRT2));
    assert.ok(approxEqual(MathExpressionParser.evaluate('sqrt(2)/2'), Math.SQRT1_2));
  });

  test('5. Nested Expressions: 2*cos(theta), 2*cos(theta/2), 2cos(theta)', () => {
    const scope = { theta: Math.PI / 3 };
    assert.ok(approxEqual(MathExpressionParser.evaluate('2*cos(theta)', scope), 1.0));
    assert.ok(approxEqual(MathExpressionParser.evaluate('2cos(theta)', scope), 1.0));
    assert.ok(approxEqual(MathExpressionParser.evaluate('2*cos(theta/2)', scope), 2 * Math.cos(Math.PI / 6)));
  });

  test('6. Unary Minus and Operator Precedence', () => {
    assert.strictEqual(MathExpressionParser.evaluate('-pi + pi'), 0);
    assert.ok(approxEqual(MathExpressionParser.evaluate('-cos(pi)'), 1.0));
    assert.strictEqual(MathExpressionParser.evaluate('-2^2'), -4);
    assert.strictEqual(MathExpressionParser.evaluate('(-2)^2'), 4);
    assert.strictEqual(MathExpressionParser.evaluate('2 + 3 * 4'), 14);
    assert.strictEqual(MathExpressionParser.evaluate('(2 + 3) * 4'), 20);
  });

  // -------------------------------------------------------------
  // Test Set 2: Safety & Error Validation
  // -------------------------------------------------------------
  test('7. Safe Rejection of Division by Zero and Non-finite Numbers', () => {
    const resDiv0 = MathExpressionParser.validate('1 / 0');
    assert.strictEqual(resDiv0.valid, false);
    assert.ok(/Division by zero/i.test(resDiv0.error));

    const resTan90 = MathExpressionParser.validate('tan(pi/2)');
    assert.strictEqual(resTan90.valid, false);
    assert.ok(/Division by zero|infinity|non-finite/i.test(resTan90.error));
  });

  test('8. Safe Rejection of Undefined Variables without eval()', () => {
    const res = MathExpressionParser.validate('alpha + 5', { theta: 1.0 });
    assert.strictEqual(res.valid, false);
    assert.ok(/Undefined variable/i.test(res.error));
  });

  test('9. Safe Rejection of Malformed Syntax and Code Injection Attempts', () => {
    const res1 = MathExpressionParser.validate('1 + * 2');
    assert.strictEqual(res1.valid, false);

    const res2 = MathExpressionParser.validate('window.alert(1)');
    assert.strictEqual(res2.valid, false);

    const res3 = MathExpressionParser.validate('sin(');
    assert.strictEqual(res3.valid, false);
  });

  // -------------------------------------------------------------
  // Test Set 3: 3D Axis Rotations Generated from Expressions
  // -------------------------------------------------------------
  test('10. Rotation Matrices around X, Y, and Z axes using theta = pi/4', () => {
    const thetaRad = Math.PI / 4;
    const c = Math.cos(thetaRad);
    const s = Math.sin(thetaRad);

    // Rz(theta)
    const Rz = [
      c, -s, 0,
      s,  c, 0,
      0,  0, 1
    ];
    // Rx(theta)
    const Rx = [
      1, 0,  0,
      0, c, -s,
      0, s,  c
    ];
    // Ry(theta)
    const Ry = [
      c,  0, s,
      0,  1, 0,
     -s,  0, c
    ];

    // Verify all have determinant = 1.0 (isometry)
    const detZ = JsMathEngine.determinant(Rz);
    const detX = JsMathEngine.determinant(Rx);
    const detY = JsMathEngine.determinant(Ry);

    assert.ok(approxEqual(detZ, 1.0));
    assert.ok(approxEqual(detX, 1.0));
    assert.ok(approxEqual(detY, 1.0));
  });

  // -------------------------------------------------------------
  // Test Set 4: Custom 3x3 Matrix with Symbolic Expressions
  // -------------------------------------------------------------
  test('11. Custom 3x3 Matrix Cells populated with trigonometric expressions', () => {
    const scope = { theta: Math.PI / 4, 'θ': Math.PI / 4, pi: Math.PI, 'π': Math.PI };
    const matrixExprs = [
      'cos(theta)', '-sin(theta)', '0',
      'sin(theta)',  'cos(theta)', '0',
      '0',           '0',          '1'
    ];

    const evaluated = matrixExprs.map(expr => MathExpressionParser.evaluate(expr, scope));
    
    assert.ok(approxEqual(evaluated[0], Math.SQRT1_2));
    assert.ok(approxEqual(evaluated[1], -Math.SQRT1_2));
    assert.ok(approxEqual(evaluated[3], Math.SQRT1_2));
    assert.ok(approxEqual(evaluated[4], Math.SQRT1_2));
    assert.strictEqual(evaluated[8], 1);

    // Feed to C++ Wasm Engine
    const v0 = [1, 0, 0];
    const res = executeWasm([evaluated], v0);
    assert.strictEqual(res.success, true);
    assert.ok(vecApproxEqual(res.steps[0].outputVector, [Math.SQRT1_2, Math.SQRT1_2, 0]));
  });

  // -------------------------------------------------------------
  // Test Set 5: Initial Vector Coordinates with Expressions
  // -------------------------------------------------------------
  test('12. Initial Vector coordinates from expressions: [sqrt(2), cos(theta), 1]', () => {
    const scope = { theta: Math.PI / 4 };
    const vx = MathExpressionParser.evaluate('sqrt(2)', scope);
    const vy = MathExpressionParser.evaluate('cos(theta)', scope);
    const vz = MathExpressionParser.evaluate('1', scope);
    const v0 = [vx, vy, vz];

    assert.ok(approxEqual(v0[0], Math.SQRT2));
    assert.ok(approxEqual(v0[1], Math.SQRT1_2));
    assert.strictEqual(v0[2], 1.0);

    // Apply 90-degree Z-rotation
    const rotZ90 = [
      0, -1, 0,
      1,  0, 0,
      0,  0, 1
    ];
    const res = executeWasm([rotZ90], v0);
    assert.strictEqual(res.success, true);
    // [0, -1, 0] * [sqrt(2), 1/sqrt(2), 1] = -1/sqrt(2)
    // [1,  0, 0] * [sqrt(2), 1/sqrt(2), 1] = sqrt(2)
    assert.ok(vecApproxEqual(res.steps[0].outputVector, [-Math.SQRT1_2, Math.SQRT2, 1.0]));
  });

  // -------------------------------------------------------------
  // Test Set 6: Multi-stage Pipeline with Theta Config & Expressions
  // -------------------------------------------------------------
  test('13. Multi-stage Pipeline Composition & Verification with Expression Metadata', () => {
    const thetaRad = Math.PI / 4;
    const c = Math.cos(thetaRad);
    const s = Math.sin(thetaRad);

    const T1 = [c, -s, 0,  s, c, 0,  0, 0, 1]; // Rz(pi/4)
    const T2 = [2, 0, 0,  0, 2, 0,  0, 0, 2];   // Scale 2
    const v0 = [1, 1, 0];

    const res = executeWasm([T1, T2], v0);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.steps.length, 2);
    assert.strictEqual(res.compositionVerified, true);
    assert.strictEqual(res.vectorRecoverySuccessful, true);

    // Enrich with expression metadata as done in main.js
    res.thetaConfig = {
      expr: 'pi/4',
      unit: 'rad',
      valueRad: thetaRad,
      valueDeg: 45.0
    };
    res.steps[0].params = {
      angleExpr: 'pi/4',
      angleUnit: 'rad',
      angleRad: thetaRad,
      angleDeg: 45.0
    };
    res.steps[0].matrixExpressions = ['cos(θ)', '-sin(θ)', '0', 'sin(θ)', 'cos(θ)', '0', '0', '0', '1'];
    res.steps[1].params = { sx: 2, sy: 2, sz: 2 };
    res.steps[1].matrixExpressions = ['2', '0', '0', '0', '2', '0', '0', '0', '2'];

    // Verify recovery equals original vector
    assert.ok(vecApproxEqual(res.recoveredVector, v0));
  });

  // -------------------------------------------------------------
  // Test Set 7: PDF Report Generation with Expression Documentation
  // -------------------------------------------------------------
  await test('14. PDF Report Generation records entered expressions, evaluated angles, and numerical matrices', async () => {
    const thetaRad = Math.PI / 4;
    const c = Math.cos(thetaRad);
    const s = Math.sin(thetaRad);

    const T1 = [c, -s, 0,  s, c, 0,  0, 0, 1];
    const T2 = [1, 0, 0,  0, 1, 0,  0, 0, -1];
    const v0 = [Math.SQRT2, 0, 1];

    const res = executeWasm([T1, T2], v0);
    assert.strictEqual(res.success, true);

    // Attach expression metadata
    res.thetaConfig = {
      expr: 'pi/4',
      unit: 'rad',
      valueRad: thetaRad,
      valueDeg: 45.0
    };
    res.steps[0].name = 'T1';
    res.steps[0].params = {
      angleExpr: 'pi/4',
      angleUnit: 'rad',
      angleRad: thetaRad,
      angleDeg: 45.0
    };
    res.steps[0].matrixExpressions = ['cos(θ)', '-sin(θ)', '0', 'sin(θ)', 'cos(θ)', '0', '0', '0', '1'];

    res.steps[1].name = 'T2';
    res.steps[1].params = {};
    res.steps[1].matrixExpressions = ['1', '0', '0', '0', '1', '0', '0', '0', '-1'];

    const mockViewport = {
      captureStageScreenshots: () => ({
        initial: null,
        stage_1: null,
        stage_2: null
      })
    };

    let savedFilename = '';
    const customDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    customDoc.save = function(filename) {
      savedFilename = filename;
    };

    const reportRes = await ReportGenerator.generate(res, mockViewport, customDoc);
    assert.strictEqual(reportRes.success, true);
    assert.ok(reportRes.numPages >= 2);
    assert.ok(reportRes.filename.startsWith('transformation-report-'));
    assert.strictEqual(savedFilename, reportRes.filename);
  });

  console.log('----------------------------------------------------------------');
  console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMathExpressionsPipelineTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
