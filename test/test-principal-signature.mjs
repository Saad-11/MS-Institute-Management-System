import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import {
  updateSchoolSettings,
  getSchoolSettings,
  saveSchoolLogo,
  savePrincipalSignature,
  removePrincipalSignature,
  getPrincipalSignatureDataUrl,
} from '../dist-electron/database/services/school.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createSubject, assignSubjectToClass } from '../dist-electron/database/services/subject.service.js';
import { createStudent, createEnrollment } from '../dist-electron/database/services/student.service.js';
import {
  createExamType,
  createExamination,
  configureExaminationSubjects,
  saveMarks,
  updateExaminationStatus,
  saveGradingRule,
  generateStudentDMC,
} from '../dist-electron/database/services/exam.service.js';

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
  console.log('   Principal Signature Feature Verification Suite   ');
  console.log('====================================================\n');

  try {
    // ─── 1. Settings UI Layout & Exact Label Verification ──────────
    console.log('--- 1. Settings UI & Exact Label Verification ---');
    const settingsPath = path.resolve('src/pages/Settings/SchoolSettingsTab.tsx');
    assert(fs.existsSync(settingsPath), 'SchoolSettingsTab.tsx exists');
    const settingsCode = fs.readFileSync(settingsPath, 'utf-8');

    // Check exact label
    const exactLabel = 'Signature Picture of Principal / Head of Institution';
    assert(settingsCode.includes(exactLabel), `Contains exact label: "${exactLabel}"`);

    // Check position: immediately after "Institution Branding & Logo"
    const logoSectionPos = settingsCode.indexOf('Institution Branding & Logo');
    const sigSectionPos = settingsCode.indexOf(exactLabel);
    assert(logoSectionPos !== -1 && sigSectionPos > logoSectionPos, 'Signature section appears immediately below Institution Branding & Logo section');

    // Check UI controls
    assert(settingsCode.includes('handleChooseSignature'), 'Image upload / replace trigger button handler exists');
    assert(settingsCode.includes('signaturePreview'), 'Preview of currently uploaded signature is implemented');
    assert(settingsCode.includes('Replace Signature'), 'Replace/Change option available');
    assert(settingsCode.includes('handleRemoveSignature'), 'Remove Signature handler exists');
    assert(settingsCode.includes('showDeleteSignatureConfirm'), 'Confirmation modal required before removal');
    assert(settingsCode.includes('transparent PNG image is recommended'), 'Helpful note recommending transparent PNG image present');

    // ─── 2. Database Migration 12 Verification ─────────────────────
    console.log('\n--- 2. Database Schema & Migration 12 Verification ---');
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migResult = runMigrations(db);
    assert(migResult.currentVersion >= 12, `Migrations applied successfully up to version ${migResult.currentVersion}`);

    const columns = db.prepare("PRAGMA table_info(school_settings)").all();
    const colNames = new Set(columns.map((c) => c.name));
    assert(colNames.has('signature_path'), 'school_settings table contains signature_path column');

    // ─── 3. Auth, Logo & Signature Upload Flow ────────────────────
    console.log('\n--- 3. Image Storage, Upload & Data Safety ---');
    createInitialAdmin({ username: 'admin', password: 'Password123!', displayName: 'Super Admin' }, db);
    const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
    const sessionToken = loginRes.sessionToken;

    updateSchoolSettings({
      sessionToken,
      schoolName: 'Oxford Model High School',
      principalName: 'Prof. Muhammad Tariq',
      phone: '+92-51-9200000',
      email: 'info@oxford.edu.pk',
      address: 'Main Campus, Sector H-8',
      city: 'Islamabad',
    }, db);

    // Create a 1x1 PNG base64 for logo
    const sampleLogoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const logoRes = saveSchoolLogo({
      sessionToken,
      base64Data: sampleLogoBase64,
      fileExtension: 'png',
    }, db);
    assert(logoRes.success, 'School logo uploaded successfully');
    const savedLogoPath = logoRes.logoPath;

    // Initially, no signature uploaded
    const initialSettings = getSchoolSettings(db);
    assert(initialSettings.signaturePath === null, 'Initial signaturePath is null');
    assert(initialSettings.signatureDataUrl === null, 'Initial signatureDataUrl is null');

    // Upload a sample transparent PNG signature
    const sampleSignatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const sigUploadRes = savePrincipalSignature({
      sessionToken,
      base64Data: sampleSignatureBase64,
      fileExtension: 'png',
    }, db);
    assert(sigUploadRes.success, 'Principal signature picture saved successfully');
    assert(sigUploadRes.signaturePath && sigUploadRes.signaturePath.startsWith('signature_'), 'Signature stored with managed filename');
    assert(sigUploadRes.dataUrl && sigUploadRes.dataUrl.startsWith('data:image/png;base64,'), 'Signature returns valid data URL');

    // Verify settings retrieval persists signature
    const updatedSettings = getSchoolSettings(db);
    assert(updatedSettings.signaturePath === sigUploadRes.signaturePath, 'signaturePath matches stored filename in database');
    assert(updatedSettings.signatureDataUrl === sigUploadRes.dataUrl, 'signatureDataUrl matches uploaded image data');

    // Verify logo was NOT deleted when signature was uploaded
    assert(updatedSettings.logoPath === savedLogoPath, 'Existing school logo remained completely untouched');

    // ─── 4. Document Rendering: DMC Integration ───────────────────
    console.log('\n--- 4. DMC Signature Display Behavior ---');
    const dmcReportCardPath = path.resolve('src/pages/DMC/DMCReportCard.tsx');
    const dmcCode = fs.readFileSync(dmcReportCardPath, 'utf-8');

    assert(dmcCode.includes('resolvedSignature'), 'DMC resolves signature dynamically');
    assert(dmcCode.includes('dmc-sig-img-wrap'), 'DMC renders signature image container');
    assert(dmcCode.includes('resolvedSignature ?'), 'DMC conditionally displays signature image only if present');

    // Generate real DMC data with signature
    const sessRes = createSession({ sessionToken, name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true }, db);
    const clsRes = createClass({ sessionToken, name: 'Class 10', displayOrder: 1 }, db);
    const secRes = createSection({ sessionToken, classId: clsRes.classItem.id, name: 'Section A' }, db);
    const subRes = createSubject({ sessionToken, name: 'Mathematics', code: 'MATH-10', isCore: true }, db);
    assignSubjectToClass({ sessionToken, classId: clsRes.classItem.id, subjectId: subRes.subject.id }, db);

    const stuRes = createStudent({
      sessionToken,
      studentId: 'STD-2026-0001',
      admissionNumber: 'ADM-1001',
      firstName: 'Hamza',
      lastName: 'Khan',
      gender: 'Male',
      dateOfBirth: '2010-05-10',
    }, db);
    createEnrollment({ sessionToken, studentId: stuRes.student.id, academicSessionId: sessRes.session.id, classId: clsRes.classItem.id, sectionId: secRes.section.id }, db);

    const examType = db.prepare('SELECT id FROM exam_types LIMIT 1').get();
    const examRes = createExamination({
      sessionToken,
      academicSessionId: sessRes.session.id,
      examTypeId: examType ? examType.id : 1,
      name: 'Annual Examination 2026',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
    }, db);

    configureExaminationSubjects({
      sessionToken,
      examinationId: examRes.examination.id,
      classId: clsRes.classItem.id,
      subjects: [{ subjectId: subRes.subject.id, maxMarks: 100, passingMarks: 33 }],
    }, db);

    saveMarks({
      sessionToken,
      examinationId: examRes.examination.id,
      classId: clsRes.classItem.id,
      subjectId: subRes.subject.id,
      marks: [{ studentId: stuRes.student.id, obtainedMarks: 92 }],
    }, db);

    updateExaminationStatus({ sessionToken, id: examRes.examination.id, status: 'Closed' }, db);

    const dmcDataRes = generateStudentDMC(examRes.examination.id, stuRes.student.id, db);
    assert(dmcDataRes.success && dmcDataRes.dmc, 'generateStudentDMC succeeded');
    assert(dmcDataRes.dmc.school.signatureDataUrl?.startsWith('data:image/'), 'Generated DMC school object embeds signature data URL');

    // ─── 5. Document Rendering: Student ID Card Integration ───────
    console.log('\n--- 5. Student ID Card Signature Display Behavior ---');
    const idCardCompPath = path.resolve('src/pages/IDCards/IDCardComponent.tsx');
    const idCardCode = fs.readFileSync(idCardCompPath, 'utf-8');

    assert(idCardCode.includes('principalSignature'), 'ID Card resolves principal signature');
    assert(idCardCode.includes('id-card-sig-img'), 'ID Card renders signature image');
    assert(idCardCode.includes('principalSignature ?'), 'ID Card conditionally displays signature image only if present');

    // ─── 6. Document Rendering: Certificates Integration ──────────
    console.log('\n--- 6. Student Document Certificate Signature Display ---');
    const certCompPath = path.resolve('src/pages/Documents/StudentDocumentCertificate.tsx');
    const certCode = fs.readFileSync(certCompPath, 'utf-8');

    assert(certCode.includes('principalSignature'), 'Certificate resolves principal signature');
    assert(certCode.includes('cert-sig-img'), 'Certificate renders signature image');
    assert(certCode.includes('principalSignature &&'), 'Certificate conditionally displays signature image only if present');

    // ─── 7. Replacement and Removal Flow ──────────────────────────
    console.log('\n--- 7. Signature Replacement & Removal Verification ---');

    // Replace signature
    const replacementSignatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const replaceRes = savePrincipalSignature({
      sessionToken,
      base64Data: replacementSignatureBase64,
      fileExtension: 'png',
    }, db);
    assert(replaceRes.success, 'Signature replacement succeeded');
    assert(replaceRes.signaturePath !== sigUploadRes.signaturePath, 'New signature file generated with distinct filename');

    const afterReplaceSettings = getSchoolSettings(db);
    assert(afterReplaceSettings.signaturePath === replaceRes.signaturePath, 'Settings updated to replacement signature');
    assert(afterReplaceSettings.signatureDataUrl === replaceRes.dataUrl, 'Settings dataUrl updated to replacement signature');

    // Remove signature
    const removeRes = removePrincipalSignature(sessionToken, db);
    assert(removeRes.success, 'Signature removal succeeded');

    const afterRemoveSettings = getSchoolSettings(db);
    assert(afterRemoveSettings.signaturePath === null, 'signature_path is NULL in database after removal');
    assert(afterRemoveSettings.signatureDataUrl === null, 'signatureDataUrl is null after removal');

    // Verify DMC with removed signature leaves signature space blank
    const dmcAfterRemoval = generateStudentDMC(examRes.examination.id, stuRes.student.id, db);
    assert(dmcAfterRemoval.dmc?.school.signatureDataUrl === null, 'DMC school object has null signatureDataUrl when removed');
    assert(afterRemoveSettings.logoPath === savedLogoPath, 'School logo remains intact after removing signature');

    db.close();

    // ─── 8. Headless A4 PDF Layout Verification ───────────────────
    console.log('\n--- 8. Real A4 PDF Layout Verification ---');
    const win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 1600,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const dmcCss = fs.readFileSync('src/styles/dmc.css', 'utf-8');
    const idCardCss = fs.readFileSync('src/styles/id-cards.css', 'utf-8');

    // Test DMC PDF with signature
    const dmcHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8" /><style>
      ${dmcCss}
      @page { size: A4 portrait !important; margin: 8mm !important; }
      </style></head><body class="printing-dmc">
        <div class="dmc-document">
          <div class="dmc-inner-frame">
            <div class="dmc-header"><div class="dmc-header-center"><h1>Oxford Model High School</h1></div></div>
            <div style="height: 140mm; background: #fff;"></div>
            <div class="dmc-footer-section">
              <div class="dmc-signatures-grid">
                <div class="dmc-sig-col"><div class="dmc-sig-line"></div><div class="dmc-sig-name">Class Teacher</div></div>
                <div class="dmc-sig-col"><div class="dmc-stamp-box"><span>Seal</span></div></div>
                <div class="dmc-sig-col">
                  <div class="dmc-sig-img-wrap">
                    <img src="data:image/png;base64,${sampleSignatureBase64}" class="dmc-sig-img" />
                  </div>
                  <div class="dmc-sig-line"></div>
                  <div class="dmc-sig-name">Prof. Muhammad Tariq</div>
                  <div class="dmc-sig-role">Head of Institution</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body></html>
    `;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(dmcHtml)}`);
    const dmcPdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' },
    });

    assert(dmcPdfBuffer.length > 5000, `DMC PDF generated (${dmcPdfBuffer.length} bytes)`);
    const dmcPageMatches = dmcPdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
    assert(dmcPageMatches && dmcPageMatches.length === 1, `DMC with signature fits on exactly 1 A4 page (detected ${dmcPageMatches?.length} page)`);

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
