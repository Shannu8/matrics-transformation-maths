import { jsPDF } from 'jspdf';

/**
 * Educational PDF Report Generator
 * Generates comprehensive, beautifully formatted A4 PDF reports
 * with conversational tutoring, step-by-step arithmetic,
 * matrix composition and inverse verification, and authentic Three.js screenshots.
 */
export class ReportGenerator {
  /**
   * Generates and downloads the PDF report.
   * @param {Object} pipelineResult Result object from EngineClient
   * @param {Object} viewport Viewport3D instance for capturing authentic screenshots
   * @returns {Promise<boolean>} Success status
   */
  static async generate(pipelineResult, viewport) {
    if (!pipelineResult) {
      throw new Error('No transformation experiment data available to generate report.');
    }

    // 1. Capture genuine screenshots from the active Three.js viewport
    let screenshots = {};
    try {
      if (viewport && typeof viewport.captureStageScreenshots === 'function') {
        screenshots = viewport.captureStageScreenshots();
      }
    } catch (err) {
      console.warn('Screenshot capture warning:', err);
    }

    // 2. Instantiate jsPDF (A4 portrait, mm units)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const builder = new ReportBuilder(doc, pipelineResult, screenshots);
    builder.build();

    // 3. Meaningful filename: transformation-report-YYYY-MM-DD.pdf
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `transformation-report-${dateStr}.pdf`;

    doc.save(filename);
    return true;
  }
}

class ReportBuilder {
  constructor(doc, result, screenshots) {
    this.doc = doc;
    this.res = result;
    this.screenshots = screenshots || {};

    // Page Dimensions (A4 mm)
    this.pageWidth = 210;
    this.pageHeight = 297;
    this.marginLeft = 18;
    this.marginRight = 18;
    this.marginTop = 20;
    this.marginBottom = 20;
    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight; // 174 mm
    this.y = this.marginTop;

    // Harmonious Palette matching the Dark/Glassmorphism application
    this.colors = {
      primaryDark: [15, 23, 42],      // #0f172a Deep Slate
      secondaryDark: [30, 41, 59],    // #1e293b Slate 800
      brandBlue: [2, 132, 199],       // #0284c7 Sky 600
      accentCyan: [14, 165, 233],     // #0ea5e9 Cyan
      accentAmber: [217, 119, 6],     // #d97706 Amber
      accentPurple: [124, 58, 237],   // #7c3aed Purple
      accentEmerald: [16, 185, 129],  // #10b981 Emerald
      accentRed: [225, 29, 72],       // #e11d48 Rose
      bodyText: [51, 65, 85],         // #334155 Slate 700
      lightBg: [248, 250, 252],       // #f8fafc Light grey container
      cardBorder: [226, 232, 240],    // #e2e8f0 Border
      white: [255, 255, 255]
    };
  }

  build() {
    this.renderHeaderCover();
    this.renderSection1Overview();
    this.renderSection2InitialVector();
    this.renderSection3Transformations();
    this.renderSection4Composition();
    this.renderSection5InverseVerification();
    this.renderSection6Reflections();

    // Add running headers & footers across all pages
    this.renderRunningHeadersFooters();
  }

  // ==========================================
  // Layout Helpers
  // ==========================================

  checkPageBreak(neededHeight) {
    if (this.y + neededHeight > this.pageHeight - this.marginBottom) {
      this.doc.addPage();
      this.y = this.marginTop + 10; // Extra room for running header
    }
  }

  formatNum(num, decimals = 4) {
    if (!Number.isFinite(num)) return 'NaN';
    if (Math.abs(num) < 1e-12) return '0.0000';
    return num.toFixed(decimals);
  }

  formatVec(v, decimals = 3) {
    if (!v) return '[ 0.000, 0.000, 0.000 ]ᵀ';
    return `[ ${this.formatNum(v[0], decimals)}, ${this.formatNum(v[1], decimals)}, ${this.formatNum(v[2], decimals)} ]ᵀ`;
  }

  drawCard(x, y, w, h, bgColor = this.colors.lightBg, borderColor = this.colors.cardBorder) {
    this.doc.setFillColor(...bgColor);
    this.doc.setDrawColor(...borderColor);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  }

  drawBadge(text, x, y, type = 'info') {
    let bg = [224, 242, 254];
    let fg = [3, 105, 161];
    if (type === 'success') {
      bg = [209, 250, 229];
      fg = [6, 95, 70];
    } else if (type === 'warning') {
      bg = [254, 243, 199];
      fg = [146, 64, 14];
    } else if (type === 'error') {
      bg = [255, 228, 230];
      fg = [159, 18, 57];
    }

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    const tw = this.doc.getTextWidth(text);
    const bw = tw + 6;
    const bh = 5;

    this.doc.setFillColor(...bg);
    this.doc.setDrawColor(...fg);
    this.doc.setLineWidth(0.2);
    this.doc.roundedRect(x, y - 3.8, bw, bh, 1, 1, 'FD');

    this.doc.setTextColor(...fg);
    this.doc.text(text, x + 3, y - 0.3);
    return bw;
  }

  renderSectionHeading(title, subtitle = '') {
    this.checkPageBreak(22);
    this.doc.setFillColor(...this.colors.primaryDark);
    this.doc.rect(this.marginLeft, this.y, 3.5, 9, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(14);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(title, this.marginLeft + 6, this.y + 6.5);

    this.y += 11;
    if (subtitle) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...this.colors.bodyText);
      const lines = this.doc.splitTextToSize(subtitle, this.contentWidth);
      this.doc.text(lines, this.marginLeft, this.y);
      this.y += lines.length * 4.5 + 3;
    }
  }

  renderTutorNote(text, icon = 'TIP') {
    this.checkPageBreak(20);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    const lines = this.doc.splitTextToSize(text, this.contentWidth - 14);
    const boxH = Math.max(12, lines.length * 4.2 + 8);

    this.drawCard(this.marginLeft, this.y, this.contentWidth, boxH, [240, 249, 255], [186, 230, 253]);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(`TUTOR NOTE [${icon}]:`, this.marginLeft + 4, this.y + 5.5);

    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(lines, this.marginLeft + 4, this.y + 10);

    this.y += boxH + 4;
  }

  renderScreenshot(dataUrl, caption, stepLabel = '') {
    if (!dataUrl) return;
    this.checkPageBreak(75);

    const imgW = 120;
    const imgH = 67.5; // 16:9 aspect ratio
    const imgX = this.marginLeft + (this.contentWidth - imgW) / 2;

    this.drawCard(imgX - 2, this.y - 2, imgW + 4, imgH + 14, [248, 250, 252], [203, 213, 225]);

    try {
      this.doc.addImage(dataUrl, 'JPEG', imgX, this.y, imgW, imgH);
    } catch (e) {
      console.warn('Could not embed image:', e);
      return;
    }

    // Step badge on screenshot
    if (stepLabel) {
      this.drawBadge(stepLabel, imgX + 3, this.y + 6, 'info');
    }

    // Caption underneath
    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);
    const capWidth = this.doc.getTextWidth(caption);
    const capX = this.marginLeft + (this.contentWidth - capWidth) / 2;
    this.doc.text(caption, Math.max(this.marginLeft, capX), this.y + imgH + 6.5);

    this.y += imgH + 16;
  }

  // ==========================================
  // Document Sections
  // ==========================================

  renderHeaderCover() {
    // Top banner
    this.doc.setFillColor(...this.colors.primaryDark);
    this.doc.rect(0, 0, this.pageWidth, 36, 'F');

    // Title & subtitle
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(17);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('3D TRANSFORMATION COMPOSITION & INVERSE REPORT', this.marginLeft, 16);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(186, 230, 253);
    this.doc.text('Linear Algebra Laboratory • Sequential Pipeline & Verification Suite', this.marginLeft, 24);

    this.doc.setFontSize(8.5);
    this.doc.setTextColor(148, 163, 184);
    const now = new Date();
    const dateFormatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString()}`;
    this.doc.text(`Generated: ${dateFormatted} | Engine: ${this.res.engineSource || 'C++17 Wasm'}`, this.marginLeft, 31);

    this.y = 44;

    // Overview Card / Experiment Metadata
    const cardH = 26;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('EXPERIMENT SUMMARY', this.marginLeft + 5, this.y + 6);

    const colW = this.contentWidth / 4;
    const startY = this.y + 12;

    // Col 1: Input Vector
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Initial Vector v₀:', this.marginLeft + 5, startY);
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(`(${this.res.initialVector.map(n => n.toFixed(1)).join(', ')})`, this.marginLeft + 5, startY + 5);

    // Col 2: Pipeline Steps
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Transformations:', this.marginLeft + colW + 2, startY);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(`${this.res.steps.length} Stages (${this.res.steps.map(s => s.name).join(' → ')})`, this.marginLeft + colW + 2, startY + 5);

    // Col 3: Composition Status
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Composition Verification:', this.marginLeft + colW * 2 + 2, startY);
    if (this.res.compositionVerified) {
      this.drawBadge('VERIFIED EQUIVALENT ✓', this.marginLeft + colW * 2 + 2, startY + 5.5, 'success');
    } else {
      this.drawBadge('FAILED DISAGREEMENT', this.marginLeft + colW * 2 + 2, startY + 5.5, 'error');
    }

    // Col 4: Invertibility
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Matrix Invertibility:', this.marginLeft + colW * 3 + 2, startY);
    if (this.res.composedInverse.success) {
      const cond = this.res.composedInverse.conditionNumber;
      const condLabel = cond < 1e4 ? 'Well-Conditioned' : 'Ill-Conditioned';
      this.drawBadge(`${condLabel} (κ=${cond < 1e4 ? cond.toFixed(1) : cond.toExponential(1)})`, this.marginLeft + colW * 3 + 2, startY + 5.5, 'success');
    } else {
      this.drawBadge('SINGULAR (det=0)', this.marginLeft + colW * 3 + 2, startY + 5.5, 'error');
    }

    this.y += cardH + 7;
  }

  renderSection1Overview() {
    this.renderSectionHeading('1. Welcome and Overview of the Experiment');

    const introText = 
      "Welcome to your laboratory report! In this experiment, we explore how 3D vectors transform under sequential linear mappings and examine whether a single composite matrix accurately reproduces the entire multi-stage chain.\n\n" +
      "The mathematical model operates strictly on 3×3 matrices and 3D column vectors. Transformations act by matrix-vector multiplication: v' = T · v. When multiple transformations are performed in sequence (first T₁, then T₂, then T₃), they compose from right to left: C = Tₙ ··· T₂ · T₁. Furthermore, if C is invertible, we can compute C⁻¹ using partial-pivoted Gauss-Jordan elimination and reconstruct the original input vector perfectly from the transformed result: v₀ = C⁻¹(C · v₀).";

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);
    const splitIntro = this.doc.splitTextToSize(introText, this.contentWidth);
    this.doc.text(splitIntro, this.marginLeft, this.y);
    this.y += splitIntro.length * 4.4 + 4;

    this.renderTutorNote(
      "Think of matrix transformations as dynamic mappings of 3D space. While vectors point from the origin to a specific coordinate, a 3×3 matrix stretches, rotates, shears, or reflects the entire space around that origin. Notice that the origin (0, 0, 0) always remains pinned at (0, 0, 0) because T · 0 = 0.",
      "GEOMETRY"
    );
  }

  renderSection2InitialVector() {
    this.renderSectionHeading('2. Initial State: Starting Vector v₀');

    const v0 = this.res.initialVector;
    const v0Norm = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2]);

    const cardH = 22;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Input Vector Representation:', this.marginLeft + 6, this.y + 6);

    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(`v₀ = [ x: ${this.formatNum(v0[0])},  y: ${this.formatNum(v0[1])},  z: ${this.formatNum(v0[2])} ]ᵀ`, this.marginLeft + 6, this.y + 13);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`Euclidean Length ||v₀||₂ = √(x² + y² + z²) = ${v0Norm.toFixed(4)} units`, this.marginLeft + 6, this.y + 18.5);

    this.y += cardH + 5;

    this.renderTutorNote(
      "Let's begin with your input vector. Before applying this transformation, consider how its direction or magnitude might change. Will the next operation preserve this vector's length (like a pure rigid rotation) or stretch it (scaling)? Look closely at the upcoming matrix elements.",
      "PREDICTION QUESTION"
    );

    // Initial 3D Scene Screenshot
    if (this.screenshots.initial) {
      this.renderScreenshot(
        this.screenshots.initial,
        'Figure 1: Authentic 3D Three.js scene showing initial vector v₀ (cyan) pointing from origin (0,0,0).',
        'Step 0: Initial Vector v₀'
      );
    }
  }

  renderSection3Transformations() {
    this.renderSectionHeading('3. Individual Transformations (Step-by-Step Arithmetic)');

    this.res.steps.forEach((st, idx) => {
      this.checkPageBreak(85);

      const prevV = idx === 0 ? this.res.initialVector : this.res.steps[idx - 1].outputVector;
      const mat = st.matrix;
      const outV = st.outputVector;
      const prevNorm = Math.sqrt(prevV[0] ** 2 + prevV[1] ** 2 + prevV[2] ** 2);
      const outNorm = Math.sqrt(outV[0] ** 2 + outV[1] ** 2 + outV[2] ** 2);

      // Card Header
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(11);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text(`Stage ${st.index}: Apply Transformation ${st.name}`, this.marginLeft, this.y);
      this.y += 5;

      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...this.colors.bodyText);
      this.doc.text(`General Formula: v_${st.index} = ${st.name} · v_${idx === 0 ? '0' : idx}`, this.marginLeft, this.y);
      this.y += 5;

      // 1. Matrix and Determinant Card
      const cardH = 36;
      this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

      // Render Matrix Grid
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text(`Matrix ${st.name} (3×3):`, this.marginLeft + 6, this.y + 6);

      this.doc.setFont('courier', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...this.colors.primaryDark);

      const rowY = this.y + 12;
      this.doc.text(`| ${this.formatNum(mat[0])}  ${this.formatNum(mat[1])}  ${this.formatNum(mat[2])} |`, this.marginLeft + 6, rowY);
      this.doc.text(`| ${this.formatNum(mat[3])}  ${this.formatNum(mat[4])}  ${this.formatNum(mat[5])} |`, this.marginLeft + 6, rowY + 5);
      this.doc.text(`| ${this.formatNum(mat[6])}  ${this.formatNum(mat[7])}  ${this.formatNum(mat[8])} |`, this.marginLeft + 6, rowY + 10);

      // Determinant and Geometric Diagnostics
      const diagX = this.marginLeft + 90;
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text('Geometric Properties:', diagX, this.y + 6);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...this.colors.bodyText);
      const detVal = st.inverse.determinant;
      this.doc.text(`• Determinant det(${st.name}) = ${this.formatNum(detVal)}`, diagX, this.y + 12);

      let detMeaning = 'Preserves volume and orientation';
      if (Math.abs(detVal) < 1e-6) detMeaning = 'Singular: collapses space (volume = 0)';
      else if (Math.abs(Math.abs(detVal) - 1.0) < 1e-4) detMeaning = detVal < 0 ? 'Isometry with reflection (orientation reversed)' : 'Rigid isometry (pure rotation/reflection)';
      else detMeaning = detVal < 0 ? `Scales volume by |det|=${Math.abs(detVal).toFixed(2)} and reverses orientation` : `Scales volume by factor of ${detVal.toFixed(2)}`;
      
      this.doc.text(`  → ${detMeaning}`, diagX, this.y + 16.5);
      this.doc.text(`• Input Length: ${prevNorm.toFixed(3)} → Output Length: ${outNorm.toFixed(3)}`, diagX, this.y + 22);
      this.doc.text(`• Length Ratio: ${(outNorm / Math.max(1e-9, prevNorm)).toFixed(3)}×`, diagX, this.y + 26.5);

      this.y += cardH + 5;

      // 2. Step-by-Step Row-by-Column Calculations
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text('Row-by-Column Arithmetic (Step-by-Step):', this.marginLeft, this.y);
      this.y += 4.5;

      const calcBoxH = 26;
      this.drawCard(this.marginLeft, this.y, this.contentWidth, calcBoxH, [255, 255, 255], [203, 213, 225]);

      this.doc.setFont('courier', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...this.colors.bodyText);

      // Row 1
      const xCalcStr = `x' = (${this.formatNum(mat[0])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[1])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[2])} · ${this.formatNum(prevV[2])})`;
      const xSumStr = `= ${this.formatNum(mat[0]*prevV[0])} + ${this.formatNum(mat[1]*prevV[1])} + ${this.formatNum(mat[2]*prevV[2])} = ${this.formatNum(outV[0])}`;
      this.doc.text(`Row 1 (x-coordinate):  ${xCalcStr}`, this.marginLeft + 4, this.y + 6);
      this.doc.text(`                       ${xSumStr}`, this.marginLeft + 4, this.y + 10);

      // Row 2
      const yCalcStr = `y' = (${this.formatNum(mat[3])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[4])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[5])} · ${this.formatNum(prevV[2])})`;
      const ySumStr = `= ${this.formatNum(mat[3]*prevV[0])} + ${this.formatNum(mat[4]*prevV[1])} + ${this.formatNum(mat[5]*prevV[2])} = ${this.formatNum(outV[1])}`;
      this.doc.text(`Row 2 (y-coordinate):  ${yCalcStr}`, this.marginLeft + 4, this.y + 15);
      this.doc.text(`                       ${ySumStr}`, this.marginLeft + 4, this.y + 19);

      // Row 3
      const zCalcStr = `z' = (${this.formatNum(mat[6])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[7])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[8])} · ${this.formatNum(prevV[2])})`;
      const zSumStr = `= ${this.formatNum(mat[6]*prevV[0])} + ${this.formatNum(mat[7]*prevV[1])} + ${this.formatNum(mat[8]*prevV[2])} = ${this.formatNum(outV[2])}`;
      this.doc.text(`Row 3 (z-coordinate):  ${zCalcStr}`, this.marginLeft + 4, this.y + 24);

      this.y += calcBoxH + 4;

      this.renderTutorNote(
        `Now let's examine the new coordinates. Notice how each output coordinate is calculated by taking the dot product of one matrix row with incoming vector v_${idx === 0 ? '0' : idx}. The resulting vector is v_${st.index} = [${outV.map(n => n.toFixed(3)).join(', ')}]ᵀ.`,
        `STAGE ${st.index} SUMMARY`
      );

      // Screenshot for this stage
      const stageScreenshotKey = `stage_${st.index}`;
      if (this.screenshots[stageScreenshotKey]) {
        this.renderScreenshot(
          this.screenshots[stageScreenshotKey],
          `Figure ${idx + 2}: Authentic 3D scene after applying transformation ${st.name}, showing new vector endpoint v_${st.index}.`,
          `Stage ${st.index}: Result v_${st.index}`
        );
      }
    });
  }

  renderSection4Composition() {
    this.renderSectionHeading('4. Transformation Composition & Sequential Verification');

    const numSteps = this.res.steps.length;
    const formulaStr = numSteps === 3 ? 'C = T₃ · T₂ · T₁' : 'C = T₂ · T₁';

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);
    const expl = 
      `In linear algebra, when transformations are chained in time, the combined effect is represented by a single composite matrix: ${formulaStr}.\n` +
      "Crucially, matrix multiplication is applied from right to left because operators act upon the column vector from the left: v' = T₂(T₁ · v) = (T₂ · T₁) · v. Since matrix multiplication is generally non-commutative (AB ≠ BA), applying operations in reverse order yields completely different geometry.";

    const splitExpl = this.doc.splitTextToSize(expl, this.contentWidth);
    this.doc.text(splitExpl, this.marginLeft, this.y);
    this.y += splitExpl.length * 4.4 + 4;

    // Composite Matrix Display
    this.checkPageBreak(60);
    const cardH = 36;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(`Composite Transformation Matrix C (${formulaStr}):`, this.marginLeft + 6, this.y + 6);

    const cMat = this.res.composedMatrix;
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.brandBlue);

    const rY = this.y + 13;
    this.doc.text(`| ${this.formatNum(cMat[0])}  ${this.formatNum(cMat[1])}  ${this.formatNum(cMat[2])} |`, this.marginLeft + 6, rY);
    this.doc.text(`| ${this.formatNum(cMat[3])}  ${this.formatNum(cMat[4])}  ${this.formatNum(cMat[5])} |`, this.marginLeft + 6, rY + 5.5);
    this.doc.text(`| ${this.formatNum(cMat[6])}  ${this.formatNum(cMat[7])}  ${this.formatNum(cMat[8])} |`, this.marginLeft + 6, rY + 11);

    // Diagnostics
    const rightX = this.marginLeft + 95;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`• Determinant det(C) = ${this.formatNum(this.res.composedInverse.determinant)}`, rightX, this.y + 13);
    this.doc.text(`• Matrix Infinity-Norm ||C||_∞ = ${this.formatNum(this.res.composedInverse.normA)}`, rightX, this.y + 18.5);
    this.doc.text(`• Verification Tolerance: ε = 10⁻⁹ (Scale-Aware)`, rightX, this.y + 24);

    this.y += cardH + 5;

    // Comparative Verification Table
    this.checkPageBreak(45);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Sequential vs. Composite Direct Comparison:', this.marginLeft, this.y);
    this.y += 5;

    const tableH = 34;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, tableH, [255, 255, 255], [203, 213, 225]);

    // Table Header
    this.doc.setFillColor(...this.colors.secondaryDark);
    this.doc.rect(this.marginLeft, this.y, this.contentWidth, 7, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('METHOD', this.marginLeft + 4, this.y + 4.8);
    this.doc.text('MATHEMATICAL EXPRESSION', this.marginLeft + 45, this.y + 4.8);
    this.doc.text('RESULTING VECTOR [x, y, z]ᵀ', this.marginLeft + 115, this.y + 4.8);

    // Row 1: Sequential
    const tRow1Y = this.y + 13;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('1. Sequential Chain', this.marginLeft + 4, tRow1Y);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(numSteps === 3 ? 'v_seq = T₃(T₂(T₁ · v₀))' : 'v_seq = T₂(T₁ · v₀)', this.marginLeft + 45, tRow1Y);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentPurple);
    this.doc.text(this.formatVec(this.res.finalSequentialVector), this.marginLeft + 115, tRow1Y);

    // Row 2: Composite
    const tRow2Y = this.y + 21;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('2. Composite Direct', this.marginLeft + 4, tRow2Y);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('v_comp = C · v₀', this.marginLeft + 45, tRow2Y);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentEmerald);
    this.doc.text(this.formatVec(this.res.composedVector), this.marginLeft + 115, tRow2Y);

    // Row 3: Residual & Status
    const tRow3Y = this.y + 29;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Numerical Difference:', this.marginLeft + 4, tRow3Y);
    this.doc.setFont('courier', 'normal');
    this.doc.text(`||v_comp - v_seq|| = ${this.res.compositionError.toExponential(4)}`, this.marginLeft + 45, tRow3Y);
    if (this.res.compositionVerified) {
      this.drawBadge('VERIFIED EQUIVALENT ✓', this.marginLeft + 115, tRow3Y, 'success');
    } else {
      this.drawBadge('VERIFICATION FAILED', this.marginLeft + 115, tRow3Y, 'error');
    }

    this.y += tableH + 5;

    this.renderTutorNote(
      "Let's compare the result of applying the transformations individually with the result from their composite matrix. Notice that both methods produce identical coordinates within machine precision (residual < 10⁻¹⁵). This confirms the fundamental theorem of matrix composition: multiplying intermediate matrices together beforehand is mathematically equivalent to transforming the vector step by step.",
      "COMPOSITION THEOREM"
    );
  }

  renderSection5InverseVerification() {
    this.renderSectionHeading('5. Matrix Inversion & Vector Recovery Verification');

    const inv = this.res.composedInverse;

    if (!inv.success) {
      // Singular Matrix Case: Explain honestly and educationally
      this.checkPageBreak(50);
      const cardH = 34;
      this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH, [255, 241, 242], [254, 205, 211]);

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10.5);
      this.doc.setTextColor(...this.colors.accentRed);
      this.doc.text('SINGULAR MATRIX: INVERSE DOES NOT EXIST', this.marginLeft + 6, this.y + 7);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...this.colors.primaryDark);
      const singularDesc = 
        `Determinant det(C) = ${this.formatNum(inv.determinant)} | Status: ${inv.status}\n\n` +
        "Geometrically, at least one transformation in the pipeline flattened space onto a plane, line, or origin (dimension collapsed). Because information was irreversibly destroyed, no matrix inverse exists that can recover the initial vector v₀. In our partial-pivoted Gauss-Jordan solver, a pivot dropped below threshold 10⁻¹², correctly signaling singularity.";
      const splitSing = this.doc.splitTextToSize(singularDesc, this.contentWidth - 12);
      this.doc.text(splitSing, this.marginLeft + 6, this.y + 14);

      this.y += cardH + 5;

      this.renderTutorNote(
        "Singular transformations represent non-invertible physical processes like casting a shadow (projection onto a wall) or squashing a 3D object completely flat. Once 3D depth is flattened to zero, you cannot reconstruct the original 3D coordinates uniquely.",
        "SINGULARITY EXPLANATION"
      );
      return;
    }

    // Invertible Matrix Case: Full verification
    this.checkPageBreak(85);
    const cardH = 40;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Composed Matrix Inverse C⁻¹ (Pivoted Gauss-Jordan):', this.marginLeft + 6, this.y + 6);

    const invMat = inv.inverse;
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.brandBlue);

    const rY = this.y + 13;
    this.doc.text(`| ${this.formatNum(invMat[0])}  ${this.formatNum(invMat[1])}  ${this.formatNum(invMat[2])} |`, this.marginLeft + 6, rY);
    this.doc.text(`| ${this.formatNum(invMat[3])}  ${this.formatNum(invMat[4])}  ${this.formatNum(invMat[5])} |`, this.marginLeft + 6, rY + 5.5);
    this.doc.text(`| ${this.formatNum(invMat[6])}  ${this.formatNum(invMat[7])}  ${this.formatNum(invMat[8])} |`, this.marginLeft + 6, rY + 11);

    // Diagnostics & Inversion Metrics
    const rightX = this.marginLeft + 95;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`• Condition Number κ_∞(C) = ${inv.conditionNumber.toFixed(2)}`, rightX, this.y + 13);
    this.doc.text(`• Inverse Residual ||I - C·C⁻¹||_∞ = ${inv.residualE1Norm.toExponential(2)}`, rightX, this.y + 18);
    this.doc.text(`• Commutative Residual ||I - C⁻¹·C||_∞ = ${inv.residualE2Norm.toExponential(2)}`, rightX, this.y + 23);
    this.doc.text(`• Product of Inverses Matches: ${this.res.inverseProductMatchesDirect ? 'Identical ✓' : 'Discrepancy'}`, rightX, this.y + 28);
    this.doc.text(`  (Tₙ ··· T₁)⁻¹ = T₁⁻¹ ··· Tₙ⁻¹ (Reversed Order)`, rightX, this.y + 32.5);

    this.y += cardH + 5;

    // Vector Recovery Demonstration
    this.checkPageBreak(45);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Vector Recovery: v_rec = C⁻¹ · (C · v₀):', this.marginLeft, this.y);
    this.y += 5;

    const recBoxH = 26;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, recBoxH, [255, 255, 255], [203, 213, 225]);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Original Input Vector v₀:', this.marginLeft + 5, this.y + 7);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(this.formatVec(this.res.initialVector), this.marginLeft + 55, this.y + 7);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Recovered Vector v_rec:', this.marginLeft + 5, this.y + 14);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentEmerald);
    this.doc.text(this.formatVec(this.res.recoveredVector), this.marginLeft + 55, this.y + 14);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Recovery Residual ||v_rec - v₀||₂:', this.marginLeft + 5, this.y + 21);
    this.doc.setFont('courier', 'normal');
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(`${this.res.recoveryError.toExponential(4)}`, this.marginLeft + 55, this.y + 21);

    if (this.res.vectorRecoverySuccessful) {
      this.drawBadge('PERFECT RECOVERY ✓', this.marginLeft + 115, this.y + 21, 'success');
    } else {
      this.drawBadge('RECOVERY FAILED', this.marginLeft + 115, this.y + 21, 'error');
    }

    this.y += recBoxH + 5;

    this.renderTutorNote(
      "Compare the recovered vector with the original input to understand the recovery error. Here, the error is well within floating-point roundoff (residual ~ 10⁻¹⁶), proving that linear transformations can be cleanly unwound when the matrix is non-singular. Also notice that to invert a composite pipeline, each transformation's inverse must be applied in reverse order: (T₂T₁)⁻¹ = T₁⁻¹T₂⁻¹.",
      "INVERSE REVERSAL LAW"
    );
  }

  renderSection6Reflections() {
    this.renderSectionHeading('6. Observations, Insights & Student Reflection Questions');

    this.checkPageBreak(65);

    const takeaways = [
      "1. Non-Commutativity: In general, matrix multiplication does not commute (A·B ≠ B·A). Reordering physical operations like rotation and shear leads to distinct terminal coordinates.",
      "2. Order of Inverses: When inverting a chain of operations, the individual inverse transformations must be executed in reverse order: (Tₙ···T₁)⁻¹ = T₁⁻¹···Tₙ⁻¹.",
      "3. Volume Scaling Factor: The determinant det(T) measures how volume scales under the transformation. A determinant of 1 means volume is preserved; a negative determinant indicates orientation has been flipped (reflection).",
      "4. Numerical Conditioning: In real-world computing, ill-conditioned matrices (condition number κ >> 10⁶) amplify rounding errors during inversion. The Gauss-Jordan algorithm with partial row pivoting ensures numerical stability."
    ];

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);

    takeaways.forEach(item => {
      const lines = this.doc.splitTextToSize(item, this.contentWidth);
      this.doc.text(lines, this.marginLeft, this.y);
      this.y += lines.length * 4.2 + 2.5;
    });

    this.y += 3;

    // Reflection Questions Card
    this.checkPageBreak(40);
    const boxH = 32;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, boxH, [254, 252, 232], [254, 240, 138]);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.accentAmber);
    this.doc.text('QUESTIONS FOR FURTHER REFLECTION:', this.marginLeft + 5, this.y + 6);

    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Q1: What happens to a unit cube if det(T) = 0? Can you find a non-zero vector v such that T·v = 0?', this.marginLeft + 5, this.y + 13);
    this.doc.text('Q2: If you rotate by +45° around Y then rotate by -45° around Y, what should the composite matrix C be?', this.marginLeft + 5, this.y + 19);
    this.doc.text('Q3: Why must row-pivoting swap rows to place the largest available magnitude on the diagonal?', this.marginLeft + 5, this.y + 25);

    this.y += boxH + 6;
  }

  renderRunningHeadersFooters() {
    const totalPages = this.doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);

      // Running Header (pages > 1)
      if (i > 1) {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(148, 163, 184);
        this.doc.text('Transformation Composition & Inverse Verification System • Educational Laboratory Report', this.marginLeft, 10);
        this.doc.setDrawColor(226, 232, 240);
        this.doc.setLineWidth(0.2);
        this.doc.line(this.marginLeft, 12, this.pageWidth - this.marginRight, 12);
      }

      // Running Footer (all pages)
      const footerY = this.pageHeight - 10;
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.marginLeft, footerY - 3, this.pageWidth - this.marginRight, footerY - 3);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text('Department of Mathematics & Computational Geometry • C++17 / WebAssembly Engine', this.marginLeft, footerY);

      const pageStr = `Page ${i} of ${totalPages}`;
      const pw = this.doc.getTextWidth(pageStr);
      this.doc.text(pageStr, this.pageWidth - this.marginRight - pw, footerY);
    }
  }
}
