import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import {
  createStudent,
  getAllStudents,
  getStudentStats,
  getStudentById,
  deleteStudent,
} from '../dist-electron/database/services/student.service.js';
import { getDashboardSummary } from '../dist-electron/database/services/dashboard.service.js';

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

app.whenReady().then(async () => {
  console.log('====================================================');
  console.log('   Safe Delete Student Verification Suite          ');
  console.log('====================================================\n');

  try {
    // ─── 1. UI Inspection & Exact Location Verification ──────────
    console.log('--- 1. UI Inspection & Exact Location Verification ---');
    const studentsPagePath = path.resolve('src/pages/Students/StudentsPage.tsx');
    assert(fs.existsSync(studentsPagePath), 'StudentsPage.tsx exists');
    const pageCode = fs.readFileSync(studentsPagePath, 'utf-8');

    // Check exact name "Delete Student"
    const exactOptionName = 'Delete Student';
    assert(pageCode.includes(exactOptionName), `Contains exact option label "${exactOptionName}"`);

    // Verify it is inside actions-dropdown-menu
    const actionsMenuIdx = pageCode.indexOf('actions-dropdown-menu');
    const deleteOptionIdx = pageCode.indexOf('Delete Student', actionsMenuIdx);
    assert(actionsMenuIdx !== -1 && deleteOptionIdx > actionsMenuIdx, 'Delete Student option is located inside three-dot Actions Menu');

    // Verify position is at the bottom, below "Official Documents"
    const officialDocsIdx = pageCode.indexOf('Official Documents', actionsMenuIdx);
    assert(officialDocsIdx !== -1 && deleteOptionIdx > officialDocsIdx, 'Delete Student is placed at the bottom, below Official Documents');

    // Verify visual separator above Delete Student
    const subSnippet = pageCode.substring(officialDocsIdx, deleteOptionIdx);
    assert(subSnippet.includes("var(--color-neutral-200)"), 'Visual separator divider exists before Delete Student option');

    // Verify red trash icon Trash2
    assert(pageCode.includes('<Trash2') || pageCode.includes('Trash2 size='), 'Uses Trash2 icon');
    assert(pageCode.includes('var(--color-error-600') || pageCode.includes('#dc2626'), 'Trash2 icon is styled with red color');

    // Verify confirmation modal requirements
    assert(pageCode.includes('deleteConfirmTarget'), 'Delete confirmation state exists');
    assert(pageCode.includes('deleteConfirmTarget.displayName'), 'Displays student full name in confirmation modal');
    assert(pageCode.includes('deleteConfirmTarget.studentId'), 'Displays student ID in confirmation modal');
    assert(pageCode.includes('Cancel') && pageCode.includes('setDeleteConfirmTarget(null)'), 'Cancel button exists and dismisses dialog without deleting');
    assert(pageCode.includes('handleConfirmDeleteStudent'), 'Explicit confirmation handler handleConfirmDeleteStudent exists');

    // Verify IPC preload and main handlers
    const preloadCode = fs.readFileSync('electron/preload.ts', 'utf-8');
    assert(preloadCode.includes("'students:delete'"), 'students:delete is registered in preload ALLOWED_CHANNELS');
    assert(preloadCode.includes("delete: (sessionToken: string, id: number)"), 'students.delete method exposed in preload bridge');

    const mainCode = fs.readFileSync('electron/main.ts', 'utf-8');
    assert(mainCode.includes("ipcMain.handle('students:delete'"), 'ipcMain.handle for students:delete registered in main.ts');

    // ─── 2. Database Migration 13 Verification ────────────────────
    console.log('\n--- 2. Database Migration 13 Verification ---');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-delete-test-'));
    const dbPath = path.join(tempDir, 'test_school.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const migResult = runMigrations(db);
    assert(migResult.currentVersion >= 13, `Database migrated to version ${migResult.currentVersion} (>= 13)`);

    const cols = db.prepare("PRAGMA table_info(students)").all();
    const colNames = new Set(cols.map((c) => c.name));
    assert(colNames.has('is_deleted'), 'students table has is_deleted column');
    assert(colNames.has('deleted_at'), 'students table has deleted_at column');

    const indexes = db.prepare("PRAGMA index_list(students)").all();
    const indexNames = new Set(indexes.map((i) => i.name));
    assert(indexNames.has('idx_students_is_deleted'), 'idx_students_is_deleted index exists');

    // Setup basic school structure
    createInitialAdmin({ username: 'admin', password: 'Password123!', displayName: 'Super Admin' }, db);
    const auth = login({ username: 'admin', password: 'Password123!' }, db);
    assert(auth.success && !!auth.sessionToken, 'Admin logged in with valid sessionToken');
    const sessionToken = auth.sessionToken;

    const sessionRes = createSession({
      sessionToken,
      name: '2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isActive: true,
    }, db);
    const sessionId = sessionRes.session.id;

    const classRes = createClass({
      sessionToken,
      name: 'Class 5',
      code: 'CLS-5',
      displayOrder: 1,
    }, db);
    const classId = classRes.classItem.id;

    const secRes = createSection({
      sessionToken,
      classId,
      name: 'Section A',
    }, db);
    const sectionId = secRes.section.id;

    // ─── 3. Test Permanent Delete (No Historical Records) ──────────
    console.log('\n--- 3. Test Permanent Delete for Student with NO History ---');
    const std1Res = createStudent({
      sessionToken,
      studentId: 'STD-2026-0001',
      firstName: 'Permanent',
      lastName: 'Student',
      gender: 'Male',
      fatherName: 'Father One',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId,
      },
    }, db);
    assert(std1Res.success, 'Created Student 1 (STD-2026-0001)');
    const std1Id = std1Res.student.id;

    // Verify student exists
    let listBefore = getAllStudents({ academicSessionId: sessionId }, db);
    assert(listBefore.totalCount === 1, 'getAllStudents returns 1 student before delete');
    let statsBefore = getStudentStats(sessionId, db);
    assert(statsBefore.total === 1 && statsBefore.active === 1, 'Stats show 1 total and 1 active');

    // Delete Student 1
    const del1Res = deleteStudent({ sessionToken, id: std1Id }, db);
    assert(del1Res.success, 'deleteStudent returned success');
    assert(del1Res.mode === 'permanent', 'Deleted via mode: permanent because no historical records exist');

    // Verify completely removed
    const std1Row = db.prepare('SELECT * FROM students WHERE id = ?').get(std1Id);
    assert(!std1Row, 'Student 1 completely removed from students table');
    const enroll1Row = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').get(std1Id);
    assert(!enroll1Row, 'Enrollment for Student 1 completely removed');

    let listAfter1 = getAllStudents({ academicSessionId: sessionId }, db);
    assert(listAfter1.totalCount === 0, 'getAllStudents returns 0 students after permanent delete');
    let statsAfter1 = getStudentStats(sessionId, db);
    assert(statsAfter1.total === 0 && statsAfter1.active === 0, 'Stats show 0 total and 0 active');

    // ─── 4. Test Safe Archival / Soft Delete (With History) ─────────
    console.log('\n--- 4. Test Safe Archival for Student WITH Historical Records ---');
    const std2Res = createStudent({
      sessionToken,
      studentId: 'STD-2026-0002',
      firstName: 'Historical',
      lastName: 'Student',
      gender: 'Female',
      fatherName: 'Father Two',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId,
      },
    }, db);
    assert(std2Res.success, 'Created Student 2 (STD-2026-0002)');
    const std2Id = std2Res.student.id;
    const std2EnrollId = std2Res.student.currentEnrollment.id;

    // Create a fee period and fee record to simulate historical financial audit records
    db.prepare(`
      INSERT INTO fee_periods (academic_session_id, name, start_date, end_date, due_date)
      VALUES (?, 'April 2026', '2026-04-01', '2026-04-30', '2026-04-10')
    `).run(sessionId);
    const periodId = Number(db.prepare('SELECT id FROM fee_periods LIMIT 1').get().id);

    const feeTypeRow = db.prepare("SELECT id FROM fee_types LIMIT 1").get();
    const feeTypeId = Number(feeTypeRow.id);

    db.prepare(`
      INSERT INTO fee_records (
        student_id, enrollment_id, academic_session_id, class_id, section_id,
        fee_period_id, fee_type_id, original_amount, discount, fine, net_amount,
        paid_amount, remaining_balance, due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 3000, 0, 0, 3000, 3000, 0, '2026-04-10', 'Paid')
    `).run(std2Id, std2EnrollId, sessionId, classId, sectionId, periodId, feeTypeId);

    const feeCount = db.prepare('SELECT COUNT(*) as count FROM fee_records WHERE student_id = ?').get(std2Id).count;
    assert(feeCount === 1, 'Historical fee record verified for Student 2');

    // Call deleteStudent on Student 2
    const del2Res = deleteStudent({ sessionToken, id: std2Id }, db);
    assert(del2Res.success, 'deleteStudent returned success for historical student');
    assert(del2Res.mode === 'archived', 'Safely archived via mode: archived because historical records exist');

    // Check database row directly
    const std2Row = db.prepare('SELECT * FROM students WHERE id = ?').get(std2Id);
    assert(!!std2Row, 'Student 2 row preserved in database for historical integrity');
    assert(std2Row.is_deleted === 1, 'is_deleted is set to 1');
    assert(std2Row.is_active === 0, 'is_active is set to 0');
    assert(typeof std2Row.deleted_at === 'string' && std2Row.deleted_at.length > 0, 'deleted_at timestamp is populated');

    const enroll2Row = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ?').get(std2Id);
    assert(enroll2Row.status === 'Left', 'Enrollment status updated to "Left"');

    // Historical fee record MUST still exist untouched
    const feeCountAfter = db.prepare('SELECT COUNT(*) as count FROM fee_records WHERE student_id = ?').get(std2Id).count;
    assert(feeCountAfter === 1, 'Historical fee record completely intact with zero foreign key violations');

    // Directory & Roster checks: must be completely hidden
    const listAfter2 = getAllStudents({ academicSessionId: sessionId }, db);
    assert(listAfter2.totalCount === 0, 'Archived student is completely hidden from getAllStudents');

    const statsAfter2 = getStudentStats(sessionId, db);
    assert(statsAfter2.total === 0 && statsAfter2.active === 0, 'getStudentStats excludes archived student from total and active counts');

    const dashSummary = getDashboardSummary(db);
    assert(dashSummary.activeStudentsCount === 0, 'getDashboardSummary excludes archived student from activeStudentsCount');

    const getByIdRes = getStudentById(std2Id, db);
    assert(getByIdRes === null, 'getStudentById(id) returns null by default for deleted/archived student');

    // ─── 5. Multi-Student Isolation Safety ──────────────────────────
    console.log('\n--- 5. Multi-Student Isolation Safety ---');
    const std3Res = createStudent({
      sessionToken,
      studentId: 'STD-2026-0003',
      firstName: 'Remaining',
      lastName: 'ActiveStudent',
      gender: 'Male',
      fatherName: 'Father Three',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId,
      },
    }, db);

    const std4Res = createStudent({
      sessionToken,
      studentId: 'STD-2026-0004',
      firstName: 'ToDelete',
      lastName: 'Student',
      gender: 'Male',
      fatherName: 'Father Four',
      enrollment: {
        academicSessionId: sessionId,
        classId,
        sectionId,
      },
    }, db);

    const std3Id = std3Res.student.id;
    const std4Id = std4Res.student.id;

    let listBeforeMulti = getAllStudents({ academicSessionId: sessionId }, db);
    assert(listBeforeMulti.totalCount === 2, '2 students visible before multi-student test');

    // Delete student 4
    deleteStudent({ sessionToken, id: std4Id }, db);

    let listAfterMulti = getAllStudents({ academicSessionId: sessionId }, db);
    assert(listAfterMulti.totalCount === 1, 'Exactly 1 student visible after deleting Student 4');
    assert(listAfterMulti.students[0].id === std3Id, 'Remaining visible student is Student 3');
    assert(listAfterMulti.students[0].displayName === 'Remaining ActiveStudent', 'Student 3 details and status untouched');

    // Clean up temp DB
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    console.log('\n====================================================');
    console.log(`Test Results: ${passed} passed, ${failed} failed.`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
});
