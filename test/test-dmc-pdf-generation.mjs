import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Test generating a real A4 PDF of the DMC using Electron's printToPDF
app.whenReady().then(async () => {
  console.log('=== Testing Real A4 PDF Generation for DMC ===\n');

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const cssPath = path.resolve('src/styles/dmc.css');
  const dmcCss = fs.readFileSync(cssPath, 'utf-8');

  // Sample DMC HTML matching DMCReportCard structure with updated white table & removed Code column
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${dmcCss}
    @page { size: A4 portrait !important; margin: 8mm !important; }
  </style>
</head>
<body class="printing-dmc">
  <div class="dmc-document" id="dmc-1">
    <div class="dmc-inner-frame">
      <!-- 1. Header -->
      <div class="dmc-header">
        <div class="dmc-header-left dmc-logo-fallback">
          <div style="width: 68px; height: 68px; border: 2px solid #0f2942; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0f2942; font-size: 20px;">
            MS
          </div>
        </div>
        <div class="dmc-header-center">
          <h1 class="dmc-school-title">MS Institute of Modern Sciences</h1>
          <div class="dmc-school-tagline">Excellence in Offline Institutional Management</div>
          <div class="dmc-school-address">Sector H-8/4, Educational Enclave, Islamabad, Pakistan</div>
          <div class="dmc-school-contact">
            <span>Tel: +92 51 9876543</span> • <span>Email: info@msinstitute.edu.pk</span> • <span>School Code: MSIMS-01</span>
          </div>
          <div class="dmc-title-badge-wrap">
            <span class="dmc-title-badge">Detailed Marks Certificate</span>
          </div>
          <div class="dmc-exam-subtitle">Annual Examination 2026 • Academic Session: 2025-2026</div>
        </div>
        <div class="dmc-header-right">
          <div class="dmc-photo-box">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 9px; color: #94a3b8; text-align: center; font-weight: 700;">
              PHOTO<br/>ON FILE
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Student Info Card -->
      <div class="dmc-student-card">
        <div class="dmc-student-grid">
          <div class="dmc-meta-item"><span class="dmc-meta-label">Student Name</span><span class="dmc-meta-value highlight">Muhammad Saad Khan</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Father's Name</span><span class="dmc-meta-value">Tariq Mehmood Khan</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Student Unique ID</span><span class="dmc-meta-value mono">STD-2026-0042</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Admission No.</span><span class="dmc-meta-value mono">ADM-8821</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Class</span><span class="dmc-meta-value">Class 10</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Section</span><span class="dmc-meta-value">Section Alpha</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Roll Number</span><span class="dmc-meta-value">101</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Academic Session</span><span class="dmc-meta-value">2025-2026</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Examination</span><span class="dmc-meta-value">Annual Examination 2026</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Position in Class</span><span class="dmc-meta-value">1st of 45</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Date of Birth</span><span class="dmc-meta-value">15/05/2010</span></div>
          <div class="dmc-meta-item"><span class="dmc-meta-label">Date of Issue</span><span class="dmc-meta-value">29/10/2026</span></div>
        </div>
      </div>

      <!-- 3. Marks Table (Pure White Background, No Code column, Aligned Total) -->
      <div class="dmc-table-wrap">
        <table class="dmc-marks-table">
          <thead>
            <tr>
              <th class="dmc-col-sno">S.#</th>
              <th class="dmc-col-name" style="text-align: left;">Subject Title</th>
              <th class="dmc-col-max">Max Marks</th>
              <th class="dmc-col-pass">Passing</th>
              <th class="dmc-col-obt">Obtained</th>
              <th class="dmc-col-pct">Percentage</th>
              <th class="dmc-col-grade">Grade</th>
              <th class="dmc-col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="dmc-col-sno">1</td>
              <td class="dmc-col-name">English Language &amp; Literature</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">88</td>
              <td class="dmc-col-pct">88.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">2</td>
              <td class="dmc-col-name">Mathematics (Pure &amp; Applied)</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">96</td>
              <td class="dmc-col-pct">96.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">3</td>
              <td class="dmc-col-name">Physics (Theory &amp; Practical)</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">92</td>
              <td class="dmc-col-pct">92.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">4</td>
              <td class="dmc-col-name">Chemistry (Theory &amp; Lab Experiment)</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">90</td>
              <td class="dmc-col-pct">90.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">5</td>
              <td class="dmc-col-name">Biology &amp; Life Sciences</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">94</td>
              <td class="dmc-col-pct">94.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">6</td>
              <td class="dmc-col-name">Computer Science &amp; Information Tech</td>
              <td class="dmc-col-max">100</td>
              <td class="dmc-col-pass">33</td>
              <td class="dmc-col-obt">98</td>
              <td class="dmc-col-pct">98.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">7</td>
              <td class="dmc-col-name">Pakistan Studies (History &amp; Geo)</td>
              <td class="dmc-col-max">50</td>
              <td class="dmc-col-pass">17</td>
              <td class="dmc-col-obt">46</td>
              <td class="dmc-col-pct">92.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
            <tr>
              <td class="dmc-col-sno">8</td>
              <td class="dmc-col-name">Islamiat / Religious Education</td>
              <td class="dmc-col-max">50</td>
              <td class="dmc-col-pass">17</td>
              <td class="dmc-col-obt">47</td>
              <td class="dmc-col-pct">94.0%</td>
              <td class="dmc-col-grade">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="dmc-grand-total-label">Grand Total:</td>
              <td class="dmc-col-max" style="font-weight: 800;">700</td>
              <td class="dmc-col-pass">—</td>
              <td class="dmc-grand-total-val">651</td>
              <td class="dmc-col-pct" style="font-weight: 800; color: #0f2942;">93.00%</td>
              <td class="dmc-col-grade" style="font-weight: 900;">A+</td>
              <td class="dmc-col-status"><span class="dmc-status-badge dmc-status-pass">PASS</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- 4. Performance Summary Strip -->
      <div class="dmc-summary-card">
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Marks Obtained</div>
          <div class="dmc-summary-val">651 <span style="font-size: 11px; color: #64748b;">/ 700</span></div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Percentage</div>
          <div class="dmc-summary-val">93.00%</div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Overall Grade</div>
          <div class="dmc-summary-val">A+</div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Grade Point (GPA)</div>
          <div class="dmc-summary-val">4.0</div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Final Result</div>
          <div class="dmc-summary-val result-pass">PASSED</div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Position in Class</div>
          <div class="dmc-summary-val">1st of 45</div>
        </div>
        <div class="dmc-summary-col">
          <div class="dmc-summary-label">Remarks</div>
          <div class="dmc-summary-val remarks">Exceptional Academic Performance</div>
        </div>
      </div>

      <!-- 5. Grading Scale Strip -->
      <div class="dmc-scale-strip">
        <strong>Grading Scale:</strong>
        <strong>A+</strong> (80% - 100%) • <strong>A</strong> (70% - 79%) • <strong>B</strong> (60% - 69%) • <strong>C</strong> (50% - 59%) • <strong>D</strong> (40% - 49%) • <strong>F</strong> (Below 40% / Fail)
      </div>

      <!-- 6. Footer Signatures & Official Stamp -->
      <div class="dmc-footer-section">
        <div class="dmc-signatures-grid">
          <div class="dmc-sig-col">
            <div class="dmc-sig-line"></div>
            <div class="dmc-sig-name">Class Teacher</div>
            <div class="dmc-sig-role">Prepared &amp; Verified By</div>
          </div>
          <div class="dmc-sig-col">
            <div class="dmc-stamp-box">
              <span>Official</span>
              <span>School Seal</span>
            </div>
            <div class="dmc-sig-role">Institutional Seal</div>
          </div>
          <div class="dmc-sig-col">
            <div class="dmc-sig-line"></div>
            <div class="dmc-sig-name">Prof. Muhammad Saeed</div>
            <div class="dmc-sig-role">Head of Institution</div>
          </div>
        </div>
        <div class="dmc-footer-note">
          This is an official computer-generated Detailed Marks Certificate issued by MS Institute of Modern Sciences.
          Any alteration, erasure, or unauthorized tampering renders this document invalid.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const tempHtmlPath = path.join(os.tmpdir(), 'dmc_sample_preview.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  await win.loadFile(tempHtmlPath);

  // Generate PDF via Electron's printToPDF
  const pdfBuffer = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
  });

  const outPdfPath = path.join(os.tmpdir(), 'Generated_Sample_DMC.pdf');
  fs.writeFileSync(outPdfPath, pdfBuffer);

  console.log(`✓ Sample DMC PDF generated at: ${outPdfPath}`);
  console.log(`✓ PDF file size: ${pdfBuffer.length} bytes`);

  // Count pages in PDF (simple regex check for /Type /Page in PDF structure)
  const pdfString = pdfBuffer.toString('binary');
  const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g) || [];
  console.log(`✓ Total Pages in Generated PDF: ${pageMatches.length}`);

  if (pageMatches.length === 1) {
    console.log('✓ SUCCESS: Updated DMC fits cleanly onto exactly ONE A4 page!');
  } else {
    console.warn(`! Note: PDF has ${pageMatches.length} pages. Checking margins/dimensions.`);
  }

  // Verify non-empty and valid PDF header %PDF-
  if (pdfBuffer.subarray(0, 5).toString('utf-8') === '%PDF-') {
    console.log('✓ Generated file is a valid PDF document (%PDF- magic header verified)');
  }

  try {
    fs.unlinkSync(tempHtmlPath);
  } catch {}

  app.quit();
});
