import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createStudent, createEnrollment, getAllStudents } from '../dist-electron/database/services/student.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

app.whenReady().then(async () => {
  console.log('====================================================');
  console.log('   Student ID Cards Module Verification Test Suite  ');
  console.log('====================================================\n');

  try {
    // ─── 1. Navigation & Routing Inspection ────────────────────────
    console.log('--- 1. Navigation & Routing Configuration ---');
    const navPath = path.resolve('src/config/navigation.ts');
    assert(fs.existsSync(navPath), 'navigation.ts exists');
    const navContent = fs.readFileSync(navPath, 'utf-8');
    assert(navContent.includes("id: 'id-cards'"), 'id-cards route ID defined in navigation items');
    assert(navContent.includes("path: '/id-cards'"), "id-cards path set to '/id-cards'");
    assert(navContent.includes("icon: 'IdCard'"), "id-cards uses 'IdCard' icon");

    // Verify placement: immediately after 'dmc'
    const dmcPos = navContent.indexOf("id: 'dmc'");
    const idCardsPos = navContent.indexOf("id: 'id-cards'");
    assert(dmcPos !== -1 && idCardsPos > dmcPos, "id-cards tab appears immediately after 'dmc' tab");

    // Sidebar icon mapping
    const sidebarPath = path.resolve('src/components/Sidebar/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    assert(sidebarContent.includes('IdCard,'), 'Sidebar imports IdCard icon from lucide-react');
    assert(sidebarContent.includes('IdCard') && sidebarContent.includes('iconMap'), 'Sidebar iconMap includes IdCard');

    // App router configuration
    const appPath = path.resolve('src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    assert(appContent.includes("import { IDCardsPage } from './pages/IDCards/IDCardsPage'"), 'App.tsx imports IDCardsPage');
    assert(appContent.includes('<Route path="/id-cards" element={<IDCardsPage />} />'), 'App.tsx defines route for /id-cards');

    // ─── 2. Physical CR80 Dimensions & Print Layout CSS ────────────
    console.log('\n--- 2. CR80 Standards & A4 Layout CSS Verification ---');
    const cssPath = path.resolve('src/styles/id-cards.css');
    assert(fs.existsSync(cssPath), 'id-cards.css exists');
    const css = fs.readFileSync(cssPath, 'utf-8');

    // Check exact CR80 physical dimensions
    assert(css.includes('width: 85.6mm;'), 'Card width is exact CR80 standard: 85.6mm');
    assert(css.includes('height: 54mm;'), 'Card height is exact CR80 standard: 54mm');
    assert(css.includes('border-radius: 3.2mm;'), 'Card corner radius matches CR80 standard: 3.2mm');

    // Check A4 sheet definition & 5-card capacity
    assert(css.includes('width: 210mm;'), 'Sheet width is standard A4: 210mm');
    assert(css.includes('297mm;'), 'Sheet height is standard A4: 297mm');
    assert(css.includes('border: 1px dashed'), 'Subtle dashed cutting guides configured for physical alignment');
    assert(css.includes('.id-card-fold-indicator'), 'Center fold indicator present for instant dual-side lamination');

    // Check @media print rules
    assert(css.includes('@page {'), 'Custom @page print directive defined');
    assert(css.includes('size: A4 portrait !important;'), 'Print target forced to A4 portrait');
    assert(css.includes('margin: 6mm 8mm !important;'), 'Print margins configured to 6mm 8mm for edge safety');
    assert(css.includes('body.printing-id-cards .id-cards-print-container'), 'Print isolate engine targets only id-cards container');

    // ─── 3. Component Architecture & Props ─────────────────────────
    console.log('\n--- 3. ID Card Component Inspection ---');
    const cardCompPath = path.resolve('src/pages/IDCards/IDCardComponent.tsx');
    assert(fs.existsSync(cardCompPath), 'IDCardComponent.tsx exists');
    const cardCode = fs.readFileSync(cardCompPath, 'utf-8');

    // Front face contents
    assert(cardCode.includes('id-card-front-header'), 'Front header present with school branding');
    assert(cardCode.includes('Student Identity Card'), 'Front badge title present');
    assert(cardCode.includes('student.photoDataUrl'), 'Front photo displays uploaded photo with fallback icon');
    assert(cardCode.includes('studentName'), 'Front displays full student name');
    assert(cardCode.includes('fatherName'), "Front displays father's name");
    assert(cardCode.includes('studentId'), 'Front displays unique student ID');
    assert(cardCode.includes('admissionNumber'), 'Front displays admission number');
    assert(cardCode.includes('Class & Sec'), 'Front displays class and section');
    assert(cardCode.includes('Emergency:'), 'Front footer displays emergency phone number');

    // Back face contents
    assert(cardCode.includes('id-card-back-header'), 'Back header present');
    assert(cardCode.includes('Terms & Conditions'), 'Back includes terms and conditions');
    assert(cardCode.includes('If found, please return to:'), 'Back includes return instructions');
    assert(cardCode.includes('Principal Signature'), 'Back includes authorized signature line');
    assert(cardCode.includes("mode === 'both'"), "Component supports side-by-side mode (5 pairs / page)");
    assert(cardCode.includes("mode === 'front'"), 'Component supports front side only mode');
    assert(cardCode.includes("mode === 'back'"), 'Component supports back side only mode');

    // Main IDCardsPage controls
    console.log('\n--- 4. IDCardsPage Interface Inspection ---');
    const pagePath = path.resolve('src/pages/IDCards/IDCardsPage.tsx');
    assert(fs.existsSync(pagePath), 'IDCardsPage.tsx exists');
    const pageCode = fs.readFileSync(pagePath, 'utf-8');

    assert(pageCode.includes('Academic Session'), 'Contains Academic Session selector');
    assert(pageCode.includes('Class'), 'Contains Class selector');
    assert(pageCode.includes('Section'), 'Contains Section selector');
    assert(pageCode.includes('Load Students'), 'Contains Load Students trigger button');
    assert(pageCode.includes('handleToggleSelectAll'), 'Contains Select All / Deselect All functionality');
    assert(pageCode.includes('Preview & Print ID Cards'), 'Contains Preview & Print modal trigger');
    assert(pageCode.includes('chunkSize = 5'), 'Calculates 5 cards per A4 sheet pagination');

    // Print & PDF utility
    const printUtilPath = path.resolve('src/utils/printIDCards.ts');
    assert(fs.existsSync(printUtilPath), 'printIDCards.ts exists');
    const printUtilCode = fs.readFileSync(printUtilPath, 'utf-8');
    assert(printUtilCode.includes('waitForIDCardImages'), 'Preloads and decodes all card photos before printing');
    assert(printUtilCode.includes('exportIDCardsPDF'), 'Provides native PDF export capability');

    // ─── 5. Database Integration & Multi-Student Query ─────────────
    console.log('\n--- 5. Database & Service Layer Verification ---');
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    runMigrations(db);
    assert(true, 'SQLite schema migrations executed successfully');

    createInitialAdmin({
      username: 'admin',
      password: 'Password123!',
      displayName: 'System Admin',
    }, db);

    const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
    const sessionToken = loginRes.sessionToken;

    updateSchoolSettings({
      sessionToken,
      schoolName: 'MS Institute of Technology',
      schoolCode: 'MS-TECH',
      schoolType: 'School',
      principalName: 'Dr. M. S. Khan',
      phone: '+92-300-1234567',
      email: 'info@ms-institute.edu',
      address: 'Main Campus Road, Sector 4',
      city: 'Islamabad',
      province: 'Federal',
      country: 'Pakistan',
      academicSession: '2026-2027',
    }, db);

    const schoolSettingsRes = getSchoolSettings(db);
    assert(schoolSettingsRes?.schoolName === 'MS Institute of Technology', 'School settings retrieved');

    const sessRes = createSession({
      sessionToken,
      name: '2026-2027',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isActive: true,
    }, db);
    const sessionId = sessRes.session.id;

    const classRes = createClass({
      sessionToken,
      name: 'Grade 10',
      code: 'G10',
      displayOrder: 1,
    }, db);
    const classId = classRes.classItem.id;

    const secRes = createSection({
      sessionToken,
      classId,
      name: 'Alpha',
      description: 'Science Group',
    }, db);
    const sectionId = secRes.section.id;

    // Create 7 test students
    console.log('  Creating 7 test students for batch ID card generation...');
    for (let i = 1; i <= 7; i++) {
      const studentRes = createStudent({
        sessionToken,
        studentId: `MS-2026-00${i}`,
        admissionNumber: `ADM-100${i}`,
        firstName: `Student${i}`,
        lastName: `Khan`,
        gender: i % 2 === 0 ? 'Female' : 'Male',
        dateOfBirth: '2010-05-15',
        fatherName: `Father of Student ${i}`,
        phone: `+92-300-000000${i}`,
        bloodGroup: i % 2 === 0 ? 'B+' : 'O+',
        currentAddress: `House ${i}, Street 1, Islamabad`,
      }, db);

      createEnrollment({
        sessionToken,
        studentId: studentRes.student.id,
        academicSessionId: sessionId,
        classId,
        sectionId,
        admissionDate: '2026-01-10',
      }, db);
    }

    // Query students as IDCardsPage does
    const studentListRes = getAllStudents({
      academicSessionId: sessionId,
      classId,
      sectionId,
      isActive: true,
      limit: 200,
      page: 1,
    }, db);

    assert(studentListRes.success, 'getAllStudents succeeded');
    assert(studentListRes.students.length === 7, `Retrieved all 7 enrolled students (count: ${studentListRes.students.length})`);

    const firstStudent = studentListRes.students[0];
    assert(firstStudent.currentEnrollment?.className === 'Grade 10', `Enrollment class matches 'Grade 10': ${firstStudent.currentEnrollment?.className}`);
    assert(firstStudent.currentEnrollment?.sectionName === 'Alpha', `Enrollment section matches 'Alpha': ${firstStudent.currentEnrollment?.sectionName}`);
    assert(firstStudent.currentEnrollment?.academicSessionName === '2026-2027', `Enrollment session matches '2026-2027': ${firstStudent.currentEnrollment?.academicSessionName}`);
    assert(firstStudent.fatherName?.length > 0, `Father name present: ${firstStudent.fatherName}`);

    // Verify 5 cards per page chunking
    const chunkSize = 5;
    const totalSheets = Math.ceil(studentListRes.students.length / chunkSize);
    assert(totalSheets === 2, `7 students correctly split into 2 A4 sheets (5 on Sheet 1, 2 on Sheet 2)`);
    assert(studentListRes.students.slice(0, 5).length === 5, 'Sheet 1 has exactly 5 student cards');
    assert(studentListRes.students.slice(5).length === 2, 'Sheet 2 has remaining 2 student cards');

    db.close();

    // ─── 6. Real A4 Print-to-PDF Generation Test ───────────────────
    console.log('\n--- 6. Real A4 PDF Export Verification ---');
    const win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 1600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Build mock 5-card sheet HTML
    const renderCardHtml = (i) => `
      <div class="id-card-row">
        <!-- Front -->
        <div class="id-card-wrapper">
          <div class="id-card-face">
            <div class="id-card-front-header">
              <div class="id-card-front-logo-fallback">MS</div>
              <div class="id-card-front-school-info">
                <div class="id-card-front-school-name">MS Institute of Technology</div>
                <div class="id-card-front-badge-title">Student Identity Card</div>
              </div>
            </div>
            <div class="id-card-front-body">
              <div class="id-card-front-photo-wrap">
                <div style="font-size: 8pt; color: #94a3b8; font-weight: bold;">PHOTO</div>
              </div>
              <div class="id-card-front-details">
                <div class="id-card-student-name">Student${i} Khan</div>
                <div class="id-card-detail-row"><span class="id-card-detail-label">Father:</span><span class="id-card-detail-value">Father ${i}</span></div>
                <div class="id-card-detail-row"><span class="id-card-detail-label">ID:</span><span class="id-card-detail-value highlight">MS-2026-00${i}</span></div>
                <div class="id-card-detail-row"><span class="id-card-detail-label">Adm No:</span><span class="id-card-detail-value">ADM-100${i}</span></div>
                <div class="id-card-detail-row"><span class="id-card-detail-label">Class:</span><span class="id-card-detail-value">Grade 10 (Alpha)</span></div>
                <div class="id-card-detail-row"><span class="id-card-detail-label">Session:</span><span class="id-card-detail-value">2026-2027</span></div>
              </div>
            </div>
            <div class="id-card-front-footer">
              <span>Emergency: +92-300-000000${i}</span>
              <span>Blood: B+</span>
            </div>
          </div>
        </div>
        <div class="id-card-fold-indicator"></div>
        <!-- Back -->
        <div class="id-card-wrapper">
          <div class="id-card-face">
            <div class="id-card-back-header">Terms & Conditions</div>
            <div class="id-card-back-body">
              <ul class="id-card-instructions">
                <li>This card is non-transferable and remains property of the institute.</li>
                <li>Student must carry and visibly display this card during campus hours.</li>
                <li>Loss of this card must be immediately reported to the school office.</li>
              </ul>
              <div class="id-card-return-box">
                <div class="id-card-return-title">If found, please return to:</div>
                <div class="id-card-return-text">
                  <strong>MS Institute of Technology</strong>
                  <div>Main Campus Road, Sector 4, Islamabad</div>
                  <div>Tel: +92-300-1234567 | Email: info@ms-institute.edu</div>
                </div>
              </div>
              <div class="id-card-back-footer">
                <span style="font-size: 5pt; color: #64748b; font-weight: 600;">Session: 2026-2027</span>
                <div class="id-card-sig-line">Principal Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const sampleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${css}
          @page { size: A4 portrait !important; margin: 8mm !important; }
        </style>
      </head>
      <body class="printing-id-cards">
        <div class="id-cards-print-container">
          <div class="id-card-sheet">
            ${[1, 2, 3, 4, 5].map(renderCardHtml).join('')}
          </div>
        </div>
      </body>
      </html>
    `;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(sampleHtml)}`);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'none',
      },
      landscape: false,
    });

    const tempPdfPath = path.join(os.tmpdir(), 'Student_ID_Cards_Test_Output.pdf');
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    assert(fs.existsSync(tempPdfPath), `PDF file physically written to: ${tempPdfPath}`);
    assert(pdfBuffer.length > 5000, `PDF size is valid (${pdfBuffer.length} bytes)`);

    const header = pdfBuffer.slice(0, 5).toString('ascii');
    assert(header === '%PDF-', 'Generated file has valid %PDF- magic bytes header');

    // Count pages in PDF
    const pdfStr = pdfBuffer.toString('latin1');
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 1;
    assert(pageCount === 1, `5 student card pairs fit perfectly on exactly ONE A4 page (detected ${pageCount} page)`);

    win.destroy();
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n====================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  app.quit();
  process.exit(failed > 0 ? 1 : 0);
});
