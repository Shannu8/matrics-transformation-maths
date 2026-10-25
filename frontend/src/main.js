import { EngineClient } from './math/engineClient.js';
import { Viewport3D } from './visualization/viewport3d.js';
import { MatrixInputsManager } from './ui/matrixInputs.js';
import { ResultsPanel } from './ui/resultsPanel.js';
import { ReportGenerator } from './report/reportGenerator.js';
import { PracticeGenerator } from './practice/practiceGenerator.js';

class App {
  constructor() {
    this.engineClient = new EngineClient();
    this.viewport = null;
    this.inputsManager = null;
    this.resultsPanel = null;
    this.currentResult = null;
    this.isUserScrubbing = false;
    this.currentChallenge = null;
    this.currentDifficulty = 'medium';
    this.activePracticeChallenge = null;
  }

  async init() {
    // 1. Initialize Results Panel
    this.resultsPanel = new ResultsPanel();

    // 2. Initialize 3D Viewport with synchronized animation callbacks
    const threeContainer = document.getElementById('three-container');
    const stepIndicator = document.getElementById('step-indicator');
    const animMiniLabel = document.getElementById('anim-mini-label');
    const animSlider = document.getElementById('anim-slider');

    this.viewport = new Viewport3D(
      threeContainer,
      (stepIdx, totalSteps, label, percent) => {
        if (stepIndicator) stepIndicator.textContent = label;
        if (animMiniLabel) animMiniLabel.textContent = label;
        if (animSlider && !this.isUserScrubbing) animSlider.value = percent;
      },
      (isPlaying) => {
        this.updatePlayStateUI(isPlaying);
      }
    );

    // Setup Unit Cube toggle listener
    const cubeToggle = document.getElementById('toggle-unit-cube');
    if (cubeToggle) {
      cubeToggle.addEventListener('change', (e) => {
        this.viewport.setShowUnitCube(e.target.checked);
      });
    }

    // Setup Reference Vectors toggle listener
    const refToggle = document.getElementById('toggle-reference-vectors');
    if (refToggle) {
      refToggle.addEventListener('change', (e) => {
        this.viewport.setShowReferenceVectors(e.target.checked);
        const refLegend = document.getElementById('legend-ref-container');
        if (refLegend) {
          if (e.target.checked) refLegend.classList.remove('hidden');
          else refLegend.classList.add('hidden');
        }
      });
    }

    // Setup Vector Coordinates visibility toggle listener
    const coordsToggle = document.getElementById('toggle-vector-coords');
    if (coordsToggle) {
      const STORAGE_KEY_SHOW_COORDS = 'transformation_show_coords';
      let initialVisible = true;
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SHOW_COORDS);
        if (saved !== null) {
          initialVisible = saved === 'true';
        }
      } catch (_) {}

      coordsToggle.checked = initialVisible;
      this.viewport.setShowVectorCoordinates(initialVisible);

      coordsToggle.addEventListener('change', (e) => {
        const isVisible = !!e.target.checked;
        this.viewport.setShowVectorCoordinates(isVisible);
        try {
          localStorage.setItem(STORAGE_KEY_SHOW_COORDS, String(isVisible));
        } catch (_) {}
      });
    }

    // Setup Axis Measurement Transparency Slider listener
    const axisTransSlider = document.getElementById('slider-axis-transparency');
    const axisTransVal = document.getElementById('axis-transparency-val');
    if (axisTransSlider) {
      const STORAGE_KEY_AXIS_OPACITY = 'transformation_axis_transparency';
      let initialOpacityVal = 100;
      try {
        const savedOpacity = localStorage.getItem(STORAGE_KEY_AXIS_OPACITY);
        if (savedOpacity !== null) {
          const parsed = Number(savedOpacity);
          if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
            initialOpacityVal = parsed;
          }
        }
      } catch (_) {}

      axisTransSlider.value = initialOpacityVal;
      if (axisTransVal) axisTransVal.textContent = `${initialOpacityVal}%`;
      this.viewport.setAxisMeasurementOpacity(initialOpacityVal / 100.0);

      const updateOpacity = (val) => {
        const numVal = Math.max(0, Math.min(100, Number(val)));
        if (axisTransVal) axisTransVal.textContent = `${numVal}%`;
        this.viewport.setAxisMeasurementOpacity(numVal / 100.0);
        try {
          localStorage.setItem(STORAGE_KEY_AXIS_OPACITY, String(numVal));
        } catch (_) {}
      };

      axisTransSlider.addEventListener('input', (e) => updateOpacity(e.target.value));
      axisTransSlider.addEventListener('change', (e) => updateOpacity(e.target.value));
    }

    // Setup Report Download Button listeners
    ['btn-download-pdf', 'btn-header-pdf', 'btn-viewport-pdf'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadReport();
        });
      }
    });

    // 3. Setup Pull-Out Left Drawer Controls immediately
    this.setupLeftDrawer();

    // 4. Setup Collapsible Animation Strip
    this.setupAnimationBar();

    // 5. Setup Collapsible Legend
    this.setupLegend();

    // 6. Setup Dedicated Fullscreen Workspace View
    this.setupFullscreen();

    // 7. Prevent 3D Camera Rotation when interacting with drawers/panels
    this.setupEventIsolation();

    // 8. Initialize Engine Client (Wasm loader)
    const wasmActive = await this.engineClient.init();
    this.updateWasmBadge(wasmActive);

    // 9. Initialize Matrix Inputs Manager
    this.inputsManager = new MatrixInputsManager(this.engineClient, () => {
      this.recalculate();
    });

    // 10. Calculate Button
    const calcBtn = document.getElementById('btn-calculate');
    if (calcBtn) {
      calcBtn.addEventListener('click', () => this.recalculate());
    }

    // 11. Clear active practice challenge when handbook examples are clicked
    const handbookExampleIds = [
      'load-ex-111', 'load-ex-roty45', 'load-ex-scale2', 'load-ex-reflectyz',
      'load-ex-rotx45', 'load-ex-12-2', 'load-ex-12-3', 'load-ex-singular'
    ];
    handbookExampleIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.activePracticeChallenge = null;
        });
      }
    });

    // 12. Setup Practice Challenges Card
    this.setupPracticeChallenges();

    // 13. Load default state: v = (1, 1, 1) with identity transformations
    const exBtn = document.getElementById('load-ex-111');
    if (exBtn) {
      exBtn.click();
    } else {
      this.recalculate();
    }
  }

  updatePlayStateUI(isPlaying) {
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const miniPlay = document.querySelector('.mini-icon-play');
    const miniPause = document.querySelector('.mini-icon-pause');

    if (isPlaying) {
      if (iconPlay) iconPlay.classList.add('hidden');
      if (iconPause) iconPause.classList.remove('hidden');
      if (miniPlay) miniPlay.classList.add('hidden');
      if (miniPause) miniPause.classList.remove('hidden');
    } else {
      if (iconPlay) iconPlay.classList.remove('hidden');
      if (iconPause) iconPause.classList.add('hidden');
      if (miniPlay) miniPlay.classList.remove('hidden');
      if (miniPause) miniPause.classList.add('hidden');
    }
  }

  updateWasmBadge(isActive) {
    const badge = document.getElementById('wasm-badge');
    if (!badge) return;
    if (isActive) {
      badge.className = 'status-badge ready';
      badge.querySelector('.status-text').textContent = 'WebAssembly Active (C++17)';
    } else {
      badge.className = 'status-badge';
      badge.querySelector('.status-text').textContent = 'JS Reference Engine Active';
    }
  }

  recalculate() {
    if (!this.inputsManager) return;
    const errorBanner = document.getElementById('error-banner');
    if (errorBanner) errorBanner.classList.add('hidden');

    const v0 = this.inputsManager.getVector();
    const { list, names, details } = this.inputsManager.getMatrices();

    const res = this.engineClient.execute(list, names, v0);

    // Attach theta config & expression details if available
    if (res) {
      res.thetaConfig = {
        expr: this.inputsManager.thetaExpr,
        unit: this.inputsManager.thetaUnit,
        valueRad: this.inputsManager.getThetaRad(),
        valueDeg: (this.inputsManager.getThetaRad() * 180 / Math.PI)
      };

      if (details && res.steps) {
        res.steps.forEach((st, idx) => {
          if (details[idx]) {
            st.details = details[idx];
            st.matrixExpressions = details[idx].matrixExpressions;
            st.type = details[idx].type;
            st.params = details[idx].params;
          }
        });
      }

      if (this.activePracticeChallenge) {
        res.practiceChallenge = this.activePracticeChallenge;
      }
    }

    this.currentResult = res;

    if (!res.success) {
      if (errorBanner) {
        errorBanner.textContent = res.errorMessage || 'Calculation error occurred.';
        errorBanner.classList.remove('hidden');
      }
      this.resultsPanel.render(res);
      return;
    }

    // Update 3D viewport and Animation
    this.viewport.setPipelineData(res);

    // Update Results tabs
    this.resultsPanel.render(res);
  }

  async downloadReport() {
    if (!this.currentResult) {
      this.recalculate();
    }
    if (!this.currentResult) {
      alert('No experiment transformation data is available to generate a report.');
      return;
    }

    const downloadBtns = [
      document.getElementById('btn-download-pdf'),
      document.getElementById('btn-header-pdf'),
      document.getElementById('btn-viewport-pdf')
    ].filter(Boolean);

    // Visual feedback during PDF compilation & screenshot capture
    downloadBtns.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.65';
      btn.style.pointerEvents = 'none';
    });

    try {
      await ReportGenerator.generate(this.currentResult, this.viewport);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      alert(`Report download error: ${err.message || err}`);
    } finally {
      downloadBtns.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1.0';
        btn.style.pointerEvents = 'auto';
      });
    }
  }

  setupLeftDrawer() {
    const drawer = document.getElementById('left-drawer');
    const drawerHandle = document.getElementById('btn-left-drawer-toggle');
    const closeBtn = document.getElementById('btn-drawer-close');
    const resizer = document.getElementById('sidebar-resizer');

    if (!drawer || !drawerHandle) return;

    const openIcon = drawerHandle.querySelector('.handle-icon-open');
    const closeIcon = drawerHandle.querySelector('.handle-icon-close');

    const STORAGE_KEY_SIDEBAR_WIDTH = 'transformation_sidebar_width';
    const DEFAULT_WIDTH = 440;
    const MIN_WIDTH = 320;

    const getResponsiveLimits = () => {
      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      // Preserve at least 340px for main 3D visualization, max 75% of viewport width
      const maxWidth = Math.max(MIN_WIDTH, Math.min(Math.floor(vw * 0.72), vw - 340));
      return { minWidth: MIN_WIDTH, maxWidth };
    };

    let currentWidth = DEFAULT_WIDTH;

    // Load persisted width if valid
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH) {
          currentWidth = parsed;
        }
      }
    } catch (_) {}

    const applyWidth = (width, persist = true) => {
      const { minWidth, maxWidth } = getResponsiveLimits();
      const clamped = Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
      currentWidth = clamped;

      document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
      if (window.innerWidth > 768) {
        if (drawer.classList.contains('drawer-open')) {
          drawer.style.width = `${clamped}px`;
        }
      } else {
        drawer.style.width = '';
      }

      if (resizer) {
        resizer.setAttribute('aria-valuenow', String(clamped));
        resizer.setAttribute('aria-valuemin', String(minWidth));
        resizer.setAttribute('aria-valuemax', String(maxWidth));
      }

      if (persist) {
        try {
          localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(clamped));
        } catch (_) {}
      }

      this.viewport?.handleResize();
      return clamped;
    };

    // Apply initial clamped width
    applyWidth(currentWidth, false);

    const setDrawerOpen = (open) => {
      if (open) {
        drawer.classList.add('drawer-open');
        drawerHandle.classList.add('drawer-open');
        drawerHandle.setAttribute('aria-expanded', 'true');
        drawerHandle.setAttribute('title', 'Close controls (<)');
        drawerHandle.setAttribute('aria-label', 'Close transformation controls');
        if (openIcon) openIcon.classList.add('hidden');
        if (closeIcon) closeIcon.classList.remove('hidden');
        applyWidth(currentWidth, false);
      } else {
        drawer.classList.remove('drawer-open');
        drawerHandle.classList.remove('drawer-open');
        drawerHandle.setAttribute('aria-expanded', 'false');
        drawerHandle.setAttribute('title', 'Open controls (>)');
        drawerHandle.setAttribute('aria-label', 'Open transformation controls');
        if (openIcon) openIcon.classList.remove('hidden');
        if (closeIcon) closeIcon.classList.add('hidden');
        if (window.innerWidth > 768) {
          drawer.style.width = '';
        }
      }

      // Smoothly update viewport aspect ratio during/after slide transition
      this.viewport?.handleResize();
      setTimeout(() => {
        this.viewport?.handleResize();
      }, 280);
    };

    drawerHandle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = drawer.classList.contains('drawer-open');
      setDrawerOpen(!isOpen);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrawerOpen(false);
      });
    }

    // Drag-to-Resize Implementation (Antigravity IDE / VS Code Style)
    if (resizer) {
      let isDragging = false;

      const onPointerMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        if (clientX === undefined) return;
        applyWidth(clientX, false);
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('is-resizing');

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);

        // Persist final width and trigger canvas resize
        applyWidth(currentWidth, true);
      };

      const onPointerDown = (e) => {
        // Only trigger on primary button (left mouse click or touch)
        if (e.button !== undefined && e.button !== 0) return;
        if (window.innerWidth <= 768) return; // In mobile view, drawer is full overlay

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        document.body.classList.add('is-resizing');

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('touchend', onPointerUp);
      };

      resizer.addEventListener('pointerdown', onPointerDown);
      resizer.addEventListener('mousedown', onPointerDown);
      resizer.addEventListener('touchstart', onPointerDown, { passive: false });

      // Keyboard Accessibility for Resizer
      resizer.addEventListener('keydown', (e) => {
        if (window.innerWidth <= 768) return;
        const step = e.shiftKey ? 40 : 16;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          applyWidth(currentWidth + step, true);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          applyWidth(currentWidth - step, true);
        } else if (e.key === 'Home') {
          e.preventDefault();
          const { minWidth } = getResponsiveLimits();
          applyWidth(minWidth, true);
        } else if (e.key === 'End') {
          e.preventDefault();
          const { maxWidth } = getResponsiveLimits();
          applyWidth(maxWidth, true);
        }
      });
    }

    // Window resize handler: adapt constraints dynamically when window is resized
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && drawer.classList.contains('drawer-open')) {
        applyWidth(currentWidth, false);
      }
    });

    // Drawer internal tab navigation (Inputs & Matrices vs Results & Analysis)
    const drawerTabs = document.querySelectorAll('.drawer-tab-btn');
    drawerTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        drawerTabs.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.drawer-tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetId = btn.getAttribute('data-drawer-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Close drawer on Escape key if open
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (drawer.classList.contains('drawer-open')) {
          setDrawerOpen(false);
          e.stopPropagation();
        }
      }
    });

    this.setDrawerOpen = setDrawerOpen;
  }

  setupAnimationBar() {
    const animBar = document.getElementById('animation-control-bar');
    const toggleBtn = document.getElementById('btn-anim-bar-toggle');
    const collapsedStrip = document.getElementById('anim-collapsed-strip');
    const expandedContent = document.getElementById('anim-expanded-content');
    const collapseIcon = toggleBtn?.querySelector('.toggle-icon-collapse');
    const expandIcon = toggleBtn?.querySelector('.toggle-icon-expand');

    const playBtn = document.getElementById('btn-play-pause');
    const miniPlayBtn = document.getElementById('btn-mini-play-pause');
    const prevBtn = document.getElementById('btn-step-prev');
    const nextBtn = document.getElementById('btn-step-next');
    const resetBtn = document.getElementById('btn-reset-anim');
    const animSlider = document.getElementById('anim-slider');
    const speedSelect = document.getElementById('speed-select');

    if (toggleBtn && animBar) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = animBar.classList.contains('is-collapsed');
        if (isCollapsed) {
          // Expand
          animBar.classList.remove('is-collapsed');
          animBar.classList.add('is-expanded');
          if (collapsedStrip) collapsedStrip.classList.add('hidden');
          if (expandedContent) expandedContent.classList.remove('hidden');
          if (collapseIcon) collapseIcon.classList.remove('hidden');
          if (expandIcon) expandIcon.classList.add('hidden');
          toggleBtn.setAttribute('aria-expanded', 'true');
          toggleBtn.setAttribute('title', 'Collapse playback controls');
        } else {
          // Collapse
          animBar.classList.add('is-collapsed');
          animBar.classList.remove('is-expanded');
          if (collapsedStrip) collapsedStrip.classList.remove('hidden');
          if (expandedContent) expandedContent.classList.add('hidden');
          if (collapseIcon) collapseIcon.classList.add('hidden');
          if (expandIcon) expandIcon.classList.remove('hidden');
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.setAttribute('title', 'Expand playback controls');
        }
      });
    }

    const togglePlayback = () => {
      const isPlaying = this.viewport.togglePlay();
      this.updatePlayStateUI(isPlaying);
    };

    if (playBtn) playBtn.addEventListener('click', togglePlayback);
    if (miniPlayBtn) miniPlayBtn.addEventListener('click', togglePlayback);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.viewport.stepPrev();
        this.updatePlayStateUI(false);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.viewport.stepNext();
        this.updatePlayStateUI(false);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.viewport.resetAnimation();
        this.updatePlayStateUI(false);
      });
    }

    if (animSlider) {
      this.isUserScrubbing = false;
      animSlider.addEventListener('mousedown', () => { this.isUserScrubbing = true; });
      animSlider.addEventListener('touchstart', () => { this.isUserScrubbing = true; });

      animSlider.addEventListener('input', (e) => {
        this.viewport.seek(parseFloat(e.target.value));
        this.updatePlayStateUI(false);
      });

      animSlider.addEventListener('mouseup', () => { this.isUserScrubbing = false; });
      animSlider.addEventListener('touchend', () => { this.isUserScrubbing = false; });
    }

    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.viewport.setSpeed(e.target.value);
      });
    }
  }

  setupLegend() {
    const legend = document.getElementById('viewport-overlay-legend');
    const toggleBtn = document.getElementById('btn-legend-toggle');
    const closeBtn = document.getElementById('btn-close-legend');

    if (!legend) return;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        legend.classList.toggle('hidden');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        legend.classList.add('hidden');
      });
    }
  }

  setupFullscreen() {
    const fsBtnHeader = document.getElementById('btn-fullscreen');
    const fsBtnViewport = document.getElementById('btn-viewport-fullscreen');
    const appRoot = document.getElementById('app-root');

    const updateFullscreenIcons = (isFullscreen) => {
      [fsBtnHeader, fsBtnViewport].forEach(btn => {
        if (!btn) return;
        const enterIcon = btn.querySelector('.fs-icon-enter');
        const exitIcon = btn.querySelector('.fs-icon-exit');
        if (isFullscreen) {
          if (enterIcon) enterIcon.classList.add('hidden');
          if (exitIcon) exitIcon.classList.remove('hidden');
          btn.setAttribute('title', 'Exit Fullscreen Workspace (F / Esc)');
        } else {
          if (enterIcon) enterIcon.classList.remove('hidden');
          if (exitIcon) exitIcon.classList.add('hidden');
          btn.setAttribute('title', 'Toggle Fullscreen Workspace (F)');
        }
      });
    };

    const toggleFullscreen = () => {
      const isFsApiAvailable = !!(
        document.fullscreenEnabled ||
        document.webkitFullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.msFullscreenEnabled
      );

      const isCurrentFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        appRoot.classList.contains('fullscreen-workspace')
      );

      if (isCurrentFs) {
        // Exit fullscreen
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
          document.webkitExitFullscreen();
        }
        appRoot.classList.remove('fullscreen-workspace');
        updateFullscreenIcons(false);
      } else {
        // Enter fullscreen
        if (isFsApiAvailable && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            // Fallback to CSS fullscreen
            appRoot.classList.add('fullscreen-workspace');
            updateFullscreenIcons(true);
          });
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else {
          // Fallback to CSS fullscreen
          appRoot.classList.add('fullscreen-workspace');
          updateFullscreenIcons(true);
        }
      }

      // Trigger 3D canvas resize
      setTimeout(() => {
        this.viewport?.handleResize();
      }, 60);
    };

    if (fsBtnHeader) fsBtnHeader.addEventListener('click', toggleFullscreen);
    if (fsBtnViewport) fsBtnViewport.addEventListener('click', toggleFullscreen);

    // Fullscreen API change listener
    const onFsChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFs) {
        appRoot.classList.add('fullscreen-workspace');
        updateFullscreenIcons(true);
      } else {
        appRoot.classList.remove('fullscreen-workspace');
        updateFullscreenIcons(false);
      }
      setTimeout(() => {
        this.viewport?.handleResize();
      }, 60);
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // Keyboard shortcuts: 'F' / 'f' toggles fullscreen, 'Escape' exits fallback fullscreen
    window.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (appRoot.classList.contains('fullscreen-workspace') && !document.fullscreenElement) {
          appRoot.classList.remove('fullscreen-workspace');
          updateFullscreenIcons(false);
          setTimeout(() => {
            this.viewport?.handleResize();
          }, 60);
        }
      }
    });
  }

  setupEventIsolation() {
    const floatingSelectors = [
      '#animation-control-bar',
      '.floating-viewport-controls',
      '#viewport-overlay-legend'
    ];

    const stopEvents = ['pointerdown', 'mousedown', 'wheel', 'touchstart', 'touchmove'];

    floatingSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        stopEvents.forEach(evtName => {
          el.addEventListener(evtName, (e) => {
            e.stopPropagation();
          }, { passive: evtName === 'wheel' || evtName.startsWith('touch') });
        });
      }
    });

    // For left-drawer, prevent wheel propagation from causing canvas zoom or page scrolls
    const drawerEl = document.getElementById('left-drawer');
    if (drawerEl) {
      drawerEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    }
  }

  setupPracticeChallenges() {
    const diffButtons = document.querySelectorAll('.diff-btn');
    const randBtn = document.getElementById('btn-randomize-challenge');
    const tryBtn = document.getElementById('btn-practice-try');
    const checkBtn = document.getElementById('btn-practice-check');
    const fillStudioBtn = document.getElementById('btn-practice-fill-studio');
    const toggleExplBtn = document.getElementById('btn-toggle-explanation');

    // Difficulty selection
    diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentDifficulty = btn.getAttribute('data-diff') || 'medium';
        this.generateNewPracticeChallenge();
      });
    });

    // Randomize button
    if (randBtn) {
      randBtn.addEventListener('click', () => {
        this.generateNewPracticeChallenge();
      });
    }

    // Try in Studio button
    if (tryBtn) {
      tryBtn.addEventListener('click', () => {
        if (!this.currentChallenge) return;
        this.loadPracticeChallengeIntoStudio(this.currentChallenge);
      });
    }

    // Check Answer button
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        this.checkPracticeAnswer();
      });
    }

    // Use Studio v' button
    if (fillStudioBtn) {
      fillStudioBtn.addEventListener('click', () => {
        if (!this.currentResult || !this.currentResult.finalSequentialVector) {
          alert('Run Compute & Verify in the studio first to produce a vector result.');
          return;
        }
        const v = this.currentResult.finalSequentialVector;
        const ansX = document.getElementById('practice-ans-x');
        const ansY = document.getElementById('practice-ans-y');
        const ansZ = document.getElementById('practice-ans-z');
        if (ansX) ansX.value = PracticeGenerator.formatNum(v[0], 3);
        if (ansY) ansY.value = PracticeGenerator.formatNum(v[1], 3);
        if (ansZ) ansZ.value = PracticeGenerator.formatNum(v[2], 3);
      });
    }

    // Toggle Explanation Accordion
    if (toggleExplBtn) {
      toggleExplBtn.addEventListener('click', () => {
        const drawer = document.getElementById('practice-explanation-drawer');
        if (!drawer) return;
        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
          drawer.classList.remove('hidden');
          toggleExplBtn.classList.add('expanded');
          const span = toggleExplBtn.querySelector('span');
          if (span) span.textContent = 'Hide Step-by-Step Explanation';
        } else {
          drawer.classList.add('hidden');
          toggleExplBtn.classList.remove('expanded');
          const span = toggleExplBtn.querySelector('span');
          if (span) span.textContent = 'Reveal Step-by-Step Explanation';
        }
      });
    }

    // Generate initial challenge
    this.generateNewPracticeChallenge();
  }

  generateNewPracticeChallenge() {
    const prevId = this.currentChallenge ? this.currentChallenge.id : null;
    const chal = PracticeGenerator.generateChallenge(this.currentDifficulty, prevId);
    if (!chal) return;

    this.currentChallenge = chal;
    this.renderPracticeChallengeUI(chal);
  }

  renderPracticeChallengeUI(chal) {
    const diffBadge = document.getElementById('challenge-diff-badge');
    const categoryText = document.getElementById('challenge-category');
    const heading = document.getElementById('challenge-heading');
    const prompt = document.getElementById('challenge-prompt');
    const givenV0 = document.getElementById('challenge-given-v0');
    const givenTrans = document.getElementById('challenge-given-trans');
    const feedbackAlert = document.getElementById('practice-feedback-alert');
    const formulaText = document.getElementById('explanation-formula');
    const stepsList = document.getElementById('explanation-steps-list');
    const matrixText = document.getElementById('explanation-matrix-text');
    const geometricText = document.getElementById('explanation-geometric-text');
    const drawer = document.getElementById('practice-explanation-drawer');
    const toggleExplBtn = document.getElementById('btn-toggle-explanation');

    if (diffBadge) {
      diffBadge.textContent = chal.difficulty;
      diffBadge.className = `badge-tag badge-${chal.difficulty.toLowerCase()}`;
    }
    if (categoryText) categoryText.textContent = chal.category || '';
    if (heading) heading.textContent = chal.title;
    if (prompt) prompt.textContent = chal.challenge;

    if (givenV0) {
      givenV0.textContent = `• Input Vector v₀ = ${PracticeGenerator.formatVec(chal.given.v0)}`;
    }
    if (givenTrans) {
      const transSummary = chal.given.transformations.map(t => `${t.name}: ${t.title}`).join(' → ');
      givenTrans.textContent = `• Transformations: ${transSummary}`;
    }

    // Reset inputs & feedback
    const ansX = document.getElementById('practice-ans-x');
    const ansY = document.getElementById('practice-ans-y');
    const ansZ = document.getElementById('practice-ans-z');
    if (ansX) ansX.value = '';
    if (ansY) ansY.value = '';
    if (ansZ) ansZ.value = '';

    if (feedbackAlert) {
      feedbackAlert.className = 'practice-feedback-alert hidden';
      feedbackAlert.textContent = '';
    }

    // Reset explanation drawer to hidden
    if (drawer) drawer.classList.add('hidden');
    if (toggleExplBtn) {
      toggleExplBtn.classList.remove('expanded');
      const span = toggleExplBtn.querySelector('span');
      if (span) span.textContent = 'Reveal Step-by-Step Explanation';
    }

    if (formulaText) formulaText.textContent = chal.explanation?.formula || '';
    if (stepsList) {
      stepsList.innerHTML = (chal.explanation?.steps || []).map(s => `<li>${s}</li>`).join('');
    }
    if (matrixText) matrixText.textContent = chal.explanation?.matrixArithmetic || '';
    if (geometricText) geometricText.textContent = chal.geometricMeaning || '';
  }

  loadPracticeChallengeIntoStudio(chal) {
    if (!chal || !this.inputsManager) return;

    this.activePracticeChallenge = chal;

    // 1. Set input vector
    this.inputsManager.setVector(chal.given.v0);

    // 2. Set transformations
    this.inputsManager.transformations = [];
    chal.given.transformations.forEach((t) => {
      const item = this.inputsManager.addTransformation(t.type, false);
      if (t.params) item.params = { ...t.params };
      if (t.matrix) item.matrix = [...t.matrix];
      if (t.matrixExpressions) item.matrixExpressions = [...t.matrixExpressions];
    });

    this.inputsManager.renderAllCards();
    this.inputsManager.notifyChange();

    // Visual feedback
    const feedbackAlert = document.getElementById('practice-feedback-alert');
    if (feedbackAlert) {
      feedbackAlert.className = 'practice-feedback-alert success';
      feedbackAlert.textContent = `Loaded challenge "${chal.title}" into the studio. 3D visualization and transformations updated!`;
    }
  }

  checkPracticeAnswer() {
    if (!this.currentChallenge) return;

    const ansX = document.getElementById('practice-ans-x');
    const ansY = document.getElementById('practice-ans-y');
    const ansZ = document.getElementById('practice-ans-z');
    const feedbackAlert = document.getElementById('practice-feedback-alert');

    const x = parseFloat(ansX ? ansX.value : NaN);
    const y = parseFloat(ansY ? ansY.value : NaN);
    const z = parseFloat(ansZ ? ansZ.value : NaN);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      if (feedbackAlert) {
        feedbackAlert.className = 'practice-feedback-alert error';
        feedbackAlert.textContent = 'Please enter valid numerical values for x\', y\', and z\' (or click "Use Studio v\'").';
      }
      return;
    }

    const report = PracticeGenerator.checkAnswer(this.currentChallenge, [x, y, z]);
    if (feedbackAlert) {
      feedbackAlert.className = `practice-feedback-alert ${report.correct ? 'success' : 'error'}`;
      feedbackAlert.textContent = report.message;
    }
  }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(err => console.error("App init error:", err));
});
