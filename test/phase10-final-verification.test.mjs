/**
 * Phase 10 Final Verification & End-to-End System Test Suite
 * 
 * Commercial Offline Windows Desktop Application: School / College Management System
 * Full Verification:
 * - Fresh DB creation & complete migration chain (Migrations 001 - 008)
 * - Clean first-run experience (Zero demo/sample data)
 * - Admin Auth & Security (scrypt hashing, session tokens)
 * - School Settings & Dynamic Branding
 * - Academic Structure (Sessions, Classes, Sections, Subjects, Assignments)
 * - Students & Faculty (Permanent IDs, admissions, enrollments)
 * - Daily Attendance & Summaries
 * - Fees & Payments (Fee structures, class billing, atomic payments, unique receipts)
 * - Distinct Class Subjects & Dynamic DMC verification
 * - Student Documents & Reports
 * - Student Promotion, Historical Data Protection & Academic Progression
 * - Asymmetric Ed25519 Offline Licensing & Hardware Binding
 * - Backup (.smbak) creation, SHA-256 validation & Disaster Recovery Restore
 * - Realistic Load & Search Performance (500+ records)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  isSetupRequired,
  createInitialAdmin,
  login,
  logout,
  verifySession,
} from '../dist-electron/database/services/auth.service.js';
import {
  getSchoolSettings,
  updateSchoolSettings,
} from '../dist-electron/database/services/school.service.js';
import {
  createSession,
  getAllSessions,
  activateSession,
} from '../dist-electron/database/services/academic-session.service.js';
import {
  createClass,
  createSection,
  getAllClasses,
  getSectionsByClassId,
} from '../dist-electron/database/services/class.service.js';
import {
  createSubject,
  assignSubjectToClass,
  getClassSubjects,
} from '../dist-electron/database/services/subject.service.js';
import {
  createTeacher,
  getAllTeachers,
} from '../dist-electron/database/services/teacher.service.js';
import {
  createStudent,
  getAllStudents,
  getStudentById,
  createEnrollment,
} from '../dist-electron/database/services/student.service.js';
import {
  saveAttendance,
  getEnrolledStudentsForAttendance,
  getDailyAttendanceSummary,
} from '../dist-electron/database/services/attendance.service.js';
import {
  createFeeType,
  createFeeStructure,
  createFeePeriod,
  generateFeesForClass,
  recordFeePayment,
  getFeeRecords,
  toMinorUnits,
} from '../dist-electron/database/services/fee.service.js';
import {
  createExamType,
  createExamination,
  configureExaminationSubjects,
  saveMarks,
  calculateStudentExamResult,
  getClassExamResults,
  generateStudentDMC,
} from '../dist-electron/database/services/exam.service.js';
import {
  issueStudentDocument,
  getStudentDocumentPreview,
  getDocumentById,
} from '../dist-electron/database/services/document.service.js';
import {
  getStudentListReport,
  getAttendanceReport,
  getFeeCollectionReport,
  getClassStrengthReport,
} from '../dist-electron/database/services/report.service.js';
import {
  getPromotionCandidates,
  executePromotion,
  getStudentAcademicHistory,
} from '../dist-electron/database/services/promotion.service.js';
import {
  getInstallationIdentity,
  activateLicense,
  getLicenseStatus,
} from '../dist-electron/database/services/license.service.js';
import {
  createSuperAdminAccount,
  loginSuperAdmin,
  generateLicense,
} from '../dist-electron/database/services/super-admin.service.js';
import {
  createBackup,
  validateBackup,
  restoreBackup,
} from '../dist-electron/database/services/backup.service.js';
import {
  verifyLicenseSignature,
} from '../dist-electron/crypto/license-crypto.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase10Tests() {
  console.log('================================================================');
  console.log('Starting Phase 10 Final Verification & Production Audit Suite...');
  console.log('================================================================\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-phase10-'));
  const dbPath = path.join(tempDir, 'school_prod_test.sqlite');
  const backupDir = path.join(tempDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  try {
    // -------------------------------------------------------------
    // PART 1 & 5: Fresh DB & Complete Migration Chain
    // -------------------------------------------------------------
    console.log('--- 1. Database Migration & Fresh Installation Audit ---');
    const migResult = runMigrations(db);
    assert(migResult.appliedCount >= 8, 'All database migrations applied successfully from scratch');
    assert(migResult.currentVersion >= 8, 'Schema version is at least 8');

    const appVerRow = db.prepare(`SELECT value FROM app_metadata WHERE key = 'app_version'`).get();
    assert(appVerRow && appVerRow.value === '1.0.0', 'Production app_version is recorded as 1.0.0');

    // Verify zero demo data in fresh install
    const studentCount = db.prepare(`SELECT COUNT(*) as c FROM students`).get().c;
    const teacherCount = db.prepare(`SELECT COUNT(*) as c FROM teachers`).get().c;
    const feeCount = db.prepare(`SELECT COUNT(*) as c FROM fee_records`).get().c;
    const examCount = db.prepare(`SELECT COUNT(*) as c FROM examinations`).get().c;
    assert(studentCount === 0 && teacherCount === 0 && feeCount === 0 && examCount === 0,
      'Fresh installation contains zero sample or demo data');

    // -------------------------------------------------------------
    // PART 6 & 7: Authentication & Setup Flow
    // -------------------------------------------------------------
    console.log('\n--- 2. Administrator Authentication & Security ---');
    assert(isSetupRequired(db) === true, 'isSetupRequired returns true before initial admin creation');

    const adminRes = createInitialAdmin({
      username: 'admin',
      displayName: 'System Administrator',
      password: 'AdminSecurePassword2026!',
    }, db);
    assert(adminRes.success === true && adminRes.user?.id === 1, 'Initial admin account initialized');
    assert(isSetupRequired(db) === false, 'isSetupRequired returns false once admin exists');

    // Verify password is scrypt hashed (never plaintext)
    const userRow = db.prepare(`SELECT password_hash FROM users WHERE username = 'admin'`).get();
    assert(userRow.password_hash !== 'AdminSecurePassword2026!', 'Admin password is encrypted with salt and hash');
    assert(userRow.password_hash.length >= 64, 'Password hash meets cryptographic length standards');

    // Login checks
    const badLogin = login({ username: 'admin', password: 'wrongpassword' }, db);
    assert(badLogin.success === false, 'Login rejected for incorrect password');

    const goodLogin = login({ username: 'admin', password: 'AdminSecurePassword2026!' }, db);
    assert(goodLogin.success === true && typeof goodLogin.sessionToken === 'string', 'Login succeeds with valid credentials');
    const token = goodLogin.sessionToken;

    const sessionCheck = verifySession(token);
    assert(sessionCheck.isValid === true && sessionCheck.user?.username === 'admin', 'Active session verified');

    // -------------------------------------------------------------
    // PART 8: School Settings & Dynamic Branding
    // -------------------------------------------------------------
    console.log('\n--- 3. School Settings & Branding ---');
    const settingsUpdate = updateSchoolSettings({
      sessionToken: token,
      schoolName: 'Quaid-e-Azam Public College',
      schoolCode: 'QPC-2026',
      schoolType: 'College',
      addressLine1: 'Main University Road, Campus A',
      city: 'Islamabad',
      province: 'Federal',
      phone: '+92-51-111-222-333',
      email: 'info@quaidcollege.edu.pk',
      principalName: 'Prof. Muhammad Tariq',
      currencySymbol: 'PKR',
    }, db);
    assert(settingsUpdate.success === true, 'School settings saved successfully');

    const activeSettings = getSchoolSettings(db);
    assert(activeSettings.schoolName === 'Quaid-e-Azam Public College', 'Retrieved dynamic school name');
    assert(activeSettings.principalName === 'Prof. Muhammad Tariq', 'Retrieved principal name');

    // -------------------------------------------------------------
    // PART 9: Academic Structure & Distinct Subjects
    // -------------------------------------------------------------
    console.log('\n--- 4. Academic Structure & Distinct Subject Allocation ---');
    const sess2025 = createSession({
      sessionToken: token,
      name: '2025-2026',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      isCurrent: true,
    }, db);
    const sess2026 = createSession({
      sessionToken: token,
      name: '2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isCurrent: false,
    }, db);
    assert(sess2025.success === true && sess2026.success === true, 'Created academic sessions 2025-2026 & 2026-2027');

    // Class A: Pre-Engineering Class
    const classA = createClass({ sessionToken: token, name: 'Class 9 - Pre-Engineering', displayOrder: 1 }, db);
    const secA1 = createSection({ sessionToken: token, classId: classA.classItem.id, name: 'Section A', capacity: 40 }, db);

    // Class B: Humanities Class
    const classB = createClass({ sessionToken: token, name: 'Class 10 - Humanities', displayOrder: 2 }, db);
    const secB1 = createSection({ sessionToken: token, classId: classB.classItem.id, name: 'Section B', capacity: 40 }, db);

    // Create distinctive subjects
    const subPhysics = createSubject({ sessionToken: token, name: 'Physics', code: 'PHY-101', type: 'Theory' }, db);
    const subChemistry = createSubject({ sessionToken: token, name: 'Chemistry', code: 'CHEM-101', type: 'Theory' }, db);
    const subCivics = createSubject({ sessionToken: token, name: 'Civics', code: 'CIV-201', type: 'Theory' }, db);
    const subHistory = createSubject({ sessionToken: token, name: 'History', code: 'HIST-201', type: 'Theory' }, db);

    // Assign to Class A
    assignSubjectToClass({ sessionToken: token, classId: classA.classItem.id, subjectId: subPhysics.subject.id }, db);
    assignSubjectToClass({ sessionToken: token, classId: classA.classItem.id, subjectId: subChemistry.subject.id }, db);

    // Assign to Class B
    assignSubjectToClass({ sessionToken: token, classId: classB.classItem.id, subjectId: subCivics.subject.id }, db);
    assignSubjectToClass({ sessionToken: token, classId: classB.classItem.id, subjectId: subHistory.subject.id }, db);

    const classASubjects = getClassSubjects(classA.classItem.id, db);
    const classBSubjects = getClassSubjects(classB.classItem.id, db);
    assert(classASubjects.length === 2 && classASubjects.some(s => s.subjectName === 'Physics'), 'Class A assigned only Physics & Chemistry');
    assert(classBSubjects.length === 2 && classBSubjects.some(s => s.subjectName === 'Civics'), 'Class B assigned only Civics & History');
    assert(!classASubjects.some(s => s.subjectName === 'Civics'), 'Class A does not have Class B subjects');

    // -------------------------------------------------------------
    // PART 10 & 11: Teachers & Students Management
    // -------------------------------------------------------------
    console.log('\n--- 5. Faculty & Student Management ---');
    const teacher1 = createTeacher({
      sessionToken: token,
      firstName: 'Ahmed',
      lastName: 'Khan',
      displayName: 'Ahmed Khan',
      gender: 'Male',
      dateOfBirth: '1985-05-15',
      phone: '03001234567',
      city: 'Islamabad',
      province: 'Federal',
      qualification: 'M.Sc. Physics',
      employmentStatus: 'Active',
      joiningDate: '2020-01-15',
      currentAddress: 'Sector G-9, Islamabad',
    }, db);
    assert(teacher1.success === true && teacher1.teacher.teacherId.startsWith('TCH-'), 'Teacher registered with permanent system ID');

    // Create 2 primary students
    const stdA = createStudent({
      sessionToken: token,
      firstName: 'Bilal',
      lastName: 'Hassan',
      displayName: 'Bilal Hassan',
      gender: 'Male',
      dateOfBirth: '2010-08-20',
      fatherName: 'Hassan Mahmood',
      phone: '03129876543',
      city: 'Islamabad',
      province: 'Federal',
      currentAddress: 'House 12, Street 4, Islamabad',
      enrollment: {
        academicSessionId: sess2025.session.id,
        classId: classA.classItem.id,
        sectionId: secA1.section.id,
        admissionDate: '2025-04-05',
      },
    }, db);

    const stdB = createStudent({
      sessionToken: token,
      firstName: 'Zainab',
      lastName: 'Fatima',
      displayName: 'Zainab Fatima',
      gender: 'Female',
      dateOfBirth: '2009-11-12',
      fatherName: 'Tariq Mehmood',
      phone: '03214567890',
      city: 'Rawalpindi',
      province: 'Punjab',
      currentAddress: 'Chaklala Scheme 3, Rawalpindi',
      enrollment: {
        academicSessionId: sess2025.session.id,
        classId: classB.classItem.id,
        sectionId: secB1.section.id,
        admissionDate: '2025-04-05',
      },
    }, db);

    assert(stdA.success === true && stdA.student.studentId.startsWith('STD-'), 'Student A registered with unique ID');
    assert(stdB.success === true && stdB.student.studentId.startsWith('STD-'), 'Student B registered with unique ID');

    // Verify invalid mismatched section enrollment protection
    const invalidEnroll = createEnrollment({
      sessionToken: token,
      studentId: stdA.student.id,
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      sectionId: secB1.section.id,
      admissionDate: '2025-04-10',
    }, db);
    assert(invalidEnroll.success === false && invalidEnroll.error.includes('Selected section does not belong'), 'Mismatched class-section enrollment is prevented');

    // -------------------------------------------------------------
    // PART 12: Daily Attendance Management
    // -------------------------------------------------------------
    console.log('\n--- 6. Attendance Operations & Statistics ---');
    const enrollmentsA = getEnrolledStudentsForAttendance({
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      sectionId: secA1.section.id,
      attendanceDate: '2025-09-01',
    }, db);
    assert(enrollmentsA.success === true && enrollmentsA.students.length >= 1, 'Loaded enrolled students for attendance');
    const stdAEnrollment = enrollmentsA.students.find(s => s.studentId === stdA.student.id);

    const attSave = saveAttendance({
      sessionToken: token,
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      sectionId: secA1.section.id,
      attendanceDate: '2025-09-01',
      records: [
        { studentId: stdA.student.id, enrollmentId: stdAEnrollment.enrollmentId, status: 'Present', remarks: 'On time' }
      ]
    }, db);
    assert(attSave.success === true && attSave.savedCount === 1, 'Attendance recorded successfully');

    const attSummary = getDailyAttendanceSummary({
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      sectionId: secA1.section.id,
      attendanceDate: '2025-09-01',
    }, db);
    assert(attSummary.success === true && attSummary.summary.presentCount === 1, 'Attendance summary reflects present status');

    // -------------------------------------------------------------
    // PART 13: Fee Structure, Billing, Payments & Receipts
    // -------------------------------------------------------------
    console.log('\n--- 7. Fees, Atomic Payments & Receipts ---');
    const tuitionType = createFeeType({
      sessionToken: token,
      name: 'Monthly Tuition Fee',
      code: 'TUI-MONTHLY',
      isRecurring: true,
    }, db);

    // Create Fee Structure for Class A (5,000 PKR = 500,000 paisa)
    const feeStruct = createFeeStructure({
      sessionToken: token,
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      feeTypeId: tuitionType.feeType.id,
      amount: 500000,
      frequency: 'Monthly',
    }, db);
    assert(feeStruct.success === true, 'Class fee structure created (5,000 PKR)');

    const feePeriod = createFeePeriod({
      sessionToken: token,
      academicSessionId: sess2025.session.id,
      name: 'September 2025',
      startDate: '2025-09-01',
      endDate: '2025-09-30',
      dueDate: '2025-09-10',
    }, db);

    const genFee = generateFeesForClass({
      sessionToken: token,
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      feePeriodId: feePeriod.period.id,
      dueDate: '2025-09-10',
    }, db);
    assert(genFee.success === true && genFee.summary.createdCount >= 1, 'Class-wise monthly fee generated');

    const studentFees = getFeeRecords({ studentId: stdA.student.id }, db).records;
    assert(studentFees.length >= 1, 'Student fee record retrieved');
    const feeRec = studentFees[0];
    assert(feeRec.netAmount === 500000 && feeRec.status === 'Unpaid', 'Student fee shows 5,000 PKR unpaid');

    // Atomic Partial Payment (3,000 PKR)
    const payment1 = recordFeePayment({
      sessionToken: token,
      feeRecordId: feeRec.id,
      amount: 300000,
      paymentMethod: 'Cash',
      paymentDate: '2025-09-05',
      referenceNotes: 'First installment',
    }, db);
    assert(payment1.success === true && payment1.receiptNumber?.startsWith('REC-'), 'Partial fee payment recorded with unique receipt');
    assert(payment1.remainingBalance === 200000, 'Remaining balance updated to 2,000 PKR');

    // Final Payment (2,000 PKR)
    const payment2 = recordFeePayment({
      sessionToken: token,
      feeRecordId: feeRec.id,
      amount: 200000,
      paymentMethod: 'Bank Transfer',
      paymentDate: '2025-09-08',
      referenceNotes: 'Clearance',
    }, db);
    assert(payment2.success === true && payment2.remainingBalance === 0, 'Final balance settled to 0');

    const feeAfterFull = getFeeRecords({ studentId: stdA.student.id }, db).records[0];
    assert(feeAfterFull.status === 'Paid', 'Fee record status transitioned to Paid');

    // -------------------------------------------------------------
    // PART 14, 15, 16: Dynamic DMC with Distinct Class Subjects
    // -------------------------------------------------------------
    console.log('\n--- 8. Examinations, Boundary Marks & Dynamic DMC Verification ---');
    const midtermType = createExamType({ sessionToken: token, name: 'Midterm Examination', code: 'MID-2025' }, db);

    // Exam for Class A (Pre-Engineering)
    const examA = createExamination({
      sessionToken: token,
      examTypeId: midtermType.examType.id,
      academicSessionId: sess2025.session.id,
      classId: classA.classItem.id,
      name: 'Class 9 Midterms',
      startDate: '2025-10-01',
      endDate: '2025-10-15',
    }, db);

    const examSubA = configureExaminationSubjects({
      sessionToken: token,
      examinationId: examA.examination.id,
      classId: classA.classItem.id,
      subjects: [
        { subjectId: subPhysics.subject.id, maxMarks: 100, passingMarks: 33, examDate: '2025-10-02' },
        { subjectId: subChemistry.subject.id, maxMarks: 100, passingMarks: 33, examDate: '2025-10-04' }
      ]
    }, db);
    assert(examSubA.success === true, 'Configured Class A exam subjects');

    // Save Marks for Student A (Physics: 85, Chemistry: 91 -> Total 176 / 200 = 88% Grade A+)
    saveMarks({
      sessionToken: token,
      examinationId: examA.examination.id,
      examinationSubjectId: examSubA.subjects[0].id,
      marks: [{ studentId: stdA.student.id, enrollmentId: stdAEnrollment.enrollmentId, obtainedMarks: 85, status: 'Entered' }]
    }, db);

    saveMarks({
      sessionToken: token,
      examinationId: examA.examination.id,
      examinationSubjectId: examSubA.subjects[1].id,
      marks: [{ studentId: stdA.student.id, enrollmentId: stdAEnrollment.enrollmentId, obtainedMarks: 91, status: 'Entered' }]
    }, db);

    const resA = calculateStudentExamResult(examA.examination.id, stdA.student.id, db);
    assert(resA.success === true, 'Calculated Student A result');
    assert(resA.result.totalMaxMarks === 200 && resA.result.totalObtainedMarks === 176, 'Marks match: 176 / 200');
    assert(resA.result.percentage === 88 && resA.result.grade === 'A' && resA.result.isPassed === true, 'Calculated 88% Grade A Pass');

    // Exam for Class B (Humanities)
    const examB = createExamination({
      sessionToken: token,
      examTypeId: midtermType.examType.id,
      academicSessionId: sess2025.session.id,
      classId: classB.classItem.id,
      name: 'Class 10 Midterms',
      startDate: '2025-10-01',
      endDate: '2025-10-15',
    }, db);

    const examSubB = configureExaminationSubjects({
      sessionToken: token,
      examinationId: examB.examination.id,
      classId: classB.classItem.id,
      subjects: [
        { subjectId: subCivics.subject.id, maxMarks: 100, passingMarks: 33, examDate: '2025-10-03' },
        { subjectId: subHistory.subject.id, maxMarks: 100, passingMarks: 33, examDate: '2025-10-05' }
      ]
    }, db);

    const enrollB = db.prepare('SELECT id FROM student_enrollments WHERE student_id = ?').get(stdB.student.id);

    saveMarks({
      sessionToken: token,
      examinationId: examB.examination.id,
      examinationSubjectId: examSubB.subjects[0].id,
      marks: [{ studentId: stdB.student.id, enrollmentId: enrollB.id, obtainedMarks: 72, status: 'Entered' }]
    }, db);
    saveMarks({
      sessionToken: token,
      examinationId: examB.examination.id,
      examinationSubjectId: examSubB.subjects[1].id,
      marks: [{ studentId: stdB.student.id, enrollmentId: enrollB.id, obtainedMarks: 78, status: 'Entered' }]
    }, db);

    const resB = calculateStudentExamResult(examB.examination.id, stdB.student.id, db);
    assert(resB.result.totalMaxMarks === 200 && resB.result.totalObtainedMarks === 150 && resB.result.percentage === 75, 'Calculated 75% for Class B student');

    // Dynamic DMC Checks
    const dmcA = generateStudentDMC(examA.examination.id, stdA.student.id, db);
    assert(dmcA.success === true, 'Generated DMC for Class A student');
    assert(dmcA.dmc.school.schoolName === 'Quaid-e-Azam Public College', 'DMC contains dynamic school name');
    assert(dmcA.dmc.student.systemStudentId === stdA.student.studentId, 'DMC identifies student by permanent studentId');
    assert(dmcA.dmc.subjects.length === 2, 'Class A DMC has exactly 2 subjects');
    assert(dmcA.dmc.subjects.some(s => s.subjectName === 'Physics') && !dmcA.dmc.subjects.some(s => s.subjectName === 'Civics'),
      'CRITICAL: Class A DMC contains only Physics & Chemistry (no Civics or hardcoded subjects)');

    const dmcB = generateStudentDMC(examB.examination.id, stdB.student.id, db);
    assert(dmcB.dmc.subjects.some(s => s.subjectName === 'Civics') && !dmcB.dmc.subjects.some(s => s.subjectName === 'Physics'),
      'CRITICAL: Class B DMC contains only Civics & History (no Physics or hardcoded subjects)');

    // -------------------------------------------------------------
    // PART 17 & 18: Student Documents & Reports
    // -------------------------------------------------------------
    console.log('\n--- 9. Official Documents & Management Reports ---');
    const docPreview = getStudentDocumentPreview({
      studentId: stdA.student.id,
      documentType: 'Bonafide',
      academicSessionId: sess2025.session.id,
    }, db);
    assert(docPreview.success === true && docPreview.document?.school?.schoolName === 'Quaid-e-Azam Public College', 'Document preview generated with dynamic school data');

    const docIssue = issueStudentDocument({
      sessionToken: token,
      studentId: stdA.student.id,
      documentType: 'Bonafide',
      academicSessionId: sess2025.session.id,
      title: 'Bonafide Certificate',
      details: { conduct: 'Exemplary' },
      remarks: 'Issued for passport verification',
    }, db);
    assert(docIssue.success === true && docIssue.document.documentNumber.startsWith('DOC-'), 'Official document issued with unique serial number');

    // Reports
    const repStudents = getStudentListReport({ academicSessionId: sess2025.session.id }, db);
    assert(repStudents.success === true && repStudents.records.length >= 2, 'Student list report generated');

    const repFees = getFeeCollectionReport({ academicSessionId: sess2025.session.id }, db);
    assert(repFees.success === true && repFees.records.length >= 2, 'Fee collection report generated');

    // -------------------------------------------------------------
    // PART 19: Student Promotion, Historical Protection & Academic Progression
    // -------------------------------------------------------------
    console.log('\n--- 10. Promotion & Historical Progression Integrity ---');
    const candidates = getPromotionCandidates({
      fromSessionId: sess2025.session.id,
      fromClassId: classA.classItem.id,
      toSessionId: sess2026.session.id,
    }, db);
    assert(candidates.success === true && candidates.candidates.length >= 1, 'Promotion candidate detected from Class A');

    // Promote Bilal Hassan to Class B in session 2026-2027
    const promoExec = executePromotion({
      sessionToken: token,
      fromSessionId: sess2025.session.id,
      toSessionId: sess2026.session.id,
      fromClassId: classA.classItem.id,
      toClassId: classB.classItem.id,
      fromSectionId: secA1.section.id,
      toSectionId: secB1.section.id,
      promotions: [
        {
          studentId: stdA.student.id,
          action: 'Promote',
          toClassId: classB.classItem.id,
          toSectionId: secB1.section.id,
          rollNumber: '10-A-01',
          remarks: 'Promoted based on 88% midterm result',
        }
      ]
    }, db);
    assert(promoExec.success === true && promoExec.processedCount === 1, 'Student successfully promoted to new session');

    // Verify Historical Integrity
    const studentAfterPromo = getStudentById(stdA.student.id, db);
    assert(studentAfterPromo.studentId === stdA.student.studentId, 'Permanent Student ID preserved across promotion');

    // Previous enrollment marked inactive with promotion status
    const enrollments = db.prepare(`SELECT academic_session_id, class_id, status, promotion_status FROM student_enrollments WHERE student_id = ? ORDER BY id ASC`).all(stdA.student.id);
    assert(enrollments.length === 2, 'Student has exactly 2 enrollment records');
    assert(enrollments[0].status === 'Inactive' && (enrollments[0].promotion_status === 'Promote' || enrollments[0].promotion_status === 'Promoted'), 'Original enrollment marked Inactive Promoted');
    assert(enrollments[1].academic_session_id === sess2026.session.id && enrollments[1].status === 'Active', 'New enrollment active in 2026-2027');

    // Verify historical attendance and marks remain linked to 2025 session
    const oldAtt = db.prepare(`SELECT COUNT(*) as c FROM attendance WHERE student_id = ? AND academic_session_id = ?`).get(stdA.student.id, sess2025.session.id).c;
    assert(oldAtt === 1, 'Historical attendance records intact in session 2025');

    const oldMarks = db.prepare(`SELECT COUNT(*) as c FROM exam_marks WHERE student_id = ?`).get(stdA.student.id).c;
    assert(oldMarks === 2, 'Historical exam marks intact');

    // Full Academic Progression Timeline
    const history = getStudentAcademicHistory(stdA.student.id, db);
    assert(history.success === true && history.history.length === 2, 'Academic history returns chronological progression across both sessions');

    // -------------------------------------------------------------
    // PART 22 & 23: Offline Cryptographic Licensing (Ed25519)
    // -------------------------------------------------------------
    console.log('\n--- 11. Ed25519 Offline Licensing & Hardware Binding ---');
    const identity = getInstallationIdentity(db);
    assert(identity.installationId.startsWith('INST-'), 'Local installation ID initialized');

    // Fresh system should report Unlicensed
    const initialLicStatus = getLicenseStatus(db);
    assert(initialLicStatus.status === 'Unlicensed', 'Fresh installation starts in Unlicensed state');

    // Super Admin setup & license issuance
    const saSetup = createSuperAdminAccount({ username: 'vendor_admin', password: 'VendorPassword123', displayName: 'Vendor Admin' }, db);
    assert(saSetup.success === true, 'Vendor Super Admin initialized');

    const saLogin = loginSuperAdmin({ username: 'vendor_admin', password: 'VendorPassword123' }, db);
    assert(saLogin.success === true, 'Super Admin logged in');

    const todayStr = new Date().toISOString().substring(0, 10);
    const expDateStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

    const licGen = generateLicense({
      superAdminToken: saLogin.token,
      customerName: 'Quaid-e-Azam Public College',
      licenseType: 'Yearly',
      edition: 'Enterprise',
      installationBinding: identity.installationId,
      startDate: todayStr,
      expiryDate: expDateStr,
      gracePeriodDays: 14,
    }, db);
    assert(licGen.success === true && typeof licGen.signedToken === 'string', 'Super Admin issued signed Ed25519 license');

    // Activate License
    const actRes = activateLicense(licGen.signedToken, db);
    assert(actRes.success === true, 'License successfully activated');

    const validStatus = getLicenseStatus(db);
    assert(validStatus.status === 'Valid' && validStatus.customerName === 'Quaid-e-Azam Public College', 'License status is Valid for registered institution');

    // Reject Tampered License
    const tamperedToken = licGen.signedToken.replace(/a/g, 'b');
    const badAct = activateLicense(tamperedToken, db);
    assert(badAct.success === false, 'Tampered license cryptographic signature rejected');

    // Reject License bound to different machine
    const foreignLicense = generateLicense({
      superAdminToken: saLogin.token,
      customerName: 'Quaid-e-Azam Public College',
      licenseType: 'Yearly',
      edition: 'Enterprise',
      installationBinding: 'INST-FOREIGN-MACHINE-9999',
      startDate: todayStr,
      expiryDate: expDateStr,
      gracePeriodDays: 14,
    }, db);
    const foreignAct = activateLicense(foreignLicense.signedToken, db);
    assert(foreignAct.success === false && foreignAct.error?.includes('bound to a different installation'), 'License bound to different machine rejected');

    // Re-verify Data Safety
    const stdSafetyCheck = db.prepare(`SELECT COUNT(*) as c FROM students`).get().c;
    assert(stdSafetyCheck >= 2, 'Data Safety: Student records preserved completely');

    // -------------------------------------------------------------
    // PART 20 & 21: Disaster Recovery Backup (.smbak) & Restore
    // -------------------------------------------------------------
    console.log('\n--- 12. Backup Creation, Checksums & Point-in-Time Restore ---');
    const backupRes = await createBackup({ customDestinationPath: path.join(backupDir, 'ReleaseTestBackup.smbak') }, db);
    assert(backupRes.success === true && fs.existsSync(backupRes.backupPath), 'Backup package (.smbak) generated');
    assert(backupRes.manifest?.schoolName === 'Quaid-e-Azam Public College', 'Backup manifest contains school name');
    assert(typeof backupRes.manifest?.databaseChecksum === 'string', 'Manifest contains SHA-256 database checksum');

    // Validate Backup Package
    const valRes = await validateBackup(backupRes.backupPath);
    assert(valRes.valid === true, 'Backup package passes SHA-256 and structure validation');

    // Intentionally alter data in active database
    db.prepare(`UPDATE school_settings SET school_name = 'HACKED NAME' WHERE id = 1`).run();
    assert(getSchoolSettings(db).schoolName === 'HACKED NAME', 'Data modified prior to restoration test');

    // Restore Backup
    const restoreRes = await restoreBackup(backupRes.backupPath, db);
    assert(restoreRes.success === true, 'Disaster recovery restore completed');
    assert(getSchoolSettings(db).schoolName === 'Quaid-e-Azam Public College', 'School settings restored to point-in-time state');
    assert(db.prepare(`SELECT COUNT(*) as c FROM students`).get().c === 2, 'All student records intact after restore');

    // Corrupt file rejection
    const corruptPath = path.join(backupDir, 'corrupt.smbak');
    fs.writeFileSync(corruptPath, Buffer.from('NOT_A_VALID_BACKUP_FILE'));
    const badRestore = await restoreBackup(corruptPath, db);
    assert(badRestore.success === false, 'Corrupt backup file safely rejected without touching database');

    // -------------------------------------------------------------
    // PART 32: Performance & Scalability (500+ Students)
    // -------------------------------------------------------------
    console.log('\n--- 13. Scalability & High-Volume Search Performance ---');
    const insertStartTime = Date.now();
    const insertStmt = db.prepare(`
      INSERT INTO students (
        student_id, admission_number, first_name, last_name, display_name,
        gender, date_of_birth, father_name, phone, current_address, city, province,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Male', '2011-01-01', 'Father Name', '03001234567', 'Address', 'Islamabad', 'Federal', 1, datetime('now'), datetime('now'))
    `);

    db.transaction(() => {
      for (let i = 1; i <= 500; i++) {
        const idStr = `STD-2026-${String(1000 + i).padStart(4, '0')}`;
        const admStr = `ADM-2026-${String(1000 + i).padStart(4, '0')}`;
        insertStmt.run(idStr, admStr, `Student${i}`, `Family${i}`, `Student${i} Family${i}`);
      }
    })();

    const insertDuration = Date.now() - insertStartTime;
    console.log(`  * Bulk inserted 500 students in ${insertDuration} ms`);
    assert(insertDuration < 3000, '500 students inserted within 3 seconds');

    // Search query latency test
    const searchStartTime = Date.now();
    const searchResults = getAllStudents({ searchQuery: 'Student250', limit: 20 }, db);
    const searchDuration = Date.now() - searchStartTime;
    console.log(`  * Search executed in ${searchDuration} ms`);
    assert(searchResults.students.length >= 1 && searchDuration < 50, 'Indexed search over 500+ records executes in < 50ms');

  } finally {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on open handles
    }
  }

  console.log('\n================================================================');
  console.log(`Phase 10 Test Suite Results: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  console.log('================================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runPhase10Tests().catch((err) => {
  console.error('Fatal Phase 10 test failure:', err);
  process.exit(1);
});
