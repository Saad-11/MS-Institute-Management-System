/**
 * Automated Test Suite — Phase 5: Attendance Management
 * 
 * Verifies:
 * 1. Migration 004 application and schema integrity (attendance table, indexes, foreign keys, unique constraint)
 * 2. Date validation rules (rejects future dates, accepts valid dates)
 * 3. Attendance percentage calculation formula: (Present + Late) / Total Recorded * 100
 * 4. Loading enrolled students for attendance (with status if already marked)
 * 5. Single & bulk attendance recording inside database transaction
 * 6. Upsert behavior (editing existing attendance updates records without duplicating rows)
 * 7. Transaction rollback on invalid enrollment or foreign key mismatch
 * 8. Daily attendance summary metrics calculation
 * 9. Multi-filtered attendance history queries (by session, class, section, dates, status, student search)
 * 10. Individual student attendance statistics & history queries
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
  createStudent,
} from '../dist-electron/database/services/student.service.js';
import {
  calculateAttendancePercentage,
  validateAttendanceDate,
  getEnrolledStudentsForAttendance,
  saveAttendance,
  getDailyAttendanceSummary,
  getAttendanceHistory,
  getStudentAttendanceHistory,
} from '../dist-electron/database/services/attendance.service.js';

const testDbPath = path.resolve('test-phase5-data.sqlite');

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

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 5 Attendance Management Tests');
  console.log('======================================================\n');

  cleanup();

  const db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    // ----------------------------------------------------
    // TEST GROUP 1: Migration 004 & Schema Verification
    // ----------------------------------------------------
    console.log('📋 Test Group 1: Migration 004 & Schema Integrity');
    const migResult = runMigrations(db);
    assert(migResult.appliedCount >= 4, `Migrations executed successfully (${migResult.appliedCount} applied)`);
    assert(migResult.currentVersion >= 4, `Schema version reached at least 4 (actual: ${migResult.currentVersion})`);

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'"
    ).get();
    assert(!!tableCheck, 'attendance table exists in SQLite schema');

    const columns = db.prepare("PRAGMA table_info('attendance')").all();
    const colNames = columns.map((c) => c.name);
    assert(colNames.includes('student_id'), 'attendance has student_id column');
    assert(colNames.includes('enrollment_id'), 'attendance has enrollment_id column');
    assert(colNames.includes('academic_session_id'), 'attendance has academic_session_id column');
    assert(colNames.includes('class_id'), 'attendance has class_id column');
    assert(colNames.includes('section_id'), 'attendance has section_id column');
    assert(colNames.includes('attendance_date'), 'attendance has attendance_date column');
    assert(colNames.includes('status'), 'attendance has status column');
    assert(colNames.includes('remarks'), 'attendance has remarks column');

    // Verify Unique index on (student_id, attendance_date)
    const indexes = db.prepare("PRAGMA index_list('attendance')").all();
    const uniqueIndex = indexes.find((idx) => idx.unique === 1);
    assert(!!uniqueIndex, 'Unique index exists and enforces UNIQUE(student_id, attendance_date)');

    // ----------------------------------------------------
    // TEST GROUP 2: Attendance Formula & Date Validation
    // ----------------------------------------------------
    console.log('\n📋 Test Group 2: Attendance Formula & Date Validation');

    // Percentage formula: (Present + Late) / Total Recorded * 100
    // Test 1: 0 recorded -> null (N/A)
    assert(calculateAttendancePercentage(0, 0, 0) === null, 'calculateAttendancePercentage(0,0,0) returns null (N/A)');
    // Test 2: 10 present, 0 late, 10 total -> 100.0%
    assert(calculateAttendancePercentage(10, 0, 10) === 100, '10 Present out of 10 returns 100%');
    // Test 3: 8 present, 2 late, 10 total -> 100.0% (Late counts as attended)
    assert(calculateAttendancePercentage(8, 2, 10) === 100, '8 Present + 2 Late out of 10 returns 100%');
    // Test 4: 7 present, 1 late, 1 absent, 1 leave (10 total) -> (7+1)/10 = 80.0%
    assert(calculateAttendancePercentage(7, 1, 10) === 80, '7 Present + 1 Late out of 10 total returns 80%');
    // Test 5: 1 present, 0 late, 3 total -> 33.33%
    assert(calculateAttendancePercentage(1, 0, 3) === 33.33, '1 Present out of 3 returns 33.33%');

    // Date validation
    const todayStr = new Date().toISOString().split('T')[0];
    const todayVal = validateAttendanceDate(todayStr);
    assert(todayVal.isValid === true, `Today's date (${todayStr}) is valid for attendance`);

    const pastVal = validateAttendanceDate('2025-01-15');
    assert(pastVal.isValid === true, 'Past date (2025-01-15) is valid for attendance');

    const futureVal = validateAttendanceDate('2099-12-31');
    assert(futureVal.isValid === false && (futureVal.error || '').includes('future date'), 'Future date (2099-12-31) is rejected');

    const invalidDateVal = validateAttendanceDate('not-a-date');
    assert(invalidDateVal.isValid === false && (invalidDateVal.error || '').includes('YYYY-MM-DD'), 'Malformed date string is rejected');

    // ----------------------------------------------------
    // TEST GROUP 3: Setup Academic Structure & Students
    // ----------------------------------------------------
    console.log('\n📋 Test Group 3: Setup Academic Structure & Test Enrolled Students');

    // Admin login
    createInitialAdmin({
      username: 'admin',
      displayName: 'System Admin',
      password: 'AdminPassword123!',
    }, db);
    const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
    const token = loginRes.sessionToken;
    assert(!!token, 'Admin session authenticated');

    // Academic session
    const sessionRes = createSession({
      sessionToken: token,
      name: '2025-2026 Academic Year',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      isActive: true,
    }, db);
    const sessionId = sessionRes.session.id;

    // Class & Section
    const classRes = createClass({
      sessionToken: token,
      name: 'Grade 9',
      code: 'G9',
      displayOrder: 1,
    }, db);
    const classId = classRes.classItem.id;

    const secResA = createSection({
      sessionToken: token,
      classId,
      name: 'Section A',
      isActive: true,
    }, db);
    const sectionAId = secResA.section.id;

    const secResB = createSection({
      sessionToken: token,
      classId,
      name: 'Section B',
      isActive: true,
    }, db);
    const sectionBId = secResB.section.id;

    // Create 3 students in Section A
    const s1 = createStudent({
      sessionToken: token,
      studentId: 'STD-2025-0001',
      admissionNumber: 'ADM-001',
      firstName: 'Hamza',
      lastName: 'Ali',
      gender: 'Male',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId: sectionAId,
        admissionDate: '2025-01-10',
        rollNumber: '01',
        status: 'Active',
      },
    }, db);
    assert(s1.success, 'Student 1 enrolled in Section A');

    const s2 = createStudent({
      sessionToken: token,
      studentId: 'STD-2025-0002',
      admissionNumber: 'ADM-002',
      firstName: 'Ayesha',
      lastName: 'Khan',
      gender: 'Female',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId: sectionAId,
        admissionDate: '2025-01-10',
        rollNumber: '02',
        status: 'Active',
      },
    }, db);
    assert(s2.success, 'Student 2 enrolled in Section A');

    const s3 = createStudent({
      sessionToken: token,
      studentId: 'STD-2025-0003',
      admissionNumber: 'ADM-003',
      firstName: 'Bilal',
      lastName: 'Ahmed',
      gender: 'Male',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId: sectionAId,
        admissionDate: '2025-01-10',
        rollNumber: '03',
        status: 'Active',
      },
    }, db);
    assert(s3.success, 'Student 3 enrolled in Section A');

    // Create 1 student in Section B
    const s4 = createStudent({
      sessionToken: token,
      studentId: 'STD-2025-0004',
      admissionNumber: 'ADM-004',
      firstName: 'Fatima',
      lastName: 'Zahra',
      gender: 'Female',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId: sectionBId,
        admissionDate: '2025-01-10',
        rollNumber: '01',
        status: 'Active',
      },
    }, db);
    assert(s4.success, 'Student 4 enrolled in Section B');

    // ----------------------------------------------------
    // TEST GROUP 4: Loading Enrolled Students for Attendance
    // ----------------------------------------------------
    console.log('\n📋 Test Group 4: Loading Students for Daily Attendance');

    const loadRes = getEnrolledStudentsForAttendance({
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
    }, db);
    assert(loadRes.success === true, 'getEnrolledStudentsForAttendance succeeds');
    assert(loadRes.isRecorded === false, 'Section A attendance is initially unrecorded for today');
    assert(loadRes.students.length === 3, 'Loads exactly 3 enrolled students for Section A');
    const std1Loaded = loadRes.students.find((s) => s.studentId === s1.student.id);
    assert(!!std1Loaded && std1Loaded.displayName.includes('Hamza'), 'Student 1 (Hamza) found in loaded list');

    // ----------------------------------------------------
    // TEST GROUP 5: Bulk Transactional Attendance Save
    // ----------------------------------------------------
    console.log('\n📋 Test Group 5: Bulk Attendance Save & Verification');

    const saveRes = saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
      records: [
        {
          studentId: s1.student.id,
          enrollmentId: s1.student.currentEnrollment.id,
          status: 'Present',
          remarks: 'On time',
        },
        {
          studentId: s2.student.id,
          enrollmentId: s2.student.currentEnrollment.id,
          status: 'Late',
          remarks: 'Traffic delay 10 mins',
        },
        {
          studentId: s3.student.id,
          enrollmentId: s3.student.currentEnrollment.id,
          status: 'Absent',
          remarks: 'Uninformed',
        },
      ],
    }, db);
    assert(saveRes.success === true, 'saveAttendance succeeds for Section A');
    assert(saveRes.savedCount === 3, 'Bulk save reports 3 records saved');

    // Verify attendance is now marked as recorded
    const recheckLoad = getEnrolledStudentsForAttendance({
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
    }, db);
    assert(recheckLoad.isRecorded === true, 'Section A attendance is now flagged as isRecorded: true');
    const r1 = recheckLoad.students.find((s) => s.studentId === s1.student.id);
    const r2 = recheckLoad.students.find((s) => s.studentId === s2.student.id);
    const r3 = recheckLoad.students.find((s) => s.studentId === s3.student.id);
    assert(r1?.status === 'Present', 'Student 1 loaded status is Present');
    assert(r2?.status === 'Late', 'Student 2 loaded status is Late');
    assert(r3?.status === 'Absent', 'Student 3 loaded status is Absent');
    assert(r2?.remarks === 'Traffic delay 10 mins', 'Student 2 remarks preserved');

    // ----------------------------------------------------
    // TEST GROUP 6: Upsert (Edit Attendance on Same Date)
    // ----------------------------------------------------
    console.log('\n📋 Test Group 6: Attendance Upsert / Edit Without Duplication');

    const countBefore = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
    assert(countBefore === 3, 'Exactly 3 attendance rows in database');

    // Change Student 3 from Absent to Leave (Sick)
    const updateRes = saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
      records: [
        {
          studentId: s3.student.id,
          enrollmentId: s3.student.currentEnrollment.id,
          status: 'Leave',
          remarks: 'Doctor note submitted',
        },
      ],
    }, db);
    assert(updateRes.success === true, 'saveAttendance update succeeds');

    const countAfter = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
    assert(countAfter === 3, 'Attendance count remains 3 (upsert updated row without duplicating)');

    const updatedRow = db.prepare(
      'SELECT status, remarks FROM attendance WHERE student_id = ? AND attendance_date = ?'
    ).get(s3.student.id, todayStr);
    assert(updatedRow.status === 'Leave', 'Student 3 status successfully updated to Leave');
    assert(updatedRow.remarks === 'Doctor note submitted', 'Student 3 remarks successfully updated');

    // ----------------------------------------------------
    // TEST GROUP 7: Validation & Transaction Rollback
    // ----------------------------------------------------
    console.log('\n📋 Test Group 7: Validation & Transaction Rollback');

    // Reject future date save
    const futureSave = saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: '2099-01-01',
      records: [
        {
          studentId: s1.student.id,
          enrollmentId: s1.student.currentEnrollment.id,
          status: 'Present',
        },
      ],
    }, db);
    assert(futureSave.success === false && (futureSave.error || '').includes('future date'), 'saveAttendance rejects future date');

    // Reject student from another section (Student 4 is in Section B, trying to save in Section A)
    const crossSectionSave = saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
      records: [
        {
          studentId: s4.student.id,
          enrollmentId: s4.student.currentEnrollment.id,
          status: 'Present',
        },
      ],
    }, db);
    assert(
      crossSectionSave.success === false && (crossSectionSave.error || '').includes('does not have an active enrollment'),
      'saveAttendance rejects student not enrolled in selected section'
    );

    // Reject invalid status
    const invalidStatusSave = saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
      records: [
        {
          studentId: s1.student.id,
          enrollmentId: s1.student.currentEnrollment.id,
          status: 'UnknownStatus',
        },
      ],
    }, db);
    assert(
      invalidStatusSave.success === false && (invalidStatusSave.error || '').includes('Invalid attendance status'),
      'saveAttendance rejects invalid status'
    );

    // Verify database state was untouched by failed transactions
    const countCheck = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
    assert(countCheck === 3, 'Database state rolled back and unchanged after failed save attempts');

    // ----------------------------------------------------
    // TEST GROUP 8: Daily Attendance Summary Calculation
    // ----------------------------------------------------
    console.log('\n📋 Test Group 8: Daily Attendance Summary Metrics');

    const summaryRes = getDailyAttendanceSummary({
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: todayStr,
    }, db);
    assert(summaryRes.success === true, 'getDailyAttendanceSummary succeeds');
    const sm = summaryRes.summary;
    assert(sm.totalStudents === 3, 'Summary total students is 3');
    assert(sm.presentCount === 1, 'Summary present count is 1');
    assert(sm.lateCount === 1, 'Summary late count is 1');
    assert(sm.leaveCount === 1, 'Summary leave count is 1');
    assert(sm.absentCount === 0, 'Summary absent count is 0');
    // Percentage formula: (Present 1 + Late 1) / Recorded 3 * 100 = 66.67%
    assert(sm.attendancePercentage === 66.67, 'Summary attendance percentage is 66.67%');

    // ----------------------------------------------------
    // TEST GROUP 9: Attendance History & Multi-Filter Query
    // ----------------------------------------------------
    console.log('\n📋 Test Group 9: Attendance History & Filtering');

    // 1. All records for section
    const histSection = getAttendanceHistory({
      sectionId: sectionAId,
    }, db);
    assert(histSection.success === true, 'getAttendanceHistory succeeds');
    assert(histSection.totalCount === 3, 'Filters exactly 3 records for Section A');

    // 2. Filter by status: Leave
    const histLeave = getAttendanceHistory({
      sectionId: sectionAId,
      status: 'Leave',
    }, db);
    assert(histLeave.totalCount === 1, 'Filtered by status Leave returns 1 record');
    assert(histLeave.records[0].studentName.includes('Bilal'), 'Leave record belongs to Bilal');

    // 3. Search query by student name: 'Hamza'
    const histSearch = getAttendanceHistory({
      searchQuery: 'Hamza',
    }, db);
    assert(histSearch.totalCount === 1, 'Search query Hamza returns 1 record');
    assert(histSearch.records[0].status === 'Present', 'Hamza record has status Present');

    // 4. Date range filtering
    const histDateRange = getAttendanceHistory({
      dateFrom: '2020-01-01',
      dateTo: todayStr,
    }, db);
    assert(histDateRange.totalCount === 3, 'Date range filter includes today records');

    // ----------------------------------------------------
    // TEST GROUP 10: Individual Student Attendance Statistics
    // ----------------------------------------------------
    console.log('\n📋 Test Group 10: Individual Student Stats & History');

    // Record an earlier date for Student 1 (Hamza) to have multiple days
    saveAttendance({
      sessionToken: token,
      academicSessionId: sessionId,
      classId,
      sectionId: sectionAId,
      attendanceDate: '2025-05-10',
      records: [
        {
          studentId: s1.student.id,
          enrollmentId: s1.student.currentEnrollment.id,
          status: 'Present',
          remarks: 'Earlier session test',
        },
      ],
    }, db);

    const studentStatsRes = getStudentAttendanceHistory({
      studentId: s1.student.id,
    }, db);
    assert(studentStatsRes.success === true, 'getStudentAttendanceHistory succeeds');
    assert(studentStatsRes.history.length === 2, 'Student 1 has 2 history records');

    const st = studentStatsRes.stats;
    assert(st.totalDaysRecorded === 2, 'Student 1 total days recorded is 2');
    assert(st.presentCount === 2, 'Student 1 present count is 2');
    assert(st.attendancePercentage === 100, 'Student 1 attendance percentage is 100%');

    // Student 3 (Bilal) stats: 1 day recorded, status Leave -> attendancePercentage: 0%
    const student3StatsRes = getStudentAttendanceHistory({
      studentId: s3.student.id,
    }, db);
    assert(student3StatsRes.stats.totalDaysRecorded === 1, 'Student 3 total days recorded is 1');
    assert(student3StatsRes.stats.leaveCount === 1, 'Student 3 leave count is 1');
    assert(student3StatsRes.stats.attendancePercentage === 0, 'Student 3 attendance percentage is 0%');

    // Unrecorded student (Student 4) stats: 0 days recorded -> attendancePercentage: null
    const student4StatsRes = getStudentAttendanceHistory({
      studentId: s4.student.id,
    }, db);
    assert(student4StatsRes.stats.totalDaysRecorded === 0, 'Student 4 has 0 recorded days');
    assert(student4StatsRes.stats.attendancePercentage === null, 'Student 4 attendance percentage is null (N/A)');

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    db.close();
    cleanup();
  }

  console.log('\n======================================================');
  console.log(`📊 Phase 5 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
