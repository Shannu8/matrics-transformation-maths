// Verification test suite for Dynamic Axis Extents based on the Vector
import assert from 'assert';
import { Viewport3D } from '../frontend/src/visualization/viewport3d.js';

function runDynamicAxisExtentTests() {
  console.log('================================================================');
  console.log('  Dynamic Axis Extent Verification Test Suite                   ');
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

  // Mock a lightweight dummy Viewport3D instance to test logic without WebGL canvas in Node
  function createTestViewport(minExtent = 5.0, margin = 1.0) {
    const vp = Object.create(Viewport3D.prototype);
    vp.minAxisExtent = minExtent;
    vp.axisMargin = margin;
    vp.currentCameraScale = 1.0;
    vp.axisExtents = {
      x: minExtent + 0.8,
      y: minExtent + 0.8,
      z: minExtent + 0.8,
      posX: minExtent + 0.8,
      negX: minExtent + 0.8,
      posY: minExtent + 0.8,
      negY: minExtent + 0.8,
      posZ: minExtent + 0.8,
      negZ: minExtent + 0.8
    };
    // Mock 3D scene methods
    vp.updateAxes = function(extents) {
      if (extents) this.axisExtents = { ...extents };
    };
    vp.updateGrid = function() {};
    vp.updateCameraFraming = function(maxCoord) {
      this.currentCameraScale = maxCoord > 7.0 ? Math.max(1.0, maxCoord / 6.5) : 1.0;
    };
    vp.updatePrimaryArrow = function() {};
    vp.updateProjectionLines = function() {};
    return vp;
  }

  // 1. Static calculation tests
  test('Static calculateAxisExtent respects minimum of 5 units for coord = 0', () => {
    const ext = Viewport3D.calculateAxisExtent(0, 5.0, 1.0);
    assert.ok(ext >= 5.0, `Extent should be >= 5.0 (was ${ext})`);
  });

  test('Static calculateAxisExtent respects minimum of 5 units for coord < 5', () => {
    const ext = Viewport3D.calculateAxisExtent(2.5, 5.0, 1.0);
    assert.ok(ext >= 5.0, `Extent should be >= 5.0 (was ${ext})`);
  });

  test('Static calculateAxisExtent extends dynamically for coord = 10 with margin', () => {
    const ext = Viewport3D.calculateAxisExtent(10.0, 5.0, 1.0);
    assert.ok(ext >= 11.0, `Extent should be >= 11.0 (was ${ext})`);
    assert.ok(ext > 10.0, `Extent must exceed vector coordinate 10.0`);
  });

  test('Static calculateAxisExtent extends dynamically for negative coord = -8 with margin', () => {
    const ext = Viewport3D.calculateAxisExtent(-8.0, 5.0, 1.0);
    assert.ok(ext >= 9.0, `Extent should be >= 9.0 (was ${ext})`);
    assert.ok(ext > 8.0, `Extent must exceed magnitude of -8.0`);
  });

  // 2. Viewport instance tests: All coordinates equal to zero
  test('Zero vector (0, 0, 0): All axes remain at configured minimum (>= 5 units)', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([0, 0, 0]);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 5.0, `X extent ${extents.x} must be >= 5.0`);
    assert.ok(extents.y >= 5.0, `Y extent ${extents.y} must be >= 5.0`);
    assert.ok(extents.z >= 5.0, `Z extent ${extents.z} must be >= 5.0`);
  });

  // 3. Viewport instance tests: Small coordinates (< 5)
  test('Vector (1, 2, 3): All axes remain at minimum length (>= 5 units)', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([1, 2, 3]);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 5.0, `X extent ${extents.x} must be >= 5.0`);
    assert.ok(extents.y >= 5.0, `Y extent ${extents.y} must be >= 5.0`);
    assert.ok(extents.z >= 5.0, `Z extent ${extents.z} must be >= 5.0`);
    // Endpoints are strictly within extents
    assert.ok(1.0 < extents.x, 'Endpoint x=1 must be strictly inside X extent');
    assert.ok(2.0 < extents.y, 'Endpoint y=2 must be strictly inside Y extent');
    assert.ok(3.0 < extents.z, 'Endpoint z=3 must be strictly inside Z extent');
  });

  // 4. Viewport instance tests: Vector (10, 2, 4)
  test('Vector (10, 2, 4): X-axis extends dynamically (>= 11) while Y and Z remain at minimum', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([10, 2, 4]);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 11.0, `X extent ${extents.x} must extend to at least 11.0`);
    assert.ok(extents.y >= 5.0 && extents.y <= 6.0, `Y extent ${extents.y} should remain at minimum`);
    assert.ok(extents.z >= 5.0 && extents.z <= 6.0, `Z extent ${extents.z} should remain at minimum`);
    // Endpoint 10 is inside extent with margin
    assert.ok(10.0 <= extents.x - vp.axisMargin + 0.1, 'Endpoint 10 must have margin clearance');
  });

  // 5. Viewport instance tests: Negative coordinates (-8, 3, -6)
  test('Negative coordinates (-8, 3, -6): X and Z axes extend to cover negative endpoints', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([-8, 3, -6]);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 9.0, `X extent ${extents.x} must be >= 9.0 to cover -8 with margin`);
    assert.ok(extents.y >= 5.0 && extents.y <= 6.0, `Y extent ${extents.y} remains at minimum for y=3`);
    assert.ok(extents.z >= 7.0, `Z extent ${extents.z} must be >= 7.0 to cover -6 with margin`);
    // Negative endpoints are inside
    assert.ok(Math.abs(-8) <= extents.x - vp.axisMargin + 0.1);
    assert.ok(Math.abs(-6) <= extents.z - vp.axisMargin + 0.1);
  });

  // 6. Viewport instance tests: Large coordinates (25, 10, 30)
  test('Large coordinates (25, 10, 30): All axes adapt independently', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([25, 10, 30]);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 26.0, `X extent ${extents.x} must cover 25`);
    assert.ok(extents.y >= 11.0, `Y extent ${extents.y} must cover 10`);
    assert.ok(extents.z >= 31.0, `Z extent ${extents.z} must cover 30`);
  });

  // 7. Pipeline composition test: Intermediate and recovered vectors
  test('Pipeline execution: Axes cover all stages (v0, steps, composed, and recovery)', () => {
    const vp = createTestViewport(5.0, 1.0);
    const mockPipelineResult = {
      success: true,
      initialVector: [1, 2, 3],
      steps: [
        {
          index: 1,
          name: 'Scaling x12',
          matrix: [12, 0, 0, 0, 1, 0, 0, 0, 1],
          outputVector: [12, 2, 3] // x=12
        },
        {
          index: 2,
          name: 'Inversion Z',
          matrix: [1, 0, 0, 0, 1, 0, 0, 0, -4],
          outputVector: [12, 2, -12] // z=-12
        }
      ],
      composedVector: [12, 2, -12],
      recoveredVector: [1, 2, 3],
      vectorRecoverySuccessful: true
    };

    vp.setPipelineData(mockPipelineResult);
    const extents = vp.getAxisExtents();

    // Must cover x=12 and z=-12 with margin
    assert.ok(extents.x >= 13.0, `X extent ${extents.x} must cover intermediate step x=12`);
    assert.ok(extents.z >= 13.0, `Z extent ${extents.z} must cover intermediate step z=-12`);
    assert.ok(extents.y >= 5.0, `Y extent ${extents.y} must be >= 5.0`);
  });

  // 8. Rotation norm consideration
  test('Rotation step: Axis extent factors in vector norm along all axes', () => {
    const vp = createTestViewport(5.0, 1.0);
    // Vector [10, 0, 0] rotated around Z by 90 degrees reaches [0, 10, 0]
    const mockResult = {
      success: true,
      initialVector: [10, 0, 0],
      steps: [
        {
          index: 1,
          name: 'Rotation Z 90deg',
          matrix: [0, -1, 0, 1, 0, 0, 0, 0, 1],
          outputVector: [0, 10, 0]
        }
      ],
      composedVector: [0, 10, 0],
      recoveredVector: [10, 0, 0],
      vectorRecoverySuccessful: true
    };

    vp.setPipelineData(mockResult);
    const extents = vp.getAxisExtents();
    assert.ok(extents.x >= 11.0, `X extent ${extents.x} must be >= 11.0`);
    assert.ok(extents.y >= 11.0, `Y extent ${extents.y} must be >= 11.0`);
  });

  // 9. Camera framing: does not zoom out for coordinates <= 7
  test('Camera framing: maintains default scale (1.0) for coordinates <= 7.0', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([1, 2, 3]);
    assert.strictEqual(vp.currentCameraScale, 1.0);
    vp.setVector([5, 5, 5]);
    assert.strictEqual(vp.currentCameraScale, 1.0);
  });

  // 10. Camera framing: adjusts only when coordinates exceed standard view
  test('Camera framing: adjusts scale only when coordinates exceed 7.0', () => {
    const vp = createTestViewport(5.0, 1.0);
    vp.setVector([13, 2, 4]);
    assert.ok(vp.currentCameraScale > 1.0, `Camera scale should adjust for coord 13 (was ${vp.currentCameraScale})`);
  });

  console.log('----------------------------------------------------------------');
  console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDynamicAxisExtentTests();
