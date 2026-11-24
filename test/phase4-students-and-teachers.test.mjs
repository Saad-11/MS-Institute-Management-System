/**
 * Automated Test Suite — Phase 4: Students & Teachers Management
 * 
 * Verifies:
 * 1. Migration 003 application and schema integrity (students, student_enrollments, teachers)
 * 2. Student ID and Teacher ID auto-generation formatting
 * 3. Student Registration with initial enrollment transaction
 * 4. Case-insensitive uniqueness enforcement (Student ID & Admission Number)
 * 5. Student profile editing, status toggling, and data fetching
 * 6. Enrollment validation (invalid section for class rejection, duplicate active enrollment rejection)
 * 7. Multi-filter and search queries for students
 * 8. Teacher Registration, case-insensitive uniqueness (Teacher ID & Employee ID)
 * 9. Teacher profile editing, status toggling, and search
 * 10. Dashboard summary aggregation with active students and active teachers live counts
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Import compiled backend modules from dist-electron
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
  generateNextStudentId,
  createStudent,
  updateStudent,
  toggleStudentStatus,
  getAllStudents,
  getStudentEnrollments,
  createEnrollment,
} from '../dist-electron/database/services/student.service.js';
import {
  generateNextTeacherId,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  getAllTeachers,
} from '../dist-electron/database/services/teacher.service.js';
import { getDashboardSummary } from '../dist-electron/database/services/dashboard.service.js';

const testDbPath = path.resolve('test-phase4-data.sqlite');

function cleanup() {
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }
  if (fs.existsSync(testDbPath + '-wal')) {
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}
  }
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   PHASE 4: STUDENT & TEACHER MANAGEMENT TEST SUITE   ');
  console.log('======================================================\n');

  cleanup();

  let db = null;

  try {
    // ------------------------------------------------------------------------
    // Group 1: Database Setup & Migration 003
    // ------------------------------------------------------------------------
    console.log('--- 1. Migrations & Table Integrity ---');

    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const migResult = runMigrations(db);
    assert(migResult.currentVersion >= 3, 'Migration executed up to at least version 3');

    const studentsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='students'").get();
    assert(Boolean(studentsTable), 'students table exists in SQLite');

    const enrollmentsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='student_enrollments'").get();
    assert(Boolean(enrollmentsTable), 'student_enrollments table exists in SQLite');

    const teachersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teachers'").get();
    assert(Boolean(teachersTable), 'teachers table exists in SQLite');

    // Setup Admin
    createInitialAdmin({
      username: 'admin',
      displayName: 'System Admin',
      password: 'AdminPassword123!',
    }, db);
    const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
    const token = loginRes.sessionToken;

    // Setup Academic Context (Session, Class, Section)
    const sessionRes = createSession({
      sessionToken: token,
      name: '2026-2027',
      startDate: '2026-08-01',
      endDate: '2027-06-30',
      isActive: true,
    }, db);
    const sessionId = sessionRes.session.id;

    const classRes = createClass({
      sessionToken: token,
      name: 'Class 9',
      code: 'C9',
    }, db);
    const classId = classRes.classItem.id;

    const class2Res = createClass({
      sessionToken: token,
      name: 'Class 10',
      code: 'C10',
    }, db);
    const class2Id = class2Res.classItem.id;

    const secRes = createSection({
      sessionToken: token,
      classId,
      name: 'Section A',
    }, db);
    const secId = secRes.section.id;

    const sec2Res = createSection({
      sessionToken: token,
      classId,
      name: 'Section B',
    }, db);
    const sec2Id = sec2Res.section.id;

    // Section belonging to Class 10
    const secC10Res = createSection({
      sessionToken: token,
      classId: class2Id,
      name: 'Section Red',
    }, db);
    const secC10Id = secC10Res.section.id;

    // ------------------------------------------------------------------------
    // Group 2: Student ID Generation & Registration
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Student ID Auto-Generation & Registration ---');

    const nextStdId1 = generateNextStudentId('2026', db);
    assert(nextStdId1 === 'STD-2026-0001', `Auto-generated initial student ID: ${nextStdId1}`);

    // Register student 1
    const createStd1 = createStudent({
      sessionToken: token,
      studentId: 'STD-2026-0001',
      admissionNumber: 'ADM-101',
      firstName: 'Hamza',
      middleName: 'Ali',
      lastName: 'Sheikh',
      gender: 'Male',
      dateOfBirth: '2010-05-12',
      bloodGroup: 'B+',
      fatherName: 'Tariq Sheikh',
      motherName: 'Amina Tariq',
      guardianName: 'Tariq Sheikh',
      guardianRelationship: 'Father',
      phone: '+92 300 1122334',
      city: 'Lahore',
      province: 'Punjab',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId: secId,
        admissionDate: '2026-08-10',
        status: 'Active',
      },
    }, db);

    assert(createStd1.success === true, 'Student 1 successfully registered');
    assert(createStd1.student.displayName === 'Hamza Ali Sheikh', 'Display name concatenated properly');
    assert(createStd1.student.currentEnrollment?.className === 'Class 9', 'Initial enrollment class is Class 9');
    assert(createStd1.student.currentEnrollment?.sectionName === 'Section A', 'Initial enrollment section is Section A');

    const std1Id = createStd1.student.id;

    const nextStdId2 = generateNextStudentId('2026', db);
    assert(nextStdId2 === 'STD-2026-0002', `Next student ID increments to: ${nextStdId2}`);

    // ------------------------------------------------------------------------
    // Group 3: Student Uniqueness Constraints
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Student Uniqueness Constraints ---');

    // Duplicate studentId rejection
    const dupStdId = createStudent({
      sessionToken: token,
      studentId: 'std-2026-0001', // case insensitive test
      admissionNumber: 'ADM-999',
      firstName: 'Test',
      lastName: 'User',
      gender: 'Male',
      fatherName: 'Test Father',
      phone: '+92 300 0000000',
    }, db);
    assert(dupStdId.success === false && dupStdId.error.includes('Student ID'), 'Duplicate student_id (case-insensitive) rejected');

    // Duplicate admissionNumber rejection
    const dupAdm = createStudent({
      sessionToken: token,
      studentId: 'STD-2026-0002',
      admissionNumber: 'adm-101', // case insensitive test
      firstName: 'Test',
      lastName: 'User',
      gender: 'Male',
      fatherName: 'Test Father',
      phone: '+92 300 0000000',
    }, db);
    assert(dupAdm.success === false && dupAdm.error.includes('Admission Number'), 'Duplicate admission_number (case-insensitive) rejected');

    // ------------------------------------------------------------------------
    // Group 4: Student Enrollment Integrity & Validation
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Student Enrollment Validation ---');

    // Attempt to enroll into Section belonging to different Class
    const invalidSecEnroll = createEnrollment({
      sessionToken: token,
      studentId: std1Id,
      academicSessionId: sessionId,
      classId, // Class 9
      sectionId: secC10Id, // Section belonging to Class 10!
    }, db);
    assert(invalidSecEnroll.success === false && invalidSecEnroll.error.includes('does not belong to'), 'Prevented cross-class section assignment');

    // Check history
    const hist1 = getStudentEnrollments(std1Id, db);
    assert(hist1.length === 1, 'Student has exactly 1 initial enrollment record');

    // Switch section within Class 9
    const newEnrollRes = createEnrollment({
      sessionToken: token,
      studentId: std1Id,
      academicSessionId: sessionId,
      classId,
      sectionId: sec2Id, // Section B
    }, db);
    assert(newEnrollRes.success === true, 'Successfully created new enrollment into Section B');

    const hist2 = getStudentEnrollments(std1Id, db);
    assert(hist2.length === 2, 'Student history now contains 2 records');
    const activeEnrollments = hist2.filter((e) => e.status === 'Active');
    assert(activeEnrollments.length === 1 && activeEnrollments[0].sectionName === 'Section B', 'Old active enrollment automatically deactivated; only 1 active enrollment per session');

    // ------------------------------------------------------------------------
    // Group 5: Student Updates & Status Toggling
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Student Profile Updates & Status Toggling ---');

    const updateRes = updateStudent({
      sessionToken: token,
      id: std1Id,
      admissionNumber: 'ADM-101-UPDATED',
      firstName: 'Hamza',
      middleName: 'A.',
      lastName: 'Sheikh',
      gender: 'Male',
      fatherName: 'Tariq Sheikh',
      phone: '+92 300 9988776',
      city: 'Islamabad',
    }, db);
    assert(updateRes.success === true, 'Student profile updated successfully');
    assert(updateRes.student.displayName === 'Hamza A. Sheikh', 'Updated display name verified');
    assert(updateRes.student.city === 'Islamabad', 'Updated city verified');

    const toggleOff = toggleStudentStatus({ sessionToken: token, id: std1Id, isActive: false }, db);
    assert(toggleOff.success === true && toggleOff.student.isActive === false, 'Student deactivated successfully');

    const toggleOn = toggleStudentStatus({ sessionToken: token, id: std1Id, isActive: true }, db);
    assert(toggleOn.success === true && toggleOn.student.isActive === true, 'Student re-activated successfully');

    // ------------------------------------------------------------------------
    // Group 6: Student Search & Filter Queries
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Student Search & Filtering ---');

    // Register second student
    createStudent({
      sessionToken: token,
      studentId: 'STD-2026-0002',
      admissionNumber: 'ADM-102',
      firstName: 'Zainab',
      lastName: 'Bibi',
      gender: 'Female',
      fatherName: 'Muhammad Rashid',
      phone: '+92 311 5566778',
      city: 'Lahore',
      enrollment: {
        academicSessionId: sessionId,
        classId: class2Id,
        sectionId: secC10Id,
      },
    }, db);

    const searchRes = getAllStudents({ searchQuery: 'Zainab' }, db);
    assert(searchRes.totalCount === 1 && searchRes.students[0].firstName === 'Zainab', 'Search by name returns correct record');

    const filterGender = getAllStudents({ gender: 'Female' }, db);
    assert(filterGender.totalCount === 1, 'Filter by gender returns correct count');

    const filterClass = getAllStudents({ classId }, db);
    assert(filterClass.totalCount === 1 && filterClass.students[0].studentId === 'STD-2026-0001', 'Filter by class returns correct student');

    // ------------------------------------------------------------------------
    // Group 7: Teacher ID Generation & Registration
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Teacher ID Auto-Generation & Registration ---');

    const nextTchId1 = generateNextTeacherId('2026', db);
    assert(nextTchId1 === 'TCH-2026-0001', `Auto-generated initial teacher ID: ${nextTchId1}`);

    const createTch1 = createTeacher({
      sessionToken: token,
      teacherId: 'TCH-2026-0001',
      employeeId: 'EMP-501',
      firstName: 'Farhan',
      middleName: 'Ahmed',
      lastName: 'Siddiqui',
      gender: 'Male',
      phone: '+92 300 4455667',
      email: 'farhan@school.edu',
      qualification: 'M.Sc Mathematics',
      specialization: 'Calculus & Algebra',
      designation: 'Senior Teacher',
      employmentStatus: 'Active',
      city: 'Lahore',
    }, db);

    assert(createTch1.success === true, 'Teacher 1 registered successfully');
    assert(createTch1.teacher.displayName === 'Farhan Ahmed Siddiqui', 'Teacher display name formatted');
    const tch1Id = createTch1.teacher.id;

    const nextTchId2 = generateNextTeacherId('2026', db);
    assert(nextTchId2 === 'TCH-2026-0002', `Next teacher ID increments to: ${nextTchId2}`);

    // Duplicate teacherId rejection
    const dupTchId = createTeacher({
      sessionToken: token,
      teacherId: 'tch-2026-0001',
      employeeId: 'EMP-999',
      firstName: 'Duplicate',
      lastName: 'User',
      gender: 'Male',
      phone: '+92 300 0000000',
      qualification: 'B.Sc',
    }, db);
    assert(dupTchId.success === false && dupTchId.error.includes('Teacher ID'), 'Duplicate teacher_id rejected');

    // Duplicate employeeId rejection
    const dupEmpId = createTeacher({
      sessionToken: token,
      teacherId: 'TCH-2026-0002',
      employeeId: 'emp-501',
      firstName: 'Duplicate',
      lastName: 'User',
      gender: 'Male',
      phone: '+92 300 0000000',
      qualification: 'B.Sc',
    }, db);
    assert(dupEmpId.success === false && dupEmpId.error.includes('Employee ID'), 'Duplicate employee_id rejected');

    // ------------------------------------------------------------------------
    // Group 8: Teacher Updates, Status & Filters
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Teacher Updates, Status & Filters ---');

    const updateTch = updateTeacher({
      sessionToken: token,
      id: tch1Id,
      employeeId: 'EMP-501-UPDATED',
      firstName: 'Farhan',
      lastName: 'Siddiqui',
      gender: 'Male',
      phone: '+92 300 4455667',
      qualification: 'M.Phil Mathematics',
      employmentStatus: 'On Leave',
    }, db);
    assert(updateTch.success === true && updateTch.teacher.qualification === 'M.Phil Mathematics', 'Teacher qualification updated');
    assert(updateTch.teacher.employmentStatus === 'On Leave', 'Teacher employment status changed to On Leave');

    const toggleTch = toggleTeacherStatus({ sessionToken: token, id: tch1Id, isActive: false }, db);
    assert(toggleTch.success === true && toggleTch.teacher.isActive === false, 'Teacher deactivated successfully');
    toggleTeacherStatus({ sessionToken: token, id: tch1Id, isActive: true }, db);

    const tchFilter = getAllTeachers({ employmentStatus: 'On Leave' }, db);
    assert(tchFilter.totalCount === 1 && tchFilter.teachers[0].teacherId === 'TCH-2026-0001', 'Teacher filtered by employment status');

    // ------------------------------------------------------------------------
    // Group 9: Dashboard Summary with Students & Teachers
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Dashboard Summary Metrics ---');

    const dashSummary = getDashboardSummary(db);
    assert(dashSummary.activeStudentsCount === 2, `Dashboard reports 2 active students (got ${dashSummary.activeStudentsCount})`);
    assert(dashSummary.activeTeachersCount === 1, `Dashboard reports 1 active teacher (got ${dashSummary.activeTeachersCount})`);
    assert(dashSummary.activeClassesCount === 2, `Dashboard reports 2 active classes (got ${dashSummary.activeClassesCount})`);

  } catch (err) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    if (db) {
      try { db.close(); } catch {}
    }
    cleanup();
  }

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
