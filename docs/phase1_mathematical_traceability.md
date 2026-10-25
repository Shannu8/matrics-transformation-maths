# Mathematical Traceability & Engineering Report — Phase 1

## 1. Formulas and Conventions Implemented from the Mathematical Handbook

All formulas follow the **Transformation Composition and Inverse Verification System — Mathematical Formula Handbook** (`transformation_composition_all_formulas.pdf`):

1. **Storage and Representation**:
   - Matrices are stored in 9-element contiguous row-major memory: $A = [a, b, c, d, e, f, g, h, i]$ (Handbook Section 1).
   - Vectors are 3D mathematical column vectors: $v = [x, y, z]^T$.
   - Matrix-vector multiplication follows $v' = Av$ (Handbook Section 2.3).
2. **Matrix Algebra**:
   - Entrywise addition: $(A + B)_{ij} = a_{ij} + b_{ij}$ (Handbook Section 2.1).
   - Scalar multiplication: $(\lambda A)_{ij} = \lambda a_{ij}$ (Handbook Section 2.1).
   - Matrix product: $(AB)_{ij} = \sum_{k=1}^3 a_{ik} b_{kj}$ (Handbook Section 2.2).
   - Transpose: $A^T$, satisfying $(AB)^T = B^T A^T$ (Handbook Section 2.4).
   - Trace: $\text{tr}(A) = a + e + i$ (Handbook Section 2.5).
3. **Determinant, Minors, Cofactors, Adjugate**:
   - Determinant: $\det(A) = a(ei - fh) - b(di - fg) + c(dh - eg)$ (Handbook Section 3.1).
   - $2 \times 2$ Minors: $M_{ij} = \det(\text{submatrix deleting row } i, \text{col } j)$ (Handbook Section 3.2).
   - Cofactors: $K_{ij} = (-1)^{i+j} M_{ij}$ (Handbook Section 3.3).
   - Adjugate: $\text{adj}(A) = \text{cofactor}(A)^T$, satisfying $A \cdot \text{adj}(A) = \det(A) I$ (Handbook Section 3.4).
4. **Predefined 3D Transformations**:
   - Scaling: $S = \text{diag}(s_x, s_y, s_z)$, $S^{-1} = \text{diag}(1/s_x, 1/s_y, 1/s_z)$ (Handbook Section 6.1).
   - Rotations with right-handed coordinate convention and internal radian conversion:
     - $R_x(\theta) = \begin{bmatrix}1 & 0 & 0\\ 0 & \cos\theta & -\sin\theta\\ 0 & \sin\theta & \cos\theta\end{bmatrix}$ (Handbook Section 7.1).
     - $R_y(\theta) = \begin{bmatrix}\cos\theta & 0 & \sin\theta\\ 0 & 1 & 0\\ -\sin\theta & 0 & \cos\theta\end{bmatrix}$ (Handbook Section 7.2).
     - $R_z(\theta) = \begin{bmatrix}\cos\theta & -\sin\theta & 0\\ \sin\theta & \cos\theta & 0\\ 0 & 0 & 1\end{bmatrix}$ (Handbook Section 7.3).
     - Verifying $R^T R = I$, $\det(R) = +1$, $R^{-1} = R^T = R(-\theta)$ (Handbook Section 7.4).
   - Coordinate plane reflections: $F_{xy} = \text{diag}(1, 1, -1)$, $F_{xz} = \text{diag}(1, -1, 1)$, $F_{yz} = \text{diag}(-1, 1, 1)$, satisfying $F^2 = I$, $F^{-1} = F$, $\det(F) = -1$ (Handbook Section 8.1).
   - Directional Shears (X by Y, X by Z, Y by X, Y by Z, Z by X, Z by Y) with $\det(H) = 1$ and $H^{-1}(k) = H(-k)$ (Handbook Section 8.3).
   - General shear parameterization with validation (Handbook Section 8.2).
5. **Transformation Composition**:
   - Order of application: $v_1 = T_1 v$, $v_2 = T_2 v_1$, $v_3 = T_3 v_2$.
   - Composed matrix: $C = T_3 T_2 T_1$.
   - Inverse composed matrix: $C^{-1} = T_1^{-1} T_2^{-1} T_3^{-1}$ (Handbook Section 5.4).
6. **Numerical Verification**:
   - Scale-aware scalar comparison: $|a - b| \le \epsilon \times \max(1, |a|, |b|)$ (Handbook Section 9.1).
   - Vector equality: $\forall i, |u_i - v_i| \le \epsilon \times \max(1, |u_i|, |v_i|)$ (Handbook Section 9.2).
   - Matrix equality: $\forall i, j, |A_{ij} - B_{ij}| \le \epsilon \times \max(1, |A_{ij}|, |B_{ij}|)$ (Handbook Section 9.3).
   - Composition error: $\text{error}_{\text{comp}} = \|C v - v_{\text{sequential}}\|_\infty$ (Handbook Section 9.4).
   - Residual matrices: $E_1 = I - AA^{-1}$, $E_2 = I - A^{-1}A$ (Handbook Section 9.5).
   - Condition number: $\kappa_\infty(A) = \|A\|_\infty \times \|A^{-1}\|_\infty$ (Handbook Section 10.2).
   - Relative residual: $r = \|I - AA^{-1}\|_\infty / (\|A\|_\infty \times \|A^{-1}\|_\infty)$ (Handbook Section 10.3).

---

## 2. Algorithms Supplemented or Replaced and Engineering Justification

1. **Matrix Inversion Algorithm**:
   - *PDF Formula*: $A^{-1} = \text{adj}(A) / \det(A)$ (Handbook Section 4.1).
   - *Engine Implementation*: We implemented **Gauss-Jordan elimination with partial pivoting** on the augmented system $[A \mid I_{3 \times 3}]$ (`InverseSolver::invertGaussian`).
   - *Rationale*: As noted in Handbook Sections 4.1 and 10.4, evaluating the adjugate formula directly with floating-point arithmetic is prone to severe cancellation and overflow/underflow if matrices have differing element scales. Gauss-Jordan with row pivoting scales pivots against $\|A\|_\infty$, guaranteeing numerical stability.
   - *Adjugate Retained*: We also implemented `InverseSolver::invertAdjugate` for mathematical comparison, verification tests, and educational display of minors and cofactors.
2. **Singularity Detection Policy**:
   - *PDF Formula*: $\det(A) = 0 \iff A \text{ is singular}$ (Handbook Section 10.1).
   - *Engine Implementation*: Scale-aware pivot threshold test:
     $$\max_{r \ge k} |A_{rk}| \le \epsilon_{\text{pivot}} \times \|A\|_\infty \quad (\epsilon_{\text{pivot}} = 10^{-12})$$
   - *Rationale*: Determinants can underflow or be artificially minute for well-conditioned scaled matrices (e.g. $0.01 \cdot I \implies \det = 10^{-6}$, yet $\kappa = 1$), or appear moderately sized even when ill-conditioned. Testing pivots against matrix scale prevents false singular classifications.
3. **Stable Vector Norm Calculation**:
   - *Engine Implementation*: In `Vector3::norm2()`, components are scaled by $\max(|x|, |y|, |z|)$ before summing squares:
     $$\|v\|_2 = m \sqrt{(x/m)^2 + (y/m)^2 + (z/m)^2}, \quad m = \max(|x|, |y|, |z|)$$
   - *Rationale*: Prevents intermediate double overflow for values near $10^{154}$ or underflow for tiny values (Handbook Section 9.6).
4. **Finite Value & Boundary Validation**:
   - *Engine Implementation*: Every input entry is checked with `std::isfinite`. Non-finite values ($\text{NaN}, +\infty, -\infty$) immediately return structured errors without crashing or silent zero-substitution (Handbook Section 11.2).
   - Composition sequence length is strictly enforced to $n \in \{2, 3\}$ (Handbook Section 11.4).

---

## 3. Verification and Test Results

- All 5 reference examples and identities from Handbook Section 12 were validated:
  - 12.1: Identity matrix properties ($Iv = v$, $AI = IA = A$).
  - 12.2: Scaling followed by reflection ($T_1 = \text{diag}(2,1,1)$, $T_2 = \text{diag}(1,1,-1)$, $Cv = [2, 2, -3]^T$).
  - 12.3: Non-commuting transformations ($RS \ne SR$ with exact values).
  - 12.4: Scaling inverse ($S = \text{diag}(2,3,4)$, $S^{-1}(Sv) = v$).
  - 12.5: Rotation inverse ($R_z(\theta)^{-1} = R_z(-\theta) = R_z(\theta)^T$).
- 65 automated tests passed with 0 failures (`tests/test_engine.cpp`).
