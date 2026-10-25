/**
 * Dynamic Matrix Inputs Manager
 * Supports adding, editing, reordering, enabling/disabling, and removing
 * arbitrary numbers of 3x3 transformations in the sequence.
 */
export class MatrixInputsManager {
  constructor(engineClient, onMatrixChangeCallback) {
    this.engineClient = engineClient;
    this.onChange = onMatrixChangeCallback;

    // Array of dynamic transformation objects:
    // { id, name, matrix: [9 numbers], type: string, params: object, enabled: boolean }
    this.transformations = [];
    this.idCounter = 1;

    this.init();
  }

  init() {
    // Start with 2 default identity transformations (T1, T2)
    this.addTransformation('identity', false);
    this.addTransformation('identity', false);

    this.renderAllCards();
    this.setupGlobalControls();
    this.setupVectorInputs();
    this.setupQuickExamples();
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
        el.addEventListener('input', () => this.notifyChange());
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

    if (preset && preset !== 'identity' && preset !== 'custom') {
      matrix = this.engineClient.getPresetMatrix(preset) || matrix;
    }

    const item = {
      id,
      name: `T${this.transformations.length + 1}`,
      matrix: [...matrix],
      type: preset || 'identity',
      params: {},
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

    // Swap items in sequence
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

  renderMatrixGrid(item) {
    const container = document.getElementById(`grid-${item.id}`);
    if (!container) return;

    container.innerHTML = '';
    const matData = item.matrix;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.className = 'matrix-cell';
        input.value = Number.isFinite(matData[idx]) ? Number(matData[idx].toFixed(4)) : 0;
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.index = idx;
        input.id = `cell-${item.id}-${r}-${c}`;
        input.setAttribute('aria-label', `${item.name} row ${r+1} col ${c+1}`);
        input.setAttribute('inputmode', 'decimal');

        input.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val) || !isFinite(val)) {
            e.target.classList.add('invalid');
          } else {
            e.target.classList.remove('invalid');
            item.matrix[idx] = val;
            item.type = 'custom';
            const sel = document.querySelector(`.preset-select[data-id="${item.id}"]`);
            if (sel) sel.value = 'custom';
            const pbox = document.getElementById(`preset-params-${item.id}`);
            if (pbox) {
              pbox.innerHTML = '';
              pbox.classList.add('hidden');
            }
            this.updateMatrixDiagnostics(item);
            this.notifyChange();
          }
        });

        container.appendChild(input);
      }
    }
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
        if (newMat) item.matrix = [...newMat];
      }
      this.renderMatrixGrid(item);
      this.updateMatrixDiagnostics(item);
      this.notifyChange();
    }
  }

  renderPresetControls(item, container) {
    if (!container) return;
    container.innerHTML = '';

    const updateFromSliders = () => {
      let newMat = null;
      if (item.type === 'scale') {
        const sx = parseFloat(container.querySelector('.p-sx')?.value || 1);
        const sy = parseFloat(container.querySelector('.p-sy')?.value || 1);
        const sz = parseFloat(container.querySelector('.p-sz')?.value || 1);
        item.params = { sx, sy, sz };
        newMat = this.engineClient.getPresetMatrix('scale', sx, sy, sz);
      } else if (item.type.startsWith('rotate')) {
        const deg = parseFloat(container.querySelector('.p-deg')?.value || 0);
        item.params = { deg };
        newMat = this.engineClient.getPresetMatrix(item.type, deg);
      } else if (item.type === 'shear') {
        const s1 = parseFloat(container.querySelector('.p-s1')?.value || 0);
        const s2 = parseFloat(container.querySelector('.p-s2')?.value || 0);
        item.params = { s1, s2 };
        newMat = this.engineClient.getPresetMatrix('shear', s1, s2);
      }

      if (newMat) {
        item.matrix = [...newMat];
        this.renderMatrixGrid(item);
        this.updateMatrixDiagnostics(item);
        this.notifyChange();
      }
    };

    if (item.type === 'scale') {
      const sx = item.params.sx ?? 1.0;
      const sy = item.params.sy ?? 1.0;
      const sz = item.params.sz ?? 1.0;
      container.innerHTML = `
        <div class="preset-row">
          <label>sx: <span class="param-val" id="val-sx-${item.id}">${sx.toFixed(1)}</span></label>
          <input type="range" class="p-sx" min="-3" max="5" step="0.5" value="${sx}" />
        </div>
        <div class="preset-row">
          <label>sy: <span class="param-val" id="val-sy-${item.id}">${sy.toFixed(1)}</span></label>
          <input type="range" class="p-sy" min="-3" max="5" step="0.5" value="${sy}" />
        </div>
        <div class="preset-row">
          <label>sz: <span class="param-val" id="val-sz-${item.id}">${sz.toFixed(1)}</span></label>
          <input type="range" class="p-sz" min="-3" max="5" step="0.5" value="${sz}" />
        </div>
      `;
      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const lbl = container.querySelector(`#val-${e.target.className.replace('p-', '')}-${item.id}`);
          if (lbl) lbl.textContent = parseFloat(e.target.value).toFixed(1);
          updateFromSliders();
        });
      });
      updateFromSliders();
    } else if (item.type.startsWith('rotate')) {
      const deg = item.params.deg ?? 45;
      container.innerHTML = `
        <div class="preset-row">
          <label>Angle θ: <span class="param-val" id="val-deg-${item.id}">${deg}°</span></label>
          <input type="range" class="p-deg" min="-180" max="180" step="15" value="${deg}" />
        </div>
      `;
      const slider = container.querySelector('.p-deg');
      slider.addEventListener('input', (e) => {
        const lbl = container.querySelector(`#val-deg-${item.id}`);
        if (lbl) lbl.textContent = `${e.target.value}°`;
        updateFromSliders();
      });
      updateFromSliders();
    } else if (item.type === 'shear') {
      const s1 = item.params.s1 ?? 0.5;
      const s2 = item.params.s2 ?? 0.0;
      container.innerHTML = `
        <div class="preset-row">
          <label>s_xy: <span class="param-val" id="val-s1-${item.id}">${s1.toFixed(2)}</span></label>
          <input type="range" class="p-s1" min="-2" max="2" step="0.25" value="${s1}" />
        </div>
        <div class="preset-row">
          <label>s_xz: <span class="param-val" id="val-s2-${item.id}">${s2.toFixed(2)}</span></label>
          <input type="range" class="p-s2" min="-2" max="2" step="0.25" value="${s2}" />
        </div>
      `;
      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const lbl = container.querySelector(`#val-${e.target.className.replace('p-', '')}-${item.id}`);
          if (lbl) lbl.textContent = parseFloat(e.target.value).toFixed(2);
          updateFromSliders();
        });
      });
      updateFromSliders();
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
      t1.params = { deg: 45 };
      t1.matrix = [...this.engineClient.getPresetMatrix('rotateY', 45)];
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-scale2', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('scale', false);
      t1.params = { sx: 2, sy: 2, sz: 2 };
      t1.matrix = [...this.engineClient.getPresetMatrix('scale', 2, 2, 2)];
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
      t1.params = { deg: 45 };
      t1.matrix = [...this.engineClient.getPresetMatrix('rotateX', 45)];
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
      const t2 = this.addTransformation('reflectXY', false);
      t2.matrix = [1,0,0, 0,1,0, 0,0,-1];
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-12-3', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('rotateX', false);
      t1.params = { deg: 90 };
      t1.matrix = [...this.engineClient.getPresetMatrix('rotateX', 90)];
      const t2 = this.addTransformation('rotateY', false);
      t2.params = { deg: 90 };
      t2.matrix = [...this.engineClient.getPresetMatrix('rotateY', 90)];
      this.renderAllCards();
      this.notifyChange();
    });

    bindBtn('load-ex-singular', () => {
      this.setVector([1, 1, 1]);
      this.transformations = [];
      const t1 = this.addTransformation('custom', false);
      t1.matrix = [1, 0, 0,  0, 1, 0,  0, 0, 0]; // z -> 0 projection
      this.addTransformation('identity', false);
      this.renderAllCards();
      this.notifyChange();
    });
  }

  setVector(vec3) {
    const vx = document.getElementById('vec-x');
    const vy = document.getElementById('vec-y');
    const vz = document.getElementById('vec-z');
    if (vx) vx.value = vec3[0];
    if (vy) vy.value = vec3[1];
    if (vz) vz.value = vec3[2];
  }

  getVector() {
    const vx = parseFloat(document.getElementById('vec-x')?.value) || 0;
    const vy = parseFloat(document.getElementById('vec-y')?.value) || 0;
    const vz = parseFloat(document.getElementById('vec-z')?.value) || 0;
    return [vx, vy, vz];
  }

  getMatrices() {
    const active = this.transformations.filter(t => t.enabled);
    const list = active.map(t => [...t.matrix]);
    const names = active.map(t => t.name);
    return { list, names };
  }

  notifyChange() {
    this.updateOrderNames();
    if (this.onChange) {
      this.onChange();
    }
  }
}
