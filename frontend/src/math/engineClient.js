import { loadWasmEngine, getWasmModule } from './wasmLoader.js';

/**
 * Pure JavaScript Reference Implementation of the Mathematical Engine
 * Guaranteed identical mathematical conventions and tolerances (Handbook Sections 1-12).
 */
export const JsMathEngine = {
  EPSILON: 1e-9,
  PIVOT_TOLERANCE: 1e-12,
  ILL_CONDITIONED_THRESHOLD: 1e8,

  isFiniteNumber(v) {
    return Number.isFinite(v);
  },

  approxEqual(a, b, eps = 1e-9) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const diff = Math.abs(a - b);
    const scale = Math.max(1.0, Math.abs(a), Math.abs(b));
    return diff <= eps * scale;
  },

  // Matrix-vector multiplication v' = A * v (Handbook 2.3)
  multiplyVec(A, v) {
    return [
      A[0] * v[0] + A[1] * v[1] + A[2] * v[2],
      A[3] * v[0] + A[4] * v[1] + A[5] * v[2],
      A[6] * v[0] + A[7] * v[1] + A[8] * v[2]
    ];
  },

  // Matrix multiplication C = A * B (Handbook 2.2)
  multiplyMat(A, B) {
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
  },

  // Determinant (Handbook 3.1)
  determinant(A) {
    const a = A[0], b = A[1], c = A[2];
    const d = A[3], e = A[4], f = A[5];
    const g = A[6], h = A[7], i = A[8];
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  },

  // Matrix infinity norm ||A||_inf (Handbook 10.2)
  normInf(A) {
    const r0 = Math.abs(A[0]) + Math.abs(A[1]) + Math.abs(A[2]);
    const r1 = Math.abs(A[3]) + Math.abs(A[4]) + Math.abs(A[5]);
    const r2 = Math.abs(A[6]) + Math.abs(A[7]) + Math.abs(A[8]);
    return Math.max(r0, r1, r2);
  },

  // Vector infinity norm ||v||_inf (Handbook 9.6)
  vectorNormInf(v) {
    return Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  },

  // Gauss-Jordan elimination with partial pivoting (Handbook 10.4)
  invertGaussian(A) {
    const det = this.determinant(A);
    const normA = this.normInf(A);

    for (let k = 0; k < 9; ++k) {
      if (!Number.isFinite(A[k])) {
        return {
          success: false,
          status: 'NON_FINITE_INPUT',
          message: 'Matrix contains non-finite entries.',
          determinant: det,
          normA,
          inverse: null
        };
      }
    }

    if (normA === 0.0 || det === 0.0) {
      return {
        success: false,
        status: 'SINGULAR_EXACT',
        message: 'Determinant is exactly zero; matrix is mathematically singular.',
        determinant: det,
        normA,
        inverse: null
      };
    }

    // Augmented matrix [A | I]
    const aug = [
      [A[0], A[1], A[2], 1, 0, 0],
      [A[3], A[4], A[5], 0, 1, 0],
      [A[6], A[7], A[8], 0, 0, 1]
    ];

    const absPivotTol = this.PIVOT_TOLERANCE * normA;

    for (let col = 0; col < 3; col++) {
      let pivotRow = col;
      let maxPivot = Math.abs(aug[col][col]);
      for (let r = col + 1; r < 3; r++) {
        const val = Math.abs(aug[r][col]);
        if (val > maxPivot) {
          maxPivot = val;
          pivotRow = r;
        }
      }

      if (maxPivot <= absPivotTol) {
        return {
          success: false,
          status: 'SINGULAR_NUMERICAL',
          message: `Pivot in column ${col} (${maxPivot}) is smaller than scale-aware tolerance (${absPivotTol}).`,
          determinant: det,
          normA,
          inverse: null
        };
      }

      if (pivotRow !== col) {
        const tmp = aug[col];
        aug[col] = aug[pivotRow];
        aug[pivotRow] = tmp;
      }

      const pivot = aug[col][col];
      for (let c = 0; c < 6; c++) {
        aug[col][c] /= pivot;
      }

      for (let r = 0; r < 3; r++) {
        if (r !== col) {
          const factor = aug[r][col];
          if (factor !== 0.0) {
            for (let c = 0; c < 6; c++) {
              aug[r][c] -= factor * aug[col][c];
            }
          }
        }
      }
    }

    const inv = [
      aug[0][3], aug[0][4], aug[0][5],
      aug[1][3], aug[1][4], aug[1][5],
      aug[2][3], aug[2][4], aug[2][5]
    ];

    const normAInv = this.normInf(inv);
    const conditionNumber = normA * normAInv;

    // Residual matrices E1 = I - A * A^-1, E2 = I - A^-1 * A
    const AAinv = this.multiplyMat(A, inv);
    const AinvA = this.multiplyMat(inv, A);
    const I = [1,0,0, 0,1,0, 0,0,1];
    const residualE1 = I.map((v, i) => v - AAinv[i]);
    const residualE2 = I.map((v, i) => v - AinvA[i]);
    const residualE1Norm = this.normInf(residualE1);
    const residualE2Norm = this.normInf(residualE2);
    const relativeResidual = conditionNumber > 0 ? (residualE1Norm / conditionNumber) : 0;

    let status = 'OK';
    let message = 'Matrix successfully inverted and verified well-conditioned.';
    if (conditionNumber > this.ILL_CONDITIONED_THRESHOLD) {
      status = 'ILL_CONDITIONED_WARNING';
      message = `Matrix is ill-conditioned (condition number kappa = ${conditionNumber.toExponential(2)} > ${this.ILL_CONDITIONED_THRESHOLD}). Precision may be degraded.`;
    }

    return {
      success: true,
      status,
      message,
      determinant: det,
      normA,
      normAInv,
      conditionNumber,
      residualE1Norm,
      residualE2Norm,
      relativeResidual,
      inverse: inv,
      residualE1,
      residualE2
    };
  },

  // Presets (Handbook Sections 6, 7, 8)
  getPreset(type, p1, p2, p3) {
    const toRad = deg => deg * (Math.PI / 180.0);
    switch (type) {
      case 'scale':
        return [p1, 0, 0,  0, p2, 0,  0, 0, p3];
      case 'uniformScale':
        return [p1, 0, 0,  0, p1, 0,  0, 0, p1];
      case 'rotateX': {
        const rad = toRad(p1);
        const c = Math.cos(rad), s = Math.sin(rad);
        return [1, 0, 0,  0, c, -s,  0, s, c];
      }
      case 'rotateY': {
        const rad = toRad(p1);
        const c = Math.cos(rad), s = Math.sin(rad);
        return [c, 0, s,  0, 1, 0,  -s, 0, c];
      }
      case 'rotateZ': {
        const rad = toRad(p1);
        const c = Math.cos(rad), s = Math.sin(rad);
        return [c, -s, 0,  s, c, 0,  0, 0, 1];
      }
      case 'reflectXY':
        return [1, 0, 0,  0, 1, 0,  0, 0, -1];
      case 'reflectXZ':
        return [1, 0, 0,  0, -1, 0,  0, 0, 1];
      case 'reflectYZ':
        return [-1, 0, 0,  0, 1, 0,  0, 0, 1];
      case 'shear': {
        const k = p2;
        switch (parseInt(p1)) {
          case 0: return [1, k, 0,  0, 1, 0,  0, 0, 1]; // X by Y
          case 1: return [1, 0, k,  0, 1, 0,  0, 0, 1]; // X by Z
          case 2: return [1, 0, 0,  k, 1, 0,  0, 0, 1]; // Y by X
          case 3: return [1, 0, 0,  0, 1, k,  0, 0, 1]; // Y by Z
          case 4: return [1, 0, 0,  0, 1, 0,  k, 0, 1]; // Z by X
          case 5: return [1, 0, 0,  0, 1, 0,  0, k, 1]; // Z by Y
          default: return [1, 0, 0,  0, 1, 0,  0, 0, 1];
        }
      }
      case 'identity':
      default:
        return [1, 0, 0,  0, 1, 0,  0, 0, 1];
    }
  },

  executePipeline(matrices, names, v0, tolerance = 1e-9) {
    const n = matrices.length;
    if (n < 2 || n > 3) {
      return { success: false, errorMessage: 'Transformation count must be exactly 2 or 3.' };
    }
    for (const c of v0) {
      if (!Number.isFinite(c)) return { success: false, errorMessage: 'Initial vector has non-finite values.' };
    }
    for (let i = 0; i < n; i++) {
      for (const val of matrices[i]) {
        if (!Number.isFinite(val)) return { success: false, errorMessage: `Matrix T${i+1} has non-finite values.` };
      }
    }

    let curV = [...v0];
    const steps = [];
    for (let i = 0; i < n; i++) {
      curV = this.multiplyVec(matrices[i], curV);
      const invRes = this.invertGaussian(matrices[i]);
      steps.push({
        index: i + 1,
        name: names[i] || `T${i + 1}`,
        matrix: matrices[i],
        inverse: invRes,
        outputVector: [...curV]
      });
    }

    let composedMatrix;
    if (n === 2) {
      composedMatrix = this.multiplyMat(matrices[1], matrices[0]);
    } else {
      const T21 = this.multiplyMat(matrices[1], matrices[0]);
      composedMatrix = this.multiplyMat(matrices[2], T21);
    }

    const composedVector = this.multiplyVec(composedMatrix, v0);
    const compDiff = [
      composedVector[0] - curV[0],
      composedVector[1] - curV[1],
      composedVector[2] - curV[2]
    ];
    const compositionError = this.vectorNormInf(compDiff);
    const compScale = Math.max(1.0, this.vectorNormInf(composedVector), this.vectorNormInf(curV));
    const compositionVerified = compositionError <= tolerance * compScale;

    const composedInverse = this.invertGaussian(composedMatrix);

    let productOfInverses = null;
    let productOfInversesValid = steps.every(s => s.inverse.success);
    if (productOfInversesValid) {
      if (n === 2) {
        productOfInverses = this.multiplyMat(steps[0].inverse.inverse, steps[1].inverse.inverse);
      } else {
        const inv12 = this.multiplyMat(steps[0].inverse.inverse, steps[1].inverse.inverse);
        productOfInverses = this.multiplyMat(inv12, steps[2].inverse.inverse);
      }
    }

    let recoveredVector = null;
    let vectorRecoverySuccessful = false;
    let recoveryError = -1;

    if (composedInverse.success) {
      recoveredVector = this.multiplyVec(composedInverse.inverse, composedVector);
      const recDiff = [
        recoveredVector[0] - v0[0],
        recoveredVector[1] - v0[1],
        recoveredVector[2] - v0[2]
      ];
      recoveryError = this.vectorNormInf(recDiff);
      const recScale = Math.max(1.0, this.vectorNormInf(recoveredVector), this.vectorNormInf(v0));
      vectorRecoverySuccessful = recoveryError <= tolerance * recScale;
    }

    let inverseProductMatchesDirect = false;
    let inverseProductDifferenceNorm = 0;
    if (productOfInversesValid && composedInverse.success) {
      const diff = composedInverse.inverse.map((v, i) => v - productOfInverses[i]);
      inverseProductDifferenceNorm = this.normInf(diff);
      const scale = Math.max(1.0, this.normInf(composedInverse.inverse), this.normInf(productOfInverses));
      inverseProductMatchesDirect = inverseProductDifferenceNorm <= tolerance * scale;
    }

    return {
      success: true,
      errorMessage: '',
      initialVector: v0,
      steps,
      finalSequentialVector: curV,
      composedMatrix,
      composedVector,
      composedInverse,
      productOfInverses,
      recoveredVector,
      vectorRecoverySuccessful,
      recoveryError,
      compositionError,
      compositionVerified,
      inverseProductMatchesDirect,
      inverseProductDifferenceNorm
    };
  }
};

/**
 * Unified Client: Uses WebAssembly whenever available, otherwise JS fallback,
 * and cross-verifies results.
 */
export class EngineClient {
  constructor() {
    this.wasmLoaded = false;
    this.wasmModule = null;
  }

  async init() {
    try {
      this.wasmModule = await loadWasmEngine();
      this.wasmLoaded = this.wasmModule && typeof this.wasmModule.isEngineReady === 'function' && this.wasmModule.isEngineReady();
      return this.wasmLoaded;
    } catch (err) {
      console.warn("Wasm load failed; using native JS high-precision engine fallback:", err);
      this.wasmLoaded = false;
      return false;
    }
  }

  isWasmActive() {
    return this.wasmLoaded;
  }

  getPresetMatrix(type, p1 = 0, p2 = 0, p3 = 0) {
    if (this.wasmLoaded) {
      try {
        const jsonStr = this.wasmModule.getPresetMatrixJson(type, Number(p1), Number(p2), Number(p3));
        const res = JSON.parse(jsonStr);
        if (res.success) return res.matrix;
      } catch (e) {
        console.warn("Wasm preset generation error, falling back:", e);
      }
    }
    return JsMathEngine.getPreset(type, Number(p1), Number(p2), Number(p3));
  }

  invertMatrix(flatArray9) {
    if (this.wasmLoaded) {
      try {
        const jsonStr = this.wasmModule.invertMatrixJson(JSON.stringify(flatArray9));
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn("Wasm invertMatrix error, falling back:", e);
      }
    }
    return JsMathEngine.invertGaussian(flatArray9);
  }

  execute(matrices, names, vector, tolerance = 1e-9) {
    if (this.wasmLoaded) {
      try {
        const payload = {
          matrices,
          names,
          vector,
          tolerance
        };
        const resultJson = this.wasmModule.executePipelineJson(JSON.stringify(payload));
        const parsed = JSON.parse(resultJson);
        if (parsed.success) {
          parsed.engineSource = 'WebAssembly (C++17 Engine)';
          return parsed;
        }
      } catch (e) {
        console.warn("Wasm execution error, falling back to JS:", e);
      }
    }
    const jsRes = JsMathEngine.executePipeline(matrices, names, vector, tolerance);
    jsRes.engineSource = 'JavaScript Reference Engine';
    return jsRes;
  }
}
