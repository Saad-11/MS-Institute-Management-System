/**
 * Automated Test Suite — Phase 3: School Settings & Core Academic Structure
 * 
 * Tests:
 * 1. Migration 002 application and table verification
 * 2. School Settings profile fields and session authentication
 * 3. Academic Sessions CRUD, duplicate name rejection, date validation, and single-active transactional enforcement
 * 4. Classes & Sections CRUD, case-insensitive uniqueness, ordering, status toggling
 * 5. Subjects CRUD, case-insensitive uniqueness, status toggling
 * 6. Class-Subject Assignment junction table, ordering, duplicate assignment prevention, unassignment
 * 7. Dashboard summary aggregation with live metrics
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Import compiled backend modules from dist-electron
import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  createInitialAdmin,
  login,
  clearAllSessions,
} from '../dist-electron/database/services/auth.service.js';
import {
  getSchoolSettings,
  updateSchoolSettings,
} from '../dist-electron/database/services/school.service.js';
import {
  getAllSessions,
  getActiveSession,
  createSession,
  updateSession,
  activateSession,
  deactivateSession,
} from '../dist-electron/database/services/academic-session.service.js';
import {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  toggleClassStatus,
  getSectionsByClassId,
  createSection,
  updateSection,
  toggleSectionStatus,
} from '../dist-electron/database/services/class.service.js';
import {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  toggleSubjectStatus,
  getClassSubjects,
  assignSubjectToClass,
  removeClassSubject,
} from '../dist-electron/database/services/subject.service.js';
import { getDashboardSummary } from '../dist-electron/database/services/dashboard.service.js';

const testDbPath = path.resolve('test-phase3-data.sqlite');

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

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING PHASE 3 AUTOMATED INTEGRATION & STRUCTURAL TEST SUITE ');
  console.log('================================================================\n');

  cleanup();
  clearAllSessions();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ─── TEST GROUP 1: Database Migrations 001 + 002 ──────────────────────────
    console.log('--- TEST GROUP 1: Schema Migrations (Phase 1 -> Phase 3) ---');
    const db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    const migResult = runMigrations(db);
    assert(migResult.appliedCount >= 2, `Applied at least 2 migrations on fresh database (got ${migResult.appliedCount})`);
    assert(migResult.currentVersion >= 2, `Database schema version is at least 2 (got ${migResult.currentVersion})`);

    // Verify all Phase 3 tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert(tables.includes('academic_sessions'), 'Table "academic_sessions" exists');
    assert(tables.includes('classes'), 'Table "classes" exists');
    assert(tables.includes('sections'), 'Table "sections" exists');
    assert(tables.includes('subjects'), 'Table "subjects" exists');
    assert(tables.includes('class_subjects'), 'Table "class_subjects" exists');

    // Create an admin user to obtain a valid session token for subsequent authenticated operations
    const adminCreated = createInitialAdmin({
      username: 'principal_admin',
      displayName: 'Principal Dr. Khan',
      password: 'AdminPassword123!',
    }, db);
    assert(adminCreated.success === true, 'Created initial admin user');

    const loginRes = login({ username: 'principal_admin', password: 'AdminPassword123!' }, db);
    assert(loginRes.success === true && !!loginRes.sessionToken, 'Logged in to acquire sessionToken');
    const token = loginRes.sessionToken;

    // ─── TEST GROUP 2: School Settings & Institutional Profile ────────────────
    console.log('\n--- TEST GROUP 2: School Settings Profile ---');
    const initialSettings = getSchoolSettings(db);
    assert(initialSettings.schoolName === 'My School', 'Initial default school name loaded');

    // Update settings with complete Phase 3 metadata
    const updateRes = updateSchoolSettings({
      sessionToken: token,
      schoolName: 'Beaconhouse High School',
      schoolCode: 'BHS-4091',
      schoolType: 'School',
      principalName: 'Dr. Tariq Khan',
      phone: '+92 51 111 222 333',
      email: 'info@beaconhouse.edu.pk',
      address: 'Plot 42, Sector H-8',
      city: 'Islamabad',
      province: 'Federal',
      country: 'Pakistan',
    }, db);
    assert(updateRes.success === true, 'Successfully updated school settings profile');

    const loadedSettings = getSchoolSettings(db);
    assert(loadedSettings.schoolName === 'Beaconhouse High School', 'School name persisted correctly');
    assert(loadedSettings.schoolCode === 'BHS-4091', 'School registration code persisted');
    assert(loadedSettings.schoolType === 'School', 'School type persisted');
    assert(loadedSettings.city === 'Islamabad', 'City persisted');

    // Rejection on invalid session token
    const unauthUpdate = updateSchoolSettings({ sessionToken: 'invalid-token-xyz', schoolName: 'Hacker High' }, db);
    assert(unauthUpdate.success === false, 'Unauthorized update rejected without valid session token');

    // ─── TEST GROUP 3: Academic Sessions Management ───────────────────────────
    console.log('\n--- TEST GROUP 3: Academic Sessions (CRUD & Single-Active Enforcement) ---');

    // 1. Create sessions
    const s1 = createSession({
      sessionToken: token,
      name: '2025-2026',
      startDate: '2025-08-01',
      endDate: '2026-06-30',
      isActive: true,
    }, db);
    assert(s1.success === true && !!s1.session, 'Created Academic Session 2025-2026 with isActive=true');

    // Check school_settings.academic_session was automatically updated to 2025-2026
    const settingsAfterS1 = getSchoolSettings(db);
    assert(settingsAfterS1.academicSession === '2025-2026', 'School settings synchronized active session to 2025-2026');

    // 2. Reject duplicate session name (case-insensitive)
    const dupSession = createSession({
      sessionToken: token,
      name: '2025-2026',
      startDate: '2025-08-01',
      endDate: '2026-06-30',
    }, db);
    assert(dupSession.success === false, 'Duplicate session name "2025-2026" rejected');

    // 3. Reject invalid dates (start_date > end_date)
    const invalidDateSession = createSession({
      sessionToken: token,
      name: '2027-2028',
      startDate: '2028-09-01',
      endDate: '2027-06-01',
    }, db);
    assert(invalidDateSession.success === false, 'Session with startDate > endDate rejected');

    // 4. Create second session
    const s2 = createSession({
      sessionToken: token,
      name: '2026-2027',
      startDate: '2026-08-01',
      endDate: '2027-06-30',
      isActive: false,
    }, db);
    assert(s2.success === true && !!s2.session, 'Created Academic Session 2026-2027 with isActive=false');

    // 5. Activate second session -> verify exactly one active session invariant
    const activateS2 = activateSession({ sessionToken: token, id: s2.session.id }, db);
    assert(activateS2.success === true, 'Activated session 2026-2027');

    const activeSession = getActiveSession(db);
    assert(activeSession?.name === '2026-2027', 'Active session is now 2026-2027');

    const allSessions = getAllSessions(undefined, db);
    const activeCount = allSessions.filter(s => s.isActive).length;
    assert(activeCount === 1, `Exactly 1 active session in database (found ${activeCount})`);

    const settingsAfterS2 = getSchoolSettings(db);
    assert(settingsAfterS2.academicSession === '2026-2027', 'School settings synchronized to newly activated session');

    // ─── TEST GROUP 4: Classes & Sections Management ──────────────────────────
    console.log('\n--- TEST GROUP 4: Classes & Sections (CRUD & Uniqueness) ---');

    // 1. Create Class
    const cls1Res = createClass({
      sessionToken: token,
      name: 'Class 9',
      code: 'C9',
      displayOrder: 9,
      isActive: true,
    }, db);
    assert(cls1Res.success === true && !!cls1Res.classItem, 'Created class "Class 9"');
    const class9Id = cls1Res.classItem.id;

    const cls2Res = createClass({
      sessionToken: token,
      name: 'Class 10',
      code: 'C10',
      displayOrder: 10,
      isActive: true,
    }, db);
    assert(cls2Res.success === true && !!cls2Res.classItem, 'Created class "Class 10"');
    const class10Id = cls2Res.classItem.id;

    // 2. Reject duplicate class name (case-insensitive)
    const dupClass = createClass({
      sessionToken: token,
      name: 'class 9',
    }, db);
    assert(dupClass.success === false, 'Duplicate class name "class 9" rejected');

    // 3. Create Sections for Class 9
    const sec1Res = createSection({
      sessionToken: token,
      classId: class9Id,
      name: 'Section A',
      description: 'Morning Shift',
    }, db);
    assert(sec1Res.success === true, 'Created "Section A" for Class 9');

    const sec2Res = createSection({
      sessionToken: token,
      classId: class9Id,
      name: 'Section B',
      description: 'Afternoon Shift',
    }, db);
    assert(sec2Res.success === true, 'Created "Section B" for Class 9');

    // 4. Reject duplicate section name in same class
    const dupSec = createSection({
      sessionToken: token,
      classId: class9Id,
      name: 'section a',
    }, db);
    assert(dupSec.success === false, 'Duplicate section name "section a" in same class rejected');

    // 5. Allow same section name in a DIFFERENT class (e.g. Section A in Class 10)
    const sec1Class10 = createSection({
      sessionToken: token,
      classId: class10Id,
      name: 'Section A',
    }, db);
    assert(sec1Class10.success === true, 'Same section name "Section A" allowed in different class (Class 10)');

    // 6. Section count verification
    const c9Fetched = getClassById(class9Id, db);
    assert(c9Fetched?.sectionCount === 2, `Class 9 section count is 2 (got ${c9Fetched?.sectionCount})`);

    // 7. Toggle class active status
    const toggleCls = toggleClassStatus({ sessionToken: token, id: class10Id, isActive: false }, db);
    assert(toggleCls.success === true && toggleCls.classItem?.isActive === false, 'Toggled Class 10 to inactive');

    // ─── TEST GROUP 5: Subjects & Class-Subject Assignments ───────────────────
    console.log('\n--- TEST GROUP 5: Subjects & Class-Subject Mappings ---');

    // 1. Create Subjects
    const sub1 = createSubject({ sessionToken: token, name: 'Mathematics', code: 'MATH-101' }, db);
    assert(sub1.success === true && !!sub1.subject, 'Created subject "Mathematics"');
    const mathId = sub1.subject.id;

    const sub2 = createSubject({ sessionToken: token, name: 'English Literature', code: 'ENG-101' }, db);
    assert(sub2.success === true && !!sub2.subject, 'Created subject "English Literature"');
    const englishId = sub2.subject.id;

    const sub3 = createSubject({ sessionToken: token, name: 'Physics', code: 'PHY-101' }, db);
    assert(sub3.success === true && !!sub3.subject, 'Created subject "Physics"');
    const physicsId = sub3.subject.id;

    // 2. Reject duplicate subject name (case-insensitive)
    const dupSub = createSubject({ sessionToken: token, name: 'mathematics' }, db);
    assert(dupSub.success === false, 'Duplicate subject "mathematics" rejected');

    // 3. Assign subjects to Class 9
    const assign1 = assignSubjectToClass({
      sessionToken: token,
      classId: class9Id,
      subjectId: mathId,
      displayOrder: 1,
    }, db);
    assert(assign1.success === true, 'Assigned Mathematics to Class 9 (Order 1)');

    const assign2 = assignSubjectToClass({
      sessionToken: token,
      classId: class9Id,
      subjectId: physicsId,
      displayOrder: 2,
    }, db);
    assert(assign2.success === true, 'Assigned Physics to Class 9 (Order 2)');

    // 4. Reject duplicate assignment of same subject to same class
    const dupAssign = assignSubjectToClass({
      sessionToken: token,
      classId: class9Id,
      subjectId: mathId,
    }, db);
    assert(dupAssign.success === false, 'Duplicate subject assignment to same class rejected');

    // 5. Query assigned subjects for Class 9
    const c9Subjects = getClassSubjects(class9Id, db);
    assert(c9Subjects.length === 2, `Class 9 has 2 assigned subjects (got ${c9Subjects.length})`);
    assert(c9Subjects[0].subjectName === 'Mathematics', 'First subject in display order is Mathematics');

    // 6. Remove subject assignment
    const removeRes = removeClassSubject({
      sessionToken: token,
      classId: class9Id,
      subjectId: physicsId,
    }, db);
    assert(removeRes.success === true, 'Removed Physics from Class 9');

    const c9SubjectsAfter = getClassSubjects(class9Id, db);
    assert(c9SubjectsAfter.length === 1, `Class 9 now has 1 assigned subject (got ${c9SubjectsAfter.length})`);

    // ─── TEST GROUP 6: Dashboard Live Summary Aggregation ─────────────────────
    console.log('\n--- TEST GROUP 6: Dashboard Summary Aggregation ---');
    const dashSummary = getDashboardSummary(db);
    assert(dashSummary.schoolName === 'Beaconhouse High School', 'Dashboard reflects school name');
    assert(dashSummary.schoolType === 'School', 'Dashboard reflects school type');
    assert(dashSummary.activeSession === '2026-2027', 'Dashboard reflects current active session');
    assert(dashSummary.activeClassesCount === 1, `Dashboard reflects active classes count = 1 (Class 9 active, Class 10 inactive, got ${dashSummary.activeClassesCount})`);
    assert(dashSummary.activeSubjectsCount === 3, `Dashboard reflects active subjects count = 3 (got ${dashSummary.activeSubjectsCount})`);

    // ─── SUMMARY ─────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log(`  PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    db.close();
    cleanup();

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled exception during Phase 3 test execution:', err);
    cleanup();
    process.exit(1);
  }
}

runTests();
