import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { updateSchoolSettings } from '../dist-electron/database/services/school.service.js';
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

async function run() {
  console.log('=== Verifying DMC Table White Design & Code Column Removal ===\n');

  // 1. Check DMCReportCard.tsx
  console.log('--- 1. DMCReportCard.tsx Template Verification ---');
  const dmcReportCardPath = path.resolve('src/pages/DMC/DMCReportCard.tsx');
  assert(fs.existsSync(dmcReportCardPath), 'DMCReportCard.tsx exists');

  const reportCardContent = fs.readFileSync(dmcReportCardPath, 'utf-8');
  assert(!reportCardContent.includes('dmc-col-code'), 'Subject Code column completely removed from DMCReportCard.tsx');
  assert(!reportCardContent.includes('<th>Code</th>'), 'No Code header in table');
  assert(reportCardContent.includes('colSpan={2} className="dmc-grand-total-label"'), 'Grand Total label has colSpan={2} for exact column alignment');

  // 2. Check dmc.css table styling
  console.log('\n--- 2. dmc.css Styling Verification ---');
  const dmcCssPath = path.resolve('src/styles/dmc.css');
  assert(fs.existsSync(dmcCssPath), 'dmc.css exists');

  const cssContent = fs.readFileSync(dmcCssPath, 'utf-8');

  // Screen table header
  assert(cssContent.includes('.dmc-marks-table thead tr {\n  background-color: #ffffff;\n  color: #0f2942;'), 'Screen header background is pure white with dark navy text');
  assert(cssContent.includes('border-bottom: 2px solid #0f2942;'), 'Header has clear, professional dark navy border below it');

  // Screen subject rows
  assert(cssContent.includes('.dmc-marks-table tbody tr {\n  background-color: #ffffff;\n  border-bottom: 1px solid #cbd5e1;'), 'Screen subject rows have pure white background and clear borders');
  assert(cssContent.includes('.dmc-marks-table tbody tr:nth-child(even) {\n  background-color: #ffffff;'), 'Zebra shading removed from subject rows (pure white)');

  // Screen Grand Total row
  assert(cssContent.includes('.dmc-marks-table tfoot tr {\n  background-color: #ffffff;'), 'Screen Grand Total row background is pure white');
  assert(cssContent.includes('.dmc-marks-table tfoot td {\n  padding: 5.5px 6px;\n  font-size: 11px;\n  font-weight: 800;'), 'Grand Total cells have bold text');

  // Print table header
  assert(cssContent.includes('.dmc-marks-table thead tr {\n    background-color: #ffffff !important;\n    color: #0f2942 !important;'), 'Print header background is pure white with dark navy text');
  assert(cssContent.includes('.dmc-marks-table thead th {\n    padding: 4.5px 6px !important;\n    font-size: 9.5px !important;\n    font-weight: 800 !important;\n    text-transform: uppercase !important;\n    letter-spacing: 0.04em !important;\n    color: #0f2942 !important;\n    background-color: #ffffff !important;\n    border: 1px solid #cbd5e1 !important;\n    border-bottom: 2px solid #0f2942 !important;'), 'Print header th has white background and clear borders');

  // Print subject rows
  assert(cssContent.includes('.dmc-marks-table tbody tr,\n  .dmc-marks-table tbody tr:nth-child(even) {\n    background-color: #ffffff !important;\n    border-bottom: 1px solid #cbd5e1 !important;\n  }'), 'Print subject rows have pure white background');

  // Print Grand Total row
  assert(cssContent.includes('.dmc-marks-table tfoot tr {\n    background-color: #ffffff !important;'), 'Print Grand Total row has pure white background');
  assert(cssContent.includes('.dmc-marks-table tfoot td {\n    padding: 4.5px 6px !important;\n    font-size: 11px !important;\n    font-weight: 800 !important;\n    color: #0f172a !important;\n    background-color: #ffffff !important;'), 'Print Grand Total cells have pure white background with bold dark text');

  // 3. Database & DMC generation data verification
  console.log('\n--- 3. Generate Sample DMC Data Verification ---');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  createInitialAdmin({ username: 'admin', displayName: 'Admin', password: 'Password123!' }, db);
  const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
  const sessionToken = loginRes.sessionToken;

  updateSchoolSettings({
    sessionToken,
    schoolName: 'Oxford Model High School',
    schoolCode: 'OMHS-01',
    address: 'Main Campus, Sector H-8',
    city: 'Islamabad',
    principalName: 'Prof. Muhammad Saeed',
  }, db);

  const sessRes = createSession({ sessionToken, name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true }, db);
  const clsRes = createClass({ sessionToken, name: 'Class 10', displayOrder: 1 }, db);
  const secRes = createSection({ sessionToken, classId: clsRes.classItem.id, name: 'Section A' }, db);

  const sub1 = createSubject({ sessionToken, name: 'Mathematics', code: 'MATH-10', isCore: true }, db);
  const sub2 = createSubject({ sessionToken, name: 'English', code: 'ENG-10', isCore: true }, db);
  const sub3 = createSubject({ sessionToken, name: 'Physics', code: 'PHY-10', isCore: true }, db);

  assignSubjectToClass({ sessionToken, classId: clsRes.classItem.id, subjectId: sub1.subject.id }, db);
  assignSubjectToClass({ sessionToken, classId: clsRes.classItem.id, subjectId: sub2.subject.id }, db);
  assignSubjectToClass({ sessionToken, classId: clsRes.classItem.id, subjectId: sub3.subject.id }, db);

  const stuRes = createStudent({
    sessionToken,
    studentId: 'STD-2026-0001',
    admissionNumber: 'ADM-1001',
    firstName: 'Saad',
    lastName: 'Ahmed',
    gender: 'Male',
    dateOfBirth: '2010-04-12',
  }, db);
  const enrRes = createEnrollment({ sessionToken, studentId: stuRes.student.id, academicSessionId: sessRes.session.id, classId: clsRes.classItem.id, sectionId: secRes.section.id, rollNumber: '101' }, db);

  const examTypeRow = db.prepare('SELECT id FROM exam_types LIMIT 1').get();
  const examTypeId = examTypeRow ? examTypeRow.id : 1;
  const examRes = createExamination({
    sessionToken,
    examTypeId: examTypeId,
    academicSessionId: sessRes.session.id,
    name: 'Annual Examination 2026',
    startDate: '2026-03-01',
    endDate: '2026-03-15',
  }, db);

  configureExaminationSubjects({
    sessionToken,
    examinationId: examRes.examination.id,
    classId: clsRes.classItem.id,
    subjects: [
      { subjectId: sub1.subject.id, maxMarks: 100, passingMarks: 33 },
      { subjectId: sub2.subject.id, maxMarks: 100, passingMarks: 33 },
      { subjectId: sub3.subject.id, maxMarks: 100, passingMarks: 33 },
    ],
  }, db);

  updateExaminationStatus({ sessionToken, id: examRes.examination.id, status: 'Open' }, db);

  const examSubjects = db.prepare('SELECT id, subject_id FROM examination_subjects WHERE examination_id = ?').all(examRes.examination.id);

  saveMarks({
    sessionToken,
    examinationId: examRes.examination.id,
    examinationSubjectId: examSubjects[0].id,
    marks: [{ studentId: stuRes.student.id, enrollmentId: enrRes.enrollment.id, obtainedMarks: 95, status: 'Entered' }],
  }, db);
  saveMarks({
    sessionToken,
    examinationId: examRes.examination.id,
    examinationSubjectId: examSubjects[1].id,
    marks: [{ studentId: stuRes.student.id, enrollmentId: enrRes.enrollment.id, obtainedMarks: 88, status: 'Entered' }],
  }, db);
  saveMarks({
    sessionToken,
    examinationId: examRes.examination.id,
    examinationSubjectId: examSubjects[2].id,
    marks: [{ studentId: stuRes.student.id, enrollmentId: enrRes.enrollment.id, obtainedMarks: 92, status: 'Entered' }],
  }, db);

  saveGradingRule({ sessionToken, grade: 'A+', minPercentage: 80, maxPercentage: 100, gradePoint: 4.0, description: 'Outstanding' }, db);
  saveGradingRule({ sessionToken, grade: 'A', minPercentage: 70, maxPercentage: 79.99, gradePoint: 3.5, description: 'Excellent' }, db);

  updateExaminationStatus({ sessionToken, id: examRes.examination.id, status: 'Completed' }, db);

  const dmcResult = generateStudentDMC(examRes.examination.id, stuRes.student.id, db);

  assert(dmcResult.success === true, 'Sample DMC generated successfully');
  assert(dmcResult.dmc.student.displayName === 'Saad Ahmed', 'Student name is preserved');
  assert(dmcResult.dmc.school.schoolName === 'Oxford Model High School', 'School name is preserved');
  assert(dmcResult.dmc.subjects.length === 3, 'All 3 subjects present in DMC payload');
  assert(dmcResult.dmc.summary.totalMaxMarks === 300, 'Total Max Marks = 300');
  assert(dmcResult.dmc.summary.totalObtainedMarks === 275, 'Total Obtained Marks = 275');
  assert(dmcResult.dmc.summary.result === 'Pass', 'Result is Pass');

  db.close();

  console.log('\n=== All Verification Checks Completed ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
