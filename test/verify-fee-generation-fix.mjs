import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  getFeePeriods,
  getFeeStructures,
  generateFeesForClass,
  getFeeRecords,
} from '../dist-electron/database/services/fee.service.js';

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const prodDbPath = path.join(appData, 'school-management-system', 'school_data.sqlite');

if (!fs.existsSync(prodDbPath)) {
  console.error(`Production DB not found at: ${prodDbPath}`);
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-fee-test-'));
const testDbPath = path.join(tempDir, 'test_copy.sqlite');
fs.copyFileSync(prodDbPath, testDbPath);

console.log('Copied production DB to test location:', testDbPath);

const db = new Database(testDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
  console.log('\n--- Step 1: Run Migrations on User Database Copy ---');
  const migrationResult = runMigrations(db);
  console.log('Migration Result: currentVersion =', migrationResult.currentVersion);

  const vRow = db.prepare("SELECT value FROM app_metadata WHERE key = 'schema_version'").get();
  console.log('DB schema_version in metadata:', vRow?.value);
  if (vRow?.value !== '11') {
    throw new Error(`Expected schema_version 11, got ${vRow?.value}`);
  }

  console.log('\n--- Step 2: Verify Fee Periods for Active Session ---');
  const activeSession = db.prepare('SELECT * FROM academic_sessions WHERE is_active = 1').get();
  console.log('Active Session:', activeSession?.id, activeSession?.name);

  const periodsRes = getFeePeriods(activeSession.id, db);
  console.log('Total fee periods returned:', periodsRes.periods.length);
  if (periodsRes.periods.length !== 12) {
    throw new Error(`Expected 12 fee periods, got ${periodsRes.periods.length}`);
  }

  console.log('Sample periods:');
  periodsRes.periods.slice(0, 3).forEach((p) => {
    console.log(`  - [ID: ${p.id}] ${p.name} (Start: ${p.startDate}, End: ${p.endDate}, Due: ${p.dueDate}, Status: ${p.status})`);
  });

  console.log('\n--- Step 3: Verify Fee Structures for Classes ---');
  const classes = db.prepare('SELECT id, name FROM classes WHERE is_active = 1').all();
  console.log('Active classes in DB:', classes);

  for (const cls of classes) {
    const structRes = getFeeStructures({ academicSessionId: activeSession.id, classId: cls.id }, db);
    console.log(`Class "${cls.name}" (ID: ${cls.id}) has ${structRes.structures.length} fee structures:`);
    structRes.structures.forEach((s) => {
      console.log(`  - ${s.feeTypeName}: ${s.amount / 100} PKR (${s.frequency})`);
    });
    if (structRes.structures.length === 0) {
      throw new Error(`Class ${cls.name} has no fee structures!`);
    }
  }

  console.log('\n--- Step 4: Verify Students Enrolled in Class 2 ---');
  const class2Students = db.prepare(`
    SELECT s.id, s.student_id, s.first_name, s.last_name, e.status as enrollment_status
    FROM students s
    JOIN student_enrollments e ON e.student_id = s.id
    WHERE e.academic_session_id = ? AND e.class_id = 2 AND e.status = 'Active'
  `).all(activeSession.id);

  console.log(`Active students enrolled in Class 2 for Session ${activeSession.id}:`, class2Students.length);
  class2Students.forEach((st) => console.log(`  - ${st.student_id}: ${st.first_name} ${st.last_name}`));

  if (class2Students.length === 0) {
    throw new Error('Expected at least 1 active student in Class 2!');
  }

  console.log('\n--- Step 5: Execute generateFeesForClass for Class 2 ---');
  const targetPeriod = periodsRes.periods[0]; // e.g. August 2026
  console.log(`Generating fees for Class 2, Period: "${targetPeriod.name}" (ID: ${targetPeriod.id})...`);

  // Mock an active session token for the admin user
  const { login } = await import('../dist-electron/database/services/auth.service.js');
  const { hashPassword } = await import('../dist-electron/database/security.js');
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  console.log('Found admin user:', adminUser?.username);

  // Set known password in test copy to log in cleanly
  const testPw = 'TestPassword123!';
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(testPw), adminUser.id);
  const loginRes = login({ username: adminUser.username, password: testPw }, db);
  if (!loginRes.success || !loginRes.sessionToken) {
    throw new Error('Failed to log in as admin: ' + loginRes.error);
  }
  const token = loginRes.sessionToken;

  const genResult = generateFeesForClass({
    sessionToken: token,
    academicSessionId: activeSession.id,
    classId: 2,
    feePeriodId: targetPeriod.id,
    dueDate: targetPeriod.dueDate,
  }, db);

  console.log('Generate Fees Result:', genResult);
  if (!genResult.success) {
    throw new Error(`Fee generation failed: ${genResult.error}`);
  }

  console.log(`Generated count: ${genResult.summary.createdCount}, Skipped count: ${genResult.summary.alreadyExistedCount}`);
  if (genResult.summary.createdCount !== class2Students.length) {
    throw new Error(`Expected ${class2Students.length} generated fees, got ${genResult.summary.createdCount}`);
  }

  console.log('\n--- Step 6: Verify Generated Fee Records in Database ---');
  const recRes = getFeeRecords({
    academicSessionId: activeSession.id,
    classId: 2,
    feePeriodId: targetPeriod.id,
  }, db);

  console.log(`Found ${recRes.records.length} fee records for Class 2 in period "${targetPeriod.name}":`);
  recRes.records.forEach((r) => {
    console.log(`  - Invoice: ${r.invoiceNumber} | Student: ${r.studentName} | Net: ${r.netAmount / 100} PKR | Status: ${r.status}`);
  });

  if (recRes.records.length !== class2Students.length) {
    throw new Error(`Fee records count mismatch: expected ${class2Students.length}, got ${recRes.records.length}`);
  }

  console.log('\n--- Step 7: Test Duplicate Skipping (Idempotency) ---');
  const dupResult = generateFeesForClass({
    sessionToken: token,
    academicSessionId: activeSession.id,
    classId: 2,
    feePeriodId: targetPeriod.id,
    dueDate: targetPeriod.dueDate,
  }, db);

  console.log('Duplicate Generation Result:', dupResult);
  if (!dupResult.success) {
    throw new Error(`Duplicate fee generation failed: ${dupResult.error}`);
  }
  if (dupResult.summary.createdCount !== 0 || dupResult.summary.alreadyExistedCount !== class2Students.length) {
    throw new Error(`Expected 0 generated and ${class2Students.length} skipped on repeat call!`);
  }
  console.log('✓ Idempotency verified: 0 duplicates created, all students skipped safely.');

  console.log('\n======================================================');
  console.log('🎉 ALL FEE GENERATION PRODUCTION AUDIT CHECKS PASSED!');
  console.log('======================================================\n');
} finally {
  db.close();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
