import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createStudent, createEnrollment } from '../dist-electron/database/services/student.service.js';
import { getStudentDocumentPreview, issueStudentDocument, getDocumentHistory } from '../dist-electron/database/services/document.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('Starting Documents Module UI/UX Redesign Test Suite...\n');

  // --- 1. Static Verification of DocumentsPage.tsx and documents.css ---
  console.log('--- 1. Static UI Structure & Design Verification ---');
  const pagePath = path.resolve('src/pages/Documents/DocumentsPage.tsx');
  const cssPath = path.resolve('src/styles/documents.css');

  assert(fs.existsSync(pagePath), 'DocumentsPage.tsx exists');
  assert(fs.existsSync(cssPath), 'documents.css exists');

  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Page Header Title & Subtitle
  assert(pageContent.includes('Student Documents & Certificates'), 'Header contains correct title "Student Documents & Certificates"');
  assert(pageContent.includes('Generate, print, export, and archive official student documents using institutional records.'), 'Header contains correct supporting description');

  // Segmented Navigation Tabs
  assert(pageContent.includes("activeTab === 'generate'"), 'Segmented tab state for "generate" exists');
  assert(pageContent.includes("activeTab === 'history'"), 'Segmented tab state for "history" exists');
  assert(pageContent.includes('Generate Document'), 'Navigation tab label "Generate Document" exists');
  assert(pageContent.includes('Document History'), 'Navigation tab label "Document History" exists');

  // Section A: Student Selection
  assert(pageContent.includes('Section A: Student Selection') || pageContent.includes('Select Student'), 'Section A for student selection exists');
  assert(pageContent.includes('searchContainerRef'), 'Click-outside ref for student search popover exists');
  assert(pageContent.includes('docs-selected-card'), 'Selected student preview card class exists');
  assert(pageContent.includes('docs-student-dropdown'), 'Search popover dropdown class exists');

  // Section B: Document Details
  assert(pageContent.includes('Section B: Document Details') || pageContent.includes('Document Details'), 'Section B for document details exists');
  assert(pageContent.includes('Bonafide Certificate'), 'Bonafide option available');
  assert(pageContent.includes('Character Certificate'), 'Character Certificate option available');
  assert(pageContent.includes('School Leaving Certificate'), 'Leaving Certificate option available');
  assert(pageContent.includes('General Certificate'), 'General Certificate option available');

  // Section C: Particulars & Options
  assert(pageContent.includes('Section C: Particulars & Options') || pageContent.includes('Particulars & Options'), 'Section C for particulars & options exists');
  assert(pageContent.includes('Conduct Assessment') || pageContent.includes('conduct'), 'Conduct assessment field exists');
  assert(pageContent.includes('Reason for Leaving') || pageContent.includes('reasonForLeaving'), 'Reason for leaving field exists');
  assert(pageContent.includes('duesCleared'), 'Dues cleared checkbox exists');
  assert(pageContent.includes('customRemarks'), 'Multiline remarks textarea exists');

  // Action Buttons Hierarchy
  assert(pageContent.includes('Preview Document'), 'Action button "Preview Document" exists');
  assert(pageContent.includes('Save & Issue Document'), 'Action button "Save & Issue Document" exists');
  assert(pageContent.includes('Print'), 'Action button "Print" exists');
  assert(pageContent.includes('Export PDF'), 'Action button "Export PDF" exists');
  assert(pageContent.includes('docs-btn-primary'), 'Primary action button CSS class used');
  assert(pageContent.includes('docs-btn-blue'), 'Prominent save & issue CSS class used');
  assert(pageContent.includes('docs-btn-dark'), 'Slate print button CSS class used');
  assert(pageContent.includes('docs-btn-emerald'), 'Emerald export button CSS class used');

  // CSS Tokens & Key Classes
  assert(cssContent.includes('.docs-workspace'), 'CSS contains .docs-workspace root layout');
  assert(cssContent.includes('.docs-header-card'), 'CSS contains .docs-header-card');
  assert(cssContent.includes('.docs-view-toggle'), 'CSS contains .docs-view-toggle');
  assert(cssContent.includes('.docs-config-grid'), 'CSS contains responsive .docs-config-grid');
  assert(cssContent.includes('.docs-selected-card'), 'CSS contains .docs-selected-card styling');
  assert(cssContent.includes('.docs-badge-bonafide'), 'CSS contains .docs-badge-bonafide badge');
  assert(cssContent.includes('.docs-badge-character'), 'CSS contains .docs-badge-character badge');
  assert(cssContent.includes('.docs-badge-leaving'), 'CSS contains .docs-badge-leaving badge');
  assert(cssContent.includes('.docs-badge-general'), 'CSS contains .docs-badge-general badge');

  // Zero Hardcoded School Branding
  assert(!pageContent.includes('Army Public School'), 'No hardcoded school name in DocumentsPage.tsx');
  assert(!pageContent.includes('Beaconhouse'), 'No hardcoded school name in DocumentsPage.tsx');

  // --- 2. Functional & Backend Service Integration Verification ---
  console.log('\n--- 2. Service & Data Pipeline Integration ---');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  createInitialAdmin({ username: 'admin', displayName: 'Admin User', password: 'Password123!' }, db);
  const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
  const sessionToken = loginRes.sessionToken;

  // Configure custom dynamic school settings
  updateSchoolSettings({
    sessionToken,
    schoolName: 'Metropolitan High School',
    schoolCode: 'MHS-99',
    city: 'Metropolis',
    principalName: 'Dr. John Doe',
  }, db);

  const sessionRes = createSession({
    sessionToken,
    name: '2025-2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isCurrent: true,
  }, db);
  const sessionId = sessionRes.session.id;

  const classRes = createClass({ sessionToken, name: 'Grade 10', displayOrder: 1 }, db);
  const sectionRes = createSection({ sessionToken, classId: classRes.classItem.id, name: 'A', capacity: 35 }, db);

  const studentRes = createStudent({
    sessionToken,
    firstName: 'Zain',
    lastName: 'Ahmed',
    displayName: 'Zain Ahmed',
    gender: 'Male',
    dateOfBirth: '2009-08-14',
    fatherName: 'Tariq Ahmed',
    phone: '03001234567',
    city: 'Metropolis',
    province: 'Capital',
    currentAddress: 'Sector F-7',
    admissionDate: '2024-04-01',
    initialSessionId: sessionId,
    initialClassId: classRes.classItem.id,
    initialSectionId: sectionRes.section.id,
  }, db);
  const studentId = studentRes.student.id;

  createEnrollment({
    sessionToken,
    studentId,
    academicSessionId: sessionId,
    classId: classRes.classItem.id,
    sectionId: sectionRes.section.id,
    rollNumber: '101',
    admissionDate: '2024-04-01',
  }, db);

  // Test Bonafide Preview
  const bonafidePreview = getStudentDocumentPreview({
    studentId,
    academicSessionId: sessionId,
    documentType: 'Bonafide',
  }, db);
  assert(bonafidePreview.success, 'Bonafide preview generation successful');
  assert(bonafidePreview.document.student.displayName === 'Zain Ahmed', 'Preview has correct student display name');
  assert(bonafidePreview.document.school.schoolName === 'Metropolitan High School', 'Preview reflects dynamic school name from settings');

  // Test Issue Document
  const issueRes = issueStudentDocument({
    sessionToken,
    studentId,
    academicSessionId: sessionId,
    documentType: 'Bonafide',
    title: bonafidePreview.document.title,
    remarks: 'Issued for passport application',
  }, db);
  assert(issueRes.success, 'Document issued successfully');
  assert(issueRes.document.documentNumber.startsWith('DOC-'), 'Issued document has standard sequential number');

  // Test History Retrieval
  const historyRes = getDocumentHistory({ studentId }, db);
  assert(historyRes.success && historyRes.documents.length === 1, 'History retrieval includes newly issued document');
  assert(historyRes.documents[0].documentType === 'Bonafide', 'History record has correct documentType');

  db.close();

  console.log(`\nResults: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
