# Transformation Composition & Inverse Verification System

[![C++17](https://img.shields.io/badge/C%2B%2B-17-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Wasm-654FF0.svg)](https://webassembly.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)

A mathematical and visual laboratory for **3D linear transformation composition, numerical matrix inversion, scale-aware verification, and interactive 3D visualization** powered by high-performance C++17 compiled to WebAssembly.

---

## 🌟 Key Features

- **3×3 Matrix Transformation Pipeline**:
  - Sequential multi-stage transformations: $\mathbf{v}' = T_3 (T_2 (T_1 \mathbf{v}))$.
  - Right-to-left operator composition: $C = T_n \cdots T_2 T_1$.
  - Presets: Arbitrary 3D scaling, axis rotations ($R_x, R_y, R_z$), reflections ($XY, XZ, YZ$), shearing, and identity.
- **Pivoted Gauss-Jordan Numerical Inversion**:
  - Robust row-partial pivoting on augmented matrix $[A \mid I]$.
  - Scale-aware singularity detection ($|\text{pivot}| \ge 10^{-12} \cdot \|A\|_\infty$).
  - Residual matrix verification: $E_1 = I - C C^{-1}$, relative residual $r$, and condition number $\kappa_\infty(C)$.
  - Reversal law verification: $(T_n \cdots T_1)^{-1} = T_1^{-1} \cdots T_n^{-1}$.
  - Vector recovery: $\mathbf{v}_{\text{rec}} = C^{-1}(C\mathbf{v}_0)$ with residual $\|\mathbf{v}_{\text{rec}} - \mathbf{v}_0\|_2 < 10^{-9}$.
- **Faithful 3D Coordinate Visualization (Three.js)**:
  - True 1:1 right-handed mapping: $+X$ (Red, right), $+Y$ (Green, vertical UP), $+Z$ (Blue, forward/depth).
  - Solid 3D vector mesh with emissive material, directional tip cone, and origin anchor at $(0,0,0)$.
  - Integer tick marks and numeric labels along all axes ($-5 \dots +5$).
  - Dynamic in-place vector animation with smooth continuous interpolation.
  - Dedicated Fullscreen Workspace with pull-out drawer panels.
- **Downloadable Educational PDF Report**:
  - One-click export of an A4 educational experiment report (`transformation-report-YYYY-MM-DD.pdf`).
  - Conversational tutoring style with step-by-step row-by-column arithmetic.
  - Authentic Three.js scene screenshots embedded at each transformation stage.
  - Comprehensive verification tables and reflection questions for students.

---

## 🏗️ System Architecture

```
d:/matrics-transformation-maths/
├── engine/                       # C++17 Core Mathematical Engine
│   ├── Vector3.hpp               # 3D Column Vector operations
│   ├── Matrix3x3.hpp             # 3×3 Matrix operations, determinants & cofactors
│   ├── InverseSolver.hpp         # Pivoted Gauss-Jordan inversion & residuals
│   ├── Presets.hpp               # Analytical transformation generators
│   ├── TransformationPipeline.hpp# Sequential vs Composite pipeline & verification
│   ├── WasmBridge.cpp            # Emscripten WebAssembly bridge (JSON interface)
│   └── build/                    # Compiled WebAssembly artifacts (.js / .wasm)
├── frontend/                     # Interactive Web Application
│   ├── index.html                # Modern High-Contrast HTML5 Workspace
│   ├── package.json              # Node dependencies (Three.js, jsPDF, Vite)
│   ├── public/wasm/              # Deployed WebAssembly runtime
│   └── src/
│       ├── main.js               # Application orchestrator
│       ├── math/                 # Engine client & JS fallback reference
│       ├── report/               # jsPDF Educational Report Generator
│       ├── styles/               # Modern responsive glassmorphism UI styles
│       ├── ui/                   # Matrix inputs & verification results panels
│       └── visualization/        # Three.js 3D Viewport & Animation manager
├── tests/                        # Automated Test Suites
│   ├── test_engine.cpp           # Native C++ unit tests (115 tests)
│   ├── test_wasm.js              # WebAssembly pipeline tests (32 tests)
│   ├── test_viewport_animation.js# Interpolation & vector continuity (27 tests)
│   └── test_coordinate_mapping_and_report.js # Coordinate mapping & PDF tests (16 tests)
└── docs/                         # Mathematical traceability & specifications
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Modern web browser with WebAssembly and WebGL support

### Running Locally

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Building for Production

```bash
cd frontend
npm run build
```

---

## 🧪 Testing & Verification

The system includes comprehensive verification at native C++, WebAssembly, animation, and PDF export levels:

```bash
# 1. Native C++ engine tests (115 tests)
./tests/test_engine.exe

# 2. WebAssembly pipeline tests (32 tests)
node tests/test_wasm.js

# 3. Viewport animation tests (27 tests)
node tests/test_viewport_animation.js

# 4. 3D coordinate mapping & PDF report tests (16 tests)
node tests/test_coordinate_mapping_and_report.js
```

All 190 tests pass with zero errors.

---

## 📜 Mathematical Foundations

### 1. Sequential Application vs. Composition
Given $n$ successive transformations $T_1, T_2, \dots, T_n$:

$$\mathbf{v}_1 = T_1 \mathbf{v}_0, \quad \mathbf{v}_2 = T_2 \mathbf{v}_1, \quad \dots \quad \mathbf{v}_n = T_n \mathbf{v}_{n-1}$$

The single composite matrix $C$ is computed from right to left:

$$C = T_n T_{n-1} \cdots T_2 T_1$$

Equivalence is verified using a scale-aware infinity-norm residual:

$$\|C \mathbf{v}_0 - \mathbf{v}_n\|_\infty \le \epsilon = 10^{-9}$$

### 2. Inversion & Recovery
When $\det(C) \neq 0$ and the pivot threshold $|p_k| \ge 10^{-12} \cdot \|C\|_\infty$ is satisfied, $C^{-1}$ is computed via Gauss-Jordan elimination with row-partial pivoting. Vector recovery is verified by:

$$\|\mathbf{v}_{\text{rec}} - \mathbf{v}_0\|_2 = \|C^{-1}(C\mathbf{v}_0) - \mathbf{v}_0\|_2 < 10^{-9}$$

---

## 📄 License

MIT License. Designed for education, computational geometry, and linear algebra verification.
