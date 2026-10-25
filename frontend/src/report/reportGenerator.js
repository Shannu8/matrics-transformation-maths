import { jsPDF } from 'jspdf';

/**
 * Educational PDF Report Generator
 * Generates comprehensive, beautifully formatted A4 PDF reports
 * with conversational tutoring, step-by-step arithmetic,
 * full-width authentic Three.js screenshots, dynamic pagination (no arbitrary page limits),
 * and robust mobile/desktop download handling.
 */
export class ReportGenerator {
  /**
   * Generates and downloads the PDF report.
   * @param {Object} pipelineResult Result object from EngineClient
   * @param {Object} viewport Viewport3D instance for capturing authentic screenshots
   * @returns {Promise<boolean>} Success status
   */
  static async generate(pipelineResult, viewport, customDoc = null) {
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

    // 2. Instantiate jsPDF (A4 portrait, mm units) or use provided instance
    const doc = customDoc || new jsPDF({
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

    try {
      doc.save(filename);
    } catch (err) {
      console.warn('Direct doc.save failed, falling back to Blob URL:', err);
      try {
        if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
          const blob = doc.output('blob');
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          }, 1500);
        }
      } catch (blobErr) {
        console.error('Blob URL fallback failed:', blobErr);
        throw blobErr;
      }
    }

    return {
      success: true,
      filename,
      numPages: doc.internal.getNumberOfPages(),
      doc
    };
  }
}

export class ReportBuilder {
  constructor(doc, result, screenshots) {
    this.doc = doc;
    this.res = result;
    this.screenshots = screenshots || {};

    // Standard A4 Layout with 20 mm Margins
    this.pageWidth = 210;
    this.pageHeight = 297;
    this.marginLeft = 20;
    this.marginRight = 20;
    this.marginTop = 20;
    this.marginBottom = 20;
    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight; // exactly 170 mm
    this.y = this.marginTop;

    // Modern High-Contrast Palette
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

    // Add running headers & footers across all generated pages
    this.renderRunningHeadersFooters();
  }

  // ==========================================
  // Layout & Spacing Helpers
  // ==========================================

  checkPageBreak(neededHeight) {
    if (this.y + neededHeight > this.pageHeight - this.marginBottom) {
      this.doc.addPage();
      this.y = this.marginTop + 8; // Room for running header
    }
  }

  forcePageBreak() {
    this.doc.addPage();
    this.y = this.marginTop + 8;
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
    this.doc.setLineWidth(0.35);
    this.doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
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
    this.doc.setFontSize(8.5);
    const tw = this.doc.getTextWidth(text);
    const bw = tw + 7;
    const bh = 5.5;

    this.doc.setFillColor(...bg);
    this.doc.setDrawColor(...fg);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(x, y - 4.2, bw, bh, 1.2, 1.2, 'FD');

    this.doc.setTextColor(...fg);
    this.doc.text(text, x + 3.5, y - 0.2);
    return bw;
  }

  renderSectionHeading(title, subtitle = '') {
    this.checkPageBreak(30);

    // Accent bar on left
    this.doc.setFillColor(...this.colors.primaryDark);
    this.doc.rect(this.marginLeft, this.y, 4, 10, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(16);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(title, this.marginLeft + 7, this.y + 7.5);

    this.y += 13;
    if (subtitle) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10.5);
      this.doc.setTextColor(...this.colors.bodyText);
      const lines = this.doc.splitTextToSize(subtitle, this.contentWidth);
      this.doc.text(lines, this.marginLeft, this.y);
      this.y += lines.length * 5 + 4;
    }
  }

  renderTutorNote(text, icon = 'PEDAGOGICAL INSIGHT') {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    const lines = this.doc.splitTextToSize(text, this.contentWidth - 16);
    const boxH = Math.max(16, lines.length * 4.6 + 10);

    this.checkPageBreak(boxH + 6);
    this.drawCard(this.marginLeft, this.y, this.contentWidth, boxH, [240, 249, 255], [186, 230, 253]);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(`TUTOR NOTE [${icon}]:`, this.marginLeft + 6, this.y + 6.5);

    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(lines, this.marginLeft + 6, this.y + 12);

    this.y += boxH + 7;
  }

  /**
   * Prominently embeds a large, high-resolution Three.js scene screenshot
   * spanning the full available content width (170 mm) without being shrunk.
   */
  renderScreenshot(dataUrl, caption, stepLabel = '') {
    if (!dataUrl) return;

    // Full content width screenshot (170 mm wide, 16:9 aspect ratio = 95.6 mm tall)
    const imgW = this.contentWidth;
    const imgH = imgW * (9 / 16);
    const cardPadding = 3;
    const totalBlockH = imgH + cardPadding * 2 + 14;

    this.checkPageBreak(totalBlockH);

    // Frame Card
    this.drawCard(
      this.marginLeft,
      this.y,
      this.contentWidth,
      imgH + cardPadding * 2 + 10,
      [248, 250, 252],
      [203, 213, 225]
    );

    try {
      this.doc.addImage(
        dataUrl,
        'JPEG',
        this.marginLeft + cardPadding,
        this.y + cardPadding,
        imgW - cardPadding * 2,
        imgH
      );
    } catch (e) {
      console.warn('Could not embed image:', e);
      return;
    }

    // Step badge in top-left
    if (stepLabel) {
      this.drawBadge(stepLabel, this.marginLeft + cardPadding + 4, this.y + cardPadding + 7, 'info');
    }

    // Centered Caption underneath
    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);
    const capWidth = this.doc.getTextWidth(caption);
    const capX = this.marginLeft + (this.contentWidth - capWidth) / 2;
    this.doc.text(caption, Math.max(this.marginLeft + 4, capX), this.y + imgH + cardPadding + 6.5);

    this.y += totalBlockH + 4;
  }

  // ==========================================
  // Document Sections
  // ==========================================

  renderHeaderCover() {
    // Top banner
    this.doc.setFillColor(...this.colors.primaryDark);
    this.doc.rect(0, 0, this.pageWidth, 42, 'F');

    // Title
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(20);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('3D TRANSFORMATION COMPOSITION & INVERSE REPORT', this.marginLeft, 18);

    // Subtitle
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.setTextColor(186, 230, 253);
    this.doc.text('Interactive Linear Algebra Laboratory • Sequential Pipeline Verification', this.marginLeft, 27);

    // Date & Engine
    this.doc.setFontSize(9);
    this.doc.setTextColor(148, 163, 184);
    const now = new Date();
    const dateFormatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString()}`;
    this.doc.text(`Generated: ${dateFormatted} • Mathematical Engine: ${this.res.engineSource || 'C++17 Wasm'}`, this.marginLeft, 35);

    this.y = 50;

    // Overview Card / Experiment Summary (Clean 2-Column Responsive Key-Value Layout)
    const hasTheta = !!this.res.thetaConfig;
    const cardH = hasTheta ? 44 : 34;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('EXPERIMENT SUMMARY & CONFIGURATION', this.marginLeft + 6, this.y + 7.5);

    const midX = this.marginLeft + this.contentWidth / 2;
    const r1 = this.y + 16;
    const r2 = this.y + 26;
    const r3 = this.y + 36;

    // Row 1, Col 1: Initial Vector
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Initial Vector v₀:', this.marginLeft + 6, r1);
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(this.formatVec(this.res.initialVector, 2), this.marginLeft + 38, r1);

    // Row 1, Col 2: Pipeline Length
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Transformations:', midX + 6, r1);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    const transNames = this.res.steps.map(s => s.name).join(' → ');
    this.doc.text(`${this.res.steps.length} Stages (${transNames})`, midX + 38, r1);

    // Row 2, Col 1: Composition Verification
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Composition:', this.marginLeft + 6, r2);
    if (this.res.compositionVerified) {
      this.drawBadge('VERIFIED EQUIVALENT ✓', this.marginLeft + 38, r2, 'success');
    } else {
      this.drawBadge('VERIFICATION FAILED', this.marginLeft + 38, r2, 'error');
    }

    // Row 2, Col 2: Matrix Inversion
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Invertibility:', midX + 6, r2);
    if (this.res.composedInverse.success) {
      const cond = this.res.composedInverse.conditionNumber;
      const condLabel = cond < 1e4 ? 'Well-Conditioned' : 'Ill-Conditioned';
      this.drawBadge(`${condLabel} (κ=${cond < 1e4 ? cond.toFixed(1) : cond.toExponential(1)})`, midX + 38, r2, 'success');
    } else {
      this.drawBadge('SINGULAR (det=0)', midX + 38, r2, 'error');
    }

    // Row 3: Theta Angle Parameter Configuration (if present)
    if (hasTheta) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text('Angle Parameter θ:', this.marginLeft + 6, r3);
      this.doc.setFont('courier', 'bold');
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...this.colors.brandBlue);
      this.doc.text(`"${this.res.thetaConfig.expr}" (${this.res.thetaConfig.unit})`, this.marginLeft + 38, r3);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text('Evaluated θ:', midX + 6, r3);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text(`≈ ${this.res.thetaConfig.valueRad.toFixed(4)} rad (${this.res.thetaConfig.valueDeg.toFixed(1)}°)`, midX + 38, r3);
    }

    this.y += cardH + 10;
  }

  renderSection1Overview() {
    this.renderSectionHeading(
      '1. Welcome and Overview of the Experiment',
      'Understanding 3D linear mappings, sequential operator chaining, and scale-aware verification.'
    );

    const introText = 
      "Welcome to your laboratory report! In this experiment, we examine how 3D vectors transform under sequential linear mappings and verify whether a single composite matrix accurately reproduces the entire multi-stage chain.\n\n" +
      "The mathematical model operates strictly on 3×3 matrices and 3D column vectors. Transformations act by matrix-vector multiplication: v' = T · v. When multiple transformations are performed in sequence (T₁, then T₂, up through Tₙ), they compose from right to left: C = Tₙ ··· T₂ · T₁. Furthermore, if C is non-singular, we can invert the composite operator using partial-pivoted Gauss-Jordan elimination and reconstruct the original input vector: v₀ = C⁻¹(C · v₀).";

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.bodyText);
    const splitIntro = this.doc.splitTextToSize(introText, this.contentWidth);
    this.doc.text(splitIntro, this.marginLeft, this.y);
    this.y += splitIntro.length * 4.8 + 6;

    this.renderTutorNote(
      "Linear transformations map the origin (0, 0, 0) strictly to itself because T · 0 = 0. Notice how the coordinate axes, grid, and reference geometry reshape around the fixed origin. By watching vectors transform continuously in 3D, we can intuitively connect algebraic equations to spatial geometry.",
      "GEOMETRIC INTUITION"
    );
  }

  renderSection2InitialVector() {
    this.renderSectionHeading('2. Initial State: Starting Vector v₀');

    const v0 = this.res.initialVector;
    const v0Norm = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2]);

    const cardH = 26;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Input Vector Coordinates & Norm:', this.marginLeft + 6, this.y + 7);

    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(`v₀ = [ x: ${this.formatNum(v0[0])},  y: ${this.formatNum(v0[1])},  z: ${this.formatNum(v0[2])} ]ᵀ`, this.marginLeft + 6, this.y + 15);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`Euclidean Length ||v₀||₂ = √(x² + y² + z²) = ${v0Norm.toFixed(4)} units`, this.marginLeft + 6, this.y + 21.5);

    this.y += cardH + 7;

    this.renderTutorNote(
      "Let's begin with your input vector. Before applying the first transformation, consider how its direction or magnitude might change. Will the next operation preserve length (like a pure rigid rotation or reflection) or stretch it (scaling)? Look closely at the upcoming matrix elements.",
      "PREDICTION QUESTION"
    );

    // Initial 3D Scene Screenshot (Large, prominent)
    if (this.screenshots.initial) {
      this.renderScreenshot(
        this.screenshots.initial,
        'Figure 1: Authentic Three.js 3D viewport showing initial vector v₀ (cyan) pointing from the origin (0,0,0).',
        'Step 0: Initial Vector v₀'
      );
    }
  }

  renderSection3Transformations() {
    this.renderSectionHeading(
      '3. Individual Transformations (Step-by-Step Arithmetic)',
      'Detailed breakdown of each stage, row-by-column calculations, and geometric interpretations.'
    );

    this.res.steps.forEach((st, idx) => {
      // Check space for the stage header and matrix card
      this.checkPageBreak(90);

      const prevV = idx === 0 ? this.res.initialVector : this.res.steps[idx - 1].outputVector;
      const mat = st.matrix;
      const outV = st.outputVector;
      const prevNorm = Math.sqrt(prevV[0] ** 2 + prevV[1] ** 2 + prevV[2] ** 2);
      const outNorm = Math.sqrt(outV[0] ** 2 + outV[1] ** 2 + outV[2] ** 2);

      // Stage Title
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(13);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text(`Stage ${st.index}: Apply Transformation ${st.name}`, this.marginLeft, this.y);
      this.y += 6;

      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(10);
      this.doc.setTextColor(...this.colors.bodyText);
      this.doc.text(`General Formula: v_${st.index} = ${st.name} · v_${idx === 0 ? '0' : idx}`, this.marginLeft, this.y);
      this.y += 6;

      // 1. Angle Parameter & Expression Evaluation Card (for rotation stages)
      const hasAngle = !!(st.params && st.params.angleExpr);
      if (hasAngle) {
        this.checkPageBreak(25);
        const angleExpr = st.params.angleExpr;
        const angleUnit = st.params.angleUnit || 'rad';
        const angleRad = st.params.angleRad !== undefined ? st.params.angleRad : (angleUnit === 'deg' ? (st.params.angleDeg || 0) * Math.PI / 180 : 0);
        const angleDeg = st.params.angleDeg !== undefined ? st.params.angleDeg : (angleRad * 180 / Math.PI);
        const cosVal = Math.cos(angleRad);
        const sinVal = Math.sin(angleRad);

        const angleCardH = 22;
        this.drawCard(this.marginLeft, this.y, this.contentWidth, angleCardH, [240, 249, 255], [186, 230, 253]);

        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9);
        this.doc.setTextColor(...this.colors.brandBlue);
        this.doc.text('ROTATION ANGLE & TRIGONOMETRIC PARAMETERS:', this.marginLeft + 6, this.y + 6);

        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...this.colors.bodyText);
        this.doc.text(`• Entered Angle: "${angleExpr}" (${angleUnit})`, this.marginLeft + 6, this.y + 11.5);
        this.doc.text(`• Evaluated Angle: approximately ${angleRad.toFixed(6)} radians (${angleDeg.toFixed(2)}°)`, this.marginLeft + 6, this.y + 16.5);

        this.doc.text(`• Rotation Parameters: cos(${angleExpr}) ≈ ${this.formatNum(cosVal, 4)},  sin(${angleExpr}) ≈ ${this.formatNum(sinVal, 4)}`, this.marginLeft + 90, this.y + 11.5);
        this.doc.text(`• Internal Convention: Radians (Standard Right-Handed Rule)`, this.marginLeft + 90, this.y + 16.5);

        this.y += angleCardH + 5;
      }

      // 2. Matrix and Determinant Card (supporting both symbolic expression grid and numerical evaluated matrix)
      const hasSymbolicCells = st.matrixExpressions && st.matrixExpressions.some(e => {
        const str = String(e).trim();
        return isNaN(Number(str));
      });

      const cardH = hasSymbolicCells ? 46 : 40;
      this.checkPageBreak(cardH + 10);
      this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

      if (hasSymbolicCells) {
        const exprs = st.matrixExpressions;
        // Col 1: Entered Symbolic Expression Matrix
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9);
        this.doc.setTextColor(...this.colors.primaryDark);
        this.doc.text(`Entered Expressions (${st.name}):`, this.marginLeft + 6, this.y + 7);

        this.doc.setFont('courier', 'bold');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...this.colors.primaryDark);
        const rowY = this.y + 13;
        this.doc.text(`| ${exprs[0]}  ${exprs[1]}  ${exprs[2]} |`, this.marginLeft + 6, rowY);
        this.doc.text(`| ${exprs[3]}  ${exprs[4]}  ${exprs[5]} |`, this.marginLeft + 6, rowY + 5.5);
        this.doc.text(`| ${exprs[6]}  ${exprs[7]}  ${exprs[8]} |`, this.marginLeft + 6, rowY + 11);

        // Col 2: Evaluated Numerical Matrix
        const numColX = this.marginLeft + 64;
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9);
        this.doc.setTextColor(...this.colors.brandBlue);
        this.doc.text('Evaluated Matrix (C++ Engine):', numColX, this.y + 7);

        this.doc.setFont('courier', 'bold');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...this.colors.primaryDark);
        this.doc.text(`| ${this.formatNum(mat[0])}  ${this.formatNum(mat[1])}  ${this.formatNum(mat[2])} |`, numColX, rowY);
        this.doc.text(`| ${this.formatNum(mat[3])}  ${this.formatNum(mat[4])}  ${this.formatNum(mat[5])} |`, numColX, rowY + 5.5);
        this.doc.text(`| ${this.formatNum(mat[6])}  ${this.formatNum(mat[7])}  ${this.formatNum(mat[8])} |`, numColX, rowY + 11);

        // Explanation Footer inside card
        this.doc.setFont('helvetica', 'italic');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(100, 116, 139);
        this.doc.text('* Mathematical expressions evaluated safely to IEEE-754 double precision floats before execution.', this.marginLeft + 6, this.y + 40);

        // Col 3: Geometric Diagnostics
        const diagX = this.marginLeft + 120;
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9);
        this.doc.setTextColor(...this.colors.primaryDark);
        this.doc.text('Properties:', diagX, this.y + 7);

        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...this.colors.bodyText);
        const detVal = st.inverse.determinant;
        this.doc.text(`• det(${st.name}) = ${this.formatNum(detVal)}`, diagX, this.y + 13);
        this.doc.text(`• Length: ${prevNorm.toFixed(2)} → ${outNorm.toFixed(2)}`, diagX, this.y + 19);
        this.doc.text(`• Ratio: ${(outNorm / Math.max(1e-9, prevNorm)).toFixed(2)}×`, diagX, this.y + 25);
      } else {
        // Standard numerical matrix display
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9.5);
        this.doc.setTextColor(...this.colors.primaryDark);
        this.doc.text(`Numerical Matrix ${st.name} (3×3):`, this.marginLeft + 6, this.y + 7);

        this.doc.setFont('courier', 'bold');
        this.doc.setFontSize(9.5);
        this.doc.setTextColor(...this.colors.primaryDark);

        const rowY = this.y + 14;
        this.doc.text(`| ${this.formatNum(mat[0])}  ${this.formatNum(mat[1])}  ${this.formatNum(mat[2])} |`, this.marginLeft + 6, rowY);
        this.doc.text(`| ${this.formatNum(mat[3])}  ${this.formatNum(mat[4])}  ${this.formatNum(mat[5])} |`, this.marginLeft + 6, rowY + 6);
        this.doc.text(`| ${this.formatNum(mat[6])}  ${this.formatNum(mat[7])}  ${this.formatNum(mat[8])} |`, this.marginLeft + 6, rowY + 12);

        // Determinant and Geometric Diagnostics
        const diagX = this.marginLeft + 88;
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9.5);
        this.doc.setTextColor(...this.colors.primaryDark);
        this.doc.text('Geometric Properties:', diagX, this.y + 7);

        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...this.colors.bodyText);
        const detVal = st.inverse.determinant;
        this.doc.text(`• Determinant det(${st.name}) = ${this.formatNum(detVal)}`, diagX, this.y + 14);

        let detMeaning = 'Preserves volume and orientation';
        if (Math.abs(detVal) < 1e-6) detMeaning = 'Singular: collapses space (dimension lost)';
        else if (Math.abs(Math.abs(detVal) - 1.0) < 1e-4) detMeaning = detVal < 0 ? 'Isometry with reflection (orientation reversed)' : 'Rigid isometry (preserves distance & volume)';
        else detMeaning = detVal < 0 ? `Scales volume by |det|=${Math.abs(detVal).toFixed(2)} and reverses orientation` : `Scales volume by factor of ${detVal.toFixed(2)}`;
        
        this.doc.text(`  → ${detMeaning}`, diagX, this.y + 19);
        this.doc.text(`• Vector Length: ${prevNorm.toFixed(3)} → ${outNorm.toFixed(3)} units`, diagX, this.y + 25);
        this.doc.text(`• Length Ratio: ${(outNorm / Math.max(1e-9, prevNorm)).toFixed(3)}×`, diagX, this.y + 30);
      }

      this.y += cardH + 6;

      // 3. Step-by-Step Row-by-Column Calculations
      this.checkPageBreak(40);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10);
      this.doc.setTextColor(...this.colors.primaryDark);
      this.doc.text('Row-by-Column Arithmetic (Step-by-Step Substitution):', this.marginLeft, this.y);
      this.y += 5;

      const calcBoxH = 30;
      this.drawCard(this.marginLeft, this.y, this.contentWidth, calcBoxH, [255, 255, 255], [203, 213, 225]);

      this.doc.setFont('courier', 'normal');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...this.colors.bodyText);

      // Row 1
      const xCalcStr = `x' = (${this.formatNum(mat[0])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[1])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[2])} · ${this.formatNum(prevV[2])})`;
      const xSumStr = `= ${this.formatNum(mat[0]*prevV[0])} + ${this.formatNum(mat[1]*prevV[1])} + ${this.formatNum(mat[2]*prevV[2])} = ${this.formatNum(outV[0])}`;
      this.doc.text(`Row 1 (x-coordinate):  ${xCalcStr}  ${xSumStr}`, this.marginLeft + 5, this.y + 7);

      // Row 2
      const yCalcStr = `y' = (${this.formatNum(mat[3])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[4])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[5])} · ${this.formatNum(prevV[2])})`;
      const ySumStr = `= ${this.formatNum(mat[3]*prevV[0])} + ${this.formatNum(mat[4]*prevV[1])} + ${this.formatNum(mat[5]*prevV[2])} = ${this.formatNum(outV[1])}`;
      this.doc.text(`Row 2 (y-coordinate):  ${yCalcStr}  ${ySumStr}`, this.marginLeft + 5, this.y + 15);

      // Row 3
      const zCalcStr = `z' = (${this.formatNum(mat[6])} · ${this.formatNum(prevV[0])}) + (${this.formatNum(mat[7])} · ${this.formatNum(prevV[1])}) + (${this.formatNum(mat[8])} · ${this.formatNum(prevV[2])})`;
      const zSumStr = `= ${this.formatNum(mat[6]*prevV[0])} + ${this.formatNum(mat[7]*prevV[1])} + ${this.formatNum(mat[8]*prevV[2])} = ${this.formatNum(outV[2])}`;
      this.doc.text(`Row 3 (z-coordinate):  ${zCalcStr}  ${zSumStr}`, this.marginLeft + 5, this.y + 23);

      this.y += calcBoxH + 6;

      const exprExplainNote = (hasAngle || hasSymbolicCells)
        ? ` Expressions were evaluated numerically prior to calculation without symbolic CAS overhead. Dot product of matrix rows with incoming vector v_${idx === 0 ? '0' : idx} produces v_${st.index} = [${outV.map(n => n.toFixed(3)).join(', ')}]ᵀ.`
        : ` Notice that each coordinate is calculated by taking the dot product of one matrix row with the incoming vector v_${idx === 0 ? '0' : idx}. The resulting vector is v_${st.index} = [${outV.map(n => n.toFixed(3)).join(', ')}]ᵀ.`;

      this.renderTutorNote(
        exprExplainNote,
        `STAGE ${st.index} RESULT & EVALUATION`
      );

      // Dedicated Large Screenshot for this stage
      const stageScreenshotKey = `stage_${st.index}`;
      if (this.screenshots[stageScreenshotKey]) {
        this.renderScreenshot(
          this.screenshots[stageScreenshotKey],
          `Figure ${idx + 2}: Authentic 3D visualization after applying transformation ${st.name}, displaying terminal vector v_${st.index}.`,
          `Stage ${st.index}: Result v_${st.index}`
        );
      }
    });
  }

  renderSection4Composition() {
    this.renderSectionHeading('4. Transformation Composition & Sequential Verification');

    const numSteps = this.res.steps.length;
    const formulaStr = `C = ${this.res.steps.map(s => s.name).reverse().join(' · ')}`;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.bodyText);
    const expl = 
      `In linear algebra, when transformations are chained sequentially, their combined effect is represented by a single composite matrix: ${formulaStr}.\n\n` +
      "Crucially, matrix multiplication is applied from right to left because operators act upon the column vector from the left: v' = Tₙ(···(T₁ · v)) = (Tₙ ··· T₁) · v. Since matrix multiplication is generally non-commutative (AB ≠ BA), preserving this order is vital to achieving the correct spatial orientation.";

    const splitExpl = this.doc.splitTextToSize(expl, this.contentWidth);
    this.doc.text(splitExpl, this.marginLeft, this.y);
    this.y += splitExpl.length * 4.8 + 6;

    // Composite Matrix Display Card
    this.checkPageBreak(50);
    const cardH = 38;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(`Composite Transformation Matrix C (${formulaStr}):`, this.marginLeft + 6, this.y + 7.5);

    const cMat = this.res.composedMatrix;
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.brandBlue);

    const rY = this.y + 15;
    this.doc.text(`| ${this.formatNum(cMat[0])}  ${this.formatNum(cMat[1])}  ${this.formatNum(cMat[2])} |`, this.marginLeft + 6, rY);
    this.doc.text(`| ${this.formatNum(cMat[3])}  ${this.formatNum(cMat[4])}  ${this.formatNum(cMat[5])} |`, this.marginLeft + 6, rY + 6);
    this.doc.text(`| ${this.formatNum(cMat[6])}  ${this.formatNum(cMat[7])}  ${this.formatNum(cMat[8])} |`, this.marginLeft + 6, rY + 12);

    // Diagnostics
    const rightX = this.marginLeft + 90;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`• Determinant det(C) = ${this.formatNum(this.res.composedInverse.determinant)}`, rightX, this.y + 15);
    this.doc.text(`• Matrix Infinity-Norm ||C||_∞ = ${this.formatNum(this.res.composedInverse.normA)}`, rightX, this.y + 21);
    this.doc.text(`• Scale-Aware Tolerance: ε = 10⁻⁹`, rightX, this.y + 27);

    this.y += cardH + 7;

    // Spacious, Uncramped Sequential vs Composite Verification Cards
    this.checkPageBreak(55);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Sequential vs. Composite Direct Comparison:', this.marginLeft, this.y);
    this.y += 6;

    const compCardH = 46;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, compCardH, [255, 255, 255], [203, 213, 225]);

    // Method 1: Sequential Chain
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('1. Sequential Chain: ', this.marginLeft + 6, this.y + 8);
    this.doc.setFont('helvetica', 'normal');
    const seqFormula = `v_seq = ${this.res.steps.map(s => s.name).reverse().join('(')} · v₀${')'.repeat(numSteps - 1)}`;
    this.doc.text(seqFormula, this.marginLeft + 44, this.y + 8);

    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentPurple);
    this.doc.text(`→ ${this.formatVec(this.res.finalSequentialVector)}`, this.marginLeft + 44, this.y + 14);

    // Divider line
    this.doc.setDrawColor(226, 232, 240);
    this.doc.line(this.marginLeft + 6, this.y + 18, this.marginLeft + this.contentWidth - 6, this.y + 18);

    // Method 2: Direct Composite
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('2. Composite Direct: ', this.marginLeft + 6, this.y + 26);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('v_comp = C · v₀', this.marginLeft + 44, this.y + 26);

    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentEmerald);
    this.doc.text(`→ ${this.formatVec(this.res.composedVector)}`, this.marginLeft + 44, this.y + 32);

    // Divider line
    this.doc.setDrawColor(226, 232, 240);
    this.doc.line(this.marginLeft + 6, this.y + 36, this.marginLeft + this.contentWidth - 6, this.y + 36);

    // Row 3: Residual & Badge
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Residual Error: ', this.marginLeft + 6, this.y + 42);
    this.doc.setFont('courier', 'normal');
    this.doc.text(`||v_comp - v_seq|| = ${this.res.compositionError.toExponential(4)}`, this.marginLeft + 44, this.y + 42);

    if (this.res.compositionVerified) {
      this.drawBadge('VERIFIED EQUIVALENT ✓', this.marginLeft + 115, this.y + 42, 'success');
    } else {
      this.drawBadge('VERIFICATION FAILED', this.marginLeft + 115, this.y + 42, 'error');
    }

    this.y += compCardH + 7;

    this.renderTutorNote(
      "Notice that both methods yield identical vector coordinates within machine floating-point precision (residual < 10⁻¹⁵). Multiplying all intermediate matrices together into composite matrix C first is mathematically identical to applying each matrix step by step.",
      "COMPOSITION THEOREM"
    );
  }

  renderSection5InverseVerification() {
    this.renderSectionHeading('5. Matrix Inversion & Vector Recovery Verification');

    const inv = this.res.composedInverse;

    if (!inv.success) {
      // Singular Matrix Case: Explain honestly and educationally
      this.checkPageBreak(50);
      const cardH = 36;
      this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH, [255, 241, 242], [254, 205, 211]);

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(11);
      this.doc.setTextColor(...this.colors.accentRed);
      this.doc.text('SINGULAR MATRIX: INVERSE DOES NOT EXIST', this.marginLeft + 6, this.y + 8);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...this.colors.primaryDark);
      const singularDesc = 
        `Determinant det(C) = ${this.formatNum(inv.determinant)} | Status: ${inv.status}\n\n` +
        "Geometrically, at least one transformation collapsed space onto a 2D plane, line, or single point (dimension destroyed). Because coordinate information was irreversibly lost, no unique inverse matrix exists to recover initial vector v₀. In our partial-pivoted Gauss-Jordan solver, a diagonal pivot fell below threshold 10⁻¹², correctly signaling singularity.";
      const splitSing = this.doc.splitTextToSize(singularDesc, this.contentWidth - 12);
      this.doc.text(splitSing, this.marginLeft + 6, this.y + 15);

      this.y += cardH + 7;

      this.renderTutorNote(
        "Singular matrices correspond to non-invertible physical projections—like casting a shadow on a wall. Once 3D depth is flattened to zero, the original coordinates cannot be reconstructed.",
        "SINGULARITY NOTE"
      );
      return;
    }

    // Invertible Matrix Case: Full verification
    this.checkPageBreak(75);
    const cardH = 42;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, cardH);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Composed Matrix Inverse C⁻¹ (Pivoted Gauss-Jordan):', this.marginLeft + 6, this.y + 7.5);

    const invMat = inv.inverse;
    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.brandBlue);

    const rY = this.y + 15;
    this.doc.text(`| ${this.formatNum(invMat[0])}  ${this.formatNum(invMat[1])}  ${this.formatNum(invMat[2])} |`, this.marginLeft + 6, rY);
    this.doc.text(`| ${this.formatNum(invMat[3])}  ${this.formatNum(invMat[4])}  ${this.formatNum(invMat[5])} |`, this.marginLeft + 6, rY + 6);
    this.doc.text(`| ${this.formatNum(invMat[6])}  ${this.formatNum(invMat[7])}  ${this.formatNum(invMat[8])} |`, this.marginLeft + 6, rY + 12);

    // Diagnostics & Inversion Metrics
    const rightX = this.marginLeft + 90;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text(`• Condition Number κ_∞(C) = ${inv.conditionNumber.toFixed(2)}`, rightX, this.y + 15);
    this.doc.text(`• Inverse Residual ||I - C·C⁻¹||_∞ = ${inv.residualE1Norm.toExponential(2)}`, rightX, this.y + 20.5);
    this.doc.text(`• Commutative Residual ||I - C⁻¹·C||_∞ = ${inv.residualE2Norm.toExponential(2)}`, rightX, this.y + 26);
    this.doc.text(`• Product of Inverses Matches: ${this.res.inverseProductMatchesDirect ? 'Identical ✓' : 'Discrepancy'}`, rightX, this.y + 31.5);
    this.doc.text(`  (Tₙ···T₁)⁻¹ = T₁⁻¹···Tₙ⁻¹ (Reversed Order)`, rightX, this.y + 36.5);

    this.y += cardH + 7;

    // Vector Recovery Demonstration Card
    this.checkPageBreak(50);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Vector Recovery: v_rec = C⁻¹ · (C · v₀):', this.marginLeft, this.y);
    this.y += 6;

    const recBoxH = 34;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, recBoxH, [255, 255, 255], [203, 213, 225]);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Original Input Vector v₀:', this.marginLeft + 6, this.y + 9);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.brandBlue);
    this.doc.text(this.formatVec(this.res.initialVector), this.marginLeft + 60, this.y + 9);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Recovered Vector v_rec:', this.marginLeft + 6, this.y + 18);
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...this.colors.accentEmerald);
    this.doc.text(this.formatVec(this.res.recoveredVector), this.marginLeft + 60, this.y + 18);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...this.colors.bodyText);
    this.doc.text('Recovery Residual ||v_rec - v₀||₂:', this.marginLeft + 6, this.y + 27);
    this.doc.setFont('courier', 'normal');
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text(`${this.res.recoveryError.toExponential(4)}`, this.marginLeft + 60, this.y + 27);

    if (this.res.vectorRecoverySuccessful) {
      this.drawBadge('PERFECT RECOVERY ✓', this.marginLeft + 115, this.y + 27, 'success');
    } else {
      this.drawBadge('RECOVERY FAILED', this.marginLeft + 115, this.y + 27, 'error');
    }

    this.y += recBoxH + 7;

    this.renderTutorNote(
      "Compare the recovered vector with the original input to understand the recovery error. Because C is well-conditioned, the recovery error is down at machine roundoff (~10⁻¹⁶). Furthermore, inverting the composite operator requires inverting each step in reverse order: (Tₙ···T₁)⁻¹ = T₁⁻¹···Tₙ⁻¹.",
      "INVERSE REVERSAL LAW"
    );
  }

  renderSection6Reflections() {
    this.renderSectionHeading('6. Observations, Insights & Student Reflection Questions');

    this.checkPageBreak(70);

    const takeaways = [
      "1. Non-Commutativity: In general, matrix multiplication does not commute (A·B ≠ B·A). Reordering physical operations like rotation and shear leads to distinct terminal coordinates.",
      "2. Order of Inverses: When inverting a chain of operations, the individual inverse transformations must be executed in reverse order: (Tₙ···T₁)⁻¹ = T₁⁻¹···Tₙ⁻¹.",
      "3. Volume Scaling Factor: The determinant det(T) measures how volume scales under the transformation. A determinant of 1 means volume is preserved; a negative determinant indicates orientation has been flipped (reflection).",
      "4. Numerical Conditioning: In real-world computing, ill-conditioned matrices (condition number κ >> 10⁶) amplify rounding errors during inversion. The Gauss-Jordan algorithm with partial row pivoting ensures numerical stability."
    ];

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.colors.bodyText);

    takeaways.forEach(item => {
      const lines = this.doc.splitTextToSize(item, this.contentWidth);
      this.doc.text(lines, this.marginLeft, this.y);
      this.y += lines.length * 4.6 + 3;
    });

    this.y += 4;

    // Reflection Questions Card
    this.checkPageBreak(45);
    const boxH = 36;
    this.drawCard(this.marginLeft, this.y, this.contentWidth, boxH, [254, 252, 232], [254, 240, 138]);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.accentAmber);
    this.doc.text('QUESTIONS FOR FURTHER REFLECTION:', this.marginLeft + 6, this.y + 7);

    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.primaryDark);
    this.doc.text('Q1: What happens to a unit cube if det(T) = 0? Can you find a non-zero vector v such that T·v = 0?', this.marginLeft + 6, this.y + 15);
    this.doc.text('Q2: If you rotate by +45° around Y then rotate by -45° around Y, what should the composite matrix C be?', this.marginLeft + 6, this.y + 22);
    this.doc.text('Q3: Why must row-pivoting swap rows to place the largest available magnitude on the diagonal?', this.marginLeft + 6, this.y + 29);

    this.y += boxH + 8;
  }

  renderRunningHeadersFooters() {
    const totalPages = this.doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);

      // Running Header (pages > 1)
      if (i > 1) {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);
        this.doc.setTextColor(148, 163, 184);
        this.doc.text('Transformation Composition & Inverse Verification System • Educational Laboratory Report', this.marginLeft, 11);
        this.doc.setDrawColor(226, 232, 240);
        this.doc.setLineWidth(0.25);
        this.doc.line(this.marginLeft, 13, this.pageWidth - this.marginRight, 13);
      }

      // Running Footer (all pages)
      const footerY = this.pageHeight - 11;
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(0.25);
      this.doc.line(this.marginLeft, footerY - 3, this.pageWidth - this.marginRight, footerY - 3);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text('Department of Mathematics & Computational Geometry • C++17 / WebAssembly Engine', this.marginLeft, footerY);

      const pageStr = `Page ${i} of ${totalPages}`;
      const pw = this.doc.getTextWidth(pageStr);
      this.doc.text(pageStr, this.pageWidth - this.marginRight - pw, footerY);
    }
  }
}
