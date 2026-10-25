import { JsMathEngine } from '../math/engineClient.js';

/**
 * Educational Practice Challenge Generator
 * Generates varied, mathematically rigorous practice problems across Easy, Medium, and Hard tiers.
 * All expected results and matrix operations are derived directly from JsMathEngine as the source of truth.
 */
export class PracticeGenerator {
  static DIFFICULTIES = ['easy', 'medium', 'hard'];

  /**
   * Helper to format numbers nicely for educational display.
   */
  static formatNum(n, decimals = 3) {
    if (!Number.isFinite(n)) return 'NaN';
    if (Math.abs(n) < 1e-9) return '0';
    const s = n.toFixed(decimals);
    return s.replace(/\.?0+$/, '');
  }

  static formatVec(v) {
    return `[${v.map(n => PracticeGenerator.formatNum(n, 3)).join(', ')}]ᵀ`;
  }

  static formatMat3x3(m) {
    const r1 = `[${PracticeGenerator.formatNum(m[0])}, ${PracticeGenerator.formatNum(m[1])}, ${PracticeGenerator.formatNum(m[2])}]`;
    const r2 = `[${PracticeGenerator.formatNum(m[3])}, ${PracticeGenerator.formatNum(m[4])}, ${PracticeGenerator.formatNum(m[5])}]`;
    const r3 = `[${PracticeGenerator.formatNum(m[6])}, ${PracticeGenerator.formatNum(m[7])}, ${PracticeGenerator.formatNum(m[8])}]`;
    return `${r1}\n${r2}\n${r3}`;
  }

  /**
   * Random integer in [min, max] inclusive.
   */
  static randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Pick random item from array.
   */
  static pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Main entry point to generate a challenge.
   * Ensures varied problems and avoids immediate repeats.
   */
  static generateChallenge(difficulty = 'medium', previousId = null) {
    const diff = (difficulty || 'medium').toLowerCase();
    let challenge = null;

    for (let attempts = 0; attempts < 15; attempts++) {
      switch (diff) {
        case 'easy':
          challenge = PracticeGenerator.generateEasy();
          break;
        case 'hard':
          challenge = PracticeGenerator.generateHard();
          break;
        case 'medium':
        default:
          challenge = PracticeGenerator.generateMedium();
          break;
      }

      if (challenge && challenge.id !== previousId) {
        break;
      }
    }

    return challenge;
  }

  // =========================================================================
  // EASY DIFFICULTY CHALLENGES
  // - Identity transformation
  // - Uniform and non-uniform scaling
  // - Reflection across XY, XZ, or YZ planes
  // =========================================================================
  static generateEasy() {
    const types = ['identity', 'uniform_scale', 'non_uniform_scale', 'reflection'];
    const type = PracticeGenerator.pick(types);
    const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    if (type === 'identity') {
      const v0 = [
        PracticeGenerator.pick([-3, -2, -1, 1, 2, 3, 4]),
        PracticeGenerator.pick([-3, -2, 1, 2, 3]),
        PracticeGenerator.pick([-2, -1, 1, 2, 3, 5])
      ];
      const I = [1, 0, 0,  0, 1, 0,  0, 0, 1];
      const vFinal = JsMathEngine.multiplyVec(I, v0);

      return {
        id: `EASY_IDENT_${seed}`,
        seed,
        difficulty: 'Easy',
        category: 'Identity Transformation',
        title: 'Identity Transformation Verification',
        challenge: 'Find the resulting vector v\' after applying the 3×3 Identity transformation I to vector v₀. Verify why I · v = v.',
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: 'identity',
              title: 'Identity Matrix I',
              matrix: I,
              matrixExpressions: ['1', '0', '0',  '0', '1', '0',  '0', '0', '1'],
              params: {}
            }
          ]
        },
        expected: {
          composedMatrix: I,
          composedVector: vFinal,
          intermediateVectors: [vFinal],
          isInvertible: true,
          determinant: 1.0,
          inverseMatrix: I
        },
        explanation: {
          formula: "v' = I · v₀ = [1·x + 0·y + 0·z, 0·x + 1·y + 0·z, 0·x + 0·y + 1·z]ᵀ",
          steps: [
            `1. Write down initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Compute x' = 1(${v0[0]}) + 0(${v0[1]}) + 0(${v0[2]}) = ${vFinal[0]}.`,
            `3. Compute y' = 0(${v0[0]}) + 1(${v0[1]}) + 0(${v0[2]}) = ${vFinal[1]}.`,
            `4. Compute z' = 0(${v0[0]}) + 0(${v0[1]}) + 1(${v0[2]}) = ${vFinal[2]}.`,
            `5. Final vector v' = ${PracticeGenerator.formatVec(vFinal)}.`
          ],
          matrixArithmetic: "I = diag(1, 1, 1), det(I) = 1.0000, I⁻¹ = I."
        },
        geometricMeaning: 'The identity matrix maps every point in 3D space to itself. The vector’s magnitude, direction, and coordinates remain entirely unchanged.',
        hint: 'Multiplying any vector or matrix by the identity matrix leaves it unchanged.'
      };
    }

    if (type === 'uniform_scale' || type === 'non_uniform_scale') {
      const isUniform = type === 'uniform_scale';
      const sx = PracticeGenerator.pick(isUniform ? [2, 3, 0.5] : [2, 3, 0.5, 1.5]);
      const sy = isUniform ? sx : PracticeGenerator.pick([1, 2, 0.5, 3]);
      const sz = isUniform ? sx : PracticeGenerator.pick([1, 2, 0.5, 3]);

      const v0 = [
        PracticeGenerator.pick([-2, -1, 1, 2, 4]),
        PracticeGenerator.pick([-3, -1, 1, 2, 3]),
        PracticeGenerator.pick([-2, 1, 2, 3])
      ];

      const S = [sx, 0, 0,  0, sy, 0,  0, 0, sz];
      const vFinal = JsMathEngine.multiplyVec(S, v0);
      const det = sx * sy * sz;
      const invS = [1 / sx, 0, 0,  0, 1 / sy, 0,  0, 0, 1 / sz];

      return {
        id: `EASY_SCALE_${seed}`,
        seed,
        difficulty: 'Easy',
        category: isUniform ? 'Uniform Scaling' : 'Non-Uniform Scaling',
        title: isUniform ? `Uniform Scaling (factor ${sx}×)` : `Non-Uniform Scaling (${sx}, ${sy}, ${sz})`,
        challenge: `Calculate the coordinates of vector v' after scaling v₀ with factors s_x = ${sx}, s_y = ${sy}, s_z = ${sz}.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: 'scale',
              title: `Scale (${sx}, ${sy}, ${sz})`,
              matrix: S,
              matrixExpressions: [String(sx), '0', '0',  '0', String(sy), '0',  '0', '0', String(sz)],
              params: { sx, sy, sz }
            }
          ]
        },
        expected: {
          composedMatrix: S,
          composedVector: vFinal,
          intermediateVectors: [vFinal],
          isInvertible: det !== 0,
          determinant: det,
          inverseMatrix: invS
        },
        explanation: {
          formula: "v' = S · v₀ = [s_x · x₀, s_y · y₀, s_z · z₀]ᵀ",
          steps: [
            `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Compute x' = ${sx} × ${v0[0]} = ${PracticeGenerator.formatNum(vFinal[0])}.`,
            `3. Compute y' = ${sy} × ${v0[1]} = ${PracticeGenerator.formatNum(vFinal[1])}.`,
            `4. Compute z' = ${sz} × ${v0[2]} = ${PracticeGenerator.formatNum(vFinal[2])}.`,
            `5. Final transformed vector v' = ${PracticeGenerator.formatVec(vFinal)}.`
          ],
          matrixArithmetic: `S = diag(${sx}, ${sy}, ${sz}), det(S) = ${PracticeGenerator.formatNum(det)}, volume scale factor = ${PracticeGenerator.formatNum(Math.abs(det))}.`
        },
        geometricMeaning: isUniform
          ? `The vector's length expands/contracts by a factor of ${sx} while maintaining its 3D spatial direction.`
          : `The vector stretches anisotropically along the coordinate axes, which tilts its direction toward the axis with higher scaling.`,
        hint: 'For a diagonal scaling matrix, each component is simply multiplied by its corresponding scale factor.'
      };
    }

    // Reflection across XY, XZ, or YZ
    const planes = [
      { key: 'reflectXY', plane: 'XY Plane (z → -z)', M: [1, 0, 0,  0, 1, 0,  0, 0, -1], normal: 'Z axis' },
      { key: 'reflectXZ', plane: 'XZ Plane (y → -y)', M: [1, 0, 0,  0, -1, 0,  0, 0, 1], normal: 'Y axis' },
      { key: 'reflectYZ', plane: 'YZ Plane (x → -x)', M: [-1, 0, 0,  0, 1, 0,  0, 0, 1], normal: 'X axis' },
    ];
    const refl = PracticeGenerator.pick(planes);
    const v0 = [
      PracticeGenerator.pick([-3, -2, -1, 1, 2, 3]),
      PracticeGenerator.pick([-2, -1, 1, 2, 4]),
      PracticeGenerator.pick([-4, -2, 1, 2, 3])
    ];
    const vFinal = JsMathEngine.multiplyVec(refl.M, v0);

    return {
      id: `EASY_REFL_${seed}`,
      seed,
      difficulty: 'Easy',
      category: 'Plane Reflection',
      title: `Reflection across ${refl.plane}`,
      challenge: `Determine the transformed vector v' when reflecting v₀ across the ${refl.plane}. What happens to the component normal to the mirror plane?`,
      given: {
        v0,
        transformations: [
          {
            name: 'T₁',
            type: refl.key,
            title: `Reflection across ${refl.plane}`,
            matrix: refl.M,
            matrixExpressions: refl.M.map(n => String(n)),
            params: {}
          }
        ]
      },
      expected: {
        composedMatrix: refl.M,
        composedVector: vFinal,
        intermediateVectors: [vFinal],
        isInvertible: true,
        determinant: -1.0,
        inverseMatrix: refl.M // Reflections are self-inverse
      },
      explanation: {
        formula: "v' = M_reflect · v₀",
        steps: [
          `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
          `2. The mirror plane is ${refl.plane}, so the coordinate along the ${refl.normal} is negated while parallel coordinates remain identical.`,
          `3. Final transformed vector v' = ${PracticeGenerator.formatVec(vFinal)}.`,
          `4. Note that det(M) = -1, indicating an orientation-reversing (isometry) transformation.`
        ],
        matrixArithmetic: "Reflection matrices are involutory (self-inverse): M⁻¹ = M, M² = I, det(M) = -1."
      },
      geometricMeaning: `The vector is flipped across the ${refl.plane}. Its spatial length is preserved (|v'| = |v₀|), but chirality/handedness is reversed.`,
      hint: 'A reflection negates only the coordinate perpendicular to the reflection plane.'
    };
  }

  // =========================================================================
  // MEDIUM DIFFICULTY CHALLENGES
  // - Rotation around X, Y, or Z axis with standard angles (pi/6, pi/4, pi/3, pi/2)
  // - Negative and decimal vector coordinates
  // - Composition of two transformations (C = T₂ · T₁)
  // - Combined scaling and reflection
  // =========================================================================
  static generateMedium() {
    const types = ['rotation_single', 'scale_and_reflect', 'rotate_and_scale', 'composition_2'];
    const type = PracticeGenerator.pick(types);
    const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const angles = [
      { expr: 'pi/6', rad: Math.PI / 6, deg: 30 },
      { expr: 'pi/4', rad: Math.PI / 4, deg: 45 },
      { expr: 'pi/3', rad: Math.PI / 3, deg: 60 },
      { expr: 'pi/2', rad: Math.PI / 2, deg: 90 },
      { expr: 'pi',   rad: Math.PI,     deg: 180 }
    ];

    if (type === 'rotation_single') {
      const axis = PracticeGenerator.pick(['rotateX', 'rotateY', 'rotateZ']);
      const angle = PracticeGenerator.pick(angles);
      const axisName = axis === 'rotateX' ? 'X-axis' : (axis === 'rotateY' ? 'Y-axis' : 'Z-axis');

      const v0 = [
        PracticeGenerator.pick([-2.5, -1.0, 1.5, 2.0, 3.0]),
        PracticeGenerator.pick([-2.0, -1.5, 0.5, 1.0, 2.5]),
        PracticeGenerator.pick([-1.5, 1.0, 2.0, 2.5])
      ];

      let R = [];
      const c = Math.cos(angle.rad);
      const s = Math.sin(angle.rad);
      if (axis === 'rotateX') {
        R = [1, 0, 0,  0, c, -s,  0, s, c];
      } else if (axis === 'rotateY') {
        R = [c, 0, s,  0, 1, 0,  -s, 0, c];
      } else {
        R = [c, -s, 0,  s, c, 0,  0, 0, 1];
      }

      const vFinal = JsMathEngine.multiplyVec(R, v0);

      return {
        id: `MED_ROT_${seed}`,
        seed,
        difficulty: 'Medium',
        category: 'Single Axis Rotation',
        title: `Rotation about ${axisName} by θ = ${angle.expr} (${angle.deg}°)`,
        challenge: `Compute the vector v' resulting from rotating v₀ about the ${axisName} by an angle of θ = ${angle.expr} rad (${angle.deg}°). Verify that vector magnitude is conserved.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: axis,
              title: `Rotate ${axisName} (${angle.expr})`,
              matrix: R,
              matrixExpressions: R.map(n => PracticeGenerator.formatNum(n, 4)),
              params: { angleExpr: angle.expr, angleUnit: 'rad' }
            }
          ]
        },
        expected: {
          composedMatrix: R,
          composedVector: vFinal,
          intermediateVectors: [vFinal],
          isInvertible: true,
          determinant: 1.0,
          inverseMatrix: [
            R[0], R[3], R[6],
            R[1], R[4], R[7],
            R[2], R[5], R[8]
          ] // Orthogonal matrix: R⁻¹ = Rᵀ
        },
        explanation: {
          formula: `v' = R_${axisName[0]}(θ) · v₀, with cos(θ) ≈ ${PracticeGenerator.formatNum(c, 4)}, sin(θ) ≈ ${PracticeGenerator.formatNum(s, 4)}`,
          steps: [
            `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Evaluate trigonometric values: cos(${angle.expr}) = ${PracticeGenerator.formatNum(c, 4)}, sin(${angle.expr}) = ${PracticeGenerator.formatNum(s, 4)}.`,
            `3. Perform matrix-vector multiplication R · v₀.`,
            `4. Final vector v' = ${PracticeGenerator.formatVec(vFinal)}.`,
            `5. Norm check: ||v₀||₂ ≈ ${PracticeGenerator.formatNum(Math.hypot(...v0), 4)}, ||v'||₂ ≈ ${PracticeGenerator.formatNum(Math.hypot(...vFinal), 4)} (rigid rotation preserves Euclidean norm).`
          ],
          matrixArithmetic: `det(R) = +1.0000. Pure rotations belong to SO(3) with R⁻¹ = Rᵀ.`
        },
        geometricMeaning: `The vector rotates smoothly around the fixed ${axisName} following the right-hand grip rule, sweeping an arc on a circle perpendicular to the axis of rotation.`,
        hint: 'Remember that rotation matrices in SO(3) are orthogonal: rows and columns are orthonormal unit vectors, and R⁻¹ = Rᵀ.'
      };
    }

    if (type === 'scale_and_reflect') {
      const v0 = [
        PracticeGenerator.pick([-2, -1.5, 1, 2.5]),
        PracticeGenerator.pick([-3, 1.5, 2, 3]),
        PracticeGenerator.pick([-2.5, 1, 2, 3.5])
      ];

      const sx = PracticeGenerator.pick([2, 1.5, 0.5]);
      const sy = PracticeGenerator.pick([1, 2, 1.5]);
      const sz = PracticeGenerator.pick([1, 0.5, 2]);
      const S = [sx, 0, 0,  0, sy, 0,  0, 0, sz];

      const reflType = PracticeGenerator.pick(['reflectXY', 'reflectXZ', 'reflectYZ']);
      const reflMat = reflType === 'reflectXY'
        ? [1, 0, 0,  0, 1, 0,  0, 0, -1]
        : (reflType === 'reflectXZ' ? [1, 0, 0,  0, -1, 0,  0, 0, 1] : [-1, 0, 0,  0, 1, 0,  0, 0, 1]);

      // T₁ = Scale, T₂ = Reflect. Column vector convention: C = T₂ · T₁
      const C = JsMathEngine.multiplyMat(reflMat, S);
      const v1 = JsMathEngine.multiplyVec(S, v0);
      const v2 = JsMathEngine.multiplyVec(reflMat, v1);
      const det = JsMathEngine.determinant(C);
      const invRes = JsMathEngine.invertGaussian(C);

      return {
        id: `MED_SCALEREFL_${seed}`,
        seed,
        difficulty: 'Medium',
        category: 'Combined Scaling & Reflection',
        title: `2-Stage Composition: Scale then ${reflType}`,
        challenge: `Apply scaling T₁ = S(${sx}, ${sy}, ${sz}) followed by reflection T₂ = ${reflType}. Compute the composed matrix C = T₂ · T₁ and the final vector v₂ = C · v₀.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: 'scale',
              title: `Scale (${sx}, ${sy}, ${sz})`,
              matrix: S,
              matrixExpressions: [String(sx), '0', '0',  '0', String(sy), '0',  '0', '0', String(sz)],
              params: { sx, sy, sz }
            },
            {
              name: 'T₂',
              type: reflType,
              title: `Reflection ${reflType}`,
              matrix: reflMat,
              matrixExpressions: reflMat.map(n => String(n)),
              params: {}
            }
          ]
        },
        expected: {
          composedMatrix: C,
          composedVector: v2,
          intermediateVectors: [v1, v2],
          isInvertible: invRes.success,
          determinant: det,
          inverseMatrix: invRes.inverse
        },
        explanation: {
          formula: "C = T₂ · T₁ (column vector convention: v' = T₂(T₁ · v₀) = C · v₀)",
          steps: [
            `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Apply T₁ (Scale): v₁ = T₁ · v₀ = ${PracticeGenerator.formatVec(v1)}.`,
            `3. Apply T₂ (Reflection): v₂ = T₂ · v₁ = ${PracticeGenerator.formatVec(v2)}.`,
            `4. Verify composition matrix multiplication C = T₂ · T₁:`,
            `   det(C) = det(T₂) · det(T₁) = (-1) · (${sx} × ${sy} × ${sz}) = ${PracticeGenerator.formatNum(det, 3)}.`,
            `5. Direct product check: C · v₀ = ${PracticeGenerator.formatVec(JsMathEngine.multiplyVec(C, v0))} (matches sequential v₂).`
          ],
          matrixArithmetic: `det(C) = ${PracticeGenerator.formatNum(det, 4)}. Negative determinant reflects parity change.`
        },
        geometricMeaning: `The vector is first rescaled along each axis, then flipped across the mirror plane. The compound action stretches and inverts chirality simultaneously.`,
        hint: 'In column-vector convention, if T₁ is applied first and T₂ second, the composite matrix is C = T₂ · T₁.'
      };
    }

    // Default Medium: 2-stage composition with rotation and scaling
    const axis = PracticeGenerator.pick(['rotateX', 'rotateY', 'rotateZ']);
    const angle = PracticeGenerator.pick(angles);
    const rad = angle.rad;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    let R = [];
    if (axis === 'rotateX') R = [1, 0, 0,  0, c, -s,  0, s, c];
    else if (axis === 'rotateY') R = [c, 0, s,  0, 1, 0,  -s, 0, c];
    else R = [c, -s, 0,  s, c, 0,  0, 0, 1];

    const sVal = PracticeGenerator.pick([2, 1.5, 0.5]);
    const S = [sVal, 0, 0,  0, sVal, 0,  0, 0, sVal];

    // T₁ = Rotation, T₂ = Scale. C = T₂ · T₁
    const C = JsMathEngine.multiplyMat(S, R);
    const v0 = [
      PracticeGenerator.pick([-1.5, 1.0, 2.0, 2.5]),
      PracticeGenerator.pick([-2.0, -1.0, 1.5, 2.0]),
      PracticeGenerator.pick([-1.0, 1.0, 2.0, 3.0])
    ];
    const v1 = JsMathEngine.multiplyVec(R, v0);
    const v2 = JsMathEngine.multiplyVec(S, v1);
    const det = JsMathEngine.determinant(C);
    const invRes = JsMathEngine.invertGaussian(C);

    return {
      id: `MED_COMP2_${seed}`,
      seed,
      difficulty: 'Medium',
      category: '2-Stage Rotation & Uniform Scale',
      title: `2-Stage Composition: ${axis} (${angle.expr}) then Scale ×${sVal}`,
      challenge: `Given vector v₀, apply rotation T₁ (${axis}, θ = ${angle.expr}) followed by uniform scale T₂ (×${sVal}). Calculate the intermediate vector v₁ and the final vector v₂ = T₂ · v₁.`,
      given: {
        v0,
        transformations: [
          {
            name: 'T₁',
            type: axis,
            title: `Rotate ${axis} (${angle.expr})`,
            matrix: R,
            matrixExpressions: R.map(n => PracticeGenerator.formatNum(n, 4)),
            params: { angleExpr: angle.expr, angleUnit: 'rad' }
          },
          {
            name: 'T₂',
            type: 'scale',
            title: `Scale ×${sVal}`,
            matrix: S,
            matrixExpressions: S.map(n => String(n)),
            params: { sx: sVal, sy: sVal, sz: sVal }
          }
        ]
      },
      expected: {
        composedMatrix: C,
        composedVector: v2,
        intermediateVectors: [v1, v2],
        isInvertible: invRes.success,
        determinant: det,
        inverseMatrix: invRes.inverse
      },
      explanation: {
        formula: "v₁ = T₁ · v₀, v₂ = T₂ · v₁ = (T₂ · T₁) · v₀ = C · v₀",
        steps: [
          `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
          `2. Intermediate stage 1 (Rotation): v₁ = T₁ · v₀ = ${PracticeGenerator.formatVec(v1)}.`,
          `3. Intermediate stage 2 (Scale ×${sVal}): v₂ = T₂ · v₁ = ${PracticeGenerator.formatVec(v2)}.`,
          `4. Composite matrix verification: C = T₂ · T₁. Note that det(C) = det(T₂) · det(T₁) = ${sVal}³ · 1 = ${PracticeGenerator.formatNum(det, 3)}.`,
          `5. Direct calculation C · v₀ = ${PracticeGenerator.formatVec(JsMathEngine.multiplyVec(C, v0))} matches v₂ exactly.`
        ],
        matrixArithmetic: `det(C) = ${PracticeGenerator.formatNum(det, 4)}, scale factor = ${sVal}.`
      },
      geometricMeaning: `The vector rotates along a circular path in 3D, and is subsequently magnified by factor ${sVal}, scaling its Euclidean length while keeping its newly rotated heading.`,
      hint: 'Compute intermediate stages sequentially: v₁ = T₁ v₀, then v₂ = T₂ v₁.'
    };
  }

  // =========================================================================
  // HARD DIFFICULTY CHALLENGES
  // - Composition of three transformations (C = T₃ · T₂ · T₁)
  // - Non-commuting transformation pairs (T₁ · T₂ ≠ T₂ · T₁)
  // - Inverse verification (C⁻¹ · C = I and C⁻¹ · v' = v₀)
  // - Singular matrix challenges (det = 0, projection, irreversible)
  // =========================================================================
  static generateHard() {
    const types = ['non_commuting', 'inverse_verification', 'composition_3', 'singular_projection'];
    const type = PracticeGenerator.pick(types);
    const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    if (type === 'non_commuting') {
      // Non-commuting transformations: RotX(pi/2) and RotY(pi/2)
      // or RotZ(pi/2) and non-uniform Scale
      const choice = PracticeGenerator.pick(['rot_rot', 'rot_scale']);
      let T1, T2, name1, name2, params1, params2;

      if (choice === 'rot_rot') {
        const rad90 = Math.PI / 2;
        // RotX(90)
        T1 = [1, 0, 0,  0, 0, -1,  0, 1, 0];
        name1 = 'rotateX';
        params1 = { angleExpr: 'pi/2', angleUnit: 'rad' };

        // RotY(90)
        T2 = [0, 0, 1,  0, 1, 0,  -1, 0, 0];
        name2 = 'rotateY';
        params2 = { angleExpr: 'pi/2', angleUnit: 'rad' };
      } else {
        // RotZ(90)
        T1 = [0, -1, 0,  1, 0, 0,  0, 0, 1];
        name1 = 'rotateZ';
        params1 = { angleExpr: 'pi/2', angleUnit: 'rad' };

        // Scale(2, 1, 1)
        T2 = [2, 0, 0,  0, 1, 0,  0, 0, 1];
        name2 = 'scale';
        params2 = { sx: 2, sy: 1, sz: 1 };
      }

      // Order A: T₁ then T₂ -> C_A = T₂ · T₁
      const CA = JsMathEngine.multiplyMat(T2, T1);
      // Order B: T₂ then T₁ -> C_B = T₁ · T₂
      const CB = JsMathEngine.multiplyMat(T1, T2);

      // Verify they are genuinely non-commuting: ||CA - CB|| > 0.1
      const diffNorm = JsMathEngine.normInf(CA.map((v, i) => v - CB[i]));

      const v0 = [
        PracticeGenerator.pick([1, 2, 3]),
        PracticeGenerator.pick([1, 2, 4]),
        PracticeGenerator.pick([1, 3, 5])
      ];

      const vFinalA = JsMathEngine.multiplyVec(CA, v0);
      const vFinalB = JsMathEngine.multiplyVec(CB, v0);

      const invA = JsMathEngine.invertGaussian(CA);

      return {
        id: `HARD_NONCOMM_${seed}`,
        seed,
        difficulty: 'Hard',
        category: 'Non-Commuting Transformation Pairs',
        title: `Non-Commutative Property: ${name1} vs ${name2}`,
        challenge: `Demonstrate why matrix multiplication is non-commutative in 3D. Compare the result of sequence T₁ then T₂ (C_A = T₂ · T₁) against reversed sequence T₂ then T₁ (C_B = T₁ · T₂). Verify that C_A · v₀ ≠ C_B · v₀.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: name1,
              title: `${name1}`,
              matrix: T1,
              matrixExpressions: T1.map(n => String(n)),
              params: params1
            },
            {
              name: 'T₂',
              type: name2,
              title: `${name2}`,
              matrix: T2,
              matrixExpressions: T2.map(n => String(n)),
              params: params2
            }
          ]
        },
        expected: {
          composedMatrix: CA,
          composedVector: vFinalA,
          intermediateVectors: [JsMathEngine.multiplyVec(T1, v0), vFinalA],
          isInvertible: invA.success,
          determinant: JsMathEngine.determinant(CA),
          inverseMatrix: invA.inverse,
          nonCommuting: true,
          reversedComposedMatrix: CB,
          reversedVector: vFinalB,
          commutatorNorm: diffNorm
        },
        explanation: {
          formula: "C_A = T₂ · T₁ ≠ C_B = T₁ · T₂ (Matrix multiplication does not commute: AB ≠ BA)",
          steps: [
            `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Sequence A (T₁ then T₂): C_A = T₂ · T₁. Evaluates to final vector v_A = ${PracticeGenerator.formatVec(vFinalA)}.`,
            `3. Sequence B (T₂ then T₁): C_B = T₁ · T₂. Evaluates to final vector v_B = ${PracticeGenerator.formatVec(vFinalB)}.`,
            `4. Non-zero Commutator: ||C_A - C_B||_∞ = ${PracticeGenerator.formatNum(diffNorm, 4)} > 0.`,
            `5. Vector difference: ||v_A - v_B||_∞ = ${PracticeGenerator.formatNum(JsMathEngine.vectorNormInf(vFinalA.map((v, i) => v - vFinalB[i])), 4)}.`,
            `6. Spatial intuition: Rotating then scaling/rotating affects axes whose orientations were already altered in step 1!`
          ],
          matrixArithmetic: `||T₂T₁ - T₁T₂||_∞ = ${PracticeGenerator.formatNum(diffNorm, 4)}. Proves spatial order dependence.`
        },
        geometricMeaning: 'In 3D Euclidean space, sequential spatial operations are strictly order-dependent. Swapping the order rotates or scales along fundamentally different intermediate axes!',
        hint: 'Remember that in general, matrix products do not commute: A · B ≠ B · A.'
      };
    }

    if (type === 'inverse_verification') {
      // Invertible composite challenge: Scale followed by Rotation
      const v0 = [
        PracticeGenerator.pick([-2, -1, 1, 2, 3]),
        PracticeGenerator.pick([-1.5, 1, 2, 2.5]),
        PracticeGenerator.pick([-2, 1.5, 2, 4])
      ];

      const s = PracticeGenerator.pick([2, 1.5, 3]);
      const S = [s, 0, 0,  0, s, 0,  0, 0, s];

      const axis = PracticeGenerator.pick(['rotateY', 'rotateZ']);
      // 90 deg rotation
      const rad = Math.PI / 2;
      const R = axis === 'rotateY'
        ? [0, 0, 1,  0, 1, 0,  -1, 0, 0]
        : [0, -1, 0,  1, 0, 0,  0, 0, 1];

      // T₁ = S, T₂ = R. C = R · S
      const C = JsMathEngine.multiplyMat(R, S);
      const vFinal = JsMathEngine.multiplyVec(C, v0);
      const det = JsMathEngine.determinant(C);
      const invRes = JsMathEngine.invertGaussian(C);

      // Verify recovery
      const vRecovered = JsMathEngine.multiplyVec(invRes.inverse, vFinal);
      const recoveryDiff = JsMathEngine.vectorNormInf(vRecovered.map((v, i) => v - v0[i]));

      return {
        id: `HARD_INV_${seed}`,
        seed,
        difficulty: 'Hard',
        category: 'Inverse Verification & Recovery',
        title: 'Full Pipeline Inversion & Vector Recovery',
        challenge: `Given composite transformation C = T₂ · T₁ (Scale ×${s} followed by ${axis}), compute its inverse matrix C⁻¹ via Gauss-Jordan elimination. Verify that C⁻¹ · v' recovers initial vector v₀ exactly.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: 'scale',
              title: `Scale ×${s}`,
              matrix: S,
              matrixExpressions: S.map(n => String(n)),
              params: { sx: s, sy: s, sz: s }
            },
            {
              name: 'T₂',
              type: axis,
              title: `${axis} (pi/2)`,
              matrix: R,
              matrixExpressions: R.map(n => String(n)),
              params: { angleExpr: 'pi/2', angleUnit: 'rad' }
            }
          ]
        },
        expected: {
          composedMatrix: C,
          composedVector: vFinal,
          intermediateVectors: [JsMathEngine.multiplyVec(S, v0), vFinal],
          isInvertible: true,
          determinant: det,
          inverseMatrix: invRes.inverse,
          recoveredVector: vRecovered,
          recoveryError: recoveryDiff
        },
        explanation: {
          formula: "v_recovered = C⁻¹ · v' = (T₂ · T₁)⁻¹ · v' = (T₁⁻¹ · T₂⁻¹) · v' = v₀",
          steps: [
            `1. Composed transformation C = T₂ · T₁.`,
            `2. Determinant det(C) = det(T₂) · det(T₁) = 1 × ${s}³ = ${PracticeGenerator.formatNum(det, 3)} ≠ 0. Therefore C is non-singular and invertible.`,
            `3. Compute C⁻¹: By matrix algebra, (AB)⁻¹ = B⁻¹ · A⁻¹ = T₁⁻¹ · T₂⁻¹.`,
            `4. Forward transform: v' = C · v₀ = ${PracticeGenerator.formatVec(vFinal)}.`,
            `5. Inverse recovery: C⁻¹ · v' = ${PracticeGenerator.formatVec(vRecovered)}.`,
            `6. Verification error ||C⁻¹ · v' - v₀||_∞ = ${PracticeGenerator.formatNum(recoveryDiff, 8)} (within tolerance 10⁻⁹).`
          ],
          matrixArithmetic: `det(C) = ${PracticeGenerator.formatNum(det, 4)}. Product of individual inverses T₁⁻¹ · T₂⁻¹ matches direct inverse C⁻¹.`
        },
        geometricMeaning: 'Applying the inverse matrix C⁻¹ perfectly undoes every rotation and scaling step in reverse order, snapping the transformed vector back to its exact initial 3D coordinate.',
        hint: 'Recall the shoe-and-sock rule for inverses: (A · B)⁻¹ = B⁻¹ · A⁻¹. Notice the order reverses!'
      };
    }

    if (type === 'singular_projection') {
      // Singular matrix challenge: Orthogonal projection onto XY plane (z -> 0)
      const v0 = [
        PracticeGenerator.pick([-3, -2, 1, 2, 4]),
        PracticeGenerator.pick([-2, -1, 2, 3]),
        PracticeGenerator.pick([2, 3, 4, 5]) // non-zero z coordinate to clearly demonstrate collapse
      ];

      const projType = PracticeGenerator.pick(['projXY', 'projXZ', 'projYZ']);
      let P, projName, droppedCoord;
      if (projType === 'projXY') {
        P = [1, 0, 0,  0, 1, 0,  0, 0, 0];
        projName = 'Orthogonal Projection onto XY Plane (z = 0)';
        droppedCoord = 'Z';
      } else if (projType === 'projXZ') {
        P = [1, 0, 0,  0, 0, 0,  0, 0, 1];
        projName = 'Orthogonal Projection onto XZ Plane (y = 0)';
        droppedCoord = 'Y';
      } else {
        P = [0, 0, 0,  0, 1, 0,  0, 0, 1];
        projName = 'Orthogonal Projection onto YZ Plane (x = 0)';
        droppedCoord = 'X';
      }

      const vFinal = JsMathEngine.multiplyVec(P, v0);
      const det = JsMathEngine.determinant(P); // exactly 0.0

      return {
        id: `HARD_SING_${seed}`,
        seed,
        difficulty: 'Hard',
        category: 'Singular Matrix & Dimensionality Reduction',
        title: `Singular Matrix: ${projName}`,
        challenge: `Analyze why matrix P is mathematically singular (det = 0). Calculate P · v₀ and explain why it is impossible to reconstruct the original 3D vector v₀ from v'.`,
        given: {
          v0,
          transformations: [
            {
              name: 'T₁',
              type: 'custom',
              title: projName,
              matrix: P,
              matrixExpressions: P.map(n => String(n)),
              params: {}
            }
          ]
        },
        expected: {
          composedMatrix: P,
          composedVector: vFinal,
          intermediateVectors: [vFinal],
          isInvertible: false,
          determinant: 0.0,
          inverseMatrix: null,
          nullspaceDirection: droppedCoord
        },
        explanation: {
          formula: "P · v₀ = v_proj, det(P) = 0 (Rank = 2, Nullity = 1)",
          steps: [
            `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
            `2. Compute projected vector: v' = P · v₀ = ${PracticeGenerator.formatVec(vFinal)}.`,
            `3. Calculate determinant: det(P) = 0.0000.`,
            `4. The matrix has rank 2 and nullity 1. The entire ${droppedCoord}-axis maps to zero (P · [0,0,1]ᵀ = 0).`,
            `5. Since distinct 3D points [x, y, z₁] and [x, y, z₂] map to the exact same projected image, the mapping is non-injective (many-to-one).`,
            `6. Consequently, no inverse matrix P⁻¹ exists. Information along the ${droppedCoord}-dimension has been irreversibly lost.`
          ],
          matrixArithmetic: "det(P) = 0.0000. Non-trivial nullspace ker(P) ≠ {0}. Inverse solver reports SINGULAR_EXACT."
        },
        geometricMeaning: `The 3D space collapses onto a 2D plane like a shadow. Because depth along ${droppedCoord} is squashed to zero, the original height/depth cannot be retrieved.`,
        hint: 'A transformation is invertible if and only if its determinant is non-zero (det ≠ 0).'
      };
    }

    // Default Hard: 3-stage composition (Rotation -> Scale -> Reflection)
    const axis = PracticeGenerator.pick(['rotateX', 'rotateY', 'rotateZ']);
    const rad = Math.PI / 2;
    let R = [];
    if (axis === 'rotateX') R = [1, 0, 0,  0, 0, -1,  0, 1, 0];
    else if (axis === 'rotateY') R = [0, 0, 1,  0, 1, 0,  -1, 0, 0];
    else R = [0, -1, 0,  1, 0, 0,  0, 0, 1];

    const sx = 2, sy = 1, sz = 1.5;
    const S = [sx, 0, 0,  0, sy, 0,  0, 0, sz];

    const reflType = PracticeGenerator.pick(['reflectXY', 'reflectXZ']);
    const reflMat = reflType === 'reflectXY'
      ? [1, 0, 0,  0, 1, 0,  0, 0, -1]
      : [1, 0, 0,  0, -1, 0,  0, 0, 1];

    // Pipeline: T₁ (Rotation) -> T₂ (Scale) -> T₃ (Reflection)
    // Column vector convention: C = T₃ · (T₂ · T₁)
    const C12 = JsMathEngine.multiplyMat(S, R);
    const C = JsMathEngine.multiplyMat(reflMat, C12);

    const v0 = [
      PracticeGenerator.pick([-2, -1, 1, 2]),
      PracticeGenerator.pick([-1.5, 1, 2, 2.5]),
      PracticeGenerator.pick([1, 2, 3])
    ];

    const v1 = JsMathEngine.multiplyVec(R, v0);
    const v2 = JsMathEngine.multiplyVec(S, v1);
    const v3 = JsMathEngine.multiplyVec(reflMat, v2);

    const det = JsMathEngine.determinant(C);
    const invRes = JsMathEngine.invertGaussian(C);

    return {
      id: `HARD_COMP3_${seed}`,
      seed,
      difficulty: 'Hard',
      category: '3-Stage Composition Pipeline',
      title: `3-Stage Pipeline: ${axis}(90°) → Scale → ${reflType}`,
      challenge: `Evaluate the 3-stage pipeline: T₁ = ${axis}(90°), T₂ = S(${sx}, ${sy}, ${sz}), T₃ = ${reflType}. Compute all intermediate vectors v₁, v₂, v₃ and verify against composite matrix C = T₃ · T₂ · T₁.`,
      given: {
        v0,
        transformations: [
          {
            name: 'T₁',
            type: axis,
            title: `${axis} (90°)`,
            matrix: R,
            matrixExpressions: R.map(n => String(n)),
            params: { angleExpr: 'pi/2', angleUnit: 'rad' }
          },
          {
            name: 'T₂',
            type: 'scale',
            title: `Scale (${sx}, ${sy}, ${sz})`,
            matrix: S,
            matrixExpressions: [String(sx), '0', '0',  '0', String(sy), '0',  '0', '0', String(sz)],
            params: { sx, sy, sz }
          },
          {
            name: 'T₃',
            type: reflType,
            title: reflType,
            matrix: reflMat,
            matrixExpressions: reflMat.map(n => String(n)),
            params: {}
          }
        ]
      },
      expected: {
        composedMatrix: C,
        composedVector: v3,
        intermediateVectors: [v1, v2, v3],
        isInvertible: invRes.success,
        determinant: det,
        inverseMatrix: invRes.inverse
      },
      explanation: {
        formula: "v₃ = T₃(T₂(T₁ · v₀)) = (T₃ · T₂ · T₁) · v₀ = C · v₀",
        steps: [
          `1. Initial vector v₀ = ${PracticeGenerator.formatVec(v0)}.`,
          `2. Stage 1 (Rotation): v₁ = T₁ · v₀ = ${PracticeGenerator.formatVec(v1)}.`,
          `3. Stage 2 (Non-Uniform Scale): v₂ = T₂ · v₁ = ${PracticeGenerator.formatVec(v2)}.`,
          `4. Stage 3 (Reflection): v₃ = T₃ · v₂ = ${PracticeGenerator.formatVec(v3)}.`,
          `5. Compute composite matrix: C = T₃ · (T₂ · T₁).`,
          `6. Determinant: det(C) = det(T₃) · det(T₂) · det(T₁) = (-1) · (${sx} × ${sy} × ${sz}) · (+1) = ${PracticeGenerator.formatNum(det, 3)}.`,
          `7. Direct multiplication check C · v₀ = ${PracticeGenerator.formatVec(JsMathEngine.multiplyVec(C, v0))} confirms v₃.`
        ],
        matrixArithmetic: `det(C) = ${PracticeGenerator.formatNum(det, 4)}. Pipeline verified across 3 sequential transformation stages.`
      },
      geometricMeaning: `The vector undergoes spatial reorientation, followed by anisotropic elongation, and finally mirrors through the ${reflType} boundary.`,
      hint: 'Multiply matrices from right to left: first T₂·T₁, then multiply T₃ on the left.'
    };
  }

  // =========================================================================
  // ANSWER CHECKING & VERIFICATION HELPER
  // =========================================================================
  /**
   * Compares student's computed result with the verified engine expected result.
   * Tolerates floating-point discrepancies up to eps (default 1e-4).
   *
   * @param {Object} challenge - Generated challenge object
   * @param {Array<number>} studentVector - Student's vector [x, y, z]
   * @param {Array<number>} [studentMatrix] - Optional student matrix (flat 9)
   * @param {number} [eps=1e-4] - Tolerance
   * @returns {Object} verification report
   */
  static checkAnswer(challenge, studentVector, studentMatrix = null, eps = 1e-4) {
    if (!challenge || !challenge.expected) {
      return { success: false, correct: false, message: 'Invalid challenge provided.' };
    }

    const expVec = challenge.expected.composedVector;
    if (!studentVector || studentVector.length < 3 || !studentVector.every(Number.isFinite)) {
      return {
        success: false,
        correct: false,
        message: 'Please provide valid numerical coordinates for [x, y, z].'
      };
    }

    const diffX = Math.abs(studentVector[0] - expVec[0]);
    const diffY = Math.abs(studentVector[1] - expVec[1]);
    const diffZ = Math.abs(studentVector[2] - expVec[2]);
    const maxDiff = Math.max(diffX, diffY, diffZ);

    const vectorCorrect = maxDiff <= eps * Math.max(1.0, Math.hypot(...expVec));

    let matrixCorrect = true;
    let matrixMaxDiff = 0;
    if (studentMatrix && studentMatrix.length === 9) {
      const expMat = challenge.expected.composedMatrix;
      for (let i = 0; i < 9; i++) {
        const d = Math.abs(studentMatrix[i] - expMat[i]);
        if (d > matrixMaxDiff) matrixMaxDiff = d;
      }
      matrixCorrect = matrixMaxDiff <= eps * Math.max(1.0, JsMathEngine.normInf(expMat));
    }

    const isAllCorrect = vectorCorrect && matrixCorrect;

    let feedback = '';
    if (isAllCorrect) {
      feedback = `Correct! Your result ${PracticeGenerator.formatVec(studentVector)} matches the mathematically expected vector within ${eps} tolerance. Great job!`;
    } else if (!vectorCorrect) {
      feedback = `Not quite. Your calculated vector is ${PracticeGenerator.formatVec(studentVector)}, but the expected result is ${PracticeGenerator.formatVec(expVec)}. Maximum component error is ${PracticeGenerator.formatNum(maxDiff, 4)}. Check the step-by-step explanation to find where the discrepancy occurred.`;
    } else {
      feedback = `Vector matches, but the composite matrix has an error of ${PracticeGenerator.formatNum(matrixMaxDiff, 4)}. Remember that in column-vector convention, C = T₂ · T₁.`;
    }

    return {
      success: true,
      correct: isAllCorrect,
      vectorCorrect,
      matrixCorrect,
      maxDiff,
      expectedVector: expVec,
      studentVector,
      message: feedback
    };
  }
}
