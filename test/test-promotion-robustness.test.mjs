import Database from 'better-sqlite3';
import assert from 'assert';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createStudent, getAllStudents } from '../dist-electron/database/services/student.service.js';
import { getPromotionCandidates, executePromotion, getStudentAcademicHistory, getPromotionLogs } from '../dist-electron/database/services/promotion.service.js';

console.log('--- Running Promotion Robustness & Edge Cases Suite ---');

const db = new Database(':memory:');
runMigrations(db);

createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, db);
const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
const sessionToken = loginRes.sessionToken;

// Create Sessions
const s1Res = createSession({ sessionToken, name: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isActive: false }, db);
const session1Id = s1Res.session.id;

const s2Res = createSession({ sessionToken, name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true }, db);
const session2Id = s2Res.session.id;

// Create Classes: Class 1 (order 1), Class 2 (order 2), Class 3 (order 3)
const c1Res = createClass({ sessionToken, name: 'Class 1', displayOrder: 1 }, db);
const class1Id = c1Res.classItem.id;

const c2Res = createClass({ sessionToken, name: 'Class 2', displayOrder: 2 }, db);
const class2Id = c2Res.classItem.id;

const c3Res = createClass({ sessionToken, name: 'Class 3', displayOrder: 3 }, db);
const class3Id = c3Res.classItem.id;

// Class 1 has Section A
const sec1Res = createSection({ sessionToken, classId: class1Id, name: 'A', capacity: 30 }, db);
const sec1Id = sec1Res.section.id;

// Class 2 has Section A
const sec2Res = createSection({ sessionToken, classId: class2Id, name: 'A', capacity: 30 }, db);
const sec2Id = sec2Res.section.id;

// Class 3 has NO sections initially (to test auto-section provisioning!)

// Enroll 3 students in Session 1, Class 1, Section A
const stu1 = createStudent({
  sessionToken, firstName: 'Student', lastName: 'One', gender: 'Male',
  enrollment: { academicSessionId: session1Id, classId: class1Id, sectionId: sec1Id, admissionDate: '2025-04-01', status: 'Active' }
}, db).student;

const stu2 = createStudent({
  sessionToken, firstName: 'Student', lastName: 'Two', gender: 'Male',
  enrollment: { academicSessionId: session1Id, classId: class1Id, sectionId: sec1Id, admissionDate: '2025-04-01', status: 'Active' }
}, db).student;

const stu3 = createStudent({
  sessionToken, firstName: 'Student', lastName: 'Three', gender: 'Female',
  enrollment: { academicSessionId: session1Id, classId: class1Id, sectionId: sec1Id, admissionDate: '2025-04-01', status: 'Active' }
}, db).student;

console.log('✓ Initial setup completed');

// TEST 1: Retrieve Candidates
const candRes = getPromotionCandidates({ fromSessionId: session1Id, fromClassId: class1Id, toSessionId: session2Id }, db);
assert.strictEqual(candRes.success, true);
assert.strictEqual(candRes.candidates.length, 3);
assert.strictEqual(candRes.candidates[0].alreadyEnrolledInDestination, false);
console.log('✓ Test 1: Promotion candidates retrieved correctly');

// TEST 2: Promote Student 1 with "Auto / Same Section" (toSectionId undefined)
const promo1Res = executePromotion({
  sessionToken,
  fromSessionId: session1Id,
  toSessionId: session2Id,
  fromClassId: class1Id,
  toClassId: class2Id,
  // Notice: toSectionId is NOT provided (Auto / Same Section)
  promotions: [
    { studentId: stu1.id, action: 'Promote' }
  ]
}, db);
assert.strictEqual(promo1Res.success, true, `Promote without section should succeed: ${promo1Res.error}`);
assert.strictEqual(promo1Res.processedCount, 1);

// Verify student 1's enrollments
const s1Enrollments = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY id ASC').all(stu1.id);
assert.strictEqual(s1Enrollments.length, 2);
assert.strictEqual(s1Enrollments[0].status, 'Inactive');
assert.strictEqual(s1Enrollments[0].promotion_status, 'Promote');
assert.strictEqual(s1Enrollments[1].status, 'Active');
assert.strictEqual(s1Enrollments[1].academic_session_id, session2Id);
assert.strictEqual(s1Enrollments[1].class_id, class2Id);
assert.strictEqual(s1Enrollments[1].section_id, sec2Id); // Matched Section A in Class 2
console.log('✓ Test 2: Auto-section matched Section A in Class 2 without requiring explicit toSectionId');

// TEST 3: Mixed Bulk Promotion (Promote Student 2 to Class 2, Retain Student 3 in Class 1)
const promoMixedRes = executePromotion({
  sessionToken,
  fromSessionId: session1Id,
  toSessionId: session2Id,
  fromClassId: class1Id,
  toClassId: class2Id, // Default destination class
  // toSectionId omitted
  promotions: [
    { studentId: stu2.id, action: 'Promote' },
    { studentId: stu3.id, action: 'Retain' }
  ]
}, db);
assert.strictEqual(promoMixedRes.success, true, `Mixed promotion should succeed: ${promoMixedRes.error}`);
assert.strictEqual(promoMixedRes.processedCount, 2);

// Verify Student 2 is in Class 2, Session 2
const s2Enrollments = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY id ASC').all(stu2.id);
assert.strictEqual(s2Enrollments[1].status, 'Active');
assert.strictEqual(s2Enrollments[1].academic_session_id, session2Id);
assert.strictEqual(s2Enrollments[1].class_id, class2Id);

// Verify Student 3 is RETAINED in Class 1, Session 2, Section 1
const s3Enrollments = db.prepare('SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY id ASC').all(stu3.id);
assert.strictEqual(s3Enrollments[0].status, 'Inactive');
assert.strictEqual(s3Enrollments[0].promotion_status, 'Retain');
assert.strictEqual(s3Enrollments[1].status, 'Active');
assert.strictEqual(s3Enrollments[1].academic_session_id, session2Id);
assert.strictEqual(s3Enrollments[1].class_id, class1Id); // Retained in Class 1!
assert.strictEqual(s3Enrollments[1].section_id, sec1Id); // Retained in Section A of Class 1!
console.log('✓ Test 3: Mixed promote and retain handled class and section assignments correctly');

// TEST 4: Promoting to a class with ZERO sections auto-provisions Section A
const promoAutoSecRes = executePromotion({
  sessionToken,
  fromSessionId: session2Id,
  toSessionId: session2Id,
  fromClassId: class2Id,
  toClassId: class3Id, // Class 3 has 0 sections!
  promotions: [
    { studentId: stu1.id, action: 'Promote' }
  ]
}, db);
assert.strictEqual(promoAutoSecRes.success, true, `Promote to sectionless class should succeed: ${promoAutoSecRes.error}`);

// Verify section was created in Class 3
const c3Sections = db.prepare('SELECT * FROM sections WHERE class_id = ?').all(class3Id);
assert.strictEqual(c3Sections.length, 1);
assert.strictEqual(c3Sections[0].name, 'Section A');
console.log('✓ Test 4: Section A auto-provisioned for class without sections');

// TEST 5: Auto next-class detection when toClassId is not provided ("Auto / Same Class")
const stu4 = createStudent({
  sessionToken, firstName: 'Student', lastName: 'Four', gender: 'Male',
  enrollment: { academicSessionId: session1Id, classId: class1Id, sectionId: sec1Id, admissionDate: '2025-04-01', status: 'Active' }
}, db).student;

const promoAutoClassRes = executePromotion({
  sessionToken,
  fromSessionId: session1Id,
  toSessionId: session2Id,
  fromClassId: class1Id,
  // toClassId omitted!
  // toSectionId omitted!
  promotions: [
    { studentId: stu4.id, action: 'Promote' }
  ]
}, db);
assert.strictEqual(promoAutoClassRes.success, true, `Auto next-class promotion should succeed: ${promoAutoClassRes.error}`);
const s4Enrollment = db.prepare("SELECT * FROM student_enrollments WHERE student_id = ? AND academic_session_id = ? AND status = 'Active'").get(stu4.id, session2Id);
assert.strictEqual(s4Enrollment.class_id, class2Id); // Automatically advanced from Class 1 to Class 2!
console.log('✓ Test 5: Auto-detected next class (Class 1 -> Class 2) without explicit toClassId');

// TEST 6: Candidate list excludes already-promoted/inactive students from source session
const candRes2 = getPromotionCandidates({ fromSessionId: session1Id, fromClassId: class1Id, toSessionId: session2Id }, db);
const candStu1Old = candRes2.candidates.find(c => c.studentId === stu1.id);
assert.strictEqual(candStu1Old, undefined, 'Promoted student no longer appears as active candidate in old class');

// But when checking candidate list in their new session and class (session2Id, class3Id):
const candResNew = getPromotionCandidates({ fromSessionId: session2Id, fromClassId: class3Id, toSessionId: session2Id }, db);
assert.strictEqual(candResNew.success, true);
assert(candResNew.candidates.some(c => c.studentId === stu1.id), 'Promoted student appears as active student in destination class');
console.log('✓ Test 6: Candidates list correctly tracks active session/class state');

// TEST 7: Duplicate promotion prevention (cannot promote if student has no active enrollment in source session)
const dupRes = executePromotion({
  sessionToken,
  fromSessionId: session1Id,
  toSessionId: session2Id,
  fromClassId: class1Id,
  toClassId: class2Id,
  promotions: [
    { studentId: stu1.id, action: 'Promote' }
  ]
}, db);
assert.strictEqual(dupRes.success, false);
assert(dupRes.error?.includes('does not have an active enrollment in the source session') || dupRes.error?.includes('already enrolled'));
console.log('✓ Test 7: Duplicate promotion prevented with clear rejection error');

// TEST 8: Verify Directory Listings (getAllStudents) for Destination and Source Sessions
const destStudents = getAllStudents({ academicSessionId: session2Id, classId: class2Id }, db);
assert.strictEqual(destStudents.success, true);
assert(destStudents.students.some(s => s.id === stu2.id), 'Promoted student 2 appears in Class 2 of Session 2');

const sourceStudents = getAllStudents({ academicSessionId: session1Id, classId: class1Id }, db);
assert.strictEqual(sourceStudents.success, true);
assert(sourceStudents.students.some(s => s.id === stu2.id), 'Student 2 historical record is preserved in Session 1, Class 1');

console.log('✓ Test 8: Both active destination roster and historical source roster return correctly in getAllStudents');

// TEST 9: Academic History & Promotion Logs
const histRes = getStudentAcademicHistory(stu2.id, db);
assert.strictEqual(histRes.success, true);
assert.strictEqual(histRes.history.length, 2);

const logsRes = getPromotionLogs({ studentId: stu2.id }, db);
assert.strictEqual(logsRes.success, true);
assert(logsRes.logs.length >= 1);
assert.strictEqual(logsRes.logs[0].action, 'Promote');
console.log('✓ Test 9: Academic history and audit logs reflect student promotion journey accurately');

db.close();

console.log('\n======================================================');
console.log('ALL 9 PROMOTION ROBUSTNESS & EDGE CASE TESTS PASSED!');
console.log('======================================================');
