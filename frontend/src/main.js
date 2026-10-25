import { EngineClient } from './math/engineClient.js';
import { Viewport3D } from './visualization/viewport3d.js';
import { MatrixInputsManager } from './ui/matrixInputs.js';
import { ResultsPanel } from './ui/resultsPanel.js';
import { ReportGenerator } from './report/reportGenerator.js';

class App {
  constructor() {
    this.engineClient = new EngineClient();
    this.viewport = null;
    this.inputsManager = null;
    this.resultsPanel = null;
    this.currentResult = null;
    this.isUserScrubbing = false;
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

    // 3. Initialize Engine Client (Wasm loader)
    const wasmActive = await this.engineClient.init();
    this.updateWasmBadge(wasmActive);

    // 4. Initialize Matrix Inputs Manager
    this.inputsManager = new MatrixInputsManager(this.engineClient, () => {
      this.recalculate();
    });

    // 5. Setup Pull-Out Left Drawer Controls
    this.setupLeftDrawer();

    // 6. Setup Collapsible Animation Strip
    this.setupAnimationBar();

    // 7. Setup Collapsible Legend
    this.setupLegend();

    // 8. Setup Dedicated Fullscreen Workspace View
    this.setupFullscreen();

    // 9. Prevent 3D Camera Rotation when interacting with drawers/panels
    this.setupEventIsolation();

    // 10. Calculate Button
    const calcBtn = document.getElementById('btn-calculate');
    if (calcBtn) {
      calcBtn.addEventListener('click', () => this.recalculate());
    }

    // 11. Load default state: v = (1, 1, 1) with identity transformations
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
    const errorBanner = document.getElementById('error-banner');
    if (errorBanner) errorBanner.classList.add('hidden');

    const v0 = this.inputsManager.getVector();
    const { list, names } = this.inputsManager.getMatrices();

    const res = this.engineClient.execute(list, names, v0);
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

    if (!drawer || !drawerHandle) return;

    const openIcon = drawerHandle.querySelector('.handle-icon-open');
    const closeIcon = drawerHandle.querySelector('.handle-icon-close');

    const setDrawerOpen = (open) => {
      if (open) {
        drawer.classList.add('drawer-open');
        drawerHandle.classList.add('drawer-open');
        drawerHandle.setAttribute('aria-expanded', 'true');
        drawerHandle.setAttribute('title', 'Close controls (<)');
        drawerHandle.setAttribute('aria-label', 'Close transformation controls');
        if (openIcon) openIcon.classList.add('hidden');
        if (closeIcon) closeIcon.classList.remove('hidden');
      } else {
        drawer.classList.remove('drawer-open');
        drawerHandle.classList.remove('drawer-open');
        drawerHandle.setAttribute('aria-expanded', 'false');
        drawerHandle.setAttribute('title', 'Open controls (>)');
        drawerHandle.setAttribute('aria-label', 'Open transformation controls');
        if (openIcon) openIcon.classList.remove('hidden');
        if (closeIcon) closeIcon.classList.add('hidden');
      }
    };

    drawerHandle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains('drawer-open');
      setDrawerOpen(!isOpen);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDrawerOpen(false);
      });
    }

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
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(err => console.error("App init error:", err));
});
