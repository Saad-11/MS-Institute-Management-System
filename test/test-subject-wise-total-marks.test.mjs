/**
 * Automated Test Suite — Subject-Wise Total Marks Configuration in Results -> Enter Marks
 *
 * Verifies:
 * 1. Configuration of subjects with different maximum marks (100, 75, 60, 50, custom).
 * 2. Backend validation: rejection of negative marks and marks exceeding maximum.
 * 3. Acceptance of boundary marks (equal to maximum, e.g. 75/75, 50/50).
 * 4. Support for decimal/fractional marks within bounds (e.g. 37.5/75).
 * 5. updateExaminationSubjectMarks API correctness and validation.
 * 6. Switching between subjects and isolation of marks and limits.
 * 7. Saving and reopening marks preserves configured max marks.
 * 8. Dynamic multi-subject weighted percentage calculations using sum of actual max marks
 *    (e.g., 75/100 + 60/75 + 42/50 = 177/225 = 78.67%, NOT 177/300 = 59%).
 * 9. Class exam results, rankings, and statistics dynamically reflect subject-wise max marks.
 * 10. DMC output accurately reflects subject-wise max marks, grand total max, and percentage.
 * 11. Examination isolation: subject total marks in Exam 1 do not alter Exam 2.
 */

import Database from 'better-sqlite3';
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
} from '../dist-electron/database/services/student.service.js';
import {
  createExamType,
  createExamination,
  configureExaminationSubjects,
  getExaminationSubjects,
  getStudentsForMarksEntry,
  saveMarks,
  updateExaminationSubjectMarks,
  calculateStudentExamResult,
  getClassExamResults,
  generateStudentDMC,
  saveGradingRule,
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

async function runTests() {
  console.log('\n=============================================================');
  console.log('TEST SUITE: Subject-Wise Total Marks Configuration & Calculations');
  console.log('=============================================================\n');

  // 1. Initialize In-Memory SQLite Database & Migrations
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const migRes = runMigrations(db);
  assert(migRes.appliedCount >= 6, 'Database migrations executed successfully');

  // 2. Auth & Admin Setup
  createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
  const authRes = login({ username: 'admin', password: 'Password123!' }, db);
  assert(authRes.success && authRes.sessionToken, 'Admin login succeeded and session token issued');
  const token = authRes.sessionToken;

  // 3. Setup Default Grading Rules
  saveGradingRule({ sessionToken: token, name: 'A+', minPercentage: 90, maxPercentage: 100, grade: 'A+', gradePoint: 4.0, remarks: 'Outstanding' }, db);
  saveGradingRule({ sessionToken: token, name: 'A', minPercentage: 80, maxPercentage: 89.99, grade: 'A', gradePoint: 3.7, remarks: 'Excellent' }, db);
  saveGradingRule({ sessionToken: token, name: 'B', minPercentage: 70, maxPercentage: 79.99, grade: 'B', gradePoint: 3.0, remarks: 'Good' }, db);
  saveGradingRule({ sessionToken: token, name: 'C', minPercentage: 60, maxPercentage: 69.99, grade: 'C', gradePoint: 2.0, remarks: 'Satisfactory' }, db);
  saveGradingRule({ sessionToken: token, name: 'D', minPercentage: 50, maxPercentage: 59.99, grade: 'D', gradePoint: 1.0, remarks: 'Pass' }, db);
  saveGradingRule({ sessionToken: token, name: 'F', minPercentage: 0, maxPercentage: 49.99, grade: 'F', gradePoint: 0.0, remarks: 'Fail' }, db);

  // 4. Create Academic Session, Class & Section
  const sessRes = createSession({
    sessionToken: token,
    name: '2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isActive: true,
  }, db);
  assert(sessRes.success && sessRes.session, 'Academic session 2026-2027 created');
  const sessionId = sessRes.session.id;

  const classRes = createClass({ sessionToken: token, name: 'Class 9', displayOrder: 9 }, db);
  const classId = classRes.classItem.id;
  const secRes = createSection({ sessionToken: token, classId, name: 'Section A', capacity: 40 }, db);
  const sectionId = secRes.section.id;

  // 5. Create Curriculum Subjects with varying intended maximum marks
  // English (100), Urdu (75), Physics (60), Computer Science (50)
  const subEng = createSubject({ sessionToken: token, name: 'English', code: 'ENG-9' }, db).subject;
  const subUrd = createSubject({ sessionToken: token, name: 'Urdu', code: 'URD-9' }, db).subject;
  const subPhy = createSubject({ sessionToken: token, name: 'Physics', code: 'PHY-9' }, db).subject;
  const subCs = createSubject({ sessionToken: token, name: 'Computer Science', code: 'CS-9' }, db).subject;

  assignSubjectToClass({ sessionToken: token, classId, subjectId: subEng.id, displayOrder: 1 }, db);
  assignSubjectToClass({ sessionToken: token, classId, subjectId: subUrd.id, displayOrder: 2 }, db);
  assignSubjectToClass({ sessionToken: token, classId, subjectId: subPhy.id, displayOrder: 3 }, db);
  assignSubjectToClass({ sessionToken: token, classId, subjectId: subCs.id, displayOrder: 4 }, db);
  console.log('  Setup: 4 subjects assigned to Class 9 (English, Urdu, Physics, Computer Science)');

  // 6. Create Enrolled Students
  const s1Res = createStudent({
    sessionToken: token,
    admissionNumber: 'ADM-2026-001',
    firstName: 'Ahmed',
    lastName: 'Khan',
    displayName: 'Ahmed Khan',
    fatherName: 'Tariq Khan',
    gender: 'Male',
    dateOfBirth: '2010-05-15',
    city: 'Lahore',
    province: 'Punjab',
    phone: '03001234567',
    currentAddress: 'Model Town',
    enrollment: {
      academicSessionId: sessionId,
      classId,
      sectionId,
      admissionDate: '2026-04-01',
      status: 'Active',
    },
  }, db);
  const s1 = s1Res.student;

  const s2Res = createStudent({
    sessionToken: token,
    admissionNumber: 'ADM-2026-002',
    firstName: 'Fatima',
    lastName: 'Ali',
    displayName: 'Fatima Ali',
    fatherName: 'Muhammad Ali',
    gender: 'Female',
    dateOfBirth: '2010-08-20',
    city: 'Lahore',
    province: 'Punjab',
    phone: '03007654321',
    currentAddress: 'Gulberg',
    enrollment: {
      academicSessionId: sessionId,
      classId,
      sectionId,
      admissionDate: '2026-04-01',
      status: 'Active',
    },
  }, db);
  const s2 = s2Res.student;

  const s3Res = createStudent({
    sessionToken: token,
    admissionNumber: 'ADM-2026-003',
    firstName: 'Zainab',
    lastName: 'Bibi',
    displayName: 'Zainab Bibi',
    fatherName: 'Rashid Ahmed',
    gender: 'Female',
    dateOfBirth: '2011-01-10',
    city: 'Lahore',
    province: 'Punjab',
    phone: '03009988776',
    currentAddress: 'Johar Town',
    enrollment: {
      academicSessionId: sessionId,
      classId,
      sectionId,
      admissionDate: '2026-04-01',
      status: 'Active',
    },
  }, db);
  const s3 = s3Res.student;
  assert(s1 && s2 && s3, '3 students created and enrolled in Class 9 Section A');

  // 7. Create Examination & Configure Subject-Wise Maximum Marks
  const examTypeRes = createExamType({ sessionToken: token, name: 'Midterm', code: 'MID' }, db);
  const examTypeId = examTypeRes.examType.id;

  const examRes = createExamination({
    sessionToken: token,
    academicSessionId: sessionId,
    examTypeId,
    name: 'Midterm Examination 2026',
    startDate: '2026-10-15',
    endDate: '2026-10-25',
  }, db);
  assert(examRes.success, 'Midterm examination created');
  const examId = examRes.examination.id;

  // ─── SCENARIO 1: Configure Subjects with 100, 75, 60, and 50 Total Marks ───
  console.log('\n--- SCENARIO 1: Subject-Wise Max Marks Configuration ---');
  const configRes = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId,
    subjects: [
      { subjectId: subEng.id, maxMarks: 100, passingMarks: 40, displayOrder: 1 },
      { subjectId: subUrd.id, maxMarks: 75, passingMarks: 30, displayOrder: 2 },
      { subjectId: subPhy.id, maxMarks: 60, passingMarks: 24, displayOrder: 3 },
      { subjectId: subCs.id, maxMarks: 50, passingMarks: 20, displayOrder: 4 },
    ],
  }, db);
  assert(configRes.success, 'Configured 4 subjects with distinct total marks (100, 75, 60, 50)');

  const examSubs = getExaminationSubjects({ examinationId: examId, classId }, db);
  assert(examSubs.length === 4, 'Retrieved all 4 configured examination subjects');

  const engExamSub = examSubs.find((s) => s.subjectId === subEng.id);
  const urdExamSub = examSubs.find((s) => s.subjectId === subUrd.id);
  const phyExamSub = examSubs.find((s) => s.subjectId === subPhy.id);
  const csExamSub = examSubs.find((s) => s.subjectId === subCs.id);

  assert(engExamSub.maxMarks === 100 && engExamSub.passingMarks === 40, 'English configured with 100 total marks (40 passing)');
  assert(urdExamSub.maxMarks === 75 && urdExamSub.passingMarks === 30, 'Urdu configured with 75 total marks (30 passing)');
  assert(phyExamSub.maxMarks === 60 && phyExamSub.passingMarks === 24, 'Physics configured with 60 total marks (24 passing)');
  assert(csExamSub.maxMarks === 50 && csExamSub.passingMarks === 20, 'Computer Science configured with 50 total marks (20 passing)');

  // ─── SCENARIO 2: Test updateExaminationSubjectMarks API and Validation ───
  console.log('\n--- SCENARIO 2: updateExaminationSubjectMarks Service API ---');
  // Update Physics to 70 with 28 passing marks
  const updateRes1 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: phyExamSub.id,
    maxMarks: 70,
    passingMarks: 28,
  }, db);
  assert(updateRes1.success && updateRes1.examinationSubject.maxMarks === 70, 'Updated Physics to 70 total marks (passing 28)');

  // Revert Physics back to 60 with 24 passing marks
  const updateRes2 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: phyExamSub.id,
    maxMarks: 60,
    passingMarks: 24,
  }, db);
  assert(updateRes2.success && updateRes2.examinationSubject.maxMarks === 60, 'Reverted Physics back to 60 total marks');

  // Test invalid updates
  const invalidMax1 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: csExamSub.id,
    maxMarks: 0,
    passingMarks: 0,
  }, db);
  assert(!invalidMax1.success, 'Rejected updating maxMarks to 0');

  const invalidMax2 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: csExamSub.id,
    maxMarks: -25,
    passingMarks: 10,
  }, db);
  assert(!invalidMax2.success, 'Rejected negative maxMarks (-25)');

  const invalidPass1 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: csExamSub.id,
    maxMarks: 50,
    passingMarks: 55,
  }, db);
  assert(!invalidPass1.success, 'Rejected passing marks (55) exceeding max marks (50)');

  const invalidPass2 = updateExaminationSubjectMarks({
    sessionToken: token,
    examinationSubjectId: csExamSub.id,
    maxMarks: 50,
    passingMarks: -5,
  }, db);
  assert(!invalidPass2.success, 'Rejected negative passing marks (-5)');

  // ─── SCENARIO 3: Marks Equal to Maximum Are Accepted ───
  console.log('\n--- SCENARIO 3: Boundary Marks Equal to Maximum Accepted ---');
  const boundaryMarksRes1 = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: urdExamSub.id,
    marks: [{
      studentId: s1.id,
      enrollmentId: s1.currentEnrollmentId || 1,
      obtainedMarks: 75, // Exactly 75 / 75
      status: 'Entered',
      remarks: 'Perfect score',
    }],
  }, db);
  assert(boundaryMarksRes1.success, 'Marks equal to maximum (75/75 for Urdu) successfully saved');

  const boundaryMarksRes2 = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: csExamSub.id,
    marks: [{
      studentId: s1.id,
      enrollmentId: s1.currentEnrollmentId || 1,
      obtainedMarks: 50, // Exactly 50 / 50
      status: 'Entered',
      remarks: 'Perfect score',
    }],
  }, db);
  assert(boundaryMarksRes2.success, 'Marks equal to maximum (50/50 for CS) successfully saved');

  // ─── SCENARIO 4: Marks Exceeding Maximum Are Rejected ───
  console.log('\n--- SCENARIO 4: Marks Exceeding Maximum Rejected ---');
  const excessMarksUrd = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: urdExamSub.id,
    marks: [{
      studentId: s2.id,
      enrollmentId: s2.currentEnrollmentId || 2,
      obtainedMarks: 76, // 76 exceeds 75
      status: 'Entered',
    }],
  }, db);
  assert(!excessMarksUrd.success, 'Rejected marks (76) exceeding Urdu maximum marks (75)');

  const excessMarksCs = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: csExamSub.id,
    marks: [{
      studentId: s2.id,
      enrollmentId: s2.currentEnrollmentId || 2,
      obtainedMarks: 51, // 51 exceeds 50
      status: 'Entered',
    }],
  }, db);
  assert(!excessMarksCs.success, 'Rejected marks (51) exceeding CS maximum marks (50)');

  const excessMarksPhy = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: phyExamSub.id,
    marks: [{
      studentId: s2.id,
      enrollmentId: s2.currentEnrollmentId || 2,
      obtainedMarks: 60.5, // 60.5 exceeds 60
      status: 'Entered',
    }],
  }, db);
  assert(!excessMarksPhy.success, 'Rejected marks (60.5) exceeding Physics maximum marks (60)');

  // ─── SCENARIO 5: Negative Marks Rejected ───
  console.log('\n--- SCENARIO 5: Negative Marks Rejected ---');
  const negativeMarksRes = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: engExamSub.id,
    marks: [{
      studentId: s1.id,
      enrollmentId: s1.currentEnrollmentId || 1,
      obtainedMarks: -5,
      status: 'Entered',
    }],
  }, db);
  assert(!negativeMarksRes.success, 'Rejected negative marks (-5) for English');

  // ─── SCENARIO 6: Fractional / Decimal Marks Supported Within Bounds ───
  console.log('\n--- SCENARIO 6: Fractional & Decimal Marks Supported ---');
  const decimalMarksRes = saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: urdExamSub.id,
    marks: [{
      studentId: s2.id,
      enrollmentId: s2.currentEnrollmentId || 2,
      obtainedMarks: 67.5, // 67.5 is <= 75
      status: 'Entered',
    }],
  }, db);
  assert(decimalMarksRes.success, 'Decimal marks (67.5/75 for Urdu) successfully saved');

  // ─── SCENARIO 7: Switching Subjects Updates Max Marks & Limits Accurately ───
  console.log('\n--- SCENARIO 7: Subject Limits & Marks Isolation ---');
  const urdEntryStudents = getStudentsForMarksEntry({
    examinationId: examId,
    classId,
    sectionId,
    examinationSubjectId: urdExamSub.id,
  }, db);
  assert(urdEntryStudents.success, 'Retrieved students for Urdu marks entry');
  const urdS1 = urdEntryStudents.students.find((s) => s.studentId === s1.id);
  assert(urdS1.obtainedMarks === 75, 'Urdu marks entry shows 75 obtained marks for Ahmed');

  const csEntryStudents = getStudentsForMarksEntry({
    examinationId: examId,
    classId,
    sectionId,
    examinationSubjectId: csExamSub.id,
  }, db);
  assert(csEntryStudents.success, 'Retrieved students for CS marks entry');
  const csS1 = csEntryStudents.students.find((s) => s.studentId === s1.id);
  assert(csS1.obtainedMarks === 50, 'CS marks entry shows 50 obtained marks for Ahmed');

  // English has no marks yet for Ahmed, verify it is null (no cross-contamination)
  const engEntryStudents = getStudentsForMarksEntry({
    examinationId: examId,
    classId,
    sectionId,
    examinationSubjectId: engExamSub.id,
  }, db);
  const engS1 = engEntryStudents.students.find((s) => s.studentId === s1.id);
  assert(engS1.obtainedMarks === null, 'English marks entry has no marks for Ahmed (zero cross-contamination)');

  // ─── SCENARIO 8: Save and Reopen Retains Configured Maximum Marks ───
  console.log('\n--- SCENARIO 8: Save and Reopen Marks Integrity ---');
  // Record marks for all 3 students:
  // English (max 100): Ahmed: 75, Fatima: 95, Zainab: 45
  // Urdu (max 75): Ahmed: 60, Fatima: 70, Zainab: 35
  // CS (max 50): Ahmed: 42, Fatima: 48, Zainab: 22
  saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: engExamSub.id,
    marks: [
      { studentId: s1.id, enrollmentId: s1.currentEnrollmentId || 1, obtainedMarks: 75, status: 'Entered' },
      { studentId: s2.id, enrollmentId: s2.currentEnrollmentId || 2, obtainedMarks: 95, status: 'Entered' },
      { studentId: s3.id, enrollmentId: s3.currentEnrollmentId || 3, obtainedMarks: 45, status: 'Entered' },
    ],
  }, db);

  saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: urdExamSub.id,
    marks: [
      { studentId: s1.id, enrollmentId: s1.currentEnrollmentId || 1, obtainedMarks: 60, status: 'Entered' },
      { studentId: s2.id, enrollmentId: s2.currentEnrollmentId || 2, obtainedMarks: 70, status: 'Entered' },
      { studentId: s3.id, enrollmentId: s3.currentEnrollmentId || 3, obtainedMarks: 35, status: 'Entered' },
    ],
  }, db);

  saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: csExamSub.id,
    marks: [
      { studentId: s1.id, enrollmentId: s1.currentEnrollmentId || 1, obtainedMarks: 42, status: 'Entered' },
      { studentId: s2.id, enrollmentId: s2.currentEnrollmentId || 2, obtainedMarks: 48, status: 'Entered' },
      { studentId: s3.id, enrollmentId: s3.currentEnrollmentId || 3, obtainedMarks: 22, status: 'Entered' },
    ],
  }, db);

  // Physics (max 60): Ahmed: 48, Fatima: 58, Zainab: 28
  saveMarks({
    sessionToken: token,
    examinationId: examId,
    examinationSubjectId: phyExamSub.id,
    marks: [
      { studentId: s1.id, enrollmentId: s1.currentEnrollmentId || 1, obtainedMarks: 48, status: 'Entered' },
      { studentId: s2.id, enrollmentId: s2.currentEnrollmentId || 2, obtainedMarks: 58, status: 'Entered' },
      { studentId: s3.id, enrollmentId: s3.currentEnrollmentId || 3, obtainedMarks: 28, status: 'Entered' },
    ],
  }, db);

  // Re-verify examination subjects still hold exact max marks
  const refreshedSubs = getExaminationSubjects({ examinationId: examId, classId }, db);
  const refEng = refreshedSubs.find((s) => s.subjectId === subEng.id);
  const refUrd = refreshedSubs.find((s) => s.subjectId === subUrd.id);
  const refPhy = refreshedSubs.find((s) => s.subjectId === subPhy.id);
  const refCs = refreshedSubs.find((s) => s.subjectId === subCs.id);

  assert(refEng.maxMarks === 100, 'Reopening retains English max marks = 100');
  assert(refUrd.maxMarks === 75, 'Reopening retains Urdu max marks = 75');
  assert(refPhy.maxMarks === 60, 'Reopening retains Physics max marks = 60');
  assert(refCs.maxMarks === 50, 'Reopening retains CS max marks = 50');

  // ─── SCENARIO 9: Dynamic Weighted Percentage Calculations ───
  console.log('\n--- SCENARIO 9: Dynamic Weighted Percentage & Results Calculation ---');
  // Ahmed:
  // ENG (100): 75
  // URD (75):  60
  // PHY (60):  48
  // CS (50):   42
  // Total Max = 100 + 75 + 60 + 50 = 285
  // Total Obtained = 75 + 60 + 48 + 42 = 225
  // Expected Percentage = (225 / 285) * 100 = 78.95% (NOT 225 / 400 = 56.25%!)
  const ahmedRes = calculateStudentExamResult(examId, s1.id, db);
  assert(ahmedRes.success, 'Result calculated for Ahmed');
  const ahmedData = ahmedRes.result;
  assert(ahmedData.totalMaxMarks === 285, `Ahmed totalMaxMarks is 285 (actual: ${ahmedData.totalMaxMarks})`);
  assert(ahmedData.totalObtainedMarks === 225, `Ahmed totalObtainedMarks is 225 (actual: ${ahmedData.totalObtainedMarks})`);
  assert(ahmedData.percentage === 78.95, `Ahmed percentage is dynamically 78.95% (actual: ${ahmedData.percentage}%)`);
  assert(ahmedData.isPassed === true, 'Ahmed passed all subjects');
  assert(ahmedData.grade === 'B', `Ahmed grade is B (actual: ${ahmedData.grade})`);

  // Fatima:
  // ENG (100): 95
  // URD (75):  70
  // PHY (60):  58
  // CS (50):   48
  // Total Max = 285
  // Total Obtained = 95 + 70 + 58 + 48 = 271
  // Expected Percentage = (271 / 285) * 100 = 95.09%
  const fatimaRes = calculateStudentExamResult(examId, s2.id, db);
  assert(fatimaRes.success, 'Result calculated for Fatima');
  const fatimaData = fatimaRes.result;
  assert(fatimaData.totalMaxMarks === 285, `Fatima totalMaxMarks is 285 (actual: ${fatimaData.totalMaxMarks})`);
  assert(fatimaData.totalObtainedMarks === 271, `Fatima totalObtainedMarks is 271 (actual: ${fatimaData.totalObtainedMarks})`);
  assert(fatimaData.percentage === 95.09, `Fatima percentage is dynamically 95.09% (actual: ${fatimaData.percentage}%)`);
  assert(fatimaData.grade === 'A+', `Fatima grade is A+ (actual: ${fatimaData.grade})`);

  // Zainab:
  // ENG (100): 45 (Pass is 40) -> PASS
  // URD (75):  35 (Pass is 30) -> PASS
  // PHY (60):  28 (Pass is 24) -> PASS
  // CS (50):   22 (Pass is 20) -> PASS
  // Total Max = 285
  // Total Obtained = 45 + 35 + 28 + 22 = 130
  // Expected Percentage = (130 / 285) * 100 = 45.61%
  const zainabRes = calculateStudentExamResult(examId, s3.id, db);
  assert(zainabRes.success, 'Result calculated for Zainab');
  const zainabData = zainabRes.result;
  assert(zainabData.totalMaxMarks === 285, `Zainab totalMaxMarks is 285 (actual: ${zainabData.totalMaxMarks})`);
  assert(zainabData.totalObtainedMarks === 130, `Zainab totalObtainedMarks is 130 (actual: ${zainabData.totalObtainedMarks})`);
  assert(zainabData.percentage === 45.61, `Zainab percentage is dynamically 45.61% (actual: ${zainabData.percentage}%)`);

  // Class Results & Merit Ranking
  const classResults = getClassExamResults({ examinationId: examId, classId, sectionId }, db).results;
  assert(classResults.totalStudents === 3, 'Class results total students = 3');
  assert(classResults.studentResults[0].displayName === 'Fatima Ali', 'Fatima Ali ranked #1');
  assert(classResults.studentResults[0].percentage === 95.09, 'Fatima Ali #1 percentage = 95.09%');
  assert(classResults.studentResults[1].displayName === 'Ahmed Khan', 'Ahmed Khan ranked #2');
  assert(classResults.studentResults[1].percentage === 78.95, 'Ahmed Khan #2 percentage = 78.95%');
  assert(classResults.studentResults[2].displayName === 'Zainab Bibi', 'Zainab Bibi ranked #3');
  assert(classResults.studentResults[2].percentage === 45.61, 'Zainab Bibi #3 percentage = 45.61%');

  // Verify subject-wise stats in Class Results
  const urdStats = classResults.subjects.find((s) => s.subjectName === 'Urdu');
  assert(urdStats.maxMarks === 75, 'Class results Urdu maxMarks is 75');
  assert(urdStats.passingMarks === 30, 'Class results Urdu passingMarks is 30');

  const csStats = classResults.subjects.find((s) => s.subjectName === 'Computer Science');
  assert(csStats.maxMarks === 50, 'Class results Computer Science maxMarks is 50');
  assert(csStats.passingMarks === 20, 'Class results Computer Science passingMarks is 20');

  // ─── SCENARIO 10: DMC Generation Reflects Subject-Wise Max Marks ───
  console.log('\n--- SCENARIO 10: Detailed Marks Certificate (DMC) Integration ---');
  const dmcRes = generateStudentDMC(examId, s1.id, db);
  assert(dmcRes.success, 'DMC generated for Ahmed Khan');
  const dmc = dmcRes.dmc;

  assert(dmc.summary.totalMaxMarks === 285, `DMC totalMaxMarks is 285 (actual: ${dmc.summary.totalMaxMarks})`);
  assert(dmc.summary.totalObtainedMarks === 225, `DMC totalObtainedMarks is 225 (actual: ${dmc.summary.totalObtainedMarks})`);
  assert(dmc.summary.percentage === 78.95, `DMC percentage is 78.95% (actual: ${dmc.summary.percentage}%)`);
  assert(dmc.summary.position === 2, `DMC position in class is 2 (actual: ${dmc.summary.position})`);

  // Check each subject breakdown inside DMC
  const dmcEng = dmc.subjects.find((s) => s.subjectName === 'English');
  const dmcUrd = dmc.subjects.find((s) => s.subjectName === 'Urdu');
  const dmcPhy = dmc.subjects.find((s) => s.subjectName === 'Physics');
  const dmcCs = dmc.subjects.find((s) => s.subjectName === 'Computer Science');

  assert(dmcEng && dmcEng.maxMarks === 100 && dmcEng.obtainedMarks === 75, 'DMC English row: 75 / 100');
  assert(dmcUrd && dmcUrd.maxMarks === 75 && dmcUrd.obtainedMarks === 60, 'DMC Urdu row: 60 / 75');
  assert(dmcPhy && dmcPhy.maxMarks === 60 && dmcPhy.obtainedMarks === 48, 'DMC Physics row: 48 / 60');
  assert(dmcCs && dmcCs.maxMarks === 50 && dmcCs.obtainedMarks === 42, 'DMC Computer Science row: 42 / 50');

  // ─── SCENARIO 11: Examination Independence ───
  console.log('\n--- SCENARIO 11: Examination Independence ---');
  // Create a second examination ("Final Term Examination 2027")
  const exam2Res = createExamination({
    sessionToken: token,
    academicSessionId: sessionId,
    examTypeId,
    name: 'Final Term Examination 2027',
    startDate: '2027-02-15',
    endDate: '2027-02-28',
  }, db);
  const exam2Id = exam2Res.examination.id;

  // In Exam 2, Urdu is configured with 100 marks (instead of 75)
  configureExaminationSubjects({
    sessionToken: token,
    examinationId: exam2Id,
    classId,
    subjects: [
      { subjectId: subUrd.id, maxMarks: 100, passingMarks: 40, displayOrder: 1 },
    ],
  }, db);

  const exam1Urd = getExaminationSubjects({ examinationId: examId, classId }, db).find((s) => s.subjectId === subUrd.id);
  const exam2Urd = getExaminationSubjects({ examinationId: exam2Id, classId }, db).find((s) => s.subjectId === subUrd.id);

  assert(exam1Urd.maxMarks === 75, 'Exam 1 Urdu remains 75 max marks');
  assert(exam2Urd.maxMarks === 100, 'Exam 2 Urdu is configured with 100 max marks without affecting Exam 1');

  db.close();

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
