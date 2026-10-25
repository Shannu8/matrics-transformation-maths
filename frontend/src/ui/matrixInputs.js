export class MatrixInputsManager {
  constructor(engineClient, onMatrixChangeCallback) {
    this.engineClient = engineClient;
    this.onChange = onMatrixChangeCallback;

    this.matrices = {
      t1: [1, 0, 0,  0, 1, 0,  0, 0, 1],
      t2: [1, 0, 0,  0, 1, 0,  0, 0, 1],
      t3: [1, 0, 0,  0, 1, 0,  0, 0, 1]
    };
    this.t3Enabled = false;

    this.init();
  }

  init() {
    this.renderMatrixGrid('t1');
    this.renderMatrixGrid('t2');
    this.renderMatrixGrid('t3');

    this.setupPresetDropdowns();
    this.setupVectorInputs();
    this.setupT3Toggle();
    this.setupQuickExamples();
  }

  renderMatrixGrid(matrixId) {
    const container = document.getElementById(`grid-${matrixId}`);
    if (!container) return;

    container.innerHTML = '';
    const matData = this.matrices[matrixId];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.className = 'matrix-cell';
        input.value = matData[idx];
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.index = idx;
        input.id = `cell-${matrixId}-${r}-${c}`;
        input.setAttribute('aria-label', `${matrixId.toUpperCase()} row ${r+1} col ${c+1}`);

        input.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val) || !isFinite(val)) {
            e.target.classList.add('invalid');
          } else {
            e.target.classList.remove('invalid');
            this.matrices[matrixId][idx] = val;
            this.resetPresetUI(matrixId);
            this.updateMatrixDiagnostics(matrixId);
            this.notifyChange();
          }
        });

        container.appendChild(input);
      }
    }

    this.updateMatrixDiagnostics(matrixId);
  }

  resetPresetUI(matrixId) {
    const sel = document.getElementById(`preset-select-${matrixId}`);
    if (sel) sel.value = '';
    const pbox = document.getElementById(`preset-params-${matrixId}`);
    if (pbox) {
      pbox.innerHTML = '';
      pbox.classList.add('hidden');
    }
  }

  applyPresetToMatrix(matrixId, preset, p1 = null, p2 = null, p3 = null) {
    const sel = document.getElementById(`preset-select-${matrixId}`);
    if (sel) sel.value = preset;
    const paramsBox = document.getElementById(`preset-params-${matrixId}`);
    if (paramsBox) {
      this.renderPresetControls(matrixId, preset, paramsBox, p1, p2, p3);
    }
  }

  updateMatrixDiagnostics(matrixId) {
    const diag = document.getElementById(`diag-${matrixId}`);
    if (!diag) return;

    const mat = this.matrices[matrixId];
    // Calculate determinant
    const det = this.engineClient.invertMatrix(mat).determinant;
    const detEl = diag.querySelector('.det-val');
    const pill = diag.querySelector('.status-pill');

    if (detEl) {
      detEl.textContent = isFinite(det) ? det.toFixed(3) : 'NaN';
    }

    if (pill) {
      if (Math.abs(det) < 1e-9) {
        pill.className = 'status-pill status-singular';
        pill.textContent = 'Singular';
      } else {
        pill.className = 'status-pill status-ok';
        pill.textContent = 'Invertible';
      }
    }
  }

  setMatrix(matrixId, flat9) {
    this.matrices[matrixId] = [...flat9];
    const container = document.getElementById(`grid-${matrixId}`);
    if (!container) return;

    const inputs = container.querySelectorAll('.matrix-cell');
    inputs.forEach((input, idx) => {
      input.value = parseFloat(flat9[idx].toFixed(4));
      input.classList.remove('invalid');
    });

    this.updateMatrixDiagnostics(matrixId);
  }

  setupPresetDropdowns() {
    ['t1', 't2', 't3'].forEach(matrixId => {
      const select = document.getElementById(`preset-select-${matrixId}`);
      const paramsBox = document.getElementById(`preset-params-${matrixId}`);
      if (!select || !paramsBox) return;

      select.addEventListener('change', (e) => {
        const preset = e.target.value;
        this.renderPresetControls(matrixId, preset, paramsBox);
      });
    });
  }

  renderPresetControls(matrixId, preset, paramsBox, initialP1 = null) {
    paramsBox.innerHTML = '';
    if (!preset || preset === 'identity') {
      paramsBox.classList.add('hidden');
      if (preset === 'identity') {
        const I = [1,0,0, 0,1,0, 0,0,1];
        this.setMatrix(matrixId, I);
        this.notifyChange();
      }
      return;
    }

    paramsBox.classList.remove('hidden');

    if (preset === 'scale') {
      paramsBox.innerHTML = `
        <div class="preset-row">
          <label>sx:</label>
          <input type="range" class="p-sx-range" min="0.1" max="3" step="0.1" value="2.0">
          <input type="number" class="p-sx-num" step="0.1" value="2.0">
        </div>
        <div class="preset-row">
          <label>sy:</label>
          <input type="range" class="p-sy-range" min="0.1" max="3" step="0.1" value="1.0">
          <input type="number" class="p-sy-num" step="0.1" value="1.0">
        </div>
        <div class="preset-row">
          <label>sz:</label>
          <input type="range" class="p-sz-range" min="0.1" max="3" step="0.1" value="1.0">
          <input type="number" class="p-sz-num" step="0.1" value="1.0">
        </div>
      `;

      const sxR = paramsBox.querySelector('.p-sx-range'), sxN = paramsBox.querySelector('.p-sx-num');
      const syR = paramsBox.querySelector('.p-sy-range'), syN = paramsBox.querySelector('.p-sy-num');
      const szR = paramsBox.querySelector('.p-sz-range'), szN = paramsBox.querySelector('.p-sz-num');

      const apply = () => {
        const sx = parseFloat(sxN.value), sy = parseFloat(syN.value), sz = parseFloat(szN.value);
        const mat = this.engineClient.getPresetMatrix('scale', sx, sy, sz);
        this.setMatrix(matrixId, mat);
        this.notifyChange();
      };

      [ [sxR, sxN], [syR, syN], [szR, szN] ].forEach(([range, num]) => {
        range.addEventListener('input', () => { num.value = range.value; apply(); });
        num.addEventListener('input', () => { range.value = num.value; apply(); });
      });
      apply();

    } else if (preset.startsWith('rotate')) {
      const initDeg = initialP1 !== null ? initialP1 : 45;
      const initRad = initDeg * (Math.PI / 180.0);
      paramsBox.innerHTML = `
        <div class="preset-row">
          <label>Angle θ (°):</label>
          <input type="range" class="p-angle-range" min="-180" max="180" step="5" value="${initDeg}">
          <input type="number" class="p-angle-num" step="1" value="${initDeg}">
        </div>
        <div class="preset-row" style="font-size:0.75rem; color:#9ca3af;">
          <span>Radians: <strong class="rad-display">${initRad.toFixed(3)} rad</strong></span>
        </div>
      `;

      const range = paramsBox.querySelector('.p-angle-range');
      const num = paramsBox.querySelector('.p-angle-num');
      const radEl = paramsBox.querySelector('.rad-display');

      const apply = () => {
        const deg = parseFloat(num.value);
        const rad = deg * (Math.PI / 180.0);
        radEl.textContent = `${rad.toFixed(3)} rad`;
        const sel = document.getElementById(`preset-select-${matrixId}`);
        const activePreset = sel && sel.value ? sel.value : preset;
        const mat = this.engineClient.getPresetMatrix(activePreset, deg, 0, 0);
        this.setMatrix(matrixId, mat);
        this.notifyChange();
      };

      range.addEventListener('input', () => { num.value = range.value; apply(); });
      num.addEventListener('input', () => { range.value = num.value; apply(); });
      apply();

    } else if (preset.startsWith('reflect')) {
      const mat = this.engineClient.getPresetMatrix(preset, 0, 0, 0);
      this.setMatrix(matrixId, mat);
      paramsBox.innerHTML = `<span style="color:#10b981;">Reflected across coordinate plane.</span>`;
      this.notifyChange();

    } else if (preset === 'shear') {
      paramsBox.innerHTML = `
        <div class="preset-row">
          <label>Mode:</label>
          <select class="shear-mode-select" style="background:#000; color:#fff; border:1px solid #333; padding:2px 6px; border-radius:4px;">
            <option value="0">X by Y (x' = x + ky)</option>
            <option value="1">X by Z (x' = x + kz)</option>
            <option value="2">Y by X (y' = y + kx)</option>
            <option value="3">Y by Z (y' = y + kz)</option>
            <option value="4">Z by X (z' = z + kx)</option>
            <option value="5">Z by Y (z' = z + ky)</option>
          </select>
        </div>
        <div class="preset-row">
          <label>Factor k:</label>
          <input type="range" class="shear-k-range" min="-2.0" max="2.0" step="0.25" value="1.0">
          <input type="number" class="shear-k-num" step="0.25" value="1.0">
        </div>
      `;

      const modeSelect = paramsBox.querySelector('.shear-mode-select');
      const kRange = paramsBox.querySelector('.shear-k-range');
      const kNum = paramsBox.querySelector('.shear-k-num');

      const apply = () => {
        const mode = parseInt(modeSelect.value);
        const k = parseFloat(kNum.value);
        const mat = this.engineClient.getPresetMatrix('shear', mode, k, 0);
        this.setMatrix(matrixId, mat);
        this.notifyChange();
      };

      modeSelect.addEventListener('change', apply);
      kRange.addEventListener('input', () => { kNum.value = kRange.value; apply(); });
      kNum.addEventListener('input', () => { kRange.value = kNum.value; apply(); });
      apply();
    }
  }

  setupVectorInputs() {
    ['x', 'y', 'z'].forEach(coord => {
      const el = document.getElementById(`vec-${coord}`);
      if (el) {
        el.addEventListener('input', () => this.notifyChange());
      }
    });

    // Preset chips
    const chips = document.querySelectorAll('.chip-btn[data-vec]');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const parts = e.target.getAttribute('data-vec').split(',').map(Number);
        document.getElementById('vec-x').value = parts[0];
        document.getElementById('vec-y').value = parts[1];
        document.getElementById('vec-z').value = parts[2];
        this.notifyChange();
      });
    });
  }

  setupT3Toggle() {
    const toggle = document.getElementById('toggle-t3');
    const cardT3 = document.getElementById('card-t3');
    const legendV3 = document.getElementById('legend-v3');

    if (toggle && cardT3) {
      toggle.addEventListener('change', (e) => {
        this.t3Enabled = e.target.checked;
        if (this.t3Enabled) {
          cardT3.classList.remove('hidden');
          if (legendV3) legendV3.style.display = 'flex';
        } else {
          cardT3.classList.add('hidden');
          if (legendV3) legendV3.style.display = 'none';
        }
        this.notifyChange();
      });
    }
  }

  setupQuickExamples() {
    // Focused Verification 1: v=(1,1,1) with Identity (all transformations disabled)
    const ex111 = document.getElementById('load-ex-111');
    if (ex111) {
      ex111.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.applyPresetToMatrix('t1', 'identity');
        this.applyPresetToMatrix('t2', 'identity');
        this.disableT3();
        this.notifyChange();
      });
    }

    // Verification 2: v=(1,1,1) with RotY(45 deg) -> (1.4142, 1, 0)
    const exRotY45 = document.getElementById('load-ex-roty45');
    if (exRotY45) {
      exRotY45.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.applyPresetToMatrix('t1', 'rotateY', 45);
        this.applyPresetToMatrix('t2', 'identity');
        this.disableT3();
        this.notifyChange();
      });
    }

    // Verification 3: v=(1,1,1) with Scaling by 2 -> (2, 2, 2)
    const exScale2 = document.getElementById('load-ex-scale2');
    if (exScale2) {
      exScale2.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.resetPresetUI('t1');
        this.resetPresetUI('t2');
        this.setMatrix('t1', [2, 0, 0,  0, 2, 0,  0, 0, 2]);
        this.applyPresetToMatrix('t2', 'identity');
        this.disableT3();
        this.notifyChange();
      });
    }

    // Verification 4: v=(1,1,1) with Reflection YZ -> (-1, 1, 1)
    const exReflectYZ = document.getElementById('load-ex-reflectyz');
    if (exReflectYZ) {
      exReflectYZ.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.applyPresetToMatrix('t1', 'reflectYZ');
        this.applyPresetToMatrix('t2', 'identity');
        this.disableT3();
        this.notifyChange();
      });
    }

    // RotX(45 deg) with v=(1,1,1)
    const exRotX45 = document.getElementById('load-ex-rotx45');
    if (exRotX45) {
      exRotX45.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.applyPresetToMatrix('t1', 'rotateX', 45);
        this.applyPresetToMatrix('t2', 'identity');
        this.disableT3();
        this.notifyChange();
      });
    }

    // 12.2: Scaling followed by reflection
    const ex12_2 = document.getElementById('load-ex-12-2');
    if (ex12_2) {
      ex12_2.addEventListener('click', () => {
        this.setVector([1, 2, 3]);
        this.resetPresetUI('t1');
        this.resetPresetUI('t2');
        // T1 = diag(2,1,1)
        this.setMatrix('t1', [2, 0, 0,  0, 1, 0,  0, 0, 1]);
        // T2 = diag(1,1,-1)
        this.setMatrix('t2', [1, 0, 0,  0, 1, 0,  0, 0, -1]);
        this.disableT3();
        this.notifyChange();
      });
    }

    // 12.3: Non-commuting
    const ex12_3 = document.getElementById('load-ex-12-3');
    if (ex12_3) {
      ex12_3.addEventListener('click', () => {
        this.setVector([1, 2, 3]);
        this.resetPresetUI('t1');
        this.resetPresetUI('t2');
        // Rz(90 deg)
        this.setMatrix('t1', [0, -1, 0,  1, 0, 0,  0, 0, 1]);
        // S = diag(2,1,1)
        this.setMatrix('t2', [2, 0, 0,  0, 1, 0,  0, 0, 1]);
        this.disableT3();
        this.notifyChange();
      });
    }

    // Shear & Rotate
    const exShear = document.getElementById('load-ex-shear');
    if (exShear) {
      exShear.addEventListener('click', () => {
        this.setVector([1, 1, 1]);
        this.resetPresetUI('t1');
        this.resetPresetUI('t2');
        // Shear X by Y with k=1.5
        this.setMatrix('t1', [1, 1.5, 0,  0, 1, 0,  0, 0, 1]);
        // Rotate Y 45 deg
        const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
        this.setMatrix('t2', [c, 0, s,  0, 1, 0,  -s, 0, c]);
        this.disableT3();
        this.notifyChange();
      });
    }

    // Singular matrix
    const exSingular = document.getElementById('load-ex-singular');
    if (exSingular) {
      exSingular.addEventListener('click', () => {
        this.setVector([2, 3, 4]);
        this.resetPresetUI('t1');
        this.resetPresetUI('t2');
        // Singular projection onto XY plane
        this.setMatrix('t1', [1, 0, 0,  0, 1, 0,  0, 0, 0]);
        this.setMatrix('t2', [1, 0, 0,  0, 1, 0,  0, 0, 1]);
        this.disableT3();
        this.notifyChange();
      });
    }
  }

  disableT3() {
    this.t3Enabled = false;
    const toggle = document.getElementById('toggle-t3');
    const cardT3 = document.getElementById('card-t3');
    if (toggle) toggle.checked = false;
    if (cardT3) cardT3.classList.add('hidden');
  }

  setVector(vec3) {
    document.getElementById('vec-x').value = vec3[0];
    document.getElementById('vec-y').value = vec3[1];
    document.getElementById('vec-z').value = vec3[2];
  }

  getVector() {
    return [
      parseFloat(document.getElementById('vec-x').value) || 0,
      parseFloat(document.getElementById('vec-y').value) || 0,
      parseFloat(document.getElementById('vec-z').value) || 0
    ];
  }

  getMatrices() {
    const list = [this.matrices.t1, this.matrices.t2];
    const names = ['T₁', 'T₂'];
    if (this.t3Enabled) {
      list.push(this.matrices.t3);
      names.push('T₃');
    }
    return { list, names };
  }

  notifyChange() {
    if (this.onChange) {
      this.onChange();
    }
  }
}
