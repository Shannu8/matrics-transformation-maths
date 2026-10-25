import assert from 'assert';
import * as THREE from '../frontend/node_modules/three/build/three.module.js';
import { JsMathEngine } from '../frontend/src/math/engineClient.js';
import { PracticeGenerator } from '../frontend/src/practice/practiceGenerator.js';
import { Viewport3D } from '../frontend/src/visualization/viewport3d.js';
import { ReportBuilder } from '../frontend/src/report/reportGenerator.js';

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
console.log('  Test Suite: Practice Challenge Generator & Axis Transparency   ');
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

// -------------------------------------------------------------------
// PART 1: Practice Generator - Easy Difficulty Verification
// -------------------------------------------------------------------
test('1. Easy Challenge Generation: Identity, Scaling, and Reflection', () => {
  for (let i = 0; i < 20; i++) {
    const chal = PracticeGenerator.generateEasy();
    assert(chal.id.startsWith('EASY_'), 'Challenge ID should start with EASY_');
    assert.strictEqual(chal.difficulty, 'Easy');
    assert(chal.given && chal.given.v0 && chal.given.v0.length === 3, 'Valid v0 expected');
    assert(chal.given.transformations.length >= 1, 'At least 1 transformation expected');
    assert(chal.expected && chal.expected.composedVector.length === 3, 'Expected vector required');

    // Mathematical verification via JsMathEngine
    const v0 = chal.given.v0;
    const M = chal.expected.composedMatrix;
    const computedV = JsMathEngine.multiplyVec(M, v0);
    const expV = chal.expected.composedVector;

    assert(approxEqual(computedV[0], expV[0]), `vX mismatch in ${chal.id}`);
    assert(approxEqual(computedV[1], expV[1]), `vY mismatch in ${chal.id}`);
    assert(approxEqual(computedV[2], expV[2]), `vZ mismatch in ${chal.id}`);

    // Verify determinant
    const det = JsMathEngine.determinant(M);
    assert(approxEqual(det, chal.expected.determinant), 'Determinant should match engine calculation');

    // Educational content verification
    assert(chal.explanation.formula.length > 0, 'Formula required');
    assert(chal.explanation.steps.length >= 3, 'Step-by-step arithmetic required');
    assert(chal.geometricMeaning.length > 10, 'Geometric meaning required');
  }
});

// -------------------------------------------------------------------
// PART 2: Practice Generator - Medium Difficulty Verification
// -------------------------------------------------------------------
test('2. Medium Challenge Generation: Rotations, Scale + Reflect, 2-Stage Compositions', () => {
  let sawDecimalOrNegative = false;

  for (let i = 0; i < 25; i++) {
    const chal = PracticeGenerator.generateMedium();
    assert(chal.id.startsWith('MED_'), 'Challenge ID should start with MED_');
    assert.strictEqual(chal.difficulty, 'Medium');
    if (chal.given.v0.some(coord => !Number.isInteger(coord) || coord < 0)) {
      sawDecimalOrNegative = true;
    }

    // Column vector convention: C = T₂ · T₁ if two transformations
    if (chal.given.transformations.length === 2) {
      const T1 = chal.given.transformations[0].matrix;
      const T2 = chal.given.transformations[1].matrix;
      const computedC = JsMathEngine.multiplyMat(T2, T1);
      const expC = chal.expected.composedMatrix;
      for (let k = 0; k < 9; k++) {
        assert(approxEqual(computedC[k], expC[k]), `Matrix entry ${k} mismatch in composite matrix C = T2 * T1`);
      }
    }

    // Verify intermediate vectors
    const v0 = chal.given.v0;
    let currentV = [...v0];
    for (let s = 0; s < chal.given.transformations.length; s++) {
      const transMat = chal.given.transformations[s].matrix;
      currentV = JsMathEngine.multiplyVec(transMat, currentV);
      const expIntermediate = chal.expected.intermediateVectors[s];
      assert(approxEqual(currentV[0], expIntermediate[0]), `Intermediate step ${s} vX mismatch`);
      assert(approxEqual(currentV[1], expIntermediate[1]), `Intermediate step ${s} vY mismatch`);
      assert(approxEqual(currentV[2], expIntermediate[2]), `Intermediate step ${s} vZ mismatch`);
    }

    // Expected final vector must equal composite matrix times initial vector
    const directV = JsMathEngine.multiplyVec(chal.expected.composedMatrix, v0);
    assert(approxEqual(directV[0], chal.expected.composedVector[0]));
    assert(approxEqual(directV[1], chal.expected.composedVector[1]));
    assert(approxEqual(directV[2], chal.expected.composedVector[2]));
  }

  assert.strictEqual(sawDecimalOrNegative, true, 'Medium difficulty must generate decimal or negative vector coordinates');
});

// -------------------------------------------------------------------
// PART 3: Practice Generator - Hard Difficulty Verification
// -------------------------------------------------------------------
test('3. Hard Challenge Generation: Non-Commuting, Inverses, 3-Stage Pipeline, Singular Matrices', () => {
  const seenCategories = new Set();

  for (let i = 0; i < 30; i++) {
    const chal = PracticeGenerator.generateHard();
    assert(chal.id.startsWith('HARD_'), 'Challenge ID should start with HARD_');
    assert.strictEqual(chal.difficulty, 'Hard');
    seenCategories.add(chal.category);

    // Non-commuting test: verify T1*T2 != T2*T1
    if (chal.expected.nonCommuting) {
      assert(chal.expected.commutatorNorm > 0.05, 'Commutator norm must be strictly positive');
      const T1 = chal.given.transformations[0].matrix;
      const T2 = chal.given.transformations[1].matrix;
      const CA = JsMathEngine.multiplyMat(T2, T1);
      const CB = JsMathEngine.multiplyMat(T1, T2);
      const diffNorm = JsMathEngine.normInf(CA.map((v, idx) => v - CB[idx]));
      assert(diffNorm > 0.05, 'CA and CB must produce genuinely non-commuting matrices');
    }

    // Singular matrix test: verify det(M) = 0 and non-invertible
    if (chal.expected.isInvertible === false) {
      const det = JsMathEngine.determinant(chal.expected.composedMatrix);
      assert(approxEqual(det, 0.0, 1e-8), 'Singular matrix determinant must be exactly 0.0');
      assert.strictEqual(chal.expected.inverseMatrix, null, 'Singular matrix must have null inverse');
    }

    // Invertible recovery test
    if (chal.expected.recoveryError !== undefined) {
      assert(chal.expected.recoveryError < 1e-6, 'Inverse recovery error must be within numerical tolerance');
      const C = chal.expected.composedMatrix;
      const Cinv = chal.expected.inverseMatrix;
      const I_computed = JsMathEngine.multiplyMat(C, Cinv);
      const I_ident = [1, 0, 0,  0, 1, 0,  0, 0, 1];
      for (let k = 0; k < 9; k++) {
        assert(approxEqual(I_computed[k], I_ident[k], 1e-4), 'C * C_inv must equal Identity');
      }
    }

    // 3-Stage composition test: C = T3 * T2 * T1
    if (chal.given.transformations.length === 3) {
      const T1 = chal.given.transformations[0].matrix;
      const T2 = chal.given.transformations[1].matrix;
      const T3 = chal.given.transformations[2].matrix;
      const C12 = JsMathEngine.multiplyMat(T2, T1);
      const C123 = JsMathEngine.multiplyMat(T3, C12);
      const expC = chal.expected.composedMatrix;
      for (let k = 0; k < 9; k++) {
        assert(approxEqual(C123[k], expC[k]), `3-stage matrix mismatch at index ${k}`);
      }
    }
  }

  assert(seenCategories.size >= 3, `Expected at least 3 distinct hard categories, saw ${seenCategories.size}`);
});

// -------------------------------------------------------------------
// PART 4: Practice Generator - Answer Checking & Feedback Logic
// -------------------------------------------------------------------
test('4. Practice Answer Checking: Exact matches, small tolerances, and incorrect calculations', () => {
  const chal = PracticeGenerator.generateChallenge('medium');
  const expVec = chal.expected.composedVector;

  // Exact match
  const checkExact = PracticeGenerator.checkAnswer(chal, [expVec[0], expVec[1], expVec[2]]);
  assert.strictEqual(checkExact.correct, true, 'Exact match must return correct: true');
  assert(checkExact.message.includes('Correct!'), 'Feedback message should indicate success');

  // Within floating tolerance (1e-6 deviation)
  const checkTol = PracticeGenerator.checkAnswer(chal, [expVec[0] + 1e-6, expVec[1] - 1e-6, expVec[2]]);
  assert.strictEqual(checkTol.correct, true, 'Deviation within tolerance must pass');

  // Gross error (swapped coordinate or sign error)
  const checkWrong = PracticeGenerator.checkAnswer(chal, [-expVec[0] - 5, expVec[1] + 10, expVec[2]]);
  assert.strictEqual(checkWrong.correct, false, 'Gross error must return correct: false');
  assert(checkWrong.message.includes('Not quite'), 'Feedback message should explain discrepancy');

  // Non-repeating generation check
  const chal1 = PracticeGenerator.generateChallenge('easy');
  const chal2 = PracticeGenerator.generateChallenge('easy', chal1.id);
  assert.notStrictEqual(chal1.id, chal2.id, 'Repeated clicks must avoid immediate ID repeat');
});

// -------------------------------------------------------------------
// Helper to create test Viewport3D instance without WebGL renderer
// -------------------------------------------------------------------
function createTestViewport() {
  const vp = Object.create(Viewport3D.prototype);
  vp.axisMeasurementOpacity = 1.0;
  vp.showVectorCoordinates = true;
  vp.minAxisExtent = 5.0;
  vp.scene = new THREE.Scene();
  vp.axisGroup = new THREE.Group();
  vp.axisGroup.name = 'coordinateAxes';
  vp.scene.add(vp.axisGroup);

  // Setup primary vector label sprite mock
  vp.primaryLabelSprite = {
    isSprite: true,
    visible: true,
    position: new THREE.Vector3(1, 1, 1),
    userData: { lastText: 'v0' }
  };

  return vp;
}

// -------------------------------------------------------------------
// PART 5: Viewport3D - Axis Measurement Transparency Tests
// -------------------------------------------------------------------
test('5. Viewport3D: Initial state and setAxisMeasurementOpacity behavior', () => {
  const viewport = createTestViewport();
  viewport.updateAxes({ x: 6, y: 6, z: 6 });

  // Default opacity should be 1.0 (100%)
  assert.strictEqual(viewport.getAxisMeasurementOpacity(), 1.0, 'Default axisMeasurementOpacity should be 1.0');

  // Check numeric tick sprites vs axis labels
  let numericSpritesCount = 0;
  let axisLabelSpritesCount = 0;

  viewport.axisGroup.traverse(child => {
    if (child.isSprite) {
      if (child.userData && child.userData.isNumericTick) {
        numericSpritesCount++;
        assert.strictEqual(child.material.opacity, 1.0, 'Initial numeric tick sprite opacity must be 1.0');
        assert.strictEqual(child.material.transparent, true, 'Sprite material must have transparent: true');
        assert.strictEqual(child.visible, true, 'Sprite must be visible at opacity 1.0');
      } else {
        axisLabelSpritesCount++;
      }
    }
  });

  assert(numericSpritesCount > 0, `Expected multiple numeric tick sprites, found ${numericSpritesCount}`);
  assert(axisLabelSpritesCount >= 6, `Expected at least 6 axis label sprites (+X, -X, +Y, -Y, +Z, -Z), found ${axisLabelSpritesCount}`);

  // Test transparency at 0%, 25%, 50%, 75%, 100%
  const testLevels = [
    { slider: 0, opacity: 0.0, expectedVisible: false },
    { slider: 25, opacity: 0.25, expectedVisible: true },
    { slider: 50, opacity: 0.50, expectedVisible: true },
    { slider: 75, opacity: 0.75, expectedVisible: true },
    { slider: 100, opacity: 1.0, expectedVisible: true }
  ];

  for (const { slider, opacity, expectedVisible } of testLevels) {
    viewport.setAxisMeasurementOpacity(opacity);
    assert.strictEqual(viewport.getAxisMeasurementOpacity(), opacity, `Opacity should be ${opacity}`);

    viewport.axisGroup.traverse(child => {
      if (child.isSprite && child.userData && child.userData.isNumericTick) {
        assert(approxEqual(child.material.opacity, opacity, 1e-4), `Sprite opacity should be ${opacity}`);
        assert.strictEqual(child.visible, expectedVisible, `Visibility should be ${expectedVisible} at opacity ${opacity}`);
      }
      // Axis names (+X, -X, +Y, -Y, +Z, -Z) must NOT be affected!
      if (child.isSprite && (!child.userData || !child.userData.isNumericTick)) {
        assert.strictEqual(child.visible, true, 'Axis names must remain visible regardless of measurement transparency slider');
      }
    });
  }
});

test('6. Viewport3D: updateAxes preserves current transparency setting and respects bounds', () => {
  const viewport = createTestViewport();

  // Set opacity to 45% (0.45)
  viewport.setAxisMeasurementOpacity(0.45);

  // Trigger dynamic axis rebuild with new extents
  viewport.updateAxes({ x: 10, y: 12, z: 8 });

  // Verify all newly constructed numeric tick sprites inherit 0.45 opacity
  let tickCount = 0;
  viewport.axisGroup.traverse(child => {
    if (child.isSprite && child.userData && child.userData.isNumericTick) {
      tickCount++;
      assert(approxEqual(child.material.opacity, 0.45, 1e-4), 'Rebuilt tick sprite must inherit current axisMeasurementOpacity');
      assert.strictEqual(child.visible, true);
    }
  });
  assert(tickCount > 10, 'Rebuilt axes should contain ticks');

  // Verify clamping outside [0, 1]
  viewport.setAxisMeasurementOpacity(-0.5);
  assert.strictEqual(viewport.getAxisMeasurementOpacity(), 0.0, 'Negative opacity clamped to 0.0');

  viewport.setAxisMeasurementOpacity(1.8);
  assert.strictEqual(viewport.getAxisMeasurementOpacity(), 1.0, 'Opacity above 1 clamped to 1.0');
});

test('7. Viewport3D: Vector coordinates toggle is completely decoupled from measurement transparency', () => {
  const viewport = createTestViewport();
  viewport.updateAxes({ x: 5, y: 5, z: 5 });

  // Hide vector coordinates
  viewport.setShowVectorCoordinates(false);
  assert.strictEqual(viewport.primaryLabelSprite.visible, false, 'Primary vector label should be hidden');

  // Set axis measurement transparency to 100%
  viewport.setAxisMeasurementOpacity(1.0);
  assert.strictEqual(viewport.primaryLabelSprite.visible, false, 'Primary vector label must REMAIN hidden when axis measurement opacity changes');

  // Show vector coordinates
  viewport.setShowVectorCoordinates(true);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true, 'Primary vector label should now be visible');

  // Set axis measurement transparency to 0% (hidden)
  viewport.setAxisMeasurementOpacity(0.0);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true, 'Primary vector label must REMAIN visible even when axis numbers are 0% transparent');
});

// -------------------------------------------------------------------
// PART 6: PDF Report - Practice Challenge Section Integration
// -------------------------------------------------------------------
test('8. PDF Report: ReportBuilder renders practice challenge section accurately', () => {
  const chal = PracticeGenerator.generateChallenge('hard');

  // Mock jsPDF doc
  const textCalls = [];
  const mockDoc = {
    internal: { getNumberOfPages: () => 1 },
    splitTextToSize: (text) => [text],
    text: (str, x, y) => { textCalls.push({ str, x, y }); },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    rect: () => {},
    roundedRect: () => {},
    getTextWidth: () => 30,
    addPage: () => {}
  };

  const mockResult = {
    initialVector: chal.given.v0,
    steps: chal.given.transformations.map(t => ({ name: t.name })),
    compositionVerified: true,
    composedInverse: { success: chal.expected.isInvertible, conditionNumber: 1.0 },
    practiceChallenge: chal
  };

  const builder = new ReportBuilder(mockDoc, mockResult, {});
  builder.renderPracticeChallengeSection();

  // Verify challenge details were rendered
  const allTexts = textCalls.map(t => String(t.str)).join(' ');
  assert(allTexts.includes('Practice Challenge & Problem Context'), 'Header must be rendered');
  assert(allTexts.includes(chal.title), 'Challenge title must be rendered');
  assert(allTexts.includes(chal.difficulty), 'Challenge difficulty must be rendered');
  assert(allTexts.includes('MATHEMATICALLY VERIFIED'), 'Verification status badge must be rendered');
});

// -------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------
console.log('================================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
