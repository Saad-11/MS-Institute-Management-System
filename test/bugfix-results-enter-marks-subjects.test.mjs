/**
 * Automated Test Suite — Bug Fix: Missing Assigned Subjects in Results -> Enter Marks
 * 
 * Verifies:
 * 1. Subject Loading: All 7 assigned subjects for the selected class/session/examination
 *    are loaded without arbitrary limits (not limited to 3 or any fixed number).
 * 2. Auto-Synchronization: When new subjects are assigned to a class after examination creation,
 *    they automatically synchronize into the active examination.
 * 3. Marks Entry & Retrieval: Marks entry, saving, and retrieval work accurately for all 7 subjects.
 * 4. Data Integrity & Calculations: calculateStudentExamResult and getClassExamResults
 *    accurately calculate total max marks (700), total obtained marks, percentage, and grade.
 * 5. Class Isolation & Subject Scoping: Class switching refreshes the subject list strictly
 *    for that class without leaking subjects across classes.
 * 6. Dynamic Removal: Removing an unrecorded subject from a class cleans it up from active
 *    examinations without affecting subjects with recorded marks.
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
  removeClassSubject,
  getClassSubjects,
} from '../dist-electron/database/services/subject.service.js';
import {
  createStudent,
  createEnrollment,
} from '../dist-electron/database/services/student.service.js';
import {
  createExamType,
  createExamination,
  configureExaminationSubjects,
  getExaminationSubjects,
  getStudentsForMarksEntry,
  saveMarks,
  calculateStudentExamResult,
  getClassExamResults,
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

async function runTestSuite() {
  console.log('\n=== RUNNING BUGFIX TEST SUITE: RESULTS -> ENTER MARKS SUBJECTS ===\n');

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Step 1: Run migrations
  console.log('--- Step 1: Running Migrations ---');
  const migrationResult = runMigrations(db);
  assert(migrationResult.appliedCount >= 6, 'Migrations applied successfully');
  assert(migrationResult.currentVersion >= 6, 'Schema version is at least 6');

  // Step 2: Auth setup
  console.log('\n--- Step 2: Auth & Session Setup ---');
  createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
  const authRes = login({ username: 'admin', password: 'Password123!' }, db);
  assert(authRes.success && authRes.sessionToken, 'Logged in as Admin');
  const token = authRes.sessionToken;

  // Step 3: School Structure Setup
  console.log('\n--- Step 3: Academic Session, Classes & Sections ---');
  const sessionRes = createSession({
    sessionToken: token,
    name: '2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isActive: true,
  }, db);
  assert(sessionRes.success && sessionRes.session, 'Created Academic Session 2026-2027');
  const sessionId = sessionRes.session.id;

  const class9Res = createClass({ sessionToken: token, name: 'Grade 9', code: 'G9' }, db);
  assert(class9Res.success && class9Res.classItem, 'Created Grade 9');
  const class9Id = class9Res.classItem.id;

  const class10Res = createClass({ sessionToken: token, name: 'Grade 10', code: 'G10' }, db);
  assert(class10Res.success && class10Res.classItem, 'Created Grade 10');
  const class10Id = class10Res.classItem.id;

  const sec9Res = createSection({ sessionToken: token, classId: class9Id, name: 'Section A' }, db);
  assert(sec9Res.success && sec9Res.section, 'Created Grade 9 - Section A');
  const sec9Id = sec9Res.section.id;

  const sec10Res = createSection({ sessionToken: token, classId: class10Id, name: 'Section A' }, db);
  assert(sec10Res.success && sec10Res.section, 'Created Grade 10 - Section A');
  const sec10Id = sec10Res.section.id;

  // Step 4: Create 7 Subjects
  console.log('\n--- Step 4: Creating 7 Curriculum Subjects ---');
  const subjectDefs = [
    { name: 'English', code: 'ENG-101' },
    { name: 'Urdu', code: 'URD-102' },
    { name: 'Mathematics', code: 'MTH-103' },
    { name: 'Physics', code: 'PHY-104' },
    { name: 'Chemistry', code: 'CHM-105' },
    { name: 'Biology', code: 'BIO-106' },
    { name: 'Pakistan Studies', code: 'PST-107' },
  ];

  const createdSubjects = [];
  for (let i = 0; i < subjectDefs.length; i++) {
    const s = subjectDefs[i];
    const subRes = createSubject({ sessionToken: token, name: s.name, code: s.code }, db);
    assert(subRes.success && subRes.subject, `Created subject: ${s.name}`);
    createdSubjects.push(subRes.subject);
  }
  assert(createdSubjects.length === 7, 'All 7 subjects created in the master catalog');

  // Step 5: Assign initially ONLY 3 subjects to Grade 9
  console.log('\n--- Step 5: Assign 3 Initial Subjects to Grade 9 ---');
  for (let i = 0; i < 3; i++) {
    const assignRes = assignSubjectToClass({
      sessionToken: token,
      classId: class9Id,
      subjectId: createdSubjects[i].id,
      displayOrder: i + 1,
    }, db);
    assert(assignRes.success, `Assigned ${createdSubjects[i].name} to Grade 9`);
  }

  // Step 6: Create Examination and configure initial 3 subjects
  console.log('\n--- Step 6: Create Examination & Configure Initial Exam Subjects ---');
  const examTypeRes = createExamType({ sessionToken: token, name: 'Midterm Examination', code: 'MID' }, db);
  assert(examTypeRes.success && examTypeRes.examType, 'Created Exam Type Midterm');
  const examTypeId = examTypeRes.examType.id;

  const examRes = createExamination({
    sessionToken: token,
    academicSessionId: sessionId,
    examTypeId: examTypeId,
    name: 'Midterm Exams 2026',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    description: 'First Term Examination',
  }, db);
  assert(examRes.success && examRes.examination, 'Created Midterm Examination 2026');
  const examId = examRes.examination.id;

  // Configure initial 3 subjects for Grade 9
  const configInitRes = configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class9Id,
    subjects: [
      { subjectId: createdSubjects[0].id, maxMarks: 100, passingMarks: 40, displayOrder: 1 },
      { subjectId: createdSubjects[1].id, maxMarks: 100, passingMarks: 40, displayOrder: 2 },
      { subjectId: createdSubjects[2].id, maxMarks: 100, passingMarks: 40, displayOrder: 3 },
    ],
  }, db);
  assert(configInitRes.success && configInitRes.subjects?.length === 3, 'Initially configured 3 subjects for Grade 9');

  // Verify only 3 subjects loaded so far
  let examSubs = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  assert(examSubs.length === 3, 'Initially getExaminationSubjects returns 3 subjects');

  // Step 7: Now assign the remaining 4 subjects to Grade 9 (simulating the bug scenario)
  console.log('\n--- Step 7: Assign Remaining 4 Subjects to Grade 9 in Classes & Subjects ---');
  for (let i = 3; i < 7; i++) {
    const assignRes = assignSubjectToClass({
      sessionToken: token,
      classId: class9Id,
      subjectId: createdSubjects[i].id,
      displayOrder: i + 1,
    }, db);
    assert(assignRes.success, `Assigned ${createdSubjects[i].name} to Grade 9 (curriculum subject #${i + 1})`);
  }

  const allGrade9Curriculum = getClassSubjects(class9Id, db);
  assert(allGrade9Curriculum.length === 7, 'Grade 9 now legitimately has all 7 subjects assigned in curriculum');

  // Step 8: Verify Auto-Sync & Subject Loading (CRITICAL BUG FIX VERIFICATION)
  console.log('\n--- Step 8: Verification of Bug Fix (All 7 Subjects Loaded in Enter Marks) ---');
  examSubs = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  assert(examSubs.length === 7, `getExaminationSubjects returned all 7 subjects (got: ${examSubs.length})`);

  const loadedSubjectIds = new Set(examSubs.map((s) => s.subjectId));
  const expectedSubjectIds = new Set(createdSubjects.map((s) => s.id));
  let allMatched = true;
  for (const id of expectedSubjectIds) {
    if (!loadedSubjectIds.has(id)) {
      allMatched = false;
      break;
    }
  }
  assert(allMatched, 'All 7 subjects match the assigned curriculum subjects exactly');

  // Step 9: Enroll Students and Test Marks Entry across all 7 subjects
  console.log('\n--- Step 9: Marks Entry Across All 7 Subjects ---');
  const student1Res = createStudent({
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
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2026-04-01',
      status: 'Active',
    },
  }, db);
  assert(student1Res.success && student1Res.student, 'Enrolled Student 1 (Ahmed Khan)');
  const student1Id = student1Res.student.id;

  const student2Res = createStudent({
    sessionToken: token,
    admissionNumber: 'ADM-2026-002',
    firstName: 'Fatima',
    lastName: 'Zahra',
    displayName: 'Fatima Zahra',
    fatherName: 'Rashid Zahra',
    gender: 'Female',
    dateOfBirth: '2010-08-20',
    city: 'Lahore',
    province: 'Punjab',
    phone: '03007654321',
    currentAddress: 'Gulberg',
    enrollment: {
      academicSessionId: sessionId,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2026-04-01',
      status: 'Active',
    },
  }, db);
  assert(student2Res.success && student2Res.student, 'Enrolled Student 2 (Fatima Zahra)');
  const student2Id = student2Res.student.id;

  // Setup Grading Rules
  saveGradingRule({ sessionToken: token, name: 'A+', minPercentage: 80, maxPercentage: 100, grade: 'A+', gradePoint: 4.0, remarks: 'Outstanding' }, db);
  saveGradingRule({ sessionToken: token, name: 'A', minPercentage: 70, maxPercentage: 79.99, grade: 'A', gradePoint: 3.7, remarks: 'Excellent' }, db);
  saveGradingRule({ sessionToken: token, name: 'B', minPercentage: 60, maxPercentage: 69.99, grade: 'B', gradePoint: 3.0, remarks: 'Good' }, db);
  saveGradingRule({ sessionToken: token, name: 'C', minPercentage: 50, maxPercentage: 59.99, grade: 'C', gradePoint: 2.0, remarks: 'Satisfactory' }, db);
  saveGradingRule({ sessionToken: token, name: 'D', minPercentage: 40, maxPercentage: 49.99, grade: 'D', gradePoint: 1.0, remarks: 'Pass' }, db);
  saveGradingRule({ sessionToken: token, name: 'F', minPercentage: 0, maxPercentage: 39.99, grade: 'F', gradePoint: 0.0, remarks: 'Fail' }, db);

  // For each of the 7 subjects: verify getStudentsForMarksEntry, enter marks, save marks
  const student1MarksValues = [85, 78, 92, 88, 81, 95, 75]; // Total: 594 / 700 = 84.86% -> Grade A+
  const student2MarksValues = [65, 70, 58, 62, 68, 72, 60]; // Total: 455 / 700 = 65.00% -> Grade B

  for (let idx = 0; idx < examSubs.length; idx++) {
    const es = examSubs[idx];
    const studentsRes = getStudentsForMarksEntry({
      examinationId: examId,
      classId: class9Id,
      sectionId: sec9Id,
      examinationSubjectId: es.id,
    }, db);

    assert(studentsRes.success && studentsRes.students.length === 2, `Subject #${idx + 1} (${es.subjectName}): getStudentsForMarksEntry returned 2 students`);

    const s1Entry = studentsRes.students.find((s) => s.studentId === student1Id);
    const s2Entry = studentsRes.students.find((s) => s.studentId === student2Id);
    assert(Boolean(s1Entry && s2Entry), `Subject #${idx + 1}: Found both student entries`);

    // Save marks
    const saveRes = saveMarks({
      sessionToken: token,
      examinationId: examId,
      examinationSubjectId: es.id,
      marks: [
        {
          studentId: student1Id,
          enrollmentId: s1Entry.enrollmentId,
          obtainedMarks: student1MarksValues[idx],
          status: 'Entered',
          remarks: 'Good performance',
        },
        {
          studentId: student2Id,
          enrollmentId: s2Entry.enrollmentId,
          obtainedMarks: student2MarksValues[idx],
          status: 'Entered',
          remarks: 'Satisfactory',
        },
      ],
    }, db);

    assert(saveRes.success && saveRes.savedCount === 2, `Subject #${idx + 1}: Successfully saved marks for both students`);

    // Verify marks retrieval on reload
    const reloadRes = getStudentsForMarksEntry({
      examinationId: examId,
      classId: class9Id,
      sectionId: sec9Id,
      examinationSubjectId: es.id,
    }, db);
    const reloadedS1 = reloadRes.students.find((s) => s.studentId === student1Id);
    assert(reloadedS1.obtainedMarks === student1MarksValues[idx], `Subject #${idx + 1}: Retrieved marks correctly match (${reloadedS1.obtainedMarks} === ${student1MarksValues[idx]})`);
  }

  // Step 10: Verify Results Calculation across all 7 subjects
  console.log('\n--- Step 10: Results Calculation Across All 7 Subjects ---');
  const result1 = calculateStudentExamResult(examId, student1Id, db);
  assert(result1.success && result1.result, 'Calculated exam result for Student 1');
  assert(result1.result.totalMaxMarks === 700, `Total Max Marks is 700 across 7 subjects (got: ${result1.result.totalMaxMarks})`);
  assert(result1.result.totalObtainedMarks === 594, `Total Obtained Marks is 594 across 7 subjects (got: ${result1.result.totalObtainedMarks})`);
  assert(result1.result.percentage === 84.86, `Percentage is 84.86% (got: ${result1.result.percentage})`);
  assert(result1.result.isPassed === true, 'Student 1 passed all 7 subjects');
  assert(result1.result.subjects.length === 7, `Student 1 has exactly 7 subject result breakdowns (got: ${result1.result.subjects.length})`);

  const classResults = getClassExamResults({ examinationId: examId, classId: class9Id, sectionId: sec9Id }, db);
  assert(classResults.success && classResults.results.studentResults.length === 2, 'Class results retrieved for 2 students');
  const ranked1 = classResults.results.studentResults.find((r) => r.studentId === student1Id);
  const ranked2 = classResults.results.studentResults.find((r) => r.studentId === student2Id);
  assert(ranked1 && ranked1.position === 1, 'Student 1 is ranked Position 1');
  assert(ranked2 && ranked2.position === 2, 'Student 2 is ranked Position 2');

  // Step 11: Class Isolation & Subject Scoping
  console.log('\n--- Step 11: Class Isolation & Scoping (No Subject Leakage) ---');
  // Assign 4 subjects to Grade 10: English, Mathematics, Physics, Pakistan Studies
  const grade10Subjects = [createdSubjects[0], createdSubjects[2], createdSubjects[3], createdSubjects[6]];
  for (let i = 0; i < grade10Subjects.length; i++) {
    assignSubjectToClass({
      sessionToken: token,
      classId: class10Id,
      subjectId: grade10Subjects[i].id,
      displayOrder: i + 1,
    }, db);
  }

  // Configure Grade 10 in the same exam
  configureExaminationSubjects({
    sessionToken: token,
    examinationId: examId,
    classId: class10Id,
    subjects: grade10Subjects.map((s, idx) => ({
      subjectId: s.id,
      maxMarks: 100,
      passingMarks: 40,
      displayOrder: idx + 1,
    })),
  }, db);

  const grade10ExamSubs = getExaminationSubjects({ examinationId: examId, classId: class10Id }, db);
  assert(grade10ExamSubs.length === 4, `Grade 10 returns exactly 4 subjects (got: ${grade10ExamSubs.length})`);
  
  const grade10Names = grade10ExamSubs.map((s) => s.subjectName);
  assert(!grade10Names.includes('Urdu'), 'Grade 10 does not leak Urdu from Grade 9');
  assert(!grade10Names.includes('Chemistry'), 'Grade 10 does not leak Chemistry from Grade 9');
  assert(!grade10Names.includes('Biology'), 'Grade 10 does not leak Biology from Grade 9');

  // Re-check Grade 9 to ensure no contamination
  const recheckGrade9Subs = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  assert(recheckGrade9Subs.length === 7, 'Grade 9 still accurately maintains all 7 subjects');

  // Step 12: Dynamic Subject Removal & Cleanup
  console.log('\n--- Step 12: Dynamic Subject Removal & Cleanup ---');
  const tempSubRes = createSubject({ sessionToken: token, name: 'General Knowledge', code: 'GK-108' }, db);
  assert(tempSubRes.success && tempSubRes.subject, 'Created temporary subject GK-108');
  const tempSub = tempSubRes.subject;

  assignSubjectToClass({
    sessionToken: token,
    classId: class9Id,
    subjectId: tempSub.id,
    displayOrder: 8,
  }, db);

  const subsWithGk = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  assert(subsWithGk.length === 8, 'GK-108 auto-synchronized into exam subjects (8 total)');

  // Now remove GK-108 before marks are entered
  const removeRes = removeClassSubject({
    sessionToken: token,
    classId: class9Id,
    subjectId: tempSub.id,
  }, db);
  assert(removeRes.success, 'Removed GK-108 from Grade 9 curriculum');

  const subsAfterRemoval = getExaminationSubjects({ examinationId: examId, classId: class9Id }, db);
  assert(subsAfterRemoval.length === 7, 'Cleaned up unrecorded GK-108 from exam subjects (7 remaining)');
  assert(!subsAfterRemoval.some((s) => s.subjectId === tempSub.id), 'GK-108 is completely absent from exam subjects');

  // Verify that the 7 subjects with recorded marks were NOT touched
  const finalResult1 = calculateStudentExamResult(examId, student1Id, db);
  assert(finalResult1.success && finalResult1.result.totalObtainedMarks === 594, 'Original 7 marks remain completely intact after cleanup');

  db.close();

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
