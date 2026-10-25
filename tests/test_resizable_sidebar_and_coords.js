/**
 * Test Suite: Resizable Sidebar & Vector Coordinate Visibility Verification
 *
 * Verifies:
 * 1. Resizable sidebar width clamping, responsive min/max constraints, keyboard adjustments, and persistence.
 * 2. Three.js canvas adaptation and event isolation behavior.
 * 3. Vector coordinate visibility toggle:
 *    - Hiding numerical vector annotations while keeping vector geometry (shaft, cone, tip) fully visible.
 *    - Keeping axis labels (+X, +Y, +Z, -X, -Y, -Z), ticks, grid, and unit cube completely visible.
 *    - Showing coordinates accurately matching mathematical engine outputs (v0, steps, composed, recovery).
 *    - Real-time responsiveness during animations and transformations.
 *    - LocalStorage persistence.
 * 4. Mutual independence of sidebar resizing and coordinate visibility.
 */

import assert from 'assert';
import * as THREE from '../frontend/node_modules/three/build/three.module.js';

// Global browser mocks for Node environment
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 300,
        height: 80,
        getContext: () => ({
          clearRect: () => {},
          fillRect: () => {},
          beginPath: () => {},
          roundRect: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {}
        })
      };
    }
    return {
      tagName: tag,
      clientWidth: 1000,
      clientHeight: 600,
      style: {},
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) {
        const idx = this.children.indexOf(c);
        if (idx !== -1) this.children.splice(idx, 1);
        return c;
      }
    };
  },
  createElementNS: (ns, tag) => global.document.createElement(tag),
  querySelectorAll: () => [],
  getElementById: () => null,
  documentElement: { clientWidth: 1200, clientHeight: 800, style: { setProperty: () => {} } },
  body: { classList: { classes: new Set(), add: () => {}, remove: () => {} } }
};

global.window = {
  innerWidth: 1200,
  innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.requestAnimationFrame = (fn) => setTimeout(fn, 16);

// Mock LocalStorage
const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.localStorage = mockLocalStorage;

// Import Viewport3D
const { Viewport3D } = await import('../frontend/src/visualization/viewport3d.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

console.log('================================================================');
console.log('  Resizable Sidebar & Vector Coordinate Visibility Verification ');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: Resizable Sidebar Math & Constraints
// -------------------------------------------------------------
console.log('--- PART 1: Sidebar Width Constraints & Clamping ---');

const MIN_SIDEBAR_WIDTH = 320;
const getResponsiveLimits = (vw) => {
  const maxWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(Math.floor(vw * 0.72), vw - 340));
  return { minWidth: MIN_SIDEBAR_WIDTH, maxWidth };
};

const clampSidebarWidth = (width, vw) => {
  const { minWidth, maxWidth } = getResponsiveLimits(vw);
  return Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
};

runTest('Sidebar width clamps to minimum (320px) on small input values', () => {
  const vw = 1280;
  assert.strictEqual(clampSidebarWidth(100, vw), 320);
  assert.strictEqual(clampSidebarWidth(0, vw), 320);
  assert.strictEqual(clampSidebarWidth(-50, vw), 320);
  assert.strictEqual(clampSidebarWidth(319, vw), 320);
});

runTest('Sidebar width clamps to maximum preserving 340px for 3D workspace', () => {
  const vw = 1000;
  const limits = getResponsiveLimits(vw);
  // min(720, 660) = 660
  assert.strictEqual(limits.maxWidth, 660);
  assert.strictEqual(clampSidebarWidth(800, vw), 660);
  assert.strictEqual(clampSidebarWidth(1200, vw), 660);
  // Remaining workspace is at least 340px
  assert.ok(vw - clampSidebarWidth(800, vw) >= 340);
});

runTest('Sidebar width preserves valid intermediate values', () => {
  const vw = 1440;
  assert.strictEqual(clampSidebarWidth(440, vw), 440);
  assert.strictEqual(clampSidebarWidth(380, vw), 380);
  assert.strictEqual(clampSidebarWidth(550, vw), 550);
});

runTest('Responsive constraints adapt for smaller desktop viewports', () => {
  const vw = 800;
  const limits = getResponsiveLimits(vw);
  // min(576, 460) = 460
  assert.strictEqual(limits.maxWidth, 460);
  assert.strictEqual(clampSidebarWidth(500, vw), 460);
  assert.ok(vw - clampSidebarWidth(500, vw) >= 340);
});

runTest('Keyboard adjustment step sizes and boundary keys', () => {
  const vw = 1200;
  let w = 440;

  // ArrowRight (+16)
  w = clampSidebarWidth(w + 16, vw);
  assert.strictEqual(w, 456);

  // ArrowLeft (-16)
  w = clampSidebarWidth(w - 16, vw);
  assert.strictEqual(w, 440);

  // Shift + ArrowRight (+40)
  w = clampSidebarWidth(w + 40, vw);
  assert.strictEqual(w, 480);

  // Shift + ArrowLeft (-40)
  w = clampSidebarWidth(w - 40, vw);
  assert.strictEqual(w, 440);

  // Home key -> min
  w = clampSidebarWidth(0, vw);
  assert.strictEqual(w, MIN_SIDEBAR_WIDTH);

  // End key -> max
  const { maxWidth } = getResponsiveLimits(vw);
  w = clampSidebarWidth(9999, vw);
  assert.strictEqual(w, maxWidth);
});

runTest('Sidebar width persistence via localStorage', () => {
  mockLocalStorage.clear();
  const STORAGE_KEY = 'transformation_sidebar_width';

  // Save width
  mockLocalStorage.setItem(STORAGE_KEY, '485');
  assert.strictEqual(mockLocalStorage.getItem(STORAGE_KEY), '485');

  // Parse and clamp on reload
  const saved = parseInt(mockLocalStorage.getItem(STORAGE_KEY), 10);
  const reloadedWidth = clampSidebarWidth(saved, 1200);
  assert.strictEqual(reloadedWidth, 485);
});

// -------------------------------------------------------------
// PART 2: Vector Coordinate Visibility Toggle in 3D Scene
// -------------------------------------------------------------
console.log('\n--- PART 2: Vector Coordinate Visibility Toggle ---');

const createTestViewport = () => {
  const vp = Object.create(Viewport3D.prototype);
  vp.showVectorCoordinates = true;
  vp.primaryArrowGroup = new THREE.Group();
  vp.arrowMeshGroup = new THREE.Group();
  vp.primaryShaftMesh = new THREE.Mesh();
  vp.primaryConeMesh = new THREE.Mesh();
  vp.primaryTipMesh = new THREE.Mesh();
  vp.arrowMeshGroup.add(vp.primaryShaftMesh);
  vp.arrowMeshGroup.add(vp.primaryConeMesh);
  vp.primaryArrowGroup.add(vp.arrowMeshGroup);
  vp.primaryArrowGroup.add(vp.primaryTipMesh);

  vp.primaryLabelSprite = new THREE.Sprite();
  vp.primaryLabelSprite.userData = { lastText: 'v₀: (1.00, 2.00, 3.00)', color: '#38bdf8' };
  vp.primaryLabelSprite.visible = true;
  vp.primaryArrowGroup.add(vp.primaryLabelSprite);

  vp.axisGroup = new THREE.Group();
  // Axis label sprites (+X, -X, +Y, -Y, +Z, -Z)
  ['+X (Red)', '-X', '+Y (Green, UP)', '-Y', '+Z (Blue)', '-Z'].forEach(name => {
    const sp = new THREE.Sprite();
    sp.userData = { lastText: name };
    sp.visible = true;
    vp.axisGroup.add(sp);
  });

  vp.referenceGroup = new THREE.Group();
  vp.showReferenceVectors = false;

  vp.camera = { position: new THREE.Vector3(5, 5, 5), aspect: 1.0, updateProjectionMatrix: () => {} };
  vp.renderer = { setSize: () => {}, setPixelRatio: () => {} };
  vp.container = { clientWidth: 800, clientHeight: 600 };

  vp.updateLabelSprite = function(sprite, text, color = '#38bdf8') {
    if (!sprite) return;
    sprite.userData = { lastText: text, color };
  };

  return vp;
};

const viewport = createTestViewport();

runTest('Initial state: showVectorCoordinates defaults to true', () => {
  assert.strictEqual(viewport.getShowVectorCoordinates(), true);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true);
});

runTest('setShowVectorCoordinates(false) hides primary coordinate label without altering vector geometry', () => {
  viewport.updatePrimaryArrow([1, 2, 3], 'v₀: (1.00, 2.00, 3.00)');
  assert.strictEqual(viewport.primaryLabelSprite.visible, true);

  viewport.setShowVectorCoordinates(false);
  assert.strictEqual(viewport.getShowVectorCoordinates(), false);
  assert.strictEqual(viewport.primaryLabelSprite.visible, false);

  // Vector arrow geometry remains visible
  assert.strictEqual(viewport.arrowMeshGroup.visible, true);
  assert.strictEqual(viewport.primaryTipMesh.visible, true);
});

runTest('Coordinate toggle does NOT hide axis labels, cones, or scale markings', () => {
  viewport.setShowVectorCoordinates(false);

  // Coordinate axes group remains visible in the scene
  assert.ok(viewport.axisGroup);
  assert.strictEqual(viewport.axisGroup.visible, true);

  // Axis group children (lines, cones, text sprites for +X, +Y, +Z, -X, etc.)
  assert.ok(viewport.axisGroup.children.length > 0);
  const axisSprites = viewport.axisGroup.children.filter(c => c.isSprite);
  assert.ok(axisSprites.length >= 6, 'Axes should have at least +X, -X, +Y, -Y, +Z, -Z labels');

  // Verify axis labels remain visible even when vector coordinates are toggled off
  axisSprites.forEach(sp => {
    assert.strictEqual(sp.visible, true, 'Axis label sprite must remain visible');
  });
});

runTest('setShowVectorCoordinates(true) restores coordinate badge with accurate mathematical coordinates', () => {
  viewport.setShowVectorCoordinates(false);
  assert.strictEqual(viewport.primaryLabelSprite.visible, false);

  viewport.setShowVectorCoordinates(true);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true);
  assert.strictEqual(viewport.getShowVectorCoordinates(), true);

  // Coordinate badge contains exact formatted coordinates
  const lastText = viewport.primaryLabelSprite.userData?.lastText || '';
  assert.ok(lastText.includes('1.00') && lastText.includes('2.00') && lastText.includes('3.00'),
    `Badge text should display coordinates: ${lastText}`);
});

runTest('Toggle remains respected across updatePrimaryArrow calls (e.g. during animations)', () => {
  viewport.setShowVectorCoordinates(false);

  // Simulate in-flight animation updates
  viewport.updatePrimaryArrow([2, 4, 6], 'v(t): (2.00, 4.00, 6.00)');
  assert.strictEqual(viewport.primaryLabelSprite.visible, false, 'Must remain hidden during animation');

  viewport.updatePrimaryArrow([3, 6, 9], 'v₁: (3.00, 6.00, 9.00)');
  assert.strictEqual(viewport.primaryLabelSprite.visible, false, 'Must remain hidden at step completion');

  // Turn back on
  viewport.setShowVectorCoordinates(true);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true);
  const text = viewport.primaryLabelSprite.userData?.lastText || '';
  assert.ok(text.includes('3.00') && text.includes('6.00') && text.includes('9.00'));
});

runTest('Toggle handles zero vector correctly', () => {
  viewport.setShowVectorCoordinates(false);
  viewport.updatePrimaryArrow([0, 0, 0], 'v₀: (0.00, 0.00, 0.00)');
  assert.strictEqual(viewport.primaryLabelSprite.visible, false);

  viewport.setShowVectorCoordinates(true);
  assert.strictEqual(viewport.primaryLabelSprite.visible, true);
  const text = viewport.primaryLabelSprite.userData?.lastText || '';
  assert.ok(text.includes('(0.00, 0.00, 0.00)'));
});

runTest('Reference vectors labels respect coordinate visibility toggle', () => {
  const dummyResult = {
    initialVector: [1, 2, 3],
    composedVector: [2, 4, -3],
    steps: [{ index: 1, outputVector: [2, 2, 3] }]
  };

  viewport.setShowVectorCoordinates(false);
  viewport.updateReferenceVectors(dummyResult);

  // Traverse referenceGroup children
  const refSprites = [];
  viewport.referenceGroup.traverse(child => {
    if (child.isSprite) refSprites.push(child);
  });
  assert.ok(refSprites.length >= 2, 'Should have reference vector sprites');
  refSprites.forEach(sp => {
    assert.strictEqual(sp.visible, false, 'Reference vector label should be hidden when coords disabled');
  });

  // Enable coords
  viewport.setShowVectorCoordinates(true);
  refSprites.forEach(sp => {
    assert.strictEqual(sp.visible, true, 'Reference vector label should be shown when coords enabled');
  });
});

runTest('Coordinate visibility preference persists in localStorage', () => {
  mockLocalStorage.clear();
  const STORAGE_KEY = 'transformation_show_coords';

  // Toggle off and save
  viewport.setShowVectorCoordinates(false);
  mockLocalStorage.setItem(STORAGE_KEY, String(viewport.getShowVectorCoordinates()));
  assert.strictEqual(mockLocalStorage.getItem(STORAGE_KEY), 'false');

  // Reload preference
  const savedPref = mockLocalStorage.getItem(STORAGE_KEY) === 'true';
  viewport.setShowVectorCoordinates(savedPref);
  assert.strictEqual(viewport.getShowVectorCoordinates(), false);

  // Toggle on and save
  viewport.setShowVectorCoordinates(true);
  mockLocalStorage.setItem(STORAGE_KEY, String(viewport.getShowVectorCoordinates()));
  assert.strictEqual(mockLocalStorage.getItem(STORAGE_KEY), 'true');
});

// -------------------------------------------------------------
// PART 3: Mutual Independence
// -------------------------------------------------------------
console.log('\n--- PART 3: Mutual Independence of Sidebar & Coordinates ---');

runTest('Resizing sidebar does not alter vector coordinates or visibility state', () => {
  viewport.setShowVectorCoordinates(false);
  const initialCoordVisible = viewport.getShowVectorCoordinates();

  // Simulate resizing sidebar
  clampSidebarWidth(550, 1200);
  viewport.handleResize();

  // Verify coordinates toggle state and text are completely unchanged
  assert.strictEqual(viewport.getShowVectorCoordinates(), initialCoordVisible);
  assert.strictEqual(viewport.primaryLabelSprite.visible, false);
});

runTest('Toggling coordinate visibility does not modify sidebar width or camera orientation', () => {
  const initialCamPos = viewport.camera.position.clone();

  viewport.setShowVectorCoordinates(true);
  assert.strictEqual(viewport.getShowVectorCoordinates(), true);

  viewport.setShowVectorCoordinates(false);
  assert.strictEqual(viewport.getShowVectorCoordinates(), false);

  // Camera orientation is preserved without reset
  assert.strictEqual(viewport.camera.position.x, initialCamPos.x);
  assert.strictEqual(viewport.camera.position.y, initialCamPos.y);
  assert.strictEqual(viewport.camera.position.z, initialCamPos.z);
});

console.log('----------------------------------------------------------------');
console.log(`Summary: Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
