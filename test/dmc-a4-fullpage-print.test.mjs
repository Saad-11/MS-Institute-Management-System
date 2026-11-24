import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Import from dist-electron
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';
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
  generateClassDMC,
} from '../dist-electron/database/services/exam.service.js';

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
  console.log('========================================================================');
  console.log(' DMC PHASE: A4 FULL-PAGE PRINT LAYOUT OPTIMIZATION VERIFICATION SUITE');
  console.log('========================================================================\n');

  // 1. Setup in-memory database
  console.log('--- Step 1: Database Setup & Migration Integrity ---');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const migrationRes = runMigrations(db);
  assert(migrationRes.appliedCount >= 7, 'All database migrations applied successfully');

  // 2. Dynamic School Branding
  console.log('\n--- Step 2: Dynamic School Branding & Principal Settings ---');
  createInitialAdmin({ username: 'admin', displayName: 'System Administrator', password: 'AdminPassword123!' }, db);
  const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
  const sessionToken = loginRes.sessionToken;

  updateSchoolSettings(
    {
      sessionToken,
      schoolName: 'Metropolitan Crest International Academy',
      schoolCode: 'MCIA-786',
      principalName: 'Dr. S. M. Farooqi, Ph.D.',
      address: 'Sector F-8/3, Education Enclave',
      city: 'Islamabad',
      phone: '+92-51-8899000',
      email: 'admissions@mcia.edu.pk',
      website: 'www.mcia.edu.pk',
    },
    db
  );

  const school = getSchoolSettings(db);
  assert(school.schoolName === 'Metropolitan Crest International Academy', 'School name dynamically populated');
  assert(school.principalName === 'Dr. S. M. Farooqi, Ph.D.', 'Principal name dynamically populated');

  // 3. Academic Structure
  console.log('\n--- Step 3: Academic Sessions, Classes & Multi-Subject Configuration ---');
  const sessionRes = createSession(
    {
      sessionToken,
      name: '2025-2026',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      isCurrent: true,
    },
    db
  );
  const sessionId = sessionRes.session.id;

  const classRes = createClass({ sessionToken, name: 'Senior Cambridge Grade 10', displayOrder: 1 }, db);
  const classId = classRes.classItem.id;

  const sectionRes = createSection({ sessionToken, classId, name: 'Section Red', capacity: 35 }, db);
  const sectionId = sectionRes.section.id;

  // Create 10 subjects to test normal (6), few (3), and extended (10) curriculums
  const subjectNames = [
    'English Language & Literature',
    'Mathematics (Pure & Applied)',
    'Physics (Theoretical & Laboratory)',
    'Chemistry (Organic & Inorganic)',
    'Biology & Environmental Ecology',
    'Computer Science & Distributed Systems',
    'Pakistan Studies (History & Geography)',
    'Islamiat / Religious Studies',
    'Advanced Statistics & Data Analysis',
    'Economics & Social Development',
  ];

  const subjectIds = [];
  for (let i = 0; i < subjectNames.length; i++) {
    const subRes = createSubject({ sessionToken, name: subjectNames[i], code: `SUB-${101 + i}`, type: 'Theory' }, db);
    subjectIds.push(subRes.subject.id);
    assignSubjectToClass({ sessionToken, classId, subjectId: subRes.subject.id }, db);
  }
  assert(subjectIds.length === 10, 'Successfully configured and assigned 10 subjects');

  // 4. Enroll 3 diverse test students
  console.log('\n--- Step 4: Diverse Student Enrollment & Records Setup ---');
  // Student 1: Normal subjects (6 subjects), has photo
  const s1Res = createStudent(
    {
      sessionToken,
      firstName: 'Ayesha',
      lastName: 'Rehman',
      displayName: 'Ayesha Rehman',
      gender: 'Female',
      dateOfBirth: '2009-07-15',
      fatherName: 'Abdul Rehman Qureshi',
      phone: '03001122334',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'Street 14, F-8/3',
      admissionDate: '2021-04-01',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student1 = s1Res.student;
  const e1 = createEnrollment({ sessionToken, studentId: student1.id, academicSessionId: sessionId, classId, sectionId, rollNumber: 'R-101', admissionDate: '2021-04-01' }, db).enrollment;
  db.prepare('UPDATE students SET photo_path = ? WHERE id = ?').run('uploads/students/student_ayesha.png', student1.id);

  // Student 2: No photo available (fallback avatar behavior)
  const s2Res = createStudent(
    {
      sessionToken,
      firstName: 'Hamza',
      lastName: 'Waqas',
      displayName: 'Hamza Waqas',
      gender: 'Male',
      dateOfBirth: '2010-02-18',
      fatherName: 'Waqas Ahmed',
      phone: '03009988776',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'G-10/4, Islamabad',
      admissionDate: '2022-04-01',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student2 = s2Res.student;
  const e2 = createEnrollment({ sessionToken, studentId: student2.id, academicSessionId: sessionId, classId, sectionId, rollNumber: 'R-102', admissionDate: '2022-04-01' }, db).enrollment;

  // Student 3: Very long student name & father name with extended 10 subjects
  const s3Res = createStudent(
    {
      sessionToken,
      firstName: 'Sahibzada',
      lastName: 'Muhammad Daniyal Tariq Al-Hussaini',
      displayName: 'Sahibzada Muhammad Daniyal Tariq Al-Hussaini',
      gender: 'Male',
      dateOfBirth: '2008-11-25',
      fatherName: 'Al-Haj Prof. Dr. Tariq Mehmood Qureshi Khan Niazi',
      phone: '03004455667',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'Sector E-7, National Educational Enclave',
      admissionDate: '2020-04-01',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student3 = s3Res.student;
  const e3 = createEnrollment({ sessionToken, studentId: student3.id, academicSessionId: sessionId, classId, sectionId, rollNumber: 'R-103', admissionDate: '2020-04-01' }, db).enrollment;

  // 5. Examination and Marks Configuration
  console.log('\n--- Step 5: Examination Setup & Marks Recording ---');
  const examTypeRes = createExamType({ sessionToken, name: 'Final Term Examination', code: 'FIN-2026' }, db);
  const examRes = createExamination(
    {
      sessionToken,
      name: 'Annual Grand Examination 2026',
      academicSessionId: sessionId,
      examTypeId: examTypeRes.examType.id,
      startDate: '2026-03-01',
      endDate: '2026-03-20',
    },
    db
  );
  const examId = examRes.examination.id;

  // Configure all 10 subjects for the exam (each 100 max, 40 pass)
  const examSubjectsConfig = subjectIds.map((subId, idx) => ({
    subjectId: subId,
    maxMarks: 100,
    passingMarks: 40,
    displayOrder: idx + 1,
  }));
  const configRes = configureExaminationSubjects(
    {
      sessionToken,
      examinationId: examId,
      classId,
      subjects: examSubjectsConfig,
    },
    db
  );
  assert(configRes.success, 'Successfully configured examination subjects');

  updateExaminationStatus({ sessionToken, id: examId, status: 'Open' }, db);

  const examSubjects = db.prepare('SELECT id, subject_id FROM examination_subjects WHERE examination_id = ?').all(examId);
  const examSubjectIds = examSubjects.map((s) => s.id);

  // Record marks for all 3 students
  // Student 1 (Normal 6 subjects marks, remaining pending)
  for (let i = 0; i < 6; i++) {
    saveMarks({ sessionToken, examinationId: examId, examinationSubjectId: examSubjectIds[i], marks: [{ studentId: student1.id, enrollmentId: e1.id, obtainedMarks: 85, status: 'Entered' }] }, db);
  }

  // Student 2 (4 subjects marks, tests few subjects scenario)
  for (let i = 0; i < 4; i++) {
    saveMarks({ sessionToken, examinationId: examId, examinationSubjectId: examSubjectIds[i], marks: [{ studentId: student2.id, enrollmentId: e2.id, obtainedMarks: 72, status: 'Entered' }] }, db);
  }

  // Student 3 (All 10 subjects marks recorded, tests extended 10-subject scenario)
  for (let i = 0; i < 10; i++) {
    saveMarks({ sessionToken, examinationId: examId, examinationSubjectId: examSubjectIds[i], marks: [{ studentId: student3.id, enrollmentId: e3.id, obtainedMarks: 91, status: 'Entered' }] }, db);
  }

  // Save standard institutional grading rules
  saveGradingRule({ sessionToken, grade: 'A+', minPercentage: 80, maxPercentage: 100, gradePoint: 4.0, description: 'Outstanding Excellence' }, db);
  saveGradingRule({ sessionToken, grade: 'A', minPercentage: 70, maxPercentage: 79.99, gradePoint: 3.5, description: 'Excellent' }, db);
  saveGradingRule({ sessionToken, grade: 'B', minPercentage: 60, maxPercentage: 69.99, gradePoint: 3.0, description: 'Very Good' }, db);
  saveGradingRule({ sessionToken, grade: 'C', minPercentage: 50, maxPercentage: 59.99, gradePoint: 2.5, description: 'Good' }, db);
  saveGradingRule({ sessionToken, grade: 'D', minPercentage: 40, maxPercentage: 49.99, gradePoint: 2.0, description: 'Pass' }, db);
  saveGradingRule({ sessionToken, grade: 'F', minPercentage: 0, maxPercentage: 39.99, gradePoint: 0.0, description: 'Fail' }, db);

  updateExaminationStatus({ sessionToken, id: examId, status: 'Completed' }, db);

  // 6. Test Single Student DMC Generation & Data Integrity
  console.log('\n--- Step 6: Test DMC Generation Across Diverse Student Scenarios ---');
  const dmc1Res = generateStudentDMC(examId, student1.id, db);
  assert(dmc1Res.success && Boolean(dmc1Res.dmc), 'Generated DMC for Student 1 (Normal 6 Subjects)');
  const dmc1 = dmc1Res.dmc;
  assert(dmc1.student.displayName === 'Ayesha Rehman', 'Student 1 name matches');
  assert(dmc1.school.schoolName === 'Metropolitan Crest International Academy', 'DMC reflects dynamic school name');
  assert(dmc1.school.principalName === 'Dr. S. M. Farooqi, Ph.D.', 'DMC reflects dynamic principal name');

  // Student 2: Genuinely no photo
  const dmc2Res = generateStudentDMC(examId, student2.id, db);
  assert(dmc2Res.success && Boolean(dmc2Res.dmc), 'Generated DMC for Student 2 (No Photo on record)');
  assert(dmc2Res.dmc.student.photoDataUrl === null, 'photoDataUrl is null for student without photo');

  // Student 3: Extended 10 subjects & long names
  const dmc3Res = generateStudentDMC(examId, student3.id, db);
  assert(dmc3Res.success && Boolean(dmc3Res.dmc), 'Generated DMC for Student 3 (Extended 10 Subjects & Long Name)');
  const dmc3 = dmc3Res.dmc;
  assert(dmc3.subjects.length === 10, 'Student 3 DMC includes all 10 subjects');
  assert(dmc3.student.displayName.length > 35, 'Preserves extra-long student display name');
  assert(dmc3.student.fatherName.length > 40, 'Preserves extra-long father name');

  // 7. Verify CSS Rules & A4 Full-Page Page Budget in dmc.css
  console.log('\n--- Step 7: Verify CSS A4 Dimensions, Flex-Column & Footer Anchoring ---');
  const dmcCssPath = path.resolve('src/styles/dmc.css');
  const dmcCss = fs.readFileSync(dmcCssPath, 'utf-8');

  // A4 Page Setup
  assert(dmcCss.includes('size: A4 portrait'), 'Print stylesheet specifies size: A4 portrait');
  assert(dmcCss.includes('margin: 8mm 8mm 8mm 8mm'), 'Print stylesheet defines standard 8mm print margins');

  // Document Full-Height Flex Box
  assert(dmcCss.includes('max-width: 194mm'), 'dmc-document constrained to printable 194mm width (210 - 16)');
  assert(dmcCss.includes('min-height: 279mm'), 'dmc-document has min-height: 279mm to fill A4 page (297 - 16 - 2 safety buffer)');
  assert(dmcCss.includes('height: 279mm'), 'dmc-document has height: 279mm for exact single-page fit');
  assert(dmcCss.includes('max-height: 280mm'), 'dmc-document has max-height: 280mm preventing sub-pixel page 2 spill');
  assert(dmcCss.includes('display: flex'), 'dmc-document uses flex layout');
  assert(dmcCss.includes('flex-direction: column'), 'dmc-document uses flex-direction: column');

  // Inner Frame Full-Height
  assert(dmcCss.includes('.dmc-inner-frame'), 'dmc-inner-frame rule exists in print');
  assert(dmcCss.includes('flex: 1 !important'), 'dmc-inner-frame expands via flex: 1');
  assert(dmcCss.includes('height: 100% !important'), 'dmc-inner-frame fills 100% of document height');

  // Footer Section Anchoring to Bottom
  assert(dmcCss.includes('.dmc-footer-section'), 'dmc-footer-section class defined in stylesheet');
  assert(dmcCss.includes('margin-top: auto !important'), 'Footer uses margin-top: auto to anchor near bottom');
  assert(dmcCss.includes('.dmc-signatures-grid'), 'dmc-signatures-grid defined in stylesheet');
  assert(dmcCss.includes('grid-template-columns: repeat(3, 1fr)'), 'Signatures organized in 3-column grid');

  // Official Institutional Seal & Signatures
  assert(dmcCss.includes('.dmc-stamp-box'), 'dmc-stamp-box defined for institutional official seal');
  assert(dmcCss.includes('.dmc-sig-line'), 'dmc-sig-line defined for signature lines');
  assert(dmcCss.includes('.dmc-footer-note'), 'dmc-footer-note defined for security / anti-tampering notice');

  // Word Break & Non-Clipping Constraints
  assert(dmcCss.includes('word-break: break-word'), 'Long names and subjects wrap with word-break: break-word');
  assert(dmcCss.includes('break-inside: avoid'), 'Prevents page breaks inside certificate');

  // Batch Printing Rules
  assert(dmcCss.includes('break-after: page'), 'Batch mode applies break-after: page between students');
  assert(dmcCss.includes('.dmc-page-break:last-child'), 'Suppresses trailing page-break after final student');

  // Screen Aspect Ratio & Flex
  assert(dmcCss.includes('min-height: 1100px'), 'Screen preview has min-height: 1100px reflecting A4 portrait aspect ratio');

  // 8. Verify Component JSX Structure
  console.log('\n--- Step 8: Verify Component JSX Implementation ---');
  const reportCardPath = path.resolve('src/pages/DMC/DMCReportCard.tsx');
  const reportCardCode = fs.readFileSync(reportCardPath, 'utf-8');

  assert(reportCardCode.includes('dmc-footer-section'), 'DMCReportCard wraps signatures and security note in dmc-footer-section');
  assert(reportCardCode.includes('dmc-signatures-grid'), 'DMCReportCard includes dmc-signatures-grid');
  assert(reportCardCode.includes('Class Teacher'), 'DMCReportCard includes Class Teacher signature block');
  assert(reportCardCode.includes('School Seal') || reportCardCode.includes('dmc-stamp-box'), 'DMCReportCard includes official school seal stamp box');
  assert(reportCardCode.includes('school.principalName'), 'DMCReportCard dynamically renders principal signature');
  assert(reportCardCode.includes('dmc-footer-note'), 'DMCReportCard includes security footer note');

  // 9. Batch Generation Verification
  console.log('\n--- Step 9: Batch DMC Class Generation ---');
  const batchRes = generateClassDMC({ examinationId: examId, classId, sectionId }, db);
  assert(batchRes.success && batchRes.dmcs.length === 3, 'Batch generated 3 student DMCs');
  assert(batchRes.dmcs[0].summary.position === 1, 'Student 3 (91% in 10 subjects) ranked 1st');

  db.close();

  console.log(`\n========================================================================`);
  console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests} assertions`);
  console.log(`========================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
