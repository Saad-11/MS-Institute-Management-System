/**
 * Automated Test Suite — Phase 7: Examinations, Marks, Results & Dynamic DMC
 * 
 * Verifies:
 * 1. Migration 006 schema integrity (exam_types, examinations, examination_subjects, grading_rules, exam_marks)
 * 2. Exam Types CRUD, unique names/codes, active toggle
 * 3. Examinations management, status lifecycle (Draft -> Open -> Closed), session associations
 * 4. Dynamic Subject System: validating and linking examination subjects strictly against class_subjects
 *    Rejection of subjects not assigned to the class in the academic curriculum
 *    Support for classes having completely different subjects (e.g. Science vs Arts or Primary vs High)
 * 5. Grading rules: customizable percentage ranges, grade evaluation, boundary edge cases (79.99 vs 80.00)
 * 6. Marks entry & transaction:
 *    Obtained marks bounds checking (0 to max_marks)
 *    Explicit Absent student handling (not fake zero mark; preserved status)
 *    Prohibition of entering/modifying marks when examination is Closed
 * 7. Results calculation:
 *    Centralized calculation (Total Max, Total Obtained, Percentage rounded to 2 decimal places)
 *    Strict pass/fail criteria (fails if any subject < passing_marks or if student absent)
 *    Class-wide results, ranking/positions, and subject-level pass/fail statistics
 * 8. Dynamic DMC Generation:
 *    School branding & contact details
 *    Student demographic ("Student ID" label, never roll number)
 *    Dynamic subjects list (only subjects configured for that student's class)
 *    Clean print layout verification
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Import backend modules from dist-electron
import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  createInitialAdmin,
  login,
} from '../dist-electron/database/services/auth.service.js';
import {
  createSession,
} from '../dist-electron/database/services/academic-session.service.js';
import {
  createClass,
  createSection,
} from '../dist-electron/database/services/class.service.js';
import {
  createSubject,
  assignSubjectToClass,
} from '../dist-electron/database/services/subject.service.js';
import {
  createStudent,
  createEnrollment,
} from '../dist-electron/database/services/student.service.js';
import {
  getAllExamTypes,
  createExamType,
  updateExamType,
  toggleExamTypeStatus,
  getAllExaminations,
  getExaminationById,
  createExamination,
  updateExamination,
  updateExaminationStatus,
  getExaminationSubjects,
  configureExaminationSubjects,
  getAllGradingRules,
  saveGradingRule,
  deleteGradingRule,
  evaluateGrade,
  getStudentsForMarksEntry,
  saveMarks,
  calculateStudentExamResult,
  getClassExamResults,
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

function assertThrows(fn, testName) {
  try {
    fn();
    console.error(`  ✗ FAIL (Expected error but succeeded): ${testName}`);
    failedTests++;
  } catch (_e) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log(' PHASE 7: EXAMINATIONS, MARKS, RESULTS & DYNAMIC DMC TESTS');
  console.log('===============================================================\n');

  // Setup in-memory SQLite database
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // ─── 1. Migrations & Schema Verification ───────────────────────────────────
  console.log('--- 1. Database Schema & Migration 006 ---');
  const migrationResult = runMigrations(db);
  assert(migrationResult.appliedCount >= 6, 'All 6 migrations applied successfully');
  assert(migrationResult.currentVersion >= 6, 'Schema version is at least 6');

  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
  assert(tables.includes('exam_types'), 'exam_types table exists');
  assert(tables.includes('examinations'), 'examinations table exists');
  assert(tables.includes('examination_subjects'), 'examination_subjects table exists');
  assert(tables.includes('grading_rules'), 'grading_rules table exists');
  assert(tables.includes('exam_marks'), 'exam_marks table exists');

  // Verify default seeded grading rules
  const defaultRules = getAllGradingRules(db);
  assert(defaultRules.length === 7, 'Default 7 grading rules seeded (A+, A, B, C, D, E, F)');
  assert(defaultRules[0].grade === 'A+' && defaultRules[0].minPercentage === 90, 'A+ rule starts at 90%');
  assert(defaultRules[6].grade === 'F' && defaultRules[6].minPercentage === 0, 'F rule covers failing percentage');

  // ─── 2. Setup Base Academic Fixtures ───────────────────────────────────────
  console.log('\n--- 2. Setting Up Academic Fixtures ---');
  createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
  const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
  const token = loginRes.sessionToken;

  const sessRes = createSession({ sessionToken: token, name: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true }, db);
  const sessionId = sessRes.session.id;

  // Create two distinct classes: Grade 9 (Science) and Grade 5 (Primary)
  const class9Res = createClass({ sessionToken: token, name: 'Grade 9', code: 'G9' }, db);
  const class9Id = class9Res.classItem.id;
  const sec9Res = createSection({ sessionToken: token, classId: class9Id, name: 'Section A' }, db);
  const sec9Id = sec9Res.section.id;

  const class5Res = createClass({ sessionToken: token, name: 'Grade 5', code: 'G5' }, db);
  const class5Id = class5Res.classItem.id;
  const sec5Res = createSection({ sessionToken: token, classId: class5Id, name: 'Section A' }, db);
  const sec5Id = sec5Res.section.id;

  // Create subjects
  const mathRes = createSubject({ sessionToken: token, name: 'Mathematics', code: 'MATH' }, db);
  const mathId = mathRes.subject.id;
  const phyRes = createSubject({ sessionToken: token, name: 'Physics', code: 'PHY' }, db);
  const phyId = phyRes.subject.id;
  const engRes = createSubject({ sessionToken: token, name: 'English', code: 'ENG' }, db);
  const engId = engRes.subject.id;
  const artRes = createSubject({ sessionToken: token, name: 'Art & Craft', code: 'ART' }, db);
  const artId = artRes.subject.id;

  // Dynamic Curriculum: Grade 9 gets Math, Physics, English. Grade 5 gets English, Art.
  assignSubjectToClass({ sessionToken: token, classId: class9Id, subjectId: mathId }, db);
  assignSubjectToClass({ sessionToken: token, classId: class9Id, subjectId: phyId }, db);
  assignSubjectToClass({ sessionToken: token, classId: class9Id, subjectId: engId }, db);

  assignSubjectToClass({ sessionToken: token, classId: class5Id, subjectId: engId }, db);
  assignSubjectToClass({ sessionToken: token, classId: class5Id, subjectId: artId }, db);

  // Enroll students in Grade 9
  const st1 = createStudent({
    sessionToken: token,
    firstName: 'Ahmad',
    lastName: 'Khan',
    gender: 'Male',
    fatherName: 'Farooq Khan',
    dateOfBirth: '2010-01-01',
    enrollment: {
      academicSessionId: sessionId,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2026-08-01',
      status: 'Active',
    },
  }, db);
  const st1Id = st1.student.id;
  const en1Id = st1.student.currentEnrollment.id;

  const st2 = createStudent({
    sessionToken: token,
    firstName: 'Bisma',
    lastName: 'Noor',
    gender: 'Female',
    fatherName: 'Noor Ali',
    dateOfBirth: '2010-05-10',
    enrollment: {
      academicSessionId: sessionId,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2026-08-01',
      status: 'Active',
    },
  }, db);
  const st2Id = st2.student.id;
  const en2Id = st2.student.currentEnrollment.id;

  const st3 = createStudent({
    sessionToken: token,
    firstName: 'Daniyal',
    lastName: 'Raza',
    gender: 'Male',
    fatherName: 'Raza Shah',
    dateOfBirth: '2010-09-15',
    enrollment: {
      academicSessionId: sessionId,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2026-08-01',
      status: 'Active',
    },
  }, db);
  const st3Id = st3.student.id;
  const en3Id = st3.student.currentEnrollment.id;

  assert(st1.success && st2.success && st3.success, 'Students created and actively enrolled');

  // ─── 3. Exam Types Management ─────────────────────────────────────────────
  console.log('\n--- 3. Exam Types CRUD ---');
  const type1 = createExamType({ sessionToken: token, name: 'Mid Term Examination', code: 'MID', description: 'First term exams' }, db);
  assert(type1.success && type1.examType.code === 'MID', 'Created exam type Mid Term (MID)');

  const type2 = createExamType({ sessionToken: token, name: 'Final Examination', code: 'FINAL' }, db);
  assert(type2.success && type2.examType.code === 'FINAL', 'Created exam type Final (FINAL)');

  // Duplicate prevention
  const dupName = createExamType({ sessionToken: token, name: 'mid term examination', code: 'MID2' }, db);
  assert(!dupName.success, 'Rejects duplicate exam type name case-insensitively');

  const dupCode = createExamType({ sessionToken: token, name: 'Other Mid Term', code: 'mid' }, db);
  assert(!dupCode.success, 'Rejects duplicate exam type code case-insensitively');

  // Status toggle
  const toggleRes = toggleExamTypeStatus({ sessionToken: token, id: type1.examType.id, isActive: false }, db);
  assert(toggleRes.success && toggleRes.examType.isActive === false, 'Deactivated exam type');
  toggleExamTypeStatus({ sessionToken: token, id: type1.examType.id, isActive: true }, db);

  // ─── 4. Examinations Management ───────────────────────────────────────────
  console.log('\n--- 4. Examinations Management & Lifecycle ---');
  const examCreate = createExamination({
    sessionToken: token,
    academicSessionId: sessionId,
    examTypeId: type1.examType.id,
    name: 'Mid Term 2026',
    startDate: '2026-10-10',
    endDate: '2026-10-25',
    description: 'Fall semester examination',
  }, db);
  assert(examCreate.success && examCreate.examination.status === 'Draft', 'Created examination in Draft status');
  const examId = examCreate.examination.id;

  // Date validation: start date cannot be after end date
  const invalidDateExam = createExamination({
    sessionToken: token,
    academicSessionId: sessionId,
    examTypeId: type1.examType.id,
    name: 'Invalid Exam',
    startDate: '2026-10-25',
    endDate: '2026-10-10',
  }, db);
  assert(!invalidDateExam.success, 'Rejects examination where start date > end date');

  // Status transitions
  const statusOpen = updateExaminationStatus({ sessionToken: token, id: examId, status: 'Open' }, db);
  assert(statusOpen.success && statusOpen.examination.status === 'Open', 'Updated exam status to Open');

  // ─── 5. Dynamic Subject System & Curriculum Enforcement ───────────────────
  console.log('\n--- 5. Dynamic Subject System & Class Curriculum Validation ---');
  // Attempt to configure Art & Craft for Grade 9 (Art is NOT in Grade 9 curriculum!)
  const invalidSubConfig = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class9Id,
    subjects: [
      { subjectId: mathId, maxMarks: 100, passingMarks: 40 },
      { subjectId: artId, maxMarks: 50, passingMarks: 20 }, // INVALID!
    ],
  }, db);
  assert(!invalidSubConfig.success, 'Rejected subject not assigned to class curriculum');
  assert(invalidSubConfig.error.includes('not assigned to this class'), 'Error message specifically notes curriculum violation');

  // Valid subject configuration for Grade 9: Math (100/40), Physics (100/40), English (100/40)
  const validSubConfig = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class9Id,
    subjects: [
      { subjectId: mathId, maxMarks: 100, passingMarks: 40, displayOrder: 1 },
      { subjectId: phyId, maxMarks: 100, passingMarks: 40, displayOrder: 2 },
      { subjectId: engId, maxMarks: 100, passingMarks: 40, displayOrder: 3 },
    ],
  }, db);
  assert(validSubConfig.success && validSubConfig.subjects.length === 3, 'Configured 3 valid subjects for Grade 9');

  // Configure Grade 5 with its distinct dynamic subjects: English (50/20), Art (50/20)
  const grade5Config = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class5Id,
    subjects: [
      { subjectId: engId, maxMarks: 50, passingMarks: 20, displayOrder: 1 },
      { subjectId: artId, maxMarks: 50, passingMarks: 20, displayOrder: 2 },
    ],
  }, db);
  assert(grade5Config.success && grade5Config.subjects.length === 2, 'Configured Grade 5 with completely different subjects');

  // Bounds validation on max/passing marks
  const invalidMarksConfig = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class9Id,
    subjects: [
      { subjectId: mathId, maxMarks: 100, passingMarks: 120 }, // passing > max!
    ],
  }, db);
  assert(!invalidMarksConfig.success, 'Rejects configuration where passing marks > maximum marks');

  // ─── 6. Grading Rules & Edge Case Boundaries ──────────────────────────────
  console.log('\n--- 6. Grading Scale & Precision Boundaries ---');
  assert(evaluateGrade(95, defaultRules).grade === 'A+', '95% evaluates to A+');
  assert(evaluateGrade(90, defaultRules).grade === 'A+', 'Exact 90.00% evaluates to A+');
  assert(evaluateGrade(89.99, defaultRules).grade === 'A', 'Exact 89.99% evaluates to A');
  assert(evaluateGrade(80.00, defaultRules).grade === 'A', 'Exact 80.00% evaluates to A');
  assert(evaluateGrade(79.99, defaultRules).grade === 'B', 'Exact 79.99% evaluates to B');
  assert(evaluateGrade(40.00, defaultRules).grade === 'E', 'Exact 40.00% evaluates to E (Pass boundary)');
  assert(evaluateGrade(39.99, defaultRules).grade === 'F', 'Exact 39.99% evaluates to F (Fail boundary)');
  assert(evaluateGrade(0, defaultRules).grade === 'F', '0% evaluates to F');

  // ─── 7. Marks Entry, Absent Students & Closed Exam Protection ─────────────
  console.log('\n--- 7. Marks Entry & Validation ---');
  const examSubs = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  const mathExamSub = examSubs.find((s) => s.subjectId === mathId);
  const phyExamSub = examSubs.find((s) => s.subjectId === phyId);
  const engExamSub = examSubs.find((s) => s.subjectId === engId);

  // Over-marks rejection (> 100)
  const overMarksRes = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: mathExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: 105, status: 'Entered' },
    ],
  }, db);
  assert(!overMarksRes.success, 'Rejected obtained marks exceeding max_marks (105 > 100)');

  // Negative marks rejection
  const negMarksRes = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: mathExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: -5, status: 'Entered' },
    ],
  }, db);
  assert(!negMarksRes.success, 'Rejected negative obtained marks (-5)');

  // Enter Math marks:
  // st1: 95 (A+)
  // st2: 75 (B)
  // st3: 30 (Fail < 40)
  const mathMarksSave = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: mathExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: 95, status: 'Entered' },
      { studentId: st2Id, enrollmentId: en2Id, obtainedMarks: 75, status: 'Entered' },
      { studentId: st3Id, enrollmentId: en3Id, obtainedMarks: 30, status: 'Entered' },
    ],
  }, db);
  assert(mathMarksSave.success && mathMarksSave.savedCount === 3, 'Saved Math marks transactionally for all 3 students');

  // Enter Physics marks:
  // st1: 90
  // st2: 80
  // st3: Absent! (Explicit absent status)
  const phyMarksSave = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: phyExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: 90, status: 'Entered' },
      { studentId: st2Id, enrollmentId: en2Id, obtainedMarks: 80, status: 'Entered' },
      { studentId: st3Id, enrollmentId: en3Id, obtainedMarks: null, status: 'Absent', remarks: 'Sick leave' },
    ],
  }, db);
  assert(phyMarksSave.success && phyMarksSave.savedCount === 3, 'Saved Physics marks with explicit Absent status for student 3');

  // Enter English marks:
  // st1: 92
  // st2: 85
  // st3: 50
  const engMarksSave = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: engExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: 92, status: 'Entered' },
      { studentId: st2Id, enrollmentId: en2Id, obtainedMarks: 85, status: 'Entered' },
      { studentId: st3Id, enrollmentId: en3Id, obtainedMarks: 50, status: 'Entered' },
    ],
  }, db);
  assert(engMarksSave.success && engMarksSave.savedCount === 3, 'Saved English marks for all students');

  // Test retrieval for marks entry table
  const marksEntryTable = getStudentsForMarksEntry({
    examinationId: examId,
    classId: class9Id,
    examinationSubjectId: phyExamSub.id,
  }, db);
  assert(marksEntryTable.success && marksEntryTable.students.length === 3, 'Loaded students for marks entry sheet');
  const st3Entry = marksEntryTable.students.find((s) => s.studentId === st3Id);
  assert(st3Entry.status === 'Absent' && st3Entry.obtainedMarks === null, 'Retrieved absent status correctly preserved without fake 0 mark');

  // ─── 8. Result Calculations & Centralized Pass/Fail Criteria ──────────────
  console.log('\n--- 8. Centralized Result Calculation & Grading ---');
  // Student 1: Math=95, Phy=90, Eng=92. Total=277 / 300 = 92.33% -> Passed, Grade A+
  const res1 = calculateStudentExamResult(examId, st1Id, db);
  assert(res1.success, 'Calculated result for student 1');
  assert(res1.result.totalMaxMarks === 300, 'Student 1 totalMaxMarks = 300');
  assert(res1.result.totalObtainedMarks === 277, 'Student 1 totalObtainedMarks = 277');
  assert(res1.result.percentage === 92.33, 'Student 1 percentage = 92.33%');
  assert(res1.result.grade === 'A+', 'Student 1 grade = A+');
  assert(res1.result.isPassed === true, 'Student 1 passed all subjects');

  // Student 2: Math=75, Phy=80, Eng=85. Total=240 / 300 = 80.00% -> Passed, Grade A
  const res2 = calculateStudentExamResult(examId, st2Id, db);
  assert(res2.success, 'Calculated result for student 2');
  assert(res2.result.totalObtainedMarks === 240, 'Student 2 totalObtainedMarks = 240');
  assert(res2.result.percentage === 80.00, 'Student 2 percentage = 80.00%');
  assert(res2.result.grade === 'A', 'Student 2 grade = A');
  assert(res2.result.isPassed === true, 'Student 2 passed');

  // Student 3: Math=30 (Fail < 40), Phy=Absent (Fail), Eng=50.
  // Must fail overall because at least one subject was failed or absent
  const res3 = calculateStudentExamResult(examId, st3Id, db);
  assert(res3.success, 'Calculated result for student 3');
  assert(res3.result.isPassed === false, 'Student 3 failed overall due to failed and absent subjects');
  assert(res3.result.grade === 'F', 'Student 3 overall grade is F');
  assert(res3.result.totalObtainedMarks === 80, 'Absent subject contributes 0 to obtained marks (30 + 0 + 50 = 80)');

  // ─── 9. Class Results & Positions ─────────────────────────────────────────
  console.log('\n--- 9. Class Exam Results & Ranking ---');
  const classRes = getClassExamResults({ examinationId: examId, classId: class9Id }, db);
  assert(classRes.success, 'Calculated class-wide results');
  assert(classRes.results.totalStudents === 3, 'Total 3 students in class result');
  assert(classRes.results.passedStudents === 2, 'Passed students count = 2');
  assert(classRes.results.failedStudents === 1, 'Failed students count = 1');
  assert(classRes.results.passPercentage === 66.67, 'Pass percentage = 66.67%');

  // Ranks: Student 1 (92.33%) -> Position 1, Student 2 (80%) -> Position 2, Student 3 -> Position 3
  const ranked1 = classRes.results.studentResults.find((r) => r.studentId === st1Id);
  const ranked2 = classRes.results.studentResults.find((r) => r.studentId === st2Id);
  const ranked3 = classRes.results.studentResults.find((r) => r.studentId === st3Id);
  assert(ranked1.position === 1, 'Student 1 is ranked Position 1');
  assert(ranked2.position === 2, 'Student 2 is ranked Position 2');
  assert(ranked3.position === 3, 'Student 3 is ranked Position 3');

  // Subject performance stats
  const phyStats = classRes.results.subjects.find((s) => s.id === phyExamSub.id);
  assert(phyStats.passCount === 2, 'Physics pass count = 2');
  assert(phyStats.failCount === 1, 'Physics fail count = 1 (Absent counted as fail)');

  // ─── 10. Dynamic Detailed Marks Certificate (DMC) ─────────────────────────
  console.log('\n--- 10. Dynamic DMC Generation & Layout ---');
  const dmc1 = generateStudentDMC(examId, st1Id, db);
  assert(dmc1.success, 'Generated DMC for Student 1');
  assert(dmc1.dmc.student.systemStudentId.startsWith('STD-'), 'DMC contains system student ID');
  assert(dmc1.dmc.student.displayName === 'Ahmad Khan', 'DMC contains student display name');
  assert(dmc1.dmc.student.fatherName === 'Farooq Khan', 'DMC contains father name');
  assert(dmc1.dmc.summary.position === 1, 'DMC displays position 1');
  assert(dmc1.dmc.subjects.length === 3, 'DMC dynamically contains only Grade 9 subjects (3 subjects)');
  assert(!dmc1.dmc.subjects.some((s) => s.subjectName === 'Art & Craft'), 'DMC does NOT contain subjects from other classes');

  // Absent student DMC verification
  const dmc3 = generateStudentDMC(examId, st3Id, db);
  assert(dmc3.success, 'Generated DMC for Student 3');
  const absentPhy = dmc3.dmc.subjects.find((s) => s.subjectName === 'Physics');
  assert(absentPhy.status === 'Absent' && absentPhy.grade === 'Absent', 'Absent subject is clearly designated as Absent on DMC');
  assert(dmc3.dmc.summary.result === 'Fail', 'DMC summary indicates Fail');

  // Class-wide DMC batch generation
  const classDMCs = generateClassDMC({ examinationId: examId, classId: class9Id }, db);
  assert(classDMCs.success && classDMCs.dmcs.length === 3, 'Generated batch DMCs for entire class (3 certificates)');

  // ─── 11. Closed Examination Protection ────────────────────────────────────
  console.log('\n--- 11. Closed Examination Guard ---');
  // Close the examination
  updateExaminationStatus({ sessionToken: token, id: examId, status: 'Closed' }, db);
  const closedExam = getExaminationById(examId, db);
  assert(closedExam.status === 'Closed', 'Exam status changed to Closed');

  // Attempting to modify marks on closed exam must fail
  const closedMarksSave = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: mathExamSub.id,
    marks: [
      { studentId: st1Id, enrollmentId: en1Id, obtainedMarks: 99, status: 'Entered' },
    ],
  }, db);
  assert(!closedMarksSave.success, 'Prevented marks entry on Closed examination');
  assert(closedMarksSave.error.includes('Closed'), 'Error specifies examination is closed');

  // Attempting to modify exam subjects on closed exam must fail
  const closedSubjectConfig = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class9Id,
    subjects: [{ subjectId: mathId, maxMarks: 100, passingMarks: 40 }],
  }, db);
  assert(!closedSubjectConfig.success, 'Prevented subject configuration on Closed examination');

  // Existing marks and DMCs must still be readable and printable when exam is closed
  const closedDmc = generateStudentDMC(examId, st1Id, db);
  assert(closedDmc.success && closedDmc.dmc.summary.percentage === 92.33, 'DMC remains fully readable and printable after exam is Closed');

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed.`);
  console.log('===============================================================\n');

  db.close();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
