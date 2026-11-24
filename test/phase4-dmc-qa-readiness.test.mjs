/**
 * Phase 4 DMC Final Quality Assurance, Workflow Testing, and Production Readiness
 * 
 * Comprehensive Verification:
 * 1. Database schema and migration integrity (all 8 migrations)
 * 2. Dynamic institution branding (school name, principal, contact, logo) - zero hardcoding
 * 3. Dynamic institution grading scale attached to StudentDMCData (dmc.gradingRules)
 * 4. Multi-student enrollment with varied academic profiles
 * 5. Accurate marks, percentage, GPA, and tied rank position calculation
 * 6. Incomplete / Pending marks isolation (Pending students NOT classified as Fail)
 * 7. Absent student handling (zero marks, absent status, Fail result)
 * 8. Single and batch DMC generation (generateStudentDMC & generateClassDMC)
 * 9. Display preferences field completeness (grade, GPA, percentage, position, remarks)
 * 10. Student photo data URL vs null fallback verification
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
  getAllGradingRules,
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
  console.log(' PHASE 4: DMC FINAL QA, WORKFLOW TESTING & READINESS TEST SUITE');
  console.log('========================================================================\n');

  // In-memory SQLite database
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // ─── SECTION 1: DATABASE MIGRATIONS & SCHEMA INTEGRITY ──────────────────────
  console.log('--- Section 1: Database Migrations & Schema Integrity ---');
  const migrationResult = runMigrations(db);
  assert(migrationResult.currentVersion === 8, 'All 8 database migrations applied successfully');

  // Verify critical tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert(tables.includes('students'), 'Table students exists');
  assert(tables.includes('examinations'), 'Table examinations exists');
  assert(tables.includes('exam_marks'), 'Table exam_marks exists');
  assert(tables.includes('grading_rules'), 'Table grading_rules exists');
  assert(tables.includes('school_settings'), 'Table school_settings exists');

  // ─── SECTION 2: DYNAMIC INSTITUTION BRANDING (ZERO HARDCODING) ──────────────
  console.log('\n--- Section 2: Dynamic Institutional Branding ---');
  createInitialAdmin({ username: 'admin', displayName: 'System Administrator', password: 'AdminPassword123!' }, db);
  const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
  assert(loginRes.success && Boolean(loginRes.sessionToken), 'Admin authenticated for test setup');
  const sessionToken = loginRes.sessionToken;

  const sampleLogoPath = 'uploads/branding/school_logo_custom.png';
  const customSchoolData = {
    sessionToken,
    schoolName: 'Horizon Vanguard Academy',
    schoolCode: 'HVA-2026',
    address: '42 Sector B, Educational Enclave',
    phone: '+92 51 9876543',
    email: 'info@horizonvanguard.edu.pk',
    principalName: 'Dr. Eleanor Vance',
  };

  const updateSettingsRes = updateSchoolSettings(customSchoolData, db);
  assert(updateSettingsRes.success, 'Dynamic institution settings saved');

  // Update logo_path directly in school_settings
  db.prepare('UPDATE school_settings SET logo_path = ?').run(sampleLogoPath);

  const retrievedSettings = getSchoolSettings(db);
  assert(retrievedSettings.schoolName === 'Horizon Vanguard Academy', 'School name is dynamic and not hardcoded');
  assert(retrievedSettings.principalName === 'Dr. Eleanor Vance', 'Principal name dynamically retrieved');
  assert(retrievedSettings.logoPath === sampleLogoPath, 'School logo path stored and retrieved');

  // ─── SECTION 3: DYNAMIC GRADING RULES CONFIGURATION ─────────────────────────
  console.log('\n--- Section 3: Dynamic Institution Grading Scale ---');
  // Clear any default grading rules and insert custom institutional rules
  db.prepare('DELETE FROM grading_rules').run();

  const customGradingRules = [
    { name: 'Outstanding', grade: 'A+', minPercentage: 90, maxPercentage: 100, gradePoint: 4.0, remarks: 'Outstanding' },
    { name: 'Excellent', grade: 'A', minPercentage: 80, maxPercentage: 89.99, gradePoint: 3.7, remarks: 'Excellent' },
    { name: 'Very Good', grade: 'B', minPercentage: 70, maxPercentage: 79.99, gradePoint: 3.0, remarks: 'Very Good' },
    { name: 'Good', grade: 'C', minPercentage: 60, maxPercentage: 69.99, gradePoint: 2.0, remarks: 'Good' },
    { name: 'Pass', grade: 'D', minPercentage: 50, maxPercentage: 59.99, gradePoint: 1.0, remarks: 'Pass' },
    { name: 'Fail', grade: 'F', minPercentage: 0, maxPercentage: 49.99, gradePoint: 0.0, remarks: 'Fail' },
  ];

  for (let i = 0; i < customGradingRules.length; i++) {
    saveGradingRule({ sessionToken, displayOrder: i + 1, ...customGradingRules[i] }, db);
  }

  const dbRules = getAllGradingRules(db);
  assert(dbRules.length === 6, 'All 6 custom grading rules persisted in database');
  assert(dbRules[0].grade === 'A+' && dbRules[0].minPercentage === 90, 'A+ rule threshold verified at 90%');

  // ─── SECTION 4: ACADEMIC INFRASTRUCTURE & ENROLLMENT ─────────────────────────
  console.log('\n--- Section 4: Academic Setup & Multi-Student Enrollment ---');
  const sessionRes = createSession({
    sessionToken,
    name: 'Academic Year 2025-2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isCurrent: true,
  }, db);
  const sessionId = sessionRes.session.id;

  const classRes = createClass({ sessionToken, name: 'Grade 10', displayOrder: 1 }, db);
  const classId = classRes.classItem.id;

  const secRes = createSection({ sessionToken, classId, name: 'Section Alpha', capacity: 40 }, db);
  const sectionId = secRes.section.id;

  // Subjects: English (100), Mathematics (100), Science (100)
  const engSub = createSubject({ sessionToken, name: 'English Literature', code: 'ENG-10', type: 'Theory' }, db).subject;
  const mathSub = createSubject({ sessionToken, name: 'Mathematics', code: 'MTH-10', type: 'Theory' }, db).subject;
  const sciSub = createSubject({ sessionToken, name: 'General Science', code: 'SCI-10', type: 'Both' }, db).subject;

  assignSubjectToClass({ sessionToken, classId, subjectId: engSub.id }, db);
  assignSubjectToClass({ sessionToken, classId, subjectId: mathSub.id }, db);
  assignSubjectToClass({ sessionToken, classId, subjectId: sciSub.id }, db);

  // Student 1: Top performer with photo
  const s1 = createStudent({
    sessionToken,
    firstName: 'Aaliyah',
    lastName: 'Tariq',
    displayName: 'Aaliyah Tariq',
    gender: 'Female',
    dateOfBirth: '2010-05-14',
    fatherName: 'Tariq Mehmood',
    phone: '03001111111',
    city: 'Islamabad',
    province: 'Federal',
    currentAddress: 'House 12, St 5',
    admissionDate: '2025-04-05',
    initialSessionId: sessionId,
    initialClassId: classId,
    initialSectionId: sectionId,
  }, db).student;
  const e1 = createEnrollment({
    sessionToken,
    studentId: s1.id,
    academicSessionId: sessionId,
    classId,
    sectionId,
    rollNumber: '10-01',
    admissionDate: '2025-04-05',
  }, db).enrollment;
  db.prepare('UPDATE students SET photo_path = ? WHERE id = ?').run('uploads/students/s1.png', s1.id);

  // Student 2: Co-Top performer (tied rank test) with photo
  const s2 = createStudent({
    sessionToken,
    firstName: 'Bilal',
    lastName: 'Ahmed',
    displayName: 'Bilal Ahmed',
    gender: 'Male',
    dateOfBirth: '2010-08-20',
    fatherName: 'Naveed Ahmed',
    phone: '03002222222',
    city: 'Rawalpindi',
    province: 'Punjab',
    currentAddress: 'House 88, Lane 2',
    admissionDate: '2025-04-06',
    initialSessionId: sessionId,
    initialClassId: classId,
    initialSectionId: sectionId,
  }, db).student;
  const e2 = createEnrollment({
    sessionToken,
    studentId: s2.id,
    academicSessionId: sessionId,
    classId,
    sectionId,
    rollNumber: '10-02',
    admissionDate: '2025-04-06',
  }, db).enrollment;
  db.prepare('UPDATE students SET photo_path = ? WHERE id = ?').run('uploads/students/s2.png', s2.id);

  // Student 3: Failing student without photo (null photo fallback test)
  const s3 = createStudent({
    sessionToken,
    firstName: 'Daniyal',
    lastName: 'Khan',
    displayName: 'Daniyal Khan',
    gender: 'Male',
    dateOfBirth: '2010-02-11',
    fatherName: 'Imran Khan',
    phone: '03003333333',
    city: 'Peshawar',
    province: 'KP',
    currentAddress: 'Village Road 3',
    admissionDate: '2025-04-07',
    initialSessionId: sessionId,
    initialClassId: classId,
    initialSectionId: sectionId,
  }, db).student;
  const e3 = createEnrollment({
    sessionToken,
    studentId: s3.id,
    academicSessionId: sessionId,
    classId,
    sectionId,
    rollNumber: '10-03',
    admissionDate: '2025-04-07',
  }, db).enrollment;

  // Student 4: Incomplete / Pending marks student
  const s4 = createStudent({
    sessionToken,
    firstName: 'Fatima',
    lastName: 'Zahra',
    displayName: 'Fatima Zahra',
    gender: 'Female',
    dateOfBirth: '2010-11-25',
    fatherName: 'Rashid Minhas',
    phone: '03004444444',
    city: 'Lahore',
    province: 'Punjab',
    currentAddress: 'Gulberg Block 3',
    admissionDate: '2025-04-08',
    initialSessionId: sessionId,
    initialClassId: classId,
    initialSectionId: sectionId,
  }, db).student;
  const e4 = createEnrollment({
    sessionToken,
    studentId: s4.id,
    academicSessionId: sessionId,
    classId,
    sectionId,
    rollNumber: '10-04',
    admissionDate: '2025-04-08',
  }, db).enrollment;

  assert(s1 && s2 && s3 && s4, 'Four distinct students created and enrolled');

  // ─── SECTION 5: EXAMINATION CREATION & MARKS ENTRY ──────────────────────────
  console.log('\n--- Section 5: Examination Configuration & Marks Entry ---');
  const examTypeRes = createExamType({ sessionToken, name: 'Annual Examination', code: 'ANN' }, db);
  const examRes = createExamination({
    sessionToken,
    academicSessionId: sessionId,
    examTypeId: examTypeRes.examType.id,
    name: 'Final Term Examination 2026',
    startDate: '2026-03-01',
    endDate: '2026-03-15',
  }, db);
  const examId = examRes.examination.id;

  const configRes = configureExaminationSubjects({
    sessionToken,
    examinationId: examId,
    classId,
    subjects: [
      { subjectId: engSub.id, maxMarks: 100, passingMarks: 40, displayOrder: 1 },
      { subjectId: mathSub.id, maxMarks: 100, passingMarks: 40, displayOrder: 2 },
      { subjectId: sciSub.id, maxMarks: 100, passingMarks: 40, displayOrder: 3 },
    ],
  }, db);
  assert(configRes.success, 'Examination subjects configured with 100 max marks and 40 pass marks each');

  updateExaminationStatus({ sessionToken, id: examId, status: 'Open' }, db);

  const examSubjects = db.prepare('SELECT id, subject_id FROM examination_subjects WHERE examination_id = ?').all(examId);
  const esEng = examSubjects.find(s => s.subject_id === engSub.id).id;
  const esMath = examSubjects.find(s => s.subject_id === mathSub.id).id;
  const esSci = examSubjects.find(s => s.subject_id === sciSub.id).id;

  // Student 1 Marks (High Performer): 95 in Eng, 95 in Math, 95 in Sci => Total 285/300 (95.0%)
  // Student 2 Marks (Tied Rank): 95 in Eng, 95 in Math, 95 in Sci => Total 285/300 (95.0%)
  // Student 3 Marks (Failing): 35 in Eng (Fail), 30 in Math (Fail), 45 in Sci => Total 110/300 (36.7%)
  // Student 4 Marks (Pending): Marks entered ONLY for English (80), Math and Sci missing!
  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esEng,
    marks: [
      { studentId: s1.id, enrollmentId: e1.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s2.id, enrollmentId: e2.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s3.id, enrollmentId: e3.id, obtainedMarks: 35, status: 'Entered' },
      { studentId: s4.id, enrollmentId: e4.id, obtainedMarks: 80, status: 'Entered' },
    ],
  }, db);

  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esMath,
    marks: [
      { studentId: s1.id, enrollmentId: e1.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s2.id, enrollmentId: e2.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s3.id, enrollmentId: e3.id, obtainedMarks: 30, status: 'Entered' },
      // s4 skipped (missing marks)
    ],
  }, db);

  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esSci,
    marks: [
      { studentId: s1.id, enrollmentId: e1.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s2.id, enrollmentId: e2.id, obtainedMarks: 95, status: 'Entered' },
      { studentId: s3.id, enrollmentId: e3.id, obtainedMarks: 45, status: 'Entered' },
      // s4 skipped (missing marks)
    ],
  }, db);

  // ─── SECTION 6: SINGLE STUDENT DMC VERIFICATION & DYNAMIC RULES ─────────────
  console.log('\n--- Section 6: Student 1 DMC Verification (generateStudentDMC) ---');
  const dmc1Res = generateStudentDMC(examId, s1.id, db);
  assert(dmc1Res.success && Boolean(dmc1Res.dmc), 'DMC successfully generated for Student 1');
  const dmc1 = dmc1Res.dmc;
  assert(dmc1.student.displayName === 'Aaliyah Tariq', 'Student displayName correctly populated');
  assert(dmc1.student.fatherName === 'Tariq Mehmood', 'Father name correctly populated');
  assert(dmc1.student.rollNumber === '10-01', 'Roll number correctly populated');
  assert(dmc1.school.schoolName === 'Horizon Vanguard Academy', 'School name reflects dynamic institutional settings');
  assert(dmc1.subjects.length === 3, 'All 3 examination subjects included in report card');
  assert(dmc1.summary.totalObtainedMarks === 285, 'Total marks correctly calculated: 285');
  assert(dmc1.summary.totalMaxMarks === 300, 'Total max marks correctly calculated: 300');
  assert(dmc1.summary.percentage === 95.0, 'Percentage accurately calculated: 95.0%');
  assert(dmc1.summary.grade === 'A+', 'Grade correctly resolved against dynamic 90% threshold for A+');
  assert(dmc1.summary.result === 'Pass', 'Result status is Pass');
  assert(Array.isArray(dmc1.gradingRules), 'Grading rules attached to StudentDMCData');
  assert(dmc1.gradingRules.length === 6, 'All 6 institutional grading rules included in certificate payload');
  assert(dmc1.gradingRules[0].grade === 'A+', 'Dynamic grading rules contain custom A+ scale');

  // ─── SECTION 7: CLASS BATCH DMC & TIED POSITIONS VERIFICATION ────────────────
  console.log('\n--- Section 7: Class Batch DMC & Position Ranking (generateClassDMC) ---');
  const classDMCRes = generateClassDMC({ examinationId: examId, classId, sectionId }, db);
  assert(classDMCRes.success && Boolean(classDMCRes.dmcs), 'generateClassDMC returned success');
  const classDMCs = classDMCRes.dmcs;
  assert(classDMCs.length === 4, 'All 4 enrolled students included in class batch');

  const s1DMC = classDMCs.find(d => d.student.id === s1.id);
  const s2DMC = classDMCs.find(d => d.student.id === s2.id);
  const s3DMC = classDMCs.find(d => d.student.id === s3.id);
  const s4DMC = classDMCs.find(d => d.student.id === s4.id);

  // Position verification:
  // Both s1 and s2 achieved 95.0% => Both MUST be ranked Position 1 (tied rank)
  assert(s1DMC.summary.position === 1, `Student 1 (95%) awarded Position 1 (actual: ${s1DMC.summary.position})`);
  assert(s2DMC.summary.position === 1, `Student 2 (95%) tied and awarded Position 1 (actual: ${s2DMC.summary.position})`);

  // Student 3 failed:
  assert(s3DMC.summary.result === 'Fail', 'Student 3 marked as Fail due to failing marks in English and Math');
  assert(s3DMC.student.photoDataUrl === null, 'Student 3 has null photoDataUrl, triggering UI avatar fallback gracefully');

  // ─── SECTION 8: INCOMPLETE / PENDING MARKS VERIFICATION ─────────────────────
  console.log('\n--- Section 8: Incomplete Marks / Pending Policy Verification ---');
  // Student 4 had marks for only 1 of 3 subjects:
  assert(s4DMC.summary.result === 'Pending', `Student 4 with missing subject marks resolved as Pending (actual: ${s4DMC.summary.result})`);
  assert(
    s4DMC.summary.overallRemarks.toLowerCase().includes('pending') ||
    s4DMC.summary.overallRemarks.toLowerCase().includes('incomplete'),
    'Remarks indicate incomplete / pending evaluation'
  );

  // Statistical segregation check:
  // Pending students must NOT be counted as failed in KPI computations
  const totalStudents = classDMCs.length;
  const passedStudents = classDMCs.filter(d => d.summary.result === 'Pass').length;
  const pendingStudents = classDMCs.filter(d => d.summary.result === 'Pending').length;
  const failedStudents = classDMCs.filter(d => d.summary.result === 'Fail').length;

  assert(totalStudents === 4, 'Total students is 4');
  assert(passedStudents === 2, 'Passed students is 2 (Aaliyah, Bilal)');
  assert(failedStudents === 1, 'Failed students is 1 (Daniyal)');
  assert(pendingStudents === 1, 'Pending students is 1 (Fatima)');
  assert(passedStudents + failedStudents + pendingStudents === totalStudents, 'Passed + Failed + Pending exactly equals Total');

  const evaluatedStudents = totalStudents - pendingStudents;
  const passRate = (passedStudents / evaluatedStudents) * 100;
  assert(Math.abs(passRate - 66.67) < 0.1, `Pass rate computed over evaluated students is ~66.7% (actual: ${passRate.toFixed(1)}%)`);

  // ─── SECTION 9: DISPLAY SETTINGS & PREFERENCE CONTRACT ──────────────────────
  console.log('\n--- Section 9: DMC Display Preferences & Field Alignment ---');
  // Check that StudentDMCData summary contains all separate fields required for toggle rendering:
  assert('grade' in s1DMC.summary, 'DMC summary contains grade (for showGradeSymbol)');
  assert('gradePoint' in s1DMC.summary, 'DMC summary contains gradePoint (for showGradePoint)');
  assert('percentage' in s1DMC.summary, 'DMC summary contains percentage (for showPercentage)');
  assert('position' in s1DMC.summary, 'DMC summary contains position (for showPosition)');
  assert('overallRemarks' in s1DMC.summary, 'DMC summary contains overallRemarks (for showRemarks)');

  // ─── SECTION 10: ABSENTEE & ZERO MARKS HANDLING ─────────────────────────────
  console.log('\n--- Section 10: Absenteeism & Zero Marks Policy Verification ---');
  const s5 = createStudent({
    sessionToken,
    firstName: 'Hamza',
    lastName: 'Abid',
    displayName: 'Hamza Abid',
    gender: 'Male',
    dateOfBirth: '2010-04-12',
    fatherName: 'Abid Hussain',
    phone: '03005555555',
    city: 'Multan',
    province: 'Punjab',
    currentAddress: 'Colony Road',
    admissionDate: '2025-04-09',
    initialSessionId: sessionId,
    initialClassId: classId,
    initialSectionId: sectionId,
  }, db).student;
  const e5 = createEnrollment({
    sessionToken,
    studentId: s5.id,
    academicSessionId: sessionId,
    classId,
    sectionId,
    rollNumber: '10-05',
    admissionDate: '2025-04-09',
  }, db).enrollment;

  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esEng,
    marks: [{ studentId: s5.id, enrollmentId: e5.id, obtainedMarks: null, status: 'Absent' }],
  }, db);
  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esMath,
    marks: [{ studentId: s5.id, enrollmentId: e5.id, obtainedMarks: null, status: 'Absent' }],
  }, db);
  saveMarks({
    sessionToken,
    examinationId: examId,
    examinationSubjectId: esSci,
    marks: [{ studentId: s5.id, enrollmentId: e5.id, obtainedMarks: null, status: 'Absent' }],
  }, db);

  const dmc5Res = generateStudentDMC(examId, s5.id, db);
  assert(dmc5Res.success && Boolean(dmc5Res.dmc), 'DMC generated for absent student');
  const dmc5 = dmc5Res.dmc;
  assert(dmc5.summary.result === 'Fail', 'Student absent from all subjects is marked Fail');
  assert(dmc5.summary.totalObtainedMarks === 0, 'Total marks obtained is 0 for absent student');
  const engSubjectDmc = dmc5.subjects.find(s => s.subjectName === 'English Literature');
  assert(engSubjectDmc.status === 'Absent', 'Absent subject marks reflect status = Absent');

  db.close();

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests} assertions`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite runtime failure:', err);
  process.exit(1);
});
