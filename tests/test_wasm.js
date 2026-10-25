const path = require('path');
const createTransformationEngine = require('../engine/build/transformation_engine.js');

async function runWasmVerification() {
    console.log("========================================================");
    console.log("  WebAssembly Integration Verification Test Suite       ");
    console.log("========================================================");

    const Module = await createTransformationEngine();
    console.log("[+] Wasm module initialized successfully.");
    
    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (!cond) {
            console.error("[-] FAILED: " + msg);
            failed++;
        } else {
            console.log("[PASS] " + msg);
            passed++;
        }
    }

    assert(Module.isEngineReady(), "Module.isEngineReady() returns true");

    // Test 1: Handbook 12.2 Scaling followed by reflection
    // T1 = diag(2,1,1); T2 = diag(1,1,-1); v = [1,2,3]^T; C*v = [2,2,-3]^T
    const test1Payload = {
        matrices: [
            [2.0, 0.0, 0.0,  0.0, 1.0, 0.0,  0.0, 0.0, 1.0],
            [1.0, 0.0, 0.0,  0.0, 1.0, 0.0,  0.0, 0.0, -1.0]
        ],
        vector: [1.0, 2.0, 3.0],
        tolerance: 1e-9
    };

    const res1Json = Module.executePipelineJson(JSON.stringify(test1Payload));
    const res1 = JSON.parse(res1Json);

    assert(res1.success === true, "Pipeline execution succeeded for 12.2");
    assert(res1.compositionVerified === true, "Composition verified: C*v == v_sequential");
    assert(res1.vectorRecoverySuccessful === true, "Vector recovery successful");
    assert(Math.abs(res1.composedVector[0] - 2.0) < 1e-9 &&
           Math.abs(res1.composedVector[1] - 2.0) < 1e-9 &&
           Math.abs(res1.composedVector[2] - (-3.0)) < 1e-9, 
           "Composed vector matches Handbook 12.2: [2, 2, -3]^T");

    // Test 2: Intermediate vectors
    assert(Math.abs(res1.steps[0].outputVector[0] - 2.0) < 1e-9 &&
           Math.abs(res1.steps[0].outputVector[1] - 2.0) < 1e-9 &&
           Math.abs(res1.steps[0].outputVector[2] - 3.0) < 1e-9,
           "Intermediate step 1 vector is [2, 2, 3]^T");
    assert(Math.abs(res1.steps[1].outputVector[0] - 2.0) < 1e-9 &&
           Math.abs(res1.steps[1].outputVector[1] - 2.0) < 1e-9 &&
           Math.abs(res1.steps[1].outputVector[2] - (-3.0)) < 1e-9,
           "Intermediate step 2 vector is [2, 2, -3]^T");

    // Test 3: Residuals and Condition Number
    assert(res1.composedInverse.success === true, "Composed inverse is valid");
    assert(res1.composedInverse.residualE1Norm < 1e-12, "Residual E1 norm is near zero");
    assert(res1.composedInverse.conditionNumber >= 1.0, "Condition number is calculated");

    // Test 4: Presets through Wasm
    const rotZJson = Module.getPresetMatrixJson("rotateZ", 90.0, 0, 0);
    const rotZ = JSON.parse(rotZJson);
    assert(rotZ.success === true, "Preset rotateZ succeeded");
    // [cos(90), -sin(90), 0, sin(90), cos(90), 0, 0, 0, 1] => [0, -1, 0, 1, 0, 0, 0, 0, 1]
    assert(Math.abs(rotZ.matrix[0]) < 1e-9 &&
           Math.abs(rotZ.matrix[1] - (-1.0)) < 1e-9 &&
           Math.abs(rotZ.matrix[3] - 1.0) < 1e-9 &&
           Math.abs(rotZ.matrix[4]) < 1e-9,
           "RotateZ matrix matches analytical values");

    // Test 5: Inverting singular matrix
    const singMatrix = [
        1.0, 2.0, 3.0,
        2.0, 4.0, 6.0,
        0.0, 1.0, 1.0
    ];
    const singRes = JSON.parse(Module.invertMatrixJson(JSON.stringify(singMatrix)));
    assert(singRes.success === false, "Singular matrix correctly rejected by Wasm invertMatrix");
    assert(singRes.status.includes("SINGULAR"), "Status indicates singular matrix: " + singRes.status);

    // Test 6: Invalid transformation count (n=1)
    const invalidCountPayload = {
        matrices: [ [1,0,0, 0,1,0, 0,0,1] ],
        vector: [1, 2, 3]
    };
    const invalidRes = JSON.parse(Module.executePipelineJson(JSON.stringify(invalidCountPayload)));
    assert(invalidRes.success === false, "Reject invalid count n=1");
    assert(invalidRes.errorMessage.includes("exactly 2 or 3"), "Error message informs about count constraint");

    // Test 7: Focused verification for v=(1,1,1) and 45 deg X rotation
    const rotX45Json = Module.getPresetMatrixJson("rotateX", 45.0, 0, 0);
    const rotX45 = JSON.parse(rotX45Json);
    assert(rotX45.success === true, "Wasm rotateX 45 deg succeeded");

    const rotXPayload = {
        matrices: [
            rotX45.matrix,
            [1,0,0, 0,1,0, 0,0,1]
        ],
        vector: [1.0, 1.0, 1.0],
        tolerance: 1e-9
    };
    const rotXRes = JSON.parse(Module.executePipelineJson(JSON.stringify(rotXPayload)));
    assert(rotXRes.success === true, "Pipeline execution for RotX(45) on v=(1,1,1) succeeded");
    assert(Math.abs(rotXRes.composedVector[0] - 1.0) < 1e-9, "RotX(45) x component is 1.0");
    assert(Math.abs(rotXRes.composedVector[1] - 0.0) < 1e-9, "RotX(45) y component is 0.0");
    assert(Math.abs(rotXRes.composedVector[2] - Math.SQRT2) < 1e-9, "RotX(45) z component is sqrt(2) (~1.41421356)");
    assert(rotXRes.vectorRecoverySuccessful === true, "RotX(45) inverse recovery succeeded");

    // Test 8: Focused Verification for Rotations X, Y, Z at 45° (Requirement 7 & 8)
    const c45 = Math.cos(45.0 * Math.PI / 180.0);
    const s45 = Math.sin(45.0 * Math.PI / 180.0);

    // Verify RotX(45) entries: [1, 0, 0, 0, cos, -sin, 0, sin, cos]
    assert(Math.abs(rotX45.matrix[0] - 1.0) < 1e-9 &&
           Math.abs(rotX45.matrix[1] - 0.0) < 1e-9 &&
           Math.abs(rotX45.matrix[2] - 0.0) < 1e-9 &&
           Math.abs(rotX45.matrix[3] - 0.0) < 1e-9 &&
           Math.abs(rotX45.matrix[4] - c45) < 1e-9 &&
           Math.abs(rotX45.matrix[5] - (-s45)) < 1e-9 &&
           Math.abs(rotX45.matrix[6] - 0.0) < 1e-9 &&
           Math.abs(rotX45.matrix[7] - s45) < 1e-9 &&
           Math.abs(rotX45.matrix[8] - c45) < 1e-9,
           "RotX(45) matrix entries match expected analytical formula");

    // Verify RotY(45) entries: [cos, 0, sin, 0, 1, 0, -sin, 0, cos]
    const rotY45Json = Module.getPresetMatrixJson("rotateY", 45.0, 0, 0);
    const rotY45 = JSON.parse(rotY45Json);
    assert(rotY45.success === true, "Wasm rotateY 45 deg succeeded");
    assert(Math.abs(rotY45.matrix[0] - c45) < 1e-9 &&
           Math.abs(rotY45.matrix[1] - 0.0) < 1e-9 &&
           Math.abs(rotY45.matrix[2] - s45) < 1e-9 &&
           Math.abs(rotY45.matrix[3] - 0.0) < 1e-9 &&
           Math.abs(rotY45.matrix[4] - 1.0) < 1e-9 &&
           Math.abs(rotY45.matrix[5] - 0.0) < 1e-9 &&
           Math.abs(rotY45.matrix[6] - (-s45)) < 1e-9 &&
           Math.abs(rotY45.matrix[7] - 0.0) < 1e-9 &&
           Math.abs(rotY45.matrix[8] - c45) < 1e-9,
           "RotY(45) matrix entries match expected [cos, 0, sin; 0, 1, 0; -sin, 0, cos]");

    // Requirement 8: Verify that a Y rotation transforms (1,0,0) to approx (0.7071, 0, -0.7071)
    const rotYPayload = {
        matrices: [
            rotY45.matrix,
            [1,0,0, 0,1,0, 0,0,1]
        ],
        vector: [1.0, 0.0, 0.0],
        tolerance: 1e-9
    };
    const rotYRes = JSON.parse(Module.executePipelineJson(JSON.stringify(rotYPayload)));
    assert(rotYRes.success === true, "Pipeline execution for RotY(45) on v=(1,0,0) succeeded");
    assert(Math.abs(rotYRes.composedVector[0] - c45) < 1e-9, "RotY(45) * (1,0,0) -> x = cos(45) (~0.70710678)");
    assert(Math.abs(rotYRes.composedVector[1] - 0.0) < 1e-9, "RotY(45) * (1,0,0) -> y = 0.0");
    assert(Math.abs(rotYRes.composedVector[2] - (-s45)) < 1e-9, "RotY(45) * (1,0,0) -> z = -sin(45) (~-0.70710678)");
    assert(rotYRes.vectorRecoverySuccessful === true, "RotY(45) inverse recovery succeeded");

    // Verify RotZ(45) entries: [cos, -sin, 0, sin, cos, 0, 0, 0, 1]
    const rotZ45Json = Module.getPresetMatrixJson("rotateZ", 45.0, 0, 0);
    const rotZ45 = JSON.parse(rotZ45Json);
    assert(rotZ45.success === true, "Wasm rotateZ 45 deg succeeded");
    assert(Math.abs(rotZ45.matrix[0] - c45) < 1e-9 &&
           Math.abs(rotZ45.matrix[1] - (-s45)) < 1e-9 &&
           Math.abs(rotZ45.matrix[2] - 0.0) < 1e-9 &&
           Math.abs(rotZ45.matrix[3] - s45) < 1e-9 &&
           Math.abs(rotZ45.matrix[4] - c45) < 1e-9 &&
           Math.abs(rotZ45.matrix[5] - 0.0) < 1e-9 &&
           Math.abs(rotZ45.matrix[6] - 0.0) < 1e-9 &&
           Math.abs(rotZ45.matrix[7] - 0.0) < 1e-9 &&
           Math.abs(rotZ45.matrix[8] - 1.0) < 1e-9,
           "RotZ(45) matrix entries match expected [cos, -sin, 0; sin, cos, 0; 0, 0, 1]");

    console.log("========================================================");
    console.log(`  WASM RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================");

    if (failed > 0) process.exit(1);
}

runWasmVerification().catch(err => {
    console.error("Wasm test error:", err);
    process.exit(1);
});
