import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createSubject, assignSubjectToClass } from '../dist-electron/database/services/subject.service.js';
import { createStudent, createEnrollment, getStudentById } from '../dist-electron/database/services/student.service.js';
import { saveAttendance, calculateAttendancePercentage } from '../dist-electron/database/services/attendance.service.js';
import { createExamType, createExamination, configureExaminationSubjects, saveMarks, updateExaminationStatus, saveGradingRule, calculateStudentExamResult, getClassExamResults } from '../dist-electron/database/services/exam.service.js';
import { generateNextDocumentNumber, getStudentDocumentPreview, issueStudentDocument, getDocumentHistory, getDocumentById } from '../dist-electron/database/services/document.service.js';
import { getPromotionCandidates, executePromotion, getStudentAcademicHistory, getPromotionLogs } from '../dist-electron/database/services/promotion.service.js';
import { getStudentListReport, getAttendanceReport, getFeeCollectionReport, getFeeOutstandingReport, getExamMarksReport, getClassResultsReport, getClassStrengthReport, getTeacherReport } from '../dist-electron/database/services/report.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';
import { createFeeType, createFeeStructure, createFeePeriod, generateFeesForClass, recordFeePayment } from '../dist-electron/database/services/fee.service.js';
import { createTeacher } from '../dist-electron/database/services/teacher.service.js';

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
  console.log('Starting Phase 8 Tests: Documents, Reports, and Promotions...\n');
  
  // Setup in-memory database
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  
  // Run migrations
  console.log('Running migrations...');
  const migrationResult = runMigrations(db);
  
  // Create admin and login
  createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
  const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
  const sessionToken = loginRes.sessionToken;

  // 1. Schema Integrity
  console.log('\n--- 1. Schema Integrity ---');
  assert(migrationResult.appliedCount >= 7, 'Migrations applied successfully');
  assert(migrationResult.currentVersion >= 7, 'Database version is at least 7');
  
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
  assert(tables.includes('student_documents'), 'student_documents table exists');
  assert(tables.includes('promotion_logs'), 'promotion_logs table exists');
  
  const enrollmentCols = db.prepare(`PRAGMA table_info(student_enrollments)`).all().map(c => c.name);
  assert(enrollmentCols.includes('promotion_status'), 'student_enrollments has promotion_status column');
  assert(enrollmentCols.includes('promotion_date'), 'student_enrollments has promotion_date column');
  assert(enrollmentCols.includes('remarks'), 'student_enrollments has remarks column');

  // 2. School Settings Setup
  console.log('\n--- 2. School Settings Setup ---');
  const settingsRes = updateSchoolSettings({
    sessionToken,
    schoolName: 'Test School',
    schoolCode: 'TSC001',
    address: '123 Main St',
    phone: '555-1234',
    principalName: 'John Doe'
  }, db);
  assert(settingsRes.success === true, 'Saved school settings successfully');
  
  const settings = getSchoolSettings(db);
  assert(settings.schoolName === 'Test School', 'School name is correct');
  assert(settings.schoolCode === 'TSC001', 'School code is correct');

  // Fixture Data Setup
  console.log('\nSetting up fixture data...');
  const s1Res = createSession({ sessionToken, name: '2025-26', startDate: '2025-04-01', endDate: '2026-03-31', isActive: true }, db);
  const session1Id = s1Res.session.id;
  
  const s2Res = createSession({ sessionToken, name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isActive: false }, db);
  const session2Id = s2Res.session.id;
  
  const c9Res = createClass({ sessionToken, name: 'Class 9', displayOrder: 9 }, db);
  const class9Id = c9Res.classItem.id;
  const c10Res = createClass({ sessionToken, name: 'Class 10', displayOrder: 10 }, db);
  const class10Id = c10Res.classItem.id;
  
  const sec9Res = createSection({ sessionToken, classId: class9Id, name: 'A', capacity: 30 }, db);
  const sec9Id = sec9Res.section.id;
  const sec10Res = createSection({ sessionToken, classId: class10Id, name: 'A', capacity: 30 }, db);
  const sec10Id = sec10Res.section.id;

  const subRes = createSubject({ sessionToken, name: 'Math', code: 'M1', type: 'Core' }, db);
  const subjectId = subRes.subject.id;
  assignSubjectToClass({ sessionToken, classId: class9Id, subjectId }, db);

  const stu1Res = createStudent({
    sessionToken, firstName: 'Alice', lastName: 'Smith',
    gender: 'Female', dateOfBirth: '2010-01-01', fatherName: 'Bob',
    phone: '111', city: 'City', province: 'Prov', currentAddress: 'Addr',
    enrollment: {
      academicSessionId: session1Id,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2025-04-01',
      status: 'Active'
    }
  }, db);
  const student1Id = stu1Res.student.id;
  const enroll1Id = stu1Res.student.currentEnrollment.id;
  
  const stu2Res = createStudent({
    sessionToken, firstName: 'Charlie', lastName: 'Brown',
    gender: 'Male', dateOfBirth: '2010-02-02', fatherName: 'Dave',
    phone: '222', city: 'City', province: 'Prov', currentAddress: 'Addr',
    enrollment: {
      academicSessionId: session1Id,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2025-04-01',
      status: 'Active'
    }
  }, db);
  const student2Id = stu2Res.student.id;
  const enroll2Id = stu2Res.student.currentEnrollment.id;
  
  const stu3Res = createStudent({
    sessionToken, firstName: 'Eve', lastName: 'White',
    gender: 'Female', dateOfBirth: '2010-03-03', fatherName: 'Frank',
    phone: '333', city: 'City', province: 'Prov', currentAddress: 'Addr',
    enrollment: {
      academicSessionId: session1Id,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2025-04-01',
      status: 'Active'
    }
  }, db);
  const student3Id = stu3Res.student.id;

  // Add Attendance
  saveAttendance({
    sessionToken, academicSessionId: session1Id, classId: class9Id, sectionId: sec9Id, attendanceDate: '2025-05-01',
    records: [
      { studentId: student1Id, enrollmentId: enroll1Id, status: 'Present', remarks: 'Good' },
      { studentId: student2Id, enrollmentId: enroll2Id, status: 'Absent', remarks: 'Sick' }
    ]
  }, db);

  // Add Fees: Fee Type -> Structure -> Period -> Generate -> Payment
  const ftRes = createFeeType({ sessionToken, name: 'Tuition Fee', code: 'TUIT', description: 'Monthly tuition' }, db);
  createFeeStructure({
    sessionToken,
    academicSessionId: session1Id,
    classId: class9Id,
    feeTypeId: ftRes.feeType.id,
    amount: 100000,
    frequency: 'Monthly'
  }, db);
  const fpRes = createFeePeriod({ sessionToken, name: 'April 2025', startDate: '2025-04-01', endDate: '2025-04-30', dueDate: '2025-04-10', academicSessionId: session1Id }, db);
  generateFeesForClass({ sessionToken, academicSessionId: session1Id, classId: class9Id, feePeriodId: fpRes.period.id }, db);
  
  // Collect a fee
  const feeRec = db.prepare('SELECT id FROM fee_records WHERE student_id = ?').get(student1Id);
  recordFeePayment({
    sessionToken,
    feeRecordId: feeRec.id,
    amount: 100000,
    paymentMethod: 'Cash',
    paymentDate: '2025-04-05'
  }, db);

  // Add Exam Marks
  const etRes = createExamType({ sessionToken, name: 'Term 1', code: 'T1' }, db);
  const examRes = createExamination({ sessionToken, name: 'Mid Term', examTypeId: etRes.examType.id, academicSessionId: session1Id, startDate: '2025-10-01', endDate: '2025-10-10' }, db);
  const examId = examRes.examination.id;
  const examSubRes = configureExaminationSubjects({ sessionToken, examinationId: examId, classId: class9Id, subjects: [{ subjectId, maxMarks: 100, passingMarks: 40, displayOrder: 1 }] }, db);
  const examSubjectId = examSubRes.subjects[0].id;
  saveMarks({ sessionToken, examinationId: examId, examinationSubjectId: examSubjectId, marks: [{ studentId: student1Id, enrollmentId: enroll1Id, obtainedMarks: 85, status: 'Entered' }] }, db);

  // Add Teacher
  createTeacher({ sessionToken, firstName: 'Mr.', lastName: 'Teacher', gender: 'Male', dateOfBirth: '1980-01-01', phone: '444', city: 'City', province: 'Prov', qualification: 'BSc', employmentStatus: 'Active', joiningDate: '2020-01-01', currentAddress: 'Addr' }, db);

  // 3. Document Generation Tests
  console.log('\n--- 3. Document Generation Tests ---');
  const preview1 = getStudentDocumentPreview({ studentId: student1Id, documentType: 'Bonafide', academicSessionId: session1Id }, db);
  assert(preview1.success === true, 'Generated Bonafide preview successfully');
  assert(preview1.document.school.schoolName === 'Test School', 'Preview contains school name');
  
  const preview2 = getStudentDocumentPreview({ studentId: student1Id, documentType: 'Character', academicSessionId: session1Id, conduct: 'Good' }, db);
  assert(preview2.success === true, 'Generated Character preview successfully');
  
  const preview3 = getStudentDocumentPreview({ studentId: student1Id, documentType: 'Leaving', academicSessionId: session1Id, reasonForLeaving: 'Transfer', duesCleared: true }, db);
  assert(preview3.success === true, 'Generated Leaving preview successfully');
  
  const preview4 = getStudentDocumentPreview({ studentId: student1Id, documentType: 'General', academicSessionId: session1Id, customTitle: 'Cert', customContent: 'Content' }, db);
  assert(preview4.success === true, 'Generated General preview successfully');

  const issueRes1 = issueStudentDocument({ sessionToken, studentId: student1Id, documentType: 'Bonafide', academicSessionId: session1Id, title: 'Bonafide Cert' }, db);
  assert(issueRes1.success === true, 'Issued Bonafide document');
  assert(issueRes1.document.documentNumber != null, 'Document has a number');

  const issueRes2 = issueStudentDocument({ sessionToken, studentId: student1Id, documentType: 'Character', academicSessionId: session1Id, title: 'Char Cert' }, db);
  assert(issueRes2.success === true, 'Issued second document');
  assert(issueRes2.document.documentNumber > issueRes1.document.documentNumber, 'Document numbering is sequential');

  const history = getDocumentHistory({ studentId: student1Id }, db);
  assert(history.success === true && history.documents.length === 2, 'Retrieved document history');

  const doc = getDocumentById(issueRes1.document.id, db);
  assert(doc !== null && doc.id === issueRes1.document.id, 'Retrieved document by ID');
  
  const docFail1 = getStudentDocumentPreview({ documentType: 'Bonafide', academicSessionId: session1Id }, db);
  assert(docFail1.success === false, 'Document preview without studentId returns error');
  
  const docFail2 = getStudentDocumentPreview({ studentId: 9999, documentType: 'Bonafide', academicSessionId: session1Id }, db);
  assert(docFail2.success === false, 'Document preview with invalid student returns error');

  // 4. Report Generation Tests
  console.log('\n--- 4. Report Generation Tests ---');
  const stuReport = getStudentListReport({ classId: class9Id }, db);
  assert(stuReport.success === true && stuReport.records.length >= 3, 'Student List Report returns records');

  const attReport = getAttendanceReport({ academicSessionId: session1Id, classId: class9Id }, db);
  assert(attReport.success === true && attReport.records.length > 0, 'Attendance Report returns records');

  const feeColReport = getFeeCollectionReport({ academicSessionId: session1Id }, db);
  assert(feeColReport.success === true && feeColReport.records.length > 0, 'Fee Collection Report returns records');

  const feeOutReport = getFeeOutstandingReport({ academicSessionId: session1Id }, db);
  assert(feeOutReport.success === true && feeOutReport.records.length > 0, 'Fee Outstanding Report returns records');

  const examReport = getExamMarksReport({ examinationId: examId, classId: class9Id }, db);
  assert(examReport.success === true && examReport.records.length > 0, 'Exam Marks Report returns records');

  const classResReport = getClassResultsReport({ examinationId: examId, classId: class9Id }, db);
  assert(classResReport.success === true, 'Class Results Report generated successfully');

  const strengthReport = getClassStrengthReport(session1Id, db);
  assert(strengthReport.success === true && strengthReport.records.length > 0, 'Class Strength Report returns records');

  const tchrReport = getTeacherReport({}, db);
  assert(tchrReport.success === true && tchrReport.records.length > 0, 'Teacher Report returns records');

  // 5. Student Promotion Tests
  console.log('\n--- 5. Student Promotion Tests ---');
  const candidates = getPromotionCandidates({ fromSessionId: session1Id, fromClassId: class9Id }, db);
  assert(candidates.success === true && candidates.candidates.length >= 3, 'Retrieved promotion candidates');
  
  // Promote Alice
  const promoRes = executePromotion({
    sessionToken,
    fromSessionId: session1Id,
    toSessionId: session2Id,
    fromClassId: class9Id,
    toClassId: class10Id,
    promotions: [
      { studentId: student1Id, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id }
    ]
  }, db);
  assert(promoRes.success === true, 'Promoted student successfully');
  
  const aliceEnrolls = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').all(student1Id);
  assert(aliceEnrolls.length === 2, 'Student has two enrollments after promotion');
  const aliceOld = aliceEnrolls.find(e => e.academic_session_id === session1Id);
  const aliceNew = aliceEnrolls.find(e => e.academic_session_id === session2Id);
  assert(aliceOld.status === 'Inactive' && aliceOld.promotion_status === 'Promote', 'Old enrollment is Inactive/Promote');
  assert(aliceNew.status === 'Active' && aliceNew.class_id === class10Id, 'New enrollment is Active in new class');

  // Retain Charlie
  executePromotion({
    sessionToken,
    fromSessionId: session1Id,
    toSessionId: session2Id,
    fromClassId: class9Id,
    promotions: [
      { studentId: student2Id, action: 'Retain', toClassId: class9Id, toSectionId: sec9Id }
    ]
  }, db);
  const charlieEnrolls = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').all(student2Id);
  const charlieOld = charlieEnrolls.find(e => e.academic_session_id === session1Id);
  const charlieNew = charlieEnrolls.find(e => e.academic_session_id === session2Id);
  assert(charlieOld.status === 'Inactive' && charlieOld.promotion_status === 'Retain', 'Old enrollment is Inactive/Retain');
  assert(charlieNew.status === 'Active' && charlieNew.class_id === class9Id, 'New enrollment is Active in same class');

  // Graduate/Transfer/Left
  const stu4Res = createStudent({
    sessionToken, firstName: 'D', lastName: 'D',
    gender: 'Male', dateOfBirth: '2010-04-04', fatherName: 'D',
    phone: '444', city: 'City', province: 'Prov', currentAddress: 'Addr',
    enrollment: {
      academicSessionId: session1Id,
      classId: class9Id,
      sectionId: sec9Id,
      admissionDate: '2025-04-01',
      status: 'Active'
    }
  }, db);
  
  executePromotion({
    sessionToken, fromSessionId: session1Id, fromClassId: class9Id,
    promotions: [{ studentId: stu4Res.student.id, action: 'Graduate' }]
  }, db);
  const dOld = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').get(stu4Res.student.id);
  const dStudent = getStudentById(stu4Res.student.id, db);
  assert(dOld.status === 'Graduated' && dOld.promotion_status === 'Graduated', 'Graduated enrollment marked Graduated');
  assert(dStudent.isActive === false, 'Graduated student is inactive');

  // 6. Duplicate Promotion Protection
  console.log('\n--- 6. Duplicate Promotion Protection ---');
  const dupPromo = executePromotion({
    sessionToken, fromSessionId: session1Id, toSessionId: session2Id, fromClassId: class9Id,
    promotions: [{ studentId: student1Id, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id }]
  }, db);
  assert(dupPromo.success === false, 'Duplicate promotion returns error');

  // 7. Bulk Promotion & Transaction Rollback
  console.log('\n--- 7. Bulk Promotion & Transaction Rollback ---');
  const stu5Res = createStudent({ sessionToken, firstName: 'E', lastName: 'E', gender: 'Male', dateOfBirth: '2010-04-04', fatherName: 'E', phone: '4', city: 'C', province: 'P', currentAddress: 'A', enrollment: { academicSessionId: session1Id, classId: class9Id, sectionId: sec9Id, admissionDate: '2025-04-01', status: 'Active' } }, db);
  const stu6Res = createStudent({ sessionToken, firstName: 'F', lastName: 'F', gender: 'Male', dateOfBirth: '2010-04-04', fatherName: 'F', phone: '5', city: 'C', province: 'P', currentAddress: 'A', enrollment: { academicSessionId: session1Id, classId: class9Id, sectionId: sec9Id, admissionDate: '2025-04-01', status: 'Active' } }, db);
  
  const bulkFail = executePromotion({
    sessionToken, fromSessionId: session1Id, toSessionId: session2Id, fromClassId: class9Id, toClassId: class10Id,
    promotions: [
      { studentId: stu5Res.student.id, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id },
      { studentId: 9999, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id } // Invalid student
    ]
  }, db);
  assert(bulkFail.success === false, 'Transaction rolls back on invalid student');
  const eEnrolls = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').all(stu5Res.student.id);
  assert(eEnrolls.length === 1, 'No partial promotion occurred during bulk failure');

  const bulkSuccess = executePromotion({
    sessionToken, fromSessionId: session1Id, toSessionId: session2Id, fromClassId: class9Id, toClassId: class10Id,
    promotions: [
      { studentId: stu5Res.student.id, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id },
      { studentId: stu6Res.student.id, action: 'Promote', toClassId: class10Id, toSectionId: sec10Id }
    ]
  }, db);
  assert(bulkSuccess.success === true, 'Bulk promotion succeeded');

  // 8. Academic History
  console.log('\n--- 8. Academic History ---');
  const historyRes = getStudentAcademicHistory(student1Id, db);
  assert(historyRes.success === true && historyRes.history.length === 2, 'Academic history retrieves both sessions');
  const histPromo = historyRes.history.find(h => h.academicSessionId === session1Id);
  assert(histPromo && histPromo.promotionStatus === 'Promote', 'History contains promotion status');

  // 9. Promotion Logs
  console.log('\n--- 9. Promotion Logs ---');
  const logsRes = getPromotionLogs({ studentId: student1Id }, db);
  assert(logsRes.success === true && logsRes.logs.length > 0, 'Promotion logs retrieved for student');
  assert(logsRes.logs[0].action === 'Promote', 'Log shows correct action');

  // 10. Historical Data Integrity
  console.log('\n--- 10. Historical Data Integrity ---');
  const oldAtt = db.prepare('SELECT * FROM attendance WHERE student_id = ?').all(student1Id);
  assert(oldAtt.length > 0 && oldAtt[0].academic_session_id === session1Id, 'Old attendance is linked to old session');
  
  const oldFee = db.prepare('SELECT * FROM fee_records WHERE student_id = ?').all(student1Id);
  assert(oldFee.length > 0 && oldFee[0].academic_session_id === session1Id, 'Old fees are linked to old session');
  
  const oldMarks = db.prepare(`SELECT m.* FROM exam_marks m JOIN examination_subjects es ON m.examination_subject_id = es.id JOIN examinations e ON es.examination_id = e.id WHERE m.student_id = ?`).all(student1Id);
  assert(oldMarks.length > 0, 'Old exam marks still exist');

  db.close();
  
  console.log(`\n\nResults: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  process.exit(failedTests > 0 ? 1 : 0);
}

runTestSuite().catch(err => { console.error(err); process.exit(1); });
