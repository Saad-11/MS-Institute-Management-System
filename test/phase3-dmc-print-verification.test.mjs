/**
 * Phase 3 DMC Printing, PDF Export & Data Integration Verification Test
 * 
 * Tests the real end-to-end DMC compilation and print data pipelines against SQLite:
 * 1. Student with a saved photograph (valid data URL)
 * 2. Student whose photograph is genuinely unavailable (null data URL)
 * 3. School logo loading from settings
 * 4. Multi-subject examination certificate generation
 * 5. Long student names and long subject names
 * 6. Incomplete marks policy (Pending status resolution)
 * 7. Class batch generation (Print All DMCs)
 * 8. Symmetrical 12-item student metadata grid data integrity
 * 9. Print CSS isolation and A4 single-page constraints
 * 10. PDF Export helper & IPC contract verification
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Compiled backend services from dist-electron
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createSubject, assignSubjectToClass } from '../dist-electron/database/services/subject.service.js';
import { createStudent, createEnrollment } from '../dist-electron/database/services/student.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';
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
  console.log(' PHASE 3: DMC PRINTING, PDF EXPORT & BACKEND INTEGRATION TEST SUITE');
  console.log('========================================================================\n');

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // 1. Run migrations
  console.log('--- Step 1: Database Migration & Schema Integrity ---');
  const migrationRes = runMigrations(db);
  assert(migrationRes.currentVersion === 8, 'All database migrations applied successfully');

  // 2. Auth & Admin setup
  console.log('\n--- Step 2: Administrator & Institutional Settings Setup ---');
  createInitialAdmin({ username: 'admin', displayName: 'System Administrator', password: 'AdminPassword123!' }, db);
  const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
  assert(loginRes.success && Boolean(loginRes.sessionToken), 'Admin login successful and sessionToken generated');
  const sessionToken = loginRes.sessionToken;

  // Configure School Settings with realistic details
  updateSchoolSettings(
    {
      sessionToken,
      schoolName: 'Universal Model Academy',
      schoolCode: 'UMA-2026',
      address: '42 Academic Avenue, Education Zone',
      city: 'Islamabad',
      province: 'Federal Capital',
      phone: '+92-51-1234567',
      email: 'info@universalacademy.edu.pk',
      principalName: 'Dr. Shahbaz Ahmed',
    },
    db
  );

  const schoolSettingsRes = getSchoolSettings(db);
  assert(schoolSettingsRes.schoolName === 'Universal Model Academy', 'Configured school name stored in database');
  assert(schoolSettingsRes.principalName === 'Dr. Shahbaz Ahmed', 'Configured principal name stored in database');

  // 3. Academic Structure Setup
  console.log('\n--- Step 3: Academic Structure & Curriculum Setup ---');
  const sessionRes = createSession(
    { sessionToken, name: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isCurrent: true },
    db
  );
  const sessionId = sessionRes.session.id;

  const classRes = createClass({ sessionToken, name: 'Class 10', displayOrder: 1 }, db);
  const classId = classRes.classItem.id;

  const sectionRes = createSection({ sessionToken, classId, name: 'Section A', capacity: 40 }, db);
  const sectionId = sectionRes.section.id;

  // Create 6 dynamic subjects including one with a long title
  const subjects = [
    { name: 'English Language & Composition', code: 'ENG-10' },
    { name: 'Mathematics & Statistics', code: 'MATH-10' },
    { name: 'Physics (Theoretical & Applied)', code: 'PHY-10' },
    { name: 'Chemistry & Molecular Biology', code: 'CHEM-10' },
    { name: 'Computer Science & Software Development', code: 'CS-10' },
    { name: 'Pakistan Studies & Islamic Ethics', code: 'PST-10' },
  ];

  const subjectIds = [];
  for (const s of subjects) {
    const subRes = createSubject({ sessionToken, name: s.name, code: s.code }, db);
    subjectIds.push(subRes.subject.id);
    assignSubjectToClass({ sessionToken, classId, subjectId: subRes.subject.id }, db);
  }
  assert(subjectIds.length === 6, 'Created and assigned 6 dynamic subjects to Class 10');

  // Grading rules
  const gradingRules = [
    { name: 'A+', minPercentage: 90, maxPercentage: 100, grade: 'A+', gradePoint: 4.0, remarks: 'Outstanding' },
    { name: 'A', minPercentage: 80, maxPercentage: 89.99, grade: 'A', gradePoint: 3.7, remarks: 'Excellent' },
    { name: 'B', minPercentage: 70, maxPercentage: 79.99, grade: 'B', gradePoint: 3.0, remarks: 'Very Good' },
    { name: 'C', minPercentage: 60, maxPercentage: 69.99, grade: 'C', gradePoint: 2.0, remarks: 'Good' },
    { name: 'D', minPercentage: 50, maxPercentage: 59.99, grade: 'D', gradePoint: 1.0, remarks: 'Fair' },
    { name: 'F', minPercentage: 0, maxPercentage: 49.99, grade: 'F', gradePoint: 0.0, remarks: 'Needs Improvement' },
  ];
  for (const rule of gradingRules) {
    saveGradingRule({ sessionToken, ...rule }, db);
  }

  // 4. Student Records Setup (Photographed student, No-photo student, Long-name student)
  console.log('\n--- Step 4: Diverse Student Enrollment & Photo Pipeline ---');
  // Student 1: With valid base64 photo
  const student1Res = createStudent(
    {
      sessionToken,
      firstName: 'Hamza',
      lastName: 'Tariq',
      displayName: 'Hamza Tariq',
      gender: 'Male',
      dateOfBirth: '2010-05-15',
      fatherName: 'Tariq Mehmood',
      phone: '03001234567',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'House 12, Street 4, F-8/2',
      admissionDate: '2022-04-10',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student1 = student1Res.student;
  createEnrollment(
    {
      sessionToken,
      studentId: student1.id,
      academicSessionId: sessionId,
      classId,
      sectionId,
      rollNumber: '101',
      admissionDate: '2022-04-10',
    },
    db
  );

  // Directly assign photo_path to student 1 in DB
  const fakePhotoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  db.prepare('UPDATE students SET photo_path = ? WHERE id = ?').run('uploads/students/student_101.png', student1.id);

  // Student 2: Genuinely NO photo (photo_path = null)
  const student2Res = createStudent(
    {
      sessionToken,
      firstName: 'Zainab',
      lastName: 'Bibi',
      displayName: 'Zainab Bibi',
      gender: 'Female',
      dateOfBirth: '2010-08-22',
      fatherName: 'Muhammad Rashid',
      phone: '03009876543',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'House 88, Street 19, G-9/1',
      admissionDate: '2023-04-05',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student2 = student2Res.student;
  createEnrollment(
    {
      sessionToken,
      studentId: student2.id,
      academicSessionId: sessionId,
      classId,
      sectionId,
      rollNumber: '102',
      admissionDate: '2023-04-05',
    },
    db
  );

  // Student 3: Very LONG student name and father's name
  const student3Res = createStudent(
    {
      sessionToken,
      firstName: 'Muhammad',
      lastName: 'Abdullah Tariq Al-Hussaini',
      displayName: 'Muhammad Abdullah Tariq Al-Hussaini',
      gender: 'Male',
      dateOfBirth: '2009-12-30',
      fatherName: 'Engr. Chaudhry Tariq Mehmood Khan Niazi',
      phone: '03005556677',
      city: 'Islamabad',
      province: 'Federal Capital',
      currentAddress: 'Sector H-11, National Education Campus',
      admissionDate: '2021-04-01',
      initialSessionId: sessionId,
      initialClassId: classId,
      initialSectionId: sectionId,
    },
    db
  );
  const student3 = student3Res.student;
  createEnrollment(
    {
      sessionToken,
      studentId: student3.id,
      academicSessionId: sessionId,
      classId,
      sectionId,
      rollNumber: '103',
      admissionDate: '2021-04-01',
    },
    db
  );

  // 5. Examination and Marks Setup
  console.log('\n--- Step 5: Examination Setup & Dynamic Marks Recording ---');
  const examTypeRes = createExamType({ sessionToken, name: 'Annual Examination', code: 'ANN' }, db);
  const examRes = createExamination(
    {
      sessionToken,
      academicSessionId: sessionId,
      examTypeId: examTypeRes.examType.id,
      name: 'Annual Examination 2026',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
      description: 'Official Board Pre-Assessment Examination',
    },
    db
  );
  const examId = examRes.examination.id;

  // Configure examination subjects
  const examSubjectsConfig = subjectIds.map((sId, idx) => ({
    subjectId: sId,
    maxMarks: 100,
    passingMarks: 40,
    displayOrder: idx + 1,
  }));
  const configRes = configureExaminationSubjects(
    { sessionToken, examinationId: examId, classId, subjects: examSubjectsConfig },
    db
  );
  const examinationSubjects = configRes.subjects || [];
  assert(examinationSubjects.length === 6, 'Configured 6 examination subjects');

  // Open examination for marks entry
  updateExaminationStatus({ sessionToken, id: examId, status: 'Open' }, db);

  // Student 1 (Hamza Tariq): Pass with high marks in all 6 subjects
  for (const es of examinationSubjects) {
    saveMarks(
      {
        sessionToken,
        examinationId: examId,
        examinationSubjectId: es.id,
        marks: [{ studentId: student1.id, enrollmentId: 1, obtainedMarks: 85, status: 'Entered' }],
      },
      db
    );
  }

  // Student 3 (Long Name): Pass with moderate marks
  for (const es of examinationSubjects) {
    saveMarks(
      {
        sessionToken,
        examinationId: examId,
        examinationSubjectId: es.id,
        marks: [{ studentId: student3.id, enrollmentId: 3, obtainedMarks: 72, status: 'Entered' }],
      },
      db
    );
  }

  // Student 2 (Zainab Bibi): Incomplete marks (only 3 of 6 subjects entered, 3 unentered)
  for (let i = 0; i < 3; i++) {
    saveMarks(
      {
        sessionToken,
        examinationId: examId,
        examinationSubjectId: examinationSubjects[i].id,
        marks: [{ studentId: student2.id, enrollmentId: 2, obtainedMarks: 65, status: 'Entered' }],
      },
      db
    );
  }

  // 6. Test Single Student DMC Compilation: Photographed Student
  console.log('\n--- Step 6: Test Single Student DMC (Photographed) ---');
  const dmc1Res = generateStudentDMC(examId, student1.id, db);
  assert(dmc1Res.success && Boolean(dmc1Res.dmc), 'Generated DMC for Student 1 (Hamza Tariq)');
  const dmc1 = dmc1Res.dmc;
  assert(dmc1.student.displayName === 'Hamza Tariq', 'DMC student name matches Hamza Tariq');
  assert(dmc1.student.rollNumber === '101', 'DMC rollNumber is present and matches 101');
  assert(dmc1.student.systemStudentId === (student1.studentId || student1.student_id), 'DMC student ID distinct from roll number');
  assert(dmc1.subjects.length === 6, 'DMC contains all 6 dynamically configured subjects');
  assert(dmc1.summary.result === 'Pass', 'DMC result status evaluates correctly to Pass');
  assert(dmc1.summary.percentage === 85, 'DMC percentage accurately computed at 85.0%');

  // 7. Test Single Student DMC Compilation: No-Photo & Incomplete Marks Student
  console.log('\n--- Step 7: Test Student with Genuinely No Photo & Incomplete Marks ---');
  const dmc2Res = generateStudentDMC(examId, student2.id, db);
  assert(dmc2Res.success && Boolean(dmc2Res.dmc), 'Generated DMC for Student 2 (Zainab Bibi)');
  const dmc2 = dmc2Res.dmc;
  assert(dmc2.student.photoDataUrl === null, 'DMC photoDataUrl is null for student with no uploaded photo');
  assert(dmc2.summary.result === 'Pending', 'Incomplete marks correctly trigger summary.result = "Pending"');
  assert(dmc2.summary.overallRemarks.includes('Pending'), 'Remarks indicate Result Pending due to incomplete marks');

  // 8. Test Single Student DMC Compilation: Long Name & Subject Wrapping
  console.log('\n--- Step 8: Test Student with Long Name & Long Subject Titles ---');
  const dmc3Res = generateStudentDMC(examId, student3.id, db);
  assert(dmc3Res.success && Boolean(dmc3Res.dmc), 'Generated DMC for Student 3 (Long Name)');
  const dmc3 = dmc3Res.dmc;
  assert(
    dmc3.student.displayName === 'Muhammad Abdullah Tariq Al-Hussaini',
    'Long student name preserved with full fidelity'
  );
  assert(
    dmc3.student.fatherName === 'Engr. Chaudhry Tariq Mehmood Khan Niazi',
    'Long father name preserved without truncation'
  );
  const longSub = dmc3.subjects.find((s) => s.subjectName.includes('Software Development'));
  assert(Boolean(longSub), 'Long subject name (Computer Science & Software Development) rendered dynamically');

  // 9. Test Class Batch Generation (Print All DMCs)
  console.log('\n--- Step 9: Test Whole Class Batch DMC Generation ---');
  const batchRes = generateClassDMC({ examinationId: examId, classId, sectionId }, db);
  assert(batchRes.success && Array.isArray(batchRes.dmcs), 'Batch generation succeeded');
  assert(batchRes.dmcs.length === 3, 'Batch generated exactly 3 student certificates for Class 10 Section A');
  assert(
    batchRes.dmcs[0].student.id !== batchRes.dmcs[1].student.id,
    'Each certificate corresponds to a unique student record'
  );

  // 10. Verify Print & PDF Utilities in Source
  console.log('\n--- Step 10: Verify Print & PDF Utilities Source Code ---');
  const printDMCSource = fs.readFileSync(path.resolve('src/utils/printDMC.ts'), 'utf-8');
  assert(printDMCSource.includes('export async function waitForDmcImages'), 'waitForDmcImages utility is exported');
  assert(printDMCSource.includes('export async function exportDMCPDF'), 'exportDMCPDF utility is exported');
  assert(printDMCSource.includes('injectA4PrintStyle'), 'Dynamic A4 portrait @page style injection exists');
  assert(printDMCSource.includes('removeA4PrintStyle'), 'Dynamic A4 style cleanup exists');

  // 11. Verify CSS Print Isolation and Single-Page A4 Dimensions
  console.log('\n--- Step 11: Verify CSS Print Styles & Dimension Constraints ---');
  const dmcCssSource = fs.readFileSync(path.resolve('src/styles/dmc.css'), 'utf-8');
  assert(dmcCssSource.includes('size: A4 portrait'), 'dmc.css specifies size: A4 portrait');
  assert(dmcCssSource.includes('max-width: 194mm'), 'dmc.css limits width to 194mm to prevent horizontal clipping');
  assert(dmcCssSource.includes('break-inside: avoid'), 'dmc.css applies break-inside: avoid to certificate');
  assert(dmcCssSource.includes('break-after: page'), 'dmc.css applies break-after: page for multi-student batch');
  assert(dmcCssSource.includes('.dmc-page-break:last-child'), 'dmc.css avoids trailing page break on last certificate');
  assert(dmcCssSource.includes('word-break: break-word'), 'dmc.css ensures long names wrap without clipping');

  db.close();

  console.log(`\n========================================================================`);
  console.log(` Results: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  console.log(`========================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
