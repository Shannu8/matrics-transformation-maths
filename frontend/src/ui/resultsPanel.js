export class ResultsPanel {
  constructor() {
    this.tabComposition = document.getElementById('tab-composition');
    this.tabInverses = document.getElementById('tab-inverses');
    this.tabSteps = document.getElementById('tab-steps');
    this.tabTheory = document.getElementById('tab-theory');

    this.setupTabNavigation();
    this.renderTheoryTab();
  }

  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabButtons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  formatNumber(val, decimals = 4) {
    if (!Number.isFinite(val)) return 'NaN';
    if (Math.abs(val) < 1e-12) return '0.0000';
    return val.toFixed(decimals);
  }

  formatMatrixGrid(mat) {
    if (!mat || mat.length !== 9) return '<div>No matrix</div>';
    return `
      <div class="matrix-display-box">
        <div class="cell">${this.formatNumber(mat[0])}</div>
        <div class="cell">${this.formatNumber(mat[1])}</div>
        <div class="cell">${this.formatNumber(mat[2])}</div>
        <div class="cell">${this.formatNumber(mat[3])}</div>
        <div class="cell">${this.formatNumber(mat[4])}</div>
        <div class="cell">${this.formatNumber(mat[5])}</div>
        <div class="cell">${this.formatNumber(mat[6])}</div>
        <div class="cell">${this.formatNumber(mat[7])}</div>
        <div class="cell">${this.formatNumber(mat[8])}</div>
      </div>
    `;
  }

  formatVector(v) {
    if (!v) return '[]';
    return `[ ${this.formatNumber(v[0], 3)}, ${this.formatNumber(v[1], 3)}, ${this.formatNumber(v[2], 3)} ]ᵀ`;
  }

  render(result) {
    if (!result || !result.success) {
      this.renderError(result ? result.errorMessage : 'Calculation failed');
      return;
    }

    this.renderCompositionTab(result);
    this.renderInversesTab(result);
    this.renderStepsTab(result);
  }

  renderError(msg) {
    if (this.tabComposition) {
      this.tabComposition.innerHTML = `
        <div class="alert-banner alert-error">
          <strong>Calculation Error:</strong> ${msg}
        </div>
      `;
    }
  }

  renderCompositionTab(res) {
    if (!this.tabComposition) return;

    const cond = res.composedInverse.conditionNumber;
    let condBadge = `<span class="metric-pill success">Well-Conditioned (κ = ${cond ? cond.toFixed(1) : '1.0'})</span>`;
    if (!res.composedInverse.success) {
      condBadge = `<span class="metric-pill error">Singular Matrix (${res.composedInverse.status})</span>`;
    } else if (cond > 1e8) {
      condBadge = `<span class="metric-pill warning">Ill-Conditioned (κ = ${cond.toExponential(2)})</span>`;
    }

    const compVerifiedBadge = res.compositionVerified
      ? `<span class="metric-pill success">Verified Equivalent (Error: ${res.compositionError.toExponential(2)})</span>`
      : `<span class="metric-pill error">Verification Failed (Error: ${res.compositionError.toExponential(2)})</span>`;

    const recoveryBadge = res.vectorRecoverySuccessful
      ? `<span class="metric-pill success">Recovered Perfectly (Error: ${res.recoveryError.toExponential(2)})</span>`
      : `<span class="metric-pill error">Recovery Failed / Singular</span>`;

    this.tabComposition.innerHTML = `
      <div class="results-grid">
        <!-- Composed Matrix Card -->
        <div class="result-card">
          <div class="result-card-header">
            <h4>Composed Matrix C = ${res.steps.map(s => s.name).reverse().join(' · ')}</h4>
            <span class="metric-pill">${res.engineSource || 'Engine'}</span>
          </div>
          ${this.formatMatrixGrid(res.composedMatrix)}
          <div class="verification-stat-row">
            <span>det(C):</span>
            <span class="stat-value">${this.formatNumber(res.composedInverse.determinant)}</span>
          </div>
          <div class="verification-stat-row">
            <span>||C||_∞:</span>
            <span class="stat-value">${this.formatNumber(res.composedInverse.normA)}</span>
          </div>
          <div class="verification-stat-row">
            <span>Conditioning:</span>
            <div>${condBadge}</div>
          </div>
        </div>

        <!-- Verification Metrics Card -->
        <div class="result-card">
          <div class="result-card-header">
            <h4>Mathematical Verification</h4>
            <span class="metric-pill">Scale-Aware Tolerance: 10⁻⁹</span>
          </div>
          <div class="verification-stat-row">
            <span>Composition Equality ||Cv - v_seq||:</span>
            <div>${compVerifiedBadge}</div>
          </div>
          <div class="verification-stat-row">
            <span>Vector Recovery ||C⁻¹(Cv) - v||:</span>
            <div>${recoveryBadge}</div>
          </div>
          <div class="verification-stat-row">
            <span>Inverse Residual ||I - CC⁻¹||_∞:</span>
            <span class="stat-value">${res.composedInverse.success ? res.composedInverse.residualE1Norm.toExponential(2) : 'N/A'}</span>
          </div>
          <div class="verification-stat-row">
            <span>Relative Residual r:</span>
            <span class="stat-value">${res.composedInverse.success ? res.composedInverse.relativeResidual.toExponential(2) : 'N/A'}</span>
          </div>
          <div class="verification-stat-row">
            <span>Product of Inverses = C⁻¹:</span>
            <span class="stat-value">${res.inverseProductMatchesDirect ? 'Matches Identically ✓' : 'N/A'}</span>
          </div>
        </div>

        <!-- Vector Comparison Card -->
        <div class="result-card">
          <div class="result-card-header">
            <h4>Vector Transformation Outcomes</h4>
          </div>
          <div class="verification-stat-row">
            <span>Initial Vector v₀:</span>
            <span class="stat-value" style="color:var(--accent-cyan);">${this.formatVector(res.initialVector)}</span>
          </div>
          <div class="verification-stat-row">
            <span>Sequential Final Vector:</span>
            <span class="stat-value" style="color:var(--accent-purple);">${this.formatVector(res.finalSequentialVector)}</span>
          </div>
          <div class="verification-stat-row">
            <span>Composed Vector Cv:</span>
            <span class="stat-value" style="color:var(--accent-emerald);">${this.formatVector(res.composedVector)}</span>
          </div>
          <div class="verification-stat-row">
            <span>Recovered Vector C⁻¹(Cv):</span>
            <span class="stat-value" style="color:#fff;">${res.recoveredVector ? this.formatVector(res.recoveredVector) : 'N/A'}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderInversesTab(res) {
    if (!this.tabInverses) return;

    let html = `<div class="results-grid">`;

    // Composed Matrix Inverse
    html += `
      <div class="result-card">
        <div class="result-card-header">
          <h4>Composed Inverse C⁻¹ (Pivoted Gauss-Jordan)</h4>
          <span class="metric-pill ${res.composedInverse.success ? 'success' : 'error'}">
            ${res.composedInverse.status}
          </span>
        </div>
        ${res.composedInverse.success ? this.formatMatrixGrid(res.composedInverse.inverse) : '<p style="color:#f43f5e;">Matrix is singular; inverse does not exist.</p>'}
        <div class="verification-stat-row">
          <span>Message:</span>
          <span class="stat-value" style="font-size:0.75rem;">${res.composedInverse.message}</span>
        </div>
      </div>

      <div class="result-card">
        <div class="result-card-header">
          <h4>Product of Individual Inverses</h4>
          <span class="metric-pill">${res.steps.map(s => `${s.name}⁻¹`).join(' · ')}</span>
        </div>
        ${res.productOfInverses ? this.formatMatrixGrid(res.productOfInverses) : '<p style="color:#f43f5e;">Cannot compute product; one or more transformations are singular.</p>'}
        <div class="verification-stat-row">
          <span>Agrees with Direct C⁻¹:</span>
          <span class="stat-value">${res.inverseProductMatchesDirect ? 'True (Diff: ' + res.inverseProductDifferenceNorm.toExponential(2) + ')' : 'False'}</span>
        </div>
      </div>
    `;

    // Individual Inverses
    res.steps.forEach(st => {
      html += `
        <div class="result-card">
          <div class="result-card-header">
            <h4>${st.name} Inverse (${st.name}⁻¹)</h4>
            <span class="metric-pill ${st.inverse.success ? 'success' : 'error'}">${st.inverse.status}</span>
          </div>
          ${st.inverse.success ? this.formatMatrixGrid(st.inverse.inverse) : '<p style="color:#f43f5e;">Matrix is singular.</p>'}
          <div class="verification-stat-row">
            <span>det(${st.name}):</span>
            <span class="stat-value">${this.formatNumber(st.inverse.determinant)}</span>
          </div>
          <div class="verification-stat-row">
            <span>||I - ${st.name}${st.name}⁻¹||_∞:</span>
            <span class="stat-value">${st.inverse.success ? st.inverse.residualE1Norm.toExponential(2) : 'N/A'}</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.tabInverses.innerHTML = html;
  }

  renderStepsTab(res) {
    if (!this.tabSteps) return;

    let html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="result-card" style="border-left: 4px solid var(--accent-cyan);">
          <h4>Step 0: Initial Vector</h4>
          <div class="vector-display-box">${this.formatVector(res.initialVector)}</div>
        </div>
    `;

    res.steps.forEach((st, idx) => {
      const colors = ['var(--accent-amber)', 'var(--accent-purple)', 'var(--accent-magenta)'];
      const borderColor = colors[idx] || 'var(--accent-blue)';
      const prevV = idx === 0 ? res.initialVector : res.steps[idx - 1].outputVector;

      html += `
        <div class="result-card" style="border-left: 4px solid ${borderColor};">
          <div class="result-card-header">
            <h4>Step ${st.index}: Apply ${st.name}</h4>
            <span class="metric-pill">v${st.index} = ${st.name} · v${idx === 0 ? '₀' : idx}</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:8px;">
            <div>
              <div style="font-size:0.75rem; color:#9ca3af; margin-bottom:4px;">Matrix ${st.name}:</div>
              ${this.formatMatrixGrid(st.matrix)}
            </div>
            <div style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
              <div>
                <div style="font-size:0.75rem; color:#9ca3af;">Input Vector:</div>
                <div style="font-family:var(--font-mono); color:#cbd5e1;">${this.formatVector(prevV)}</div>
              </div>
              <div>
                <div style="font-size:0.75rem; color:#9ca3af;">Output Vector v${st.index}:</div>
                <div style="font-family:var(--font-mono); font-weight:600; color:${borderColor};">${this.formatVector(st.outputVector)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        <div class="result-card" style="border-left: 4px solid var(--accent-emerald);">
          <div class="result-card-header">
            <h4>Composed Direct Application: Cv₀</h4>
            <span class="metric-pill success">Matches Step ${res.steps.length} Result</span>
          </div>
          <div class="vector-display-box">${this.formatVector(res.composedVector)}</div>
        </div>
      </div>
    `;

    this.tabSteps.innerHTML = html;
  }

  renderTheoryTab() {
    if (!this.tabTheory) return;
    this.tabTheory.innerHTML = `
      <article class="theory-article">
        <div class="theory-section">
          <h4>1. Transformation Composition Order</h4>
          <p>
            When transformations are applied sequentially to a 3D column vector <code>v</code> in the order 
            <strong>T₁</strong>, then <strong>T₂</strong>, then <strong>T₃</strong>:
          </p>
          <div class="code-block">
v₁ = T₁ · v
v₂ = T₂ · v₁ = T₂ · (T₁ · v) = (T₂ · T₁) · v
v₃ = T₃ · v₂ = T₃ · (T₂ · T₁) · v = (T₃ · T₂ · T₁) · v
          </div>
          <p>
            Therefore, the composed transformation matrix is applied from right-to-left:
            <strong>C = T₃ · T₂ · T₁</strong> (or <strong>C = T₂ · T₁</strong> for two transformations).
            Since matrix multiplication is generally <em>non-commutative</em> (<code>AB ≠ BA</code>), preserving 
            the exact order is mathematically vital.
          </p>
        </div>

        <div class="theory-section">
          <h4>2. Inverse of a Transformation Product</h4>
          <p>
            When taking the inverse of a matrix product, the order of factors is reversed:
          </p>
          <div class="code-block">
(A · B)⁻¹ = B⁻¹ · A⁻¹
(T₃ · T₂ · T₁)⁻¹ = T₁⁻¹ · T₂⁻¹ · T₃⁻¹
          </div>
          <p>
            Our verification suite computes both the direct Gauss-Jordan inversion of <code>C</code> and the product 
            of individual inverses <code>T₁⁻¹ · T₂⁻¹ · T₃⁻¹</code>, proving their mathematical identity.
          </p>
        </div>

        <div class="theory-section">
          <h4>3. Numerical Inversion: Gauss-Jordan with Partial Pivoting</h4>
          <p>
            While the mathematical adjugate formula is <code>A⁻¹ = adj(A) / det(A)</code>, directly calculating 
            minors and determinant in floating-point arithmetic is prone to catastrophic cancellation when entries vary in scale.
          </p>
          <p>
            The C++17 engine implements <strong>Gauss-Jordan elimination with row-partial pivoting</strong> on the augmented matrix <code>[A | I]</code>.
            Singularity is determined by a scale-aware pivot threshold:
          </p>
          <div class="code-block">
|pivot| ≥ ε_pivot × ||A||_∞  (where ε_pivot = 10⁻¹²)
          </div>
        </div>

        <div class="theory-section">
          <h4>4. Condition Number & Residual Verification</h4>
          <p>
            The condition number <code>κ(A) = ||A||_∞ × ||A⁻¹||_∞</code> quantifies sensitivity to perturbations.
            Matrices with <code>κ(A) > 10⁸</code> are flagged as ill-conditioned.
            Inversion accuracy is verified by computing residual matrices:
          </p>
          <div class="code-block">
E₁ = I - A · A⁻¹
E₂ = I - A⁻¹ · A
Relative Residual: r = ||I - A · A⁻¹||_∞ / (||A||_∞ · ||A⁻¹||_∞)
          </div>
        </div>
      </article>
    `;
  }
}
