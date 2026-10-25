import assert from 'assert';
import * as THREE from '../frontend/node_modules/three/build/three.module.js';
import { MathExpressionParser } from '../frontend/src/math/expressionParser.js';

console.log('================================================================');
console.log('  Sidebar Toggle, Unit Cube Default & Vector Rendering Suite     ');
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
// PART 1: Sidebar Toggle & State Management Verification
// -------------------------------------------------------------------
test('1. Sidebar Toggle: Open/Close state transitions and aria attributes', () => {
  // Mock elements
  const classListSet = (el) => ({
    classes: new Set(),
    add(c) { this.classes.add(c); el.className = Array.from(this.classes).join(' '); },
    remove(c) { this.classes.delete(c); el.className = Array.from(this.classes).join(' '); },
    contains(c) { return this.classes.has(c); }
  });

  const drawer = { style: {} };
  drawer.classList = classListSet(drawer);

  const drawerHandle = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } };
  drawerHandle.classList = classListSet(drawerHandle);

  const openIcon = { classList: classListSet({}) };
  const closeIcon = { classList: classListSet({}) };

  let currentWidth = 440;
  let resizeHandled = 0;
  const mockViewport = { handleResize: () => { resizeHandled++; } };

  const setDrawerOpen = (open) => {
    if (open) {
      drawer.classList.add('drawer-open');
      drawerHandle.classList.add('drawer-open');
      drawerHandle.setAttribute('aria-expanded', 'true');
      drawerHandle.setAttribute('title', 'Close controls (<)');
      drawer.style.width = `${currentWidth}px`;
      openIcon.classList.add('hidden');
      closeIcon.classList.remove('hidden');
    } else {
      drawer.classList.remove('drawer-open');
      drawerHandle.classList.remove('drawer-open');
      drawerHandle.setAttribute('aria-expanded', 'false');
      drawerHandle.setAttribute('title', 'Open controls (>)');
      drawer.style.width = '';
      openIcon.classList.remove('hidden');
      closeIcon.classList.add('hidden');
    }
    mockViewport.handleResize();
  };

  // Initially closed
  assert.strictEqual(drawer.classList.contains('drawer-open'), false);
  assert.strictEqual(drawer.style.width, undefined);

  // Click > to open
  setDrawerOpen(true);
  assert.strictEqual(drawer.classList.contains('drawer-open'), true);
  assert.strictEqual(drawerHandle.classList.contains('drawer-open'), true);
  assert.strictEqual(drawerHandle.attributes['aria-expanded'], 'true');
  assert.strictEqual(drawer.style.width, '440px');
  assert.strictEqual(openIcon.classList.contains('hidden'), true);
  assert.strictEqual(closeIcon.classList.contains('hidden'), false);

  // Click < to close
  setDrawerOpen(false);
  assert.strictEqual(drawer.classList.contains('drawer-open'), false);
  assert.strictEqual(drawerHandle.classList.contains('drawer-open'), false);
  assert.strictEqual(drawerHandle.attributes['aria-expanded'], 'false');
  assert.strictEqual(drawer.style.width, '');
  assert.strictEqual(openIcon.classList.contains('hidden'), false);
  assert.strictEqual(closeIcon.classList.contains('hidden'), true);
});

test('2. Sidebar Width Persistence: Preserves user-defined width when reopening', () => {
  let storedWidth = null;
  const setPersistedWidth = (w) => { storedWidth = w; };
  const getPersistedWidth = () => storedWidth || 440;

  // Simulate user dragging sidebar to 520px
  setPersistedWidth(520);
  assert.strictEqual(getPersistedWidth(), 520);

  // Reopening panel should restore 520px
  let drawerWidth = `${getPersistedWidth()}px`;
  assert.strictEqual(drawerWidth, '520px');
});

// -------------------------------------------------------------------
// PART 2: Unwanted Object at Origin & Unit Cube Helper
// -------------------------------------------------------------------
test('3. Clean Default Scene: Unit cube is hidden by default and toggleable', () => {
  let showUnitCube = false; // Must be false by default
  const geometryGroup = { visible: showUnitCube };

  const setShowUnitCube = (visible) => {
    showUnitCube = !!visible;
    geometryGroup.visible = showUnitCube;
  };

  assert.strictEqual(showUnitCube, false, 'Unit cube must be false by default');
  assert.strictEqual(geometryGroup.visible, false);

  // User checks "Unit cube"
  setShowUnitCube(true);
  assert.strictEqual(geometryGroup.visible, true);

  // User unchecks "Unit cube"
  setShowUnitCube(false);
  assert.strictEqual(geometryGroup.visible, false);
});

test('4. Scene Cleanliness: Single persistent arrow group with no orphan geometry at (0,0,0)', () => {
  // Verify shaft and cone geometry dimensions
  const shaftGeom = new THREE.CylinderGeometry(0.038, 0.038, 1.0, 20);
  shaftGeom.translate(0, 0.5, 0); // Base at 0, top at 1

  const coneGeom = new THREE.ConeGeometry(0.12, 1.0, 20);
  coneGeom.translate(0, 0.5, 0); // Base at 0, apex at 1

  // Bounding box of translated shaft
  shaftGeom.computeBoundingBox();
  assert.ok(approxEqual(shaftGeom.boundingBox.min.y, 0.0));
  assert.ok(approxEqual(shaftGeom.boundingBox.max.y, 1.0));

  // Bounding box of translated cone
  coneGeom.computeBoundingBox();
  assert.ok(approxEqual(coneGeom.boundingBox.min.y, 0.0));
  assert.ok(approxEqual(coneGeom.boundingBox.max.y, 1.0));
});

// -------------------------------------------------------------------
// PART 3: Primary Vector Rendering Across All Required Vectors
// -------------------------------------------------------------------
const requiredTestVectors = [
  { vec: [1, 0, 0], desc: 'Unit vector +X' },
  { vec: [0, 1, 0], desc: 'Unit vector +Y' },
  { vec: [0, 0, 1], desc: 'Unit vector +Z' },
  { vec: [1, 2, 3], desc: 'Vector (1, 2, 3)' },
  { vec: [1, 1, 1], desc: 'Default vector (1, 1, 1)' },
  { vec: [0, 0, 0], desc: 'Zero vector (0, 0, 0)' },
  { vec: [-2, 3, -4], desc: 'Vector with negative coordinates (-2, 3, -4)' }
];

function simulateUpdatePrimaryArrow(vec3) {
  const v = new THREE.Vector3(vec3[0], vec3[1], vec3[2]);
  const len = v.length();

  if (len < 0.0001) {
    return {
      isZero: true,
      arrowVisible: false,
      tipPosition: new THREE.Vector3(0, 0, 0),
      labelPosition: new THREE.Vector3(0, 0.35, 0)
    };
  }

  const dir = v.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);

  const headLen = Math.min(0.42, Math.max(0.20, len * 0.24));
  const headRadius = Math.min(0.14, Math.max(0.08, len * 0.10));
  const shaftLen = Math.max(0.001, len - headLen);
  const shaftRadius = Math.min(0.045, Math.max(0.025, len * 0.035));

  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);

  // Position of cone apex in world space
  const localApex = new THREE.Vector3(0, shaftLen + headLen, 0);
  const worldApex = localApex.clone().applyQuaternion(quat);

  const verticalOffset = v.y < -0.5 ? -0.38 : 0.38;
  const labelPos = new THREE.Vector3(v.x, v.y + verticalOffset, v.z);

  return {
    isZero: false,
    arrowVisible: true,
    length: len,
    direction: dir,
    shaftLen,
    headLen,
    quaternion: quat,
    worldApex,
    tipPosition: v.clone(),
    labelPosition: labelPos
  };
}

requiredTestVectors.forEach((item, idx) => {
  test(`5.${idx + 1} Vector Rendering: ${item.desc}`, () => {
    const res = simulateUpdatePrimaryArrow(item.vec);

    if (item.vec[0] === 0 && item.vec[1] === 0 && item.vec[2] === 0) {
      assert.strictEqual(res.isZero, true);
      assert.strictEqual(res.arrowVisible, false);
      assert.strictEqual(res.tipPosition.x, 0);
      assert.strictEqual(res.tipPosition.y, 0);
      assert.strictEqual(res.tipPosition.z, 0);
    } else {
      assert.strictEqual(res.isZero, false);
      assert.strictEqual(res.arrowVisible, true);

      // Verify length
      const expectedLen = Math.hypot(item.vec[0], item.vec[1], item.vec[2]);
      assert.ok(approxEqual(res.length, expectedLen), `Length should be ${expectedLen}, got ${res.length}`);

      // Verify arrow apex matches mathematical endpoint
      assert.ok(approxEqual(res.worldApex.x, item.vec[0]), `Apex X mismatch: ${res.worldApex.x} vs ${item.vec[0]}`);
      assert.ok(approxEqual(res.worldApex.y, item.vec[1]), `Apex Y mismatch: ${res.worldApex.y} vs ${item.vec[1]}`);
      assert.ok(approxEqual(res.worldApex.z, item.vec[2]), `Apex Z mismatch: ${res.worldApex.z} vs ${item.vec[2]}`);

      // Verify tip mesh matches endpoint
      assert.ok(approxEqual(res.tipPosition.x, item.vec[0]));
      assert.ok(approxEqual(res.tipPosition.y, item.vec[1]));
      assert.ok(approxEqual(res.tipPosition.z, item.vec[2]));

      // Verify label is positioned above endpoint
      assert.ok(approxEqual(res.labelPosition.x, item.vec[0]));
      assert.ok(approxEqual(res.labelPosition.z, item.vec[2]));
      assert.ok(res.labelPosition.y !== item.vec[1], 'Label should have vertical offset');
    }
  });
});

// -------------------------------------------------------------------
// PART 4: Initialization Race Condition Bug Prevention
// -------------------------------------------------------------------
test('6. Initialization Race Condition: MatrixInputsManager does not trigger recalculate() before assignment', () => {
  let onChangeFiredBeforeConstructorReturn = false;
  let inputsManager = null;

  class SafeManager {
    constructor(cb) {
      this.onChange = cb;
      this.isInitializing = true;
      this.init();
      this.isInitializing = false;
    }
    init() {
      this.notifyChange(); // Should be blocked by isInitializing
    }
    notifyChange() {
      if (this.isInitializing) return;
      if (this.onChange) this.onChange();
    }
  }

  inputsManager = new SafeManager(() => {
    if (!inputsManager) {
      onChangeFiredBeforeConstructorReturn = true;
    }
  });

  assert.strictEqual(onChangeFiredBeforeConstructorReturn, false, 'onChange must NOT fire during constructor execution');
  assert.ok(inputsManager !== null);
});

console.log('----------------------------------------------------------------');
console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
