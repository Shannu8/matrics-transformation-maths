import { MathExpressionParser } from '../math/expressionParser.js';

/**
 * Dynamic Matrix Inputs Manager
 * Supports adding, editing, reordering, enabling/disabling, and removing
 * arbitrary numbers of 3x3 transformations in the sequence.
 * 
 * Full mathematical expression support for:
 * - Angles (pi, theta, sin(theta), cos(theta), 2*pi, pi/4, etc.)
 * - Theta angle parameter configuration (Radians / Degrees)
 * - Custom 3x3 matrix cells with symbolic expressions
 * - Initial vector coordinates
 */
export class MatrixInputsManager {
  constructor(engineClient, onMatrixChangeCallback) {
    this.engineClient = engineClient;
    this.onChange = onMatrixChangeCallback;

    // Angle parameter θ state (default: theta = pi/4 in radians)
    this.thetaExpr = 'pi/4';
    this.thetaUnit = 'rad'; // 'rad' | 'deg'
    this.thetaValue = Math.PI / 4.0;

    // Array of dynamic transformation objects:
    // { id, name, matrix: [9 numbers], matrixExpressions: [9 strings], type: string, params: object, enabled: boolean }
    this.transformations = [];
    this.idCounter = 1;

    this.isInitializing = true;
    this.init();
    this.isInitializing = false;
  }

  init() {
    // Start with 2 default transformations:
    // T1: Rotation about Z by θ (or identity), T2: Identity
    this.addTransformation('identity', false);
    this.addTransformation('identity', false);

    this.setupThetaControls();
    this.renderAllCards();
    this.setupGlobalControls();
    this.setupVectorInputs();
    this.setupQuickExamples();
  }

  getThetaRad() {
    try {
      const res = MathExpressionParser.validate(this.thetaExpr, { pi: Math.PI, 'π': Math.PI, e: Math.E });
      if (res.valid) {
        if (this.thetaUnit === 'deg') {
          return res.value * (Math.PI / 180.0);
        }
        return res.value;
      }
    } catch (_) {}
    return this.thetaValue || (Math.PI / 4.0);
  }

  getScope() {
    const thetaRad = this.getThetaRad();
    return {
      theta: thetaRad,
      'θ': thetaRad,
      pi: Math.PI,
      'π': Math.PI,
      e: Math.E
    };
  }

  setupThetaControls() {
    const thetaInput = document.getElementById('input-theta-expr');
    const badge = document.getElementById('theta-eval-badge');
    const errMsg = document.getElementById('theta-error-msg');
    const btnRad = document.getElementById('btn-unit-rad');
    const btnDeg = document.getElementById('btn-unit-deg');

    const updateTheta = (notify = true) => {
      const expr = thetaInput ? thetaInput.value.trim() : this.thetaExpr;
      const res = MathExpressionParser.validate(expr, { pi: Math.PI, 'π': Math.PI, e: Math.E });

      if (res.valid) {
        if (thetaInput) thetaInput.classList.remove('invalid');
        if (errMsg) errMsg.classList.add('hidden');
        this.thetaExpr = expr;

        let rad = res.value;
        let deg = res.value * (180.0 / Math.PI);
        if (this.thetaUnit === 'deg') {
          deg = res.value;
          rad = res.value * (Math.PI / 180.0);
        }
        this.thetaValue = rad;

        if (badge) {
          badge.textContent = `≈ ${rad.toFixed(4)} rad (${deg.toFixed(1)}°)`;
        }

        // Re-evaluate transformations that depend on theta
        this.recalculateDependentTransformations();
        if (notify && !this.isInitializing) {
          this.notifyChange();
        }
      } else {
        if (thetaInput) thetaInput.classList.add('invalid');
        if (errMsg) {
          errMsg.textContent = res.error;
          errMsg.classList.remove('hidden');
        }
      }
    };

    if (thetaInput) {
      thetaInput.addEventListener('input', () => updateTheta(true));
    }

    if (btnRad && btnDeg) {
      btnRad.addEventListener('click', () => {
        if (this.thetaUnit === 'rad') return;
        this.thetaUnit = 'rad';
        btnRad.classList.add('active');
        btnDeg.classList.remove('active');
        updateTheta(true);
      });
      btnDeg.addEventListener('click', () => {
        if (this.thetaUnit === 'deg') return;
        this.thetaUnit = 'deg';
        btnDeg.classList.add('active');
        btnRad.classList.remove('active');
        updateTheta(true);
      });
    }

    const quickChips = document.querySelectorAll('.chip-theta');
    quickChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = e.target.getAttribute('data-val');
        if (!val || !thetaInput) return;
        thetaInput.value = val;
        updateTheta(true);
      });
    });

    updateTheta(false);
  }

  setupGlobalControls() {
    const addBtnTop = document.getElementById('btn-add-transformation');
    const addBtnBottom = document.getElementById('btn-add-transformation-bottom');

    const handleAdd = () => {
      this.addTransformation('identity', true);
    };

    if (addBtnTop) addBtnTop.addEventListener('click', handleAdd);
    if (addBtnBottom) addBtnBottom.addEventListener('click', handleAdd);
  }

  setupVectorInputs() {
    ['vec-x', 'vec-y', 'vec-z'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const res = MathExpressionParser.validate(el.value, this.getScope());
          if (res.valid) {
            el.classList.remove('invalid');
            el.title = `Evaluated: ${MathExpressionParser.formatNumber(res.value)}`;
          } else {
            el.classList.add('invalid');
            el.title = `Error: ${res.error}`;
          }
          this.notifyChange();
        });
      }
    });

    const chips = document.querySelectorAll('.header-presets .chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const raw = e.target.getAttribute('data-vec');
        if (!raw) return;
        const [x, y, z] = raw.split(',').map(Number);
        this.setVector([x, y, z]);
        this.notifyChange();
      });
    });
  }

  addTransformation(preset = 'identity', shouldNotify = true) {
    const id = `trans_${this.idCounter++}`;
    let matrix = [1, 0, 0,  0, 1, 0,  0, 0, 1];
    let matrixExpressions = ['1', '0', '0',  '0', '1', '0',  '0', '0', '1'];
    const params = {};

    if (preset && preset !== 'identity' && preset !== 'custom') {
      if (preset.startsWith('rotate')) {
        params.angleExpr = 'theta';
        params.angleUnit = this.thetaUnit || 'rad';
        const rad = this.getThetaRad();
        matrix = this.computeRotationMatrix(preset, rad);
        matrixExpressions = this.getRotationMatrixExpressions(preset);
      } else {
        matrix = this.engineClient.getPresetMatrix(preset) || matrix;
        matrixExpressions = matrix.map(v => MathExpressionParser.formatNumber(v));
      }
    }

    const item = {
      id,
      name: `T${this.transformations.length + 1}`,
      matrix: [...matrix],
      matrixExpressions: [...matrixExpressions],
      type: preset || 'identity',
      params,
      enabled: true
    };

    this.transformations.push(item);
    this.updateOrderNames();

    if (shouldNotify) {
      this.renderAllCards();
      this.notifyChange();
    }
    return item;
  }

  removeTransformation(id) {
    if (this.transformations.length <= 1) {
      alert('At least one transformation must remain in the sequence.');
      return;
    }
    this.transformations = this.transformations.filter(t => t.id !== id);
    this.updateOrderNames();
    this.renderAllCards();
    this.notifyChange();
  }

  moveTransformation(id, direction) {
    const idx = this.transformations.findIndex(t => t.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.transformations.length) return;

    const temp = this.transformations[idx];
    this.transformations[idx] = this.transformations[targetIdx];
    this.transformations[targetIdx] = temp;

    this.updateOrderNames();
    this.renderAllCards();
    this.notifyChange();
  }

  toggleTransformation(id) {
    const item = this.transformations.find(t => t.id === id);
    if (!item) return;
    item.enabled = !item.enabled;
    this.renderAllCards();
    this.notifyChange();
  }

  updateOrderNames() {
    let activeIdx = 1;
    this.transformations.forEach(t => {
      t.name = `T${activeIdx++}`;
    });

    const badge = document.getElementById('trans-order-badge');
    if (badge) {
      const activeNames = this.transformations.filter(t => t.enabled).map(t => t.name);
      if (activeNames.length > 0) {
        badge.textContent = `Order: C = ${activeNames.slice().reverse().join(' · ')}`;
      } else {
        badge.textContent = 'All Transformations Disabled';
      }
    }
  }

  renderAllCards() {
    const container = document.getElementById('transformation-cards-container');
    if (!container) return;

    container.innerHTML = '';
    this.transformations.forEach((item, idx) => {
      const cardEl = this.createCardElement(item, idx, this.transformations.length);
      container.appendChild(cardEl);
      this.renderMatrixGrid(item);
      this.updateMatrixDiagnostics(item);
    });
  }

  createCardElement(item, index, total) {
    const card = document.createElement('div');
    card.className = `control-card matrix-card ${item.enabled ? '' : 'is-disabled'}`;
    card.id = `card-${item.id}`;

    const isFirst = index === 0;
    const isLast = index === total - 1;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <label class="toggle-control trans-enable-toggle" title="Enable / Disable this transformation stage">
            <input type="checkbox" ${item.enabled ? 'checked' : ''} class="trans-checkbox" data-id="${item.id}" />
            <span class="card-badge badge-t">${item.name}</span>
          </label>
          <span class="trans-stage-title">${this.getPresetDisplayName(item.type)}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-icon btn-compact btn-move-up" data-id="${item.id}" ${isFirst ? 'disabled' : ''} title="Move Up in sequence (applied earlier)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          <button class="btn btn-icon btn-compact btn-move-down" data-id="${item.id}" ${isLast ? 'disabled' : ''} title="Move Down in sequence (applied later)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button class="btn btn-icon btn-compact btn-delete-trans" data-id="${item.id}" title="Delete transformation" ${total <= 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="card-type-row">
        <label class="preset-label">Type / Preset:</label>
        <select class="preset-select" data-id="${item.id}">
          <option value="identity" ${item.type === 'identity' ? 'selected' : ''}>Identity Matrix</option>
          <option value="scale" ${item.type === 'scale' ? 'selected' : ''}>Scaling (sx, sy, sz)</option>
          <option value="rotateX" ${item.type === 'rotateX' ? 'selected' : ''}>Rotation about X</option>
          <option value="rotateY" ${item.type === 'rotateY' ? 'selected' : ''}>Rotation about Y</option>
          <option value="rotateZ" ${item.type === 'rotateZ' ? 'selected' : ''}>Rotation about Z</option>
          <option value="reflectXY" ${item.type === 'reflectXY' ? 'selected' : ''}>Reflection XY (z → -z)</option>
          <option value="reflectXZ" ${item.type === 'reflectXZ' ? 'selected' : ''}>Reflection XZ (y → -y)</option>
          <option value="reflectYZ" ${item.type === 'reflectYZ' ? 'selected' : ''}>Reflection YZ (x → -x)</option>
          <option value="shear" ${item.type === 'shear' ? 'selected' : ''}>Shear</option>
          <option value="custom" ${item.type === 'custom' ? 'selected' : ''}>Custom 3×3 Matrix</option>
        </select>
      </div>

      <div class="preset-params-box ${this.hasPresetParams(item.type) ? '' : 'hidden'}" id="preset-params-${item.id}"></div>
      <div class="matrix-grid-container" id="grid-${item.id}"></div>
      <div id="matrix-error-${item.id}" class="expr-error-text hidden"></div>
      <div id="matrix-preview-${item.id}"></div>
      <div class="matrix-diagnostics" id="diag-${item.id}">
        <span class="det-label">det(${item.name}) = <strong class="det-val">1.0</strong></span>
        <span class="status-pill status-ok">Invertible</span>
      </div>
    `;

    // Event listeners on this card
    const chk = card.querySelector('.trans-checkbox');
    chk.addEventListener('change', () => this.toggleTransformation(item.id));

    const btnUp = card.querySelector('.btn-move-up');
    if (btnUp) btnUp.addEventListener('click', () => this.moveTransformation(item.id, -1));

    const btnDown = card.querySelector('.btn-move-down');
    if (btnDown) btnDown.addEventListener('click', () => this.moveTransformation(item.id, 1));

    const btnDel = card.querySelector('.btn-delete-trans');
    if (btnDel) btnDel.addEventListener('click', () => this.removeTransformation(item.id));

    const sel = card.querySelector('.preset-select');
    sel.addEventListener('change', (e) => {
      this.applyPreset(item.id, e.target.value);
    });

    if (this.hasPresetParams(item.type)) {
      const pbox = card.querySelector(`#preset-params-${item.id}`);
      this.renderPresetControls(item, pbox);
    }

    return card;
  }

  getPresetDisplayName(type) {
    switch (type) {
      case 'scale': return 'Scaling';
      case 'rotateX': return 'Rotation about X';
      case 'rotateY': return 'Rotation about Y';
      case 'rotateZ': return 'Rotation about Z';
      case 'reflectXY': return 'Reflection XY';
      case 'reflectXZ': return 'Reflection XZ';
      case 'reflectYZ': return 'Reflection YZ';
      case 'shear': return 'Shear Mapping';
      case 'custom': return 'Custom 3×3';
      case 'identity':
      default: return 'Identity';
    }
  }

  hasPresetParams(type) {
    return ['scale', 'rotateX', 'rotateY', 'rotateZ', 'shear'].includes(type);
  }

  computeRotationMatrix(type, rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const cleanC = Math.abs(c) < 1e-15 ? 0 : (Math.abs(c - Math.round(c)) < 1e-14 ? Math.round(c) : c);
    const cleanS = Math.abs(s) < 1e-15 ? 0 : (Math.abs(s - Math.round(s)) < 1e-14 ? Math.round(s) : s);

    if (type === 'rotateX') {
      return [1, 0, 0,  0, cleanC, -cleanS,  0, cleanS, cleanC];
    } else if (type === 'rotateY') {
      return [cleanC, 0, cleanS,  0, 1, 0,  -cleanS, 0, cleanC];
    } else if (type === 'rotateZ') {
      return [cleanC, -cleanS, 0,  cleanS, cleanC, 0,  0, 0, 1];
    }
    return [1, 0, 0,  0, 1, 0,  0, 0, 1];
  }

  getRotationMatrixExpressions(type) {
    if (type === 'rotateX') {
      return ['1', '0', '0',  '0', 'cos(θ)', '-sin(θ)',  '0', 'sin(θ)', 'cos(θ)'];
    } else if (type === 'rotateY') {
      return ['cos(θ)', '0', 'sin(θ)',  '0', '1', '0',  '-sin(θ)', '0', 'cos(θ)'];
    } else if (type === 'rotateZ') {
      return ['cos(θ)', '-sin(θ)', '0',  'sin(θ)', 'cos(θ)', '0',  '0', '0', '1'];
    }
    return ['1', '0', '0',  '0', '1', '0',  '0', '0', '1'];
  }

  renderMatrixGrid(item) {
    const container = document.getElementById(`grid-${item.id}`);
    if (!container) return;

    container.innerHTML = '';
    const matData = item.matrix;
    if (!item.matrixExpressions || item.matrixExpressions.length !== 9) {
      item.matrixExpressions = matData.map(v => MathExpressionParser.formatNumber(v));
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'matrix-cell';
        input.value = item.matrixExpressions[idx];
        input.title = `Evaluated: ${MathExpressionParser.formatNumber(matData[idx])}`;
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.index = idx;
        input.id = `cell-${item.id}-${r}-${c}`;
        input.setAttribute('aria-label', `${item.name} row ${r+1} col ${c+1}`);
        input.placeholder = '0';

        input.addEventListener('input', (e) => {
          const expr = e.target.value.trim();
          const res = MathExpressionParser.validate(expr, this.getScope());

          if (!res.valid) {
            e.target.classList.add('invalid');
            this.showMatrixError(item.id, `Cell [${r+1},${c+1}]: ${res.error}`);
          } else {
            e.target.classList.remove('invalid');
            this.hideMatrixError(item.id);
            item.matrixExpressions[idx] = expr;
            item.matrix[idx] = res.value;
            e.target.title = `Evaluated: ${MathExpressionParser.formatNumber(res.value)}`;

            // Switch preset to custom if not already
            if (item.type !== 'custom') {
              item.type = 'custom';
              const sel = document.querySelector(`.preset-select[data-id="${item.id}"]`);
              if (sel) sel.value = 'custom';
              const pbox = document.getElementById(`preset-params-${item.id}`);
              if (pbox) {
                pbox.innerHTML = '';
                pbox.classList.add('hidden');
              }
            }

            this.updateMatrixDiagnostics(item);
            this.updateMatrixEvalPreview(item);
            this.notifyChange();
          }
        });

        container.appendChild(input);
      }
    }

    this.updateMatrixEvalPreview(item);
  }

  showMatrixError(itemId, msg) {
    const errEl = document.getElementById(`matrix-error-${itemId}`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }
  }

  hideMatrixError(itemId) {
    const errEl = document.getElementById(`matrix-error-${itemId}`);
    if (errEl) {
      errEl.classList.add('hidden');
    }
  }

  updateMatrixEvalPreview(item) {
    const previewEl = document.getElementById(`matrix-preview-${item.id}`);
    if (!previewEl) return;

    // Check if any cell has a symbolic expression
    const hasExpression = item.matrixExpressions && item.matrixExpressions.some(expr => {
      const trimmed = String(expr).trim();
      return isNaN(Number(trimmed));
    });

    if (!hasExpression) {
      previewEl.innerHTML = '';
      return;
    }

    const m = item.matrix;
    previewEl.innerHTML = `
      <div class="matrix-eval-preview">
        <div class="matrix-eval-preview-header">
          <span>Evaluated Matrix (Engine Input)</span>
        </div>
        <div class="matrix-eval-grid">
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[0])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[1])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[2])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[3])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[4])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[5])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[6])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[7])}</div>
          <div class="matrix-eval-cell">${MathExpressionParser.formatNumber(m[8])}</div>
        </div>
      </div>
    `;
  }

  updateMatrixDiagnostics(item) {
    const diag = document.getElementById(`diag-${item.id}`);
    if (!diag) return;

    const det = this.engineClient.invertMatrix(item.matrix).determinant;
    const detEl = diag.querySelector('.det-val');
    const pill = diag.querySelector('.status-pill');

    if (detEl) {
      detEl.textContent = isFinite(det) ? det.toFixed(3) : 'NaN';
    }

    if (pill) {
      if (Math.abs(det) < 1e-12) {
        pill.className = 'status-pill status-singular';
        pill.textContent = 'Singular';
      } else {
        pill.className = 'status-pill status-ok';
        pill.textContent = 'Invertible';
      }
    }
  }

  applyPreset(id, presetType) {
    const item = this.transformations.find(t => t.id === id);
    if (!item) return;

    item.type = presetType;
    const pbox = document.getElementById(`preset-params-${item.id}`);

    if (this.hasPresetParams(presetType)) {
      if (pbox) {
        pbox.classList.remove('hidden');
        this.renderPresetControls(item, pbox);
      }
    } else {
      if (pbox) {
        pbox.innerHTML = '';
        pbox.classList.add('hidden');
      }
      if (presetType !== 'custom') {
        const newMat = this.engineClient.getPresetMatrix(presetType);
        if (newMat) {
          item.matrix = [...newMat];
          item.matrixExpressions = newMat.map(v => MathExpressionParser.formatNumber(v));
        }
      }
      this.renderMatrixGrid(item);
      this.updateMatrixDiagnostics(item);
      this.notifyChange();
    }
  }

  recalculateDependentTransformations() {
    this.transformations.forEach(item => {
      if (item.type.startsWith('rotate')) {
        const rad = this.getRotationAngleRad(item);
        item.matrix = this.computeRotationMatrix(item.type, rad);
        item.matrixExpressions = this.getRotationMatrixExpressions(item.type);
        const pbox = document.getElementById(`preset-params-${item.id}`);
        if (pbox) this.renderPresetControls(item, pbox);
        this.renderMatrixGrid(item);
        this.updateMatrixDiagnostics(item);
      } else if (item.type === 'custom') {
        // Check if any cell references theta or θ
        let changed = false;
        if (item.matrixExpressions) {
          item.matrixExpressions.forEach((expr, idx) => {
            if (/theta|θ/i.test(expr)) {
              const res = MathExpressionParser.validate(expr, this.getScope());
              if (res.valid) {
                item.matrix[idx] = res.value;
                changed = true;
              }
            }
          });
        }
        if (changed) {
          this.renderMatrixGrid(item);
          this.updateMatrixDiagnostics(item);
        }
      }
    });
  }

  getRotationAngleRad(item) {
    const expr = item.params.angleExpr || 'theta';
    const unit = item.params.angleUnit || this.thetaUnit || 'rad';
    const res = MathExpressionParser.validate(expr, this.getScope());
    if (!res.valid) return this.getThetaRad();
    return unit === 'deg' ? res.value * (Math.PI / 180.0) : res.value;
  }

  renderPresetControls(item, container) {
    if (!container) return;
    container.innerHTML = '';

    if (item.type === 'scale') {
      const sx = item.params.sx ?? 1.0;
      const sy = item.params.sy ?? 1.0;
      const sz = item.params.sz ?? 1.0;
      container.innerHTML = `
        <div class="preset-row">
          <label>sx: <span class="param-val" id="val-sx-${item.id}">${sx}</span></label>
          <input type="range" class="p-sx" min="-3" max="5" step="0.5" value="${sx}" />
        </div>
        <div class="preset-row">
          <label>sy: <span class="param-val" id="val-sy-${item.id}">${sy}</span></label>
          <input type="range" class="p-sy" min="-3" max="5" step="0.5" value="${sy}" />
        </div>
        <div class="preset-row">
          <label>sz: <span class="param-val" id="val-sz-${item.id}">${sz}</span></label>
          <input type="range" class="p-sz" min="-3" max="5" step="0.5" value="${sz}" />
        </div>
      `;

      const updateScale = () => {
        const sxVal = parseFloat(container.querySelector('.p-sx')?.value || 1);
        const syVal = parseFloat(container.querySelector('.p-sy')?.value || 1);
        const szVal = parseFloat(container.querySelector('.p-sz')?.value || 1);
        item.params = { sx: sxVal, sy: syVal, sz: szVal };
        item.matrix = [sxVal, 0, 0,  0, syVal, 0,  0, 0, szVal];
        item.matrixExpressions = [String(sxVal), '0', '0', '0', String(syVal), '0', '0', '0', String(szVal)];
        this.renderMatrixGrid(item);
        this.updateMatrixDiagnostics(item);
        this.notifyChange();
      };

      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const lbl = container.querySelector(`#val-${e.target.className.replace('p-', '')}-${item.id}`);
          if (lbl) lbl.textContent = e.target.value;
          updateScale();
        });
      });
    } else if (item.type.startsWith('rotate')) {
      const angleExpr = item.params.angleExpr || 'theta';
      const angleUnit = item.params.angleUnit || this.thetaUnit || 'rad';
      const rad = this.getRotationAngleRad(item);
      const deg = rad * (180.0 / Math.PI);
      const c = Math.cos(rad);
      const s = Math.sin(rad);

      container.innerHTML = `
        <div class="angle-row-expr">
          <div class="card-header" style="padding:0;margin-bottom:4px;">
            <label style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">Rotation Angle:</label>
            <div class="theta-unit-toggle" role="radiogroup">
              <button type="button" class="unit-toggle-btn ${angleUnit === 'rad' ? 'active' : ''} p-angle-rad" title="Radians">Rad</button>
              <button type="button" class="unit-toggle-btn ${angleUnit === 'deg' ? 'active' : ''} p-angle-deg" title="Degrees">Deg</button>
            </div>
          </div>
          <div class="angle-input-wrapper">
            <input type="text" class="param-expr-input p-angle-input" value="${angleExpr}" placeholder="e.g. pi/4, theta, 45, pi/3" title="Enter mathematical expression for angle" />
            <span class="eval-badge p-angle-badge">≈ ${rad.toFixed(4)} rad (${deg.toFixed(1)}°)</span>
          </div>
          <div class="theta-presets-chips">
            <span class="preset-label-sm">Presets:</span>
            <button type="button" class="chip-btn chip-p-angle" data-val="0">0</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="pi/6">π/6</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="pi/4">π/4</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="pi/3">π/3</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="pi/2">π/2</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="pi">π</button>
            <button type="button" class="chip-btn chip-p-angle" data-val="theta">θ</button>
          </div>
          <div style="font-size:0.73rem;color:var(--text-faint);margin-top:2px;">
            cos(θ) = <strong>${MathExpressionParser.formatNumber(c, 4)}</strong>, sin(θ) = <strong>${MathExpressionParser.formatNumber(s, 4)}</strong>
          </div>
          <div class="preset-row" style="margin-top:4px;">
            <label style="font-size:0.75rem;">Scrub:</label>
            <input type="range" class="p-deg-slider" min="-180" max="180" step="5" value="${Math.round(deg)}" />
          </div>
          <div class="expr-error-text p-angle-error hidden"></div>
        </div>
      `;

      const angleInput = container.querySelector('.p-angle-input');
      const badge = container.querySelector('.p-angle-badge');
      const slider = container.querySelector('.p-deg-slider');
      const errBox = container.querySelector('.p-angle-error');
      const btnR = container.querySelector('.p-angle-rad');
      const btnD = container.querySelector('.p-angle-deg');

      const applyAngleChange = () => {
        const expr = angleInput ? angleInput.value.trim() : 'theta';
        const res = MathExpressionParser.validate(expr, this.getScope());

        if (res.valid) {
          angleInput?.classList.remove('invalid');
          errBox?.classList.add('hidden');
          item.params.angleExpr = expr;

          let r = res.value;
          let d = res.value * (180.0 / Math.PI);
          if (item.params.angleUnit === 'deg') {
            d = res.value;
            r = res.value * (Math.PI / 180.0);
          }
          item.params.angleRad = r;
          item.params.angleDeg = d;

          if (badge) badge.textContent = `≈ ${r.toFixed(4)} rad (${d.toFixed(1)}°)`;
          if (slider && !isNaN(d)) slider.value = String(Math.round(d));

          item.matrix = this.computeRotationMatrix(item.type, r);
          item.matrixExpressions = this.getRotationMatrixExpressions(item.type);

          this.renderMatrixGrid(item);
          this.updateMatrixDiagnostics(item);
          this.notifyChange();
        } else {
          angleInput?.classList.add('invalid');
          if (errBox) {
            errBox.textContent = res.error;
            errBox.classList.remove('hidden');
          }
        }
      };

      if (angleInput) angleInput.addEventListener('input', applyAngleChange);

      if (btnR && btnD) {
        btnR.addEventListener('click', () => {
          item.params.angleUnit = 'rad';
          btnR.classList.add('active');
          btnD.classList.remove('active');
          applyAngleChange();
        });
        btnD.addEventListener('click', () => {
          item.params.angleUnit = 'deg';
          btnD.classList.add('active');
          btnR.classList.remove('active');
          applyAngleChange();
        });
      }

      container.querySelectorAll('.chip-p-angle').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const val = e.target.getAttribute('data-val');
          if (val && angleInput) {
            angleInput.value = val;
            applyAngleChange();
          }
        });
      });

      if (slider) {
        slider.addEventListener('input', (e) => {
          const degVal = parseFloat(e.target.value);
          if (angleInput) {
            angleInput.value = item.params.angleUnit === 'deg' ? String(degVal) : `${degVal}*pi/180`;
            applyAngleChange();
          }
        });
      }
    } else if (item.type === 'shear') {
      const s1 = item.params.s1 ?? 0.5;
      const s2 = item.params.s2 ?? 0.0;
      container.innerHTML = `
        <div class="preset-row">
          <label>s_xy: <span class="param-val" id="val-s1-${item.id}">${s1}</span></label>
          <input type="range" class="p-s1" min="-2" max="2" step="0.25" value="${s1}" />
        </div>
        <div class="preset-row">
          <label>s_xz: <span class="param-val" id="val-s2-${item.id}">${s2}</span></label>
          <input type="range" class="p-s2" min="-2" max="2" step="0.25" value="${s2}" />
        </div>
      `;
      const updateShear = () => {
        const s1Val = parseFloat(container.querySelector('.p-s1')?.value || 0);
        const s2Val = parseFloat(container.querySelector('.p-s2')?.value || 0);
        item.params = { s1: s1Val, s2: s2Val };
        item.matrix = [1, s1Val, s2Val,  0, 1, 0,  0, 0, 1];
        item.matrixExpressions = ['1', String(s1Val), String(s2Val), '0', '1', '0', '0', '0', '1'];
        this.renderMatrixGrid(item);
        this.updateMatrixDiagnostics(item);
        this.notifyChange();
      };
      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const lbl = container.querySelector(`#val-${e.target.className.replace('p-', '')}-${item.id}`);
          if (lbl) lbl.textContent = e.target.value;
          updateShear();
        });
      });
    }
  }

  setupQuickExamples() {
    const bindBtn = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', fn);
    };

    bindBtn('load-ex-111', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      this.addTransformation('identity', false);
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-roty45', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('rotateY', false);
      t1.params = { angleExpr: 'pi/4', angleUnit: 'rad' };
      t1.matrix = this.computeRotationMatrix('rotateY', Math.PI / 4.0);
      t1.matrixExpressions = this.getRotationMatrixExpressions('rotateY');
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-scale2', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('scale', false);
      t1.params = { sx: 2, sy: 2, sz: 2 };
      t1.matrix = [2,0,0, 0,2,0, 0,0,2];
      t1.matrixExpressions = ['2','0','0', '0','2','0', '0','0','2'];
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-reflectyz', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      this.addTransformation('reflectYZ', false);
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-rotx45', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('rotateX', false);
      t1.params = { angleExpr: 'pi/4', angleUnit: 'rad' };
      t1.matrix = this.computeRotationMatrix('rotateX', Math.PI / 4.0);
      t1.matrixExpressions = this.getRotationMatrixExpressions('rotateX');
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-12-2', () => {
      this.setVector([1, 2, 3]);
      this.transformations = [];
      const t1 = this.addTransformation('scale', false);
      t1.params = { sx: 2, sy: 1, sz: 1 };
      t1.matrix = [2,0,0, 0,1,0, 0,0,1];
      t1.matrixExpressions = ['2','0','0', '0','1','0', '0','0','1'];
      const t2 = this.addTransformation('reflectXY', false);
      t2.matrix = [1,0,0, 0,1,0, 0,0,-1];
      t2.matrixExpressions = ['1','0','0', '0','1','0', '0','0','-1'];
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-12-3', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('rotateX', false);
      t1.params = { angleExpr: 'pi/2', angleUnit: 'rad' };
      t1.matrix = this.computeRotationMatrix('rotateX', Math.PI / 2.0);
      t1.matrixExpressions = this.getRotationMatrixExpressions('rotateX');
      const t2 = this.addTransformation('rotateY', false);
      t2.params = { angleExpr: 'pi/2', angleUnit: 'rad' };
      t2.matrix = this.computeRotationMatrix('rotateY', Math.PI / 2.0);
      t2.matrixExpressions = this.getRotationMatrixExpressions('rotateY');
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-singular', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('custom', false);
      t1.matrix = [1, 0, 0,  0, 1, 0,  0, 0, 0]; // z -> 0 projection
      t1.matrixExpressions = ['1', '0', '0',  '0', '1', '0',  '0', '0', '0'];
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });
  }

  setVector(vec3) {
    const vx = document.getElementById('vec-x');
    const vy = document.getElementById('vec-y');
    const vz = document.getElementById('vec-z');
    if (vx) vx.value = MathExpressionParser.formatNumber(vec3[0]);
    if (vy) vy.value = MathExpressionParser.formatNumber(vec3[1]);
    if (vz) vz.value = MathExpressionParser.formatNumber(vec3[2]);
  }

  getVector() {
    const parseCoord = (id, defaultVal = 0) => {
      const el = document.getElementById(id);
      if (!el) return defaultVal;
      const res = MathExpressionParser.validate(el.value, this.getScope());
      return res.valid ? res.value : defaultVal;
    };
    return [
      parseCoord('vec-x', 0),
      parseCoord('vec-y', 0),
      parseCoord('vec-z', 0)
    ];
  }

  getMatrices() {
    const active = this.transformations.filter(t => t.enabled);
    const list = active.map(t => [...t.matrix]);
    const names = active.map(t => t.name);
    const details = active.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      matrix: [...t.matrix],
      matrixExpressions: t.matrixExpressions ? [...t.matrixExpressions] : t.matrix.map(v => MathExpressionParser.formatNumber(v)),
      params: { ...t.params },
      thetaScope: {
        expr: this.thetaExpr,
        value: this.getThetaRad(),
        unit: this.thetaUnit
      }
    }));
    return { list, names, details };
  }

  notifyChange() {
    if (this.isInitializing) return;
    this.updateOrderNames();
    if (this.onChange) {
      this.onChange();
    }
  }
}
