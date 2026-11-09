# MatrixLab
### Interactive Linear Algebra & Matrix Transformation Visualizer

MatrixLab is a C++-based project designed to explore the mathematical foundations of linear algebra through interactive computation and visualization.

The long-term goal is to develop a Desmos-inspired environment where users can manipulate matrices, vectors, and transformations and observe how they affect geometric spaces.

The project is being developed incrementally, implementing and validating each mathematical operation individually before introducing visualization and advanced features.

---

## Project Goals

- Implement fundamental linear algebra operations from scratch using C++.
- Understand the mathematical principles behind matrix and vector operations.
- Build a reusable mathematical engine.
- Visualize how matrices transform vectors, coordinate grids, and geometric objects.
- Eventually develop an interactive desktop application and a browser-based version using WebAssembly.

## Current Development Status

**Phase 1: Fundamental Matrix Operations**

Currently implementing:

- Matrix representation
- Matrix input and output
- Matrix addition
- Matrix dimension validation

Additional operations will be implemented progressively.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| C++ | Core mathematical engine |
| C++17 | Language standard |
| GCC / MinGW | Compiler |
| VS Code | Development environment |
| SFML (planned) | Desktop graphics and visualization |
| WebAssembly (planned) | Browser-based execution |
| HTML, CSS, JavaScript (planned) | Web interface |

---

## Installation & Setup

### Prerequisites

Install the following:

- Windows 10 or Windows 11
- Visual Studio Code
- GCC/G++ compiler (MinGW-w64)
- Git (optional)

### 1. Verify the C++ compiler

Open Command Prompt or the VS Code terminal and run:

```bash
g++ --version
```

If GCC is installed and configured correctly, the compiler version will be displayed.

If the command is not recognized, install MinGW-w64 and add its `bin` directory to your system PATH.

### 2. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/MatrixLab.git
```

Navigate into the project directory:

```bash
cd frontend
```

Alternatively, download the repository as a ZIP file and extract it.

### 3. Open the project in VS Code

```bash
code .
```

Ensure that the C/C++ extension by Microsoft is installed.

### 4. Compile the project

For the current C++ implementation:

```bash
g++ -std=c++17 -Wall -Wextra -O2 main.cpp -o MatrixLab.exe
```

If the project contains multiple source files, compile them together:

```bash
g++ -std=c++17 -Wall -Wextra -O2 main.cpp Matrix.cpp -o MatrixLab.exe
```

### 5. Run the application

On Windows:

```bash
.\MatrixLab.exe
```

---

## Project Structure

The project structure will evolve as additional mathematical operations are implemented.

```text
MatrixLab/
│
├── src/
│   ├── main.cpp
│   ├── Matrix.cpp
│   └── Matrix.h
│
├── tests/
│   └── matrix_tests.cpp
│
├── README.md
└── .gitignore
```

---

## Mathematical Roadmap

### Phase 1 — Fundamental Operations
- [x] Project initialization
- [ ] Matrix representation
- [ ] Matrix addition
- [ ] Matrix subtraction
- [ ] Scalar multiplication
- [ ] Matrix multiplication
- [ ] Matrix-vector multiplication

### Phase 2 — Advanced Matrix Operations
- [ ] Transpose
- [ ] Determinant
- [ ] Inverse
- [ ] Rank
- [ ] Trace

### Phase 3 — Vector Mathematics
- [ ] Vector addition and subtraction
- [ ] Dot product
- [ ] Magnitude
- [ ] Normalization
- [ ] Vector projection

### Phase 4 — Linear Transformations
- [ ] Scaling
- [ ] Rotation
- [ ] Reflection
- [ ] Shearing
- [ ] Transformation composition

### Phase 5 — Interactive Visualization
- [ ] 2D coordinate system
- [ ] Vector rendering
- [ ] Matrix transformation visualization
- [ ] Animated coordinate grid
- [ ] Basis vector visualization
- [ ] Determinant and area visualization

### Phase 6 — Advanced Mathematics
- [ ] Eigenvalues
- [ ] Eigenvectors
- [ ] Matrix decomposition
- [ ] Singular Value Decomposition (SVD)
- [ ] 3D transformations

### Phase 7 — Web Application
- [ ] Compile C++ mathematical engine using WebAssembly
- [ ] Develop interactive frontend
- [ ] Integrate JavaScript with C++
- [ ] Add PHP and MySQL for saving experiments
- [ ] Implement matrix sharing and user accounts

---

## Design Philosophy

MatrixLab follows a mathematics-first development approach.

Each operation will be:

1. Mathematically understood.
2. Implemented from scratch in C++.
3. Tested using appropriate examples and edge cases.
4. Integrated into the larger mathematical engine.
5. Eventually visualized interactively.

The objective is not simply to calculate mathematical results, but to understand and visualize the mathematics behind them.

---

## Future Vision

MatrixLab aims to become an interactive linear algebra environment where users can manipulate matrices and vectors and observe their mathematical consequences in real time.

Inspired by interactive mathematical tools such as Desmos, the project aims to connect abstract mathematical concepts with visual intuition.

**See the mathematics. Transform the space.**

---

## License

This project is currently under development. Licensing information will be added in a future release.
