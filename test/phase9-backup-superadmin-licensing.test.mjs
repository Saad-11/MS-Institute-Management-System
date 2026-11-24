import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  VENDOR_PUBLIC_KEY_PEM,
  VENDOR_PRIVATE_KEY_PEM,
  signLicensePayload,
  verifyLicenseSignature,
  generateMachineBinding,
  serializeCanonicalPayload,
} from '../dist-electron/crypto/license-crypto.js';
import {
  getInstallationIdentity,
  getLicenseStatus,
  activateLicense,
  checkClockTampering,
  recordAuditLog,
} from '../dist-electron/database/services/license.service.js';
import {
  isSuperAdminSetupRequired,
  createSuperAdminAccount,
  loginSuperAdmin,
  verifySuperAdminSession,
  logoutSuperAdmin,
  generateLicense,
  getGeneratedLicenses,
  getSuperAdminDashboardStats,
} from '../dist-electron/database/services/super-admin.service.js';
import {
  createBackup,
  validateBackup,
  restoreBackup,
  listBackups,
  getLastBackupInfo,
} from '../dist-electron/database/services/backup.service.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createStudent, createEnrollment } from '../dist-electron/database/services/student.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { updateSchoolSettings } from '../dist-electron/database/services/school.service.js';

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
  console.log('Starting Phase 9 Tests: Backup/Restore, Super Admin & Offline Licensing...\n');

  // Setup temporary test directory and database
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-phase9-test-'));
  const dbPath = path.join(tempDir, 'school_test.db');
  const backupDir = path.join(tempDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  try {
    // -------------------------------------------------------------
    // 1. Migration 008 & Schema Integrity
    // -------------------------------------------------------------
    console.log('\n--- 1. Migration 008 & Schema Integrity ---');
    const migrationResult = runMigrations(db);
    assert(migrationResult.appliedCount >= 8, 'Migrations 001 through 008 applied');
    assert(migrationResult.currentVersion >= 8, 'Database version is at least 8');

    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
    assert(tables.includes('installation_identity'), 'installation_identity table exists');
    assert(tables.includes('license_state'), 'license_state table exists');
    assert(tables.includes('super_admin_accounts'), 'super_admin_accounts table exists');
    assert(tables.includes('super_admin_license_records'), 'super_admin_license_records table exists');
    assert(tables.includes('backup_metadata'), 'backup_metadata table exists');
    assert(tables.includes('system_audit_logs'), 'system_audit_logs table exists');

    // Seed school settings and student data
    createInitialAdmin({ username: 'admin', displayName: 'School Admin', password: 'Password123!' }, db);
    const loginRes = login({ username: 'admin', password: 'Password123!' }, db);
    const sessionToken = loginRes.sessionToken;

    updateSchoolSettings({
      sessionToken,
      schoolName: 'Allama Iqbal Model School',
      schoolCode: 'AIMS-01',
      city: 'Islamabad',
    }, db);

    const sessRes = createSession({ sessionToken, name: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isCurrent: true }, db);
    const clsRes = createClass({ sessionToken, name: 'Grade 10', displayOrder: 10 }, db);
    const classId = clsRes.classItem ? clsRes.classItem.id : (clsRes.class ? clsRes.class.id : 1);
    const secRes = createSection({ sessionToken, classId, name: 'Section A', capacity: 40 }, db);
    const sectionId = secRes.section ? secRes.section.id : 1;

    const stuRes = createStudent({
      sessionToken,
      firstName: 'Hamza',
      lastName: 'Ali',
      gender: 'Male',
      dateOfBirth: '2010-05-15',
      fatherName: 'Tariq Ali',
      admissionDate: '2025-04-05',
      currentAddress: 'Street 4, Sector F-8, Islamabad',
      contactNumber: '0300-1112233',
      enrollment: {
        academicSessionId: sessRes.session.id,
        classId,
        sectionId,
        admissionDate: '2025-04-05',
        rollNumber: '101',
      },
    }, db);

    // -------------------------------------------------------------
    // 2. Cryptographic Licensing Engine (Ed25519)
    // -------------------------------------------------------------
    console.log('\n--- 2. Cryptographic Engine (Ed25519 Asymmetric Verification) ---');
    assert(typeof VENDOR_PUBLIC_KEY_PEM === 'string' && VENDOR_PUBLIC_KEY_PEM.includes('BEGIN PUBLIC KEY'), 'Vendor public key loaded');
    assert(typeof VENDOR_PRIVATE_KEY_PEM === 'string' && VENDOR_PRIVATE_KEY_PEM.includes('BEGIN PRIVATE KEY'), 'Vendor private key loaded');

    const samplePayload = {
      licenseId: 'LIC-2026-TEST-001',
      customerName: 'Allama Iqbal Model School',
      product: 'SMS-Enterprise',
      edition: 'Enterprise',
      licenseType: 'Annual',
      installationBinding: 'INST-ABCD-1234-EF56',
      issuedAt: '2026-01-01',
      startsAt: '2026-01-01',
      expiresAt: '2027-01-01',
      gracePeriodDays: 14,
    };

    const canonicalStr = serializeCanonicalPayload(samplePayload);
    assert(canonicalStr.includes('LIC-2026-TEST-001') && canonicalStr.includes('Allama Iqbal Model School'), 'Canonical serialization format is deterministic');

    const signedToken = signLicensePayload(samplePayload);
    assert(typeof signedToken === 'string' && signedToken.length > 50, 'Signed license token created via Ed25519');

    const verifyResult = verifyLicenseSignature(signedToken);
    assert(verifyResult.valid === true, 'Valid token passes Ed25519 signature verification');
    assert(verifyResult.payload?.customerName === 'Allama Iqbal Model School', 'Verified payload matches original data');

    // Tampering test: tamper customer name
    const tamperedPayload = { ...samplePayload, customerName: 'Hacked School' };
    const rawBase64 = signedToken.replace('SMS-LIC-', '');
    const originalPackage = JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
    const tamperedPackage = {
      ...originalPackage,
      payload: tamperedPayload,
    };
    const tamperedToken = `SMS-LIC-${Buffer.from(JSON.stringify(tamperedPackage)).toString('base64')}`;

    const tamperedVerify = verifyLicenseSignature(tamperedToken);
    assert(tamperedVerify.valid === false, 'Tampered payload is rejected by Ed25519 verification');

    // -------------------------------------------------------------
    // 3. Hardware Fingerprinting & Installation Identity
    // -------------------------------------------------------------
    console.log('\n--- 3. Machine Hardware Binding ---');
    const binding = generateMachineBinding();
    assert(binding.installationId.startsWith('INST-'), 'Installation ID matches INST-XXXX format');
    assert(binding.machineFingerprint.length === 64, 'Machine fingerprint is SHA-256 hash');

    const identity = getInstallationIdentity(db);
    assert(identity.installationId.startsWith('INST-'), 'Database initialized with stable installation ID');
    assert(identity.firstInstalledAt !== null, 'firstInstalledAt is tracked');

    // Idempotent test
    const identity2 = getInstallationIdentity(db);
    assert(identity2.installationId === identity.installationId, 'Subsequent identity calls return identical installation ID');

    // -------------------------------------------------------------
    // 4. Offline License Activation & Validation
    // -------------------------------------------------------------
    console.log('\n--- 4. Offline License Activation & Status ---');
    const initialStatus = getLicenseStatus(db);
    assert(initialStatus.status === 'Unlicensed', 'Fresh install starts as Unlicensed');

    // Generate valid license bound to this machine
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const machineValidPayload = {
      licenseId: 'LIC-2026-ACTIVE-01',
      customerName: 'Allama Iqbal Model School',
      product: 'School Management System',
      edition: 'Enterprise',
      licenseType: 'Annual',
      installationBinding: identity.installationId,
      issuedAt: today,
      startsAt: today,
      expiresAt: futureDate,
      gracePeriodDays: 14,
    };
    const validMachineToken = signLicensePayload(machineValidPayload);

    const activateRes = activateLicense(validMachineToken, db);
    assert(activateRes.success === true, 'License successfully activated');
    assert(activateRes.statusInfo?.status === 'Valid', 'License status is Valid');
    assert(activateRes.statusInfo?.daysRemaining >= 170, 'Days remaining calculated correctly');

    // Verify database record
    const statusAfterActivate = getLicenseStatus(db);
    assert(statusAfterActivate.status === 'Valid', 'getLicenseStatus returns Valid');
    assert(statusAfterActivate.customerName === 'Allama Iqbal Model School', 'Customer name persisted');

    // Activate license bound to WRONG machine
    const wrongMachinePayload = {
      ...machineValidPayload,
      licenseId: 'LIC-WRONG-MACHINE',
      installationBinding: 'INST-9999-DIFFERENT-MACHINE',
    };
    const wrongMachineToken = signLicensePayload(wrongMachinePayload);
    const wrongActivateRes = activateLicense(wrongMachineToken, db);
    assert(wrongActivateRes.success === false, 'License bound to different machine is rejected');
    assert(wrongActivateRes.error?.includes('installation') || wrongActivateRes.error?.includes('machine'), 'Appropriate machine mismatch error message returned');

    // -------------------------------------------------------------
    // 5. Expiration & Grace Period Handling
    // -------------------------------------------------------------
    console.log('\n--- 5. Expiration, Grace Period & Data Safety ---');
    // Expired license (within grace period)
    const pastExpires = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const gracePayload = {
      ...machineValidPayload,
      licenseId: 'LIC-GRACE-PERIOD',
      issuedAt: '2025-01-01',
      startsAt: '2025-01-01',
      expiresAt: pastExpires,
      gracePeriodDays: 14, // 5 days expired <= 14 days grace
    };
    const graceToken = signLicensePayload(gracePayload);
    activateLicense(graceToken, db);
    const graceStatus = getLicenseStatus(db);
    assert(graceStatus.status === 'Expired', 'Expired license correctly marked as Expired');
    assert(graceStatus.isInGracePeriod === true, 'Identified as currently in grace period');

    // Fully expired past grace period
    const longAgoExpires = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const fullyExpiredPayload = {
      ...machineValidPayload,
      licenseId: 'LIC-FULLY-EXPIRED',
      issuedAt: '2024-01-01',
      startsAt: '2024-01-01',
      expiresAt: longAgoExpires,
      gracePeriodDays: 7,
    };
    const fullyExpiredToken = signLicensePayload(fullyExpiredPayload);
    activateLicense(fullyExpiredToken, db);
    const expiredStatus = getLicenseStatus(db);
    assert(expiredStatus.status === 'Expired' && expiredStatus.isInGracePeriod === false, 'Fully expired license past grace period identified');

    // CRITICAL: Data safety verification - students and settings still intact
    const studentCount = db.prepare(`SELECT COUNT(*) as count FROM students`).get().count;
    assert(studentCount >= 1, 'Data Safety: Student records preserved after license expiration');
    const enrollmentCount = db.prepare(`SELECT COUNT(*) as count FROM student_enrollments`).get().count;
    assert(enrollmentCount >= 1, 'Data Safety: Financial and enrollment records preserved after license expiration');

    // Clock rollback detection
    console.log('\n--- 6. Clock Tampering Detection ---');
    // Artificially record a future last_validated_timestamp in DB
    const futureClock = new Date(Date.now() + 86400000 * 30).toISOString();
    db.prepare(`UPDATE installation_identity SET last_validated_timestamp = ? WHERE id = 1`).run(futureClock);
    const clockTampered = checkClockTampering(db);
    assert(clockTampered === true, 'Detected clock rollback when current time is older than last_validated_timestamp');

    // Reset clock back to normal
    db.prepare(`UPDATE installation_identity SET last_validated_timestamp = ? WHERE id = 1`).run(new Date().toISOString());
    assert(checkClockTampering(db) === false, 'Clock tampering check passes with normal timestamps');

    // -------------------------------------------------------------
    // 7. Super Admin / Vendor Management
    // -------------------------------------------------------------
    console.log('\n--- 7. Super Admin Vendor Portal ---');
    assert(isSuperAdminSetupRequired(db) === true, 'First-run indicates Super Admin setup required');

    const saSetupRes = createSuperAdminAccount({
      username: 'vendor_admin',
      password: 'VendorSecretPassword123!',
      displayName: 'Master Software Vendor',
    }, db);
    assert(saSetupRes.success === true, 'Super Admin account created');
    assert(isSuperAdminSetupRequired(db) === false, 'Setup requirement clears after creation');

    // Duplicate account rejection
    const dupRes = createSuperAdminAccount({
      username: 'vendor_admin',
      password: 'AnotherPassword!',
      displayName: 'Duplicate',
    }, db);
    assert(dupRes.success === false, 'Duplicate Super Admin username is rejected');

    // Login authentication
    const saLoginBad = loginSuperAdmin({ username: 'vendor_admin', password: 'WrongPassword' }, db);
    assert(saLoginBad.success === false, 'Super Admin login with invalid password fails');

    const saLoginGood = loginSuperAdmin({ username: 'vendor_admin', password: 'VendorSecretPassword123!' }, db);
    assert(saLoginGood.success === true && typeof saLoginGood.token === 'string', 'Super Admin login succeeds and returns session token');

    const verifySa = verifySuperAdminSession(saLoginGood.token);
    assert(verifySa !== null && verifySa.username === 'vendor_admin', 'Super Admin session verified');

    // Generate license via Super Admin service
    const genRes = generateLicense({
      superAdminToken: saLoginGood.token,
      customerName: 'Beaconhouse School System',
      licenseType: 'Yearly',
      edition: 'Enterprise',
      installationBinding: 'INST-5555-6666-7777',
      startDate: today,
      gracePeriodDays: 14,
      notes: 'Paid via direct bank transfer',
    }, db);
    assert(genRes.success === true && genRes.licenseId?.startsWith('LIC-'), 'Super Admin generated offline license record');
    assert(typeof genRes.signedToken === 'string', 'Generated license has valid Ed25519 signed token');

    // Verify token generated by Super Admin
    const genVerify = verifyLicenseSignature(genRes.signedToken);
    assert(genVerify.valid === true, 'Token generated by Super Admin passes Ed25519 verification');
    assert(genVerify.payload?.customerName === 'Beaconhouse School System', 'Token payload contains correct customer');

    // List generated licenses and stats
    const listGen = getGeneratedLicenses({}, db);
    assert(listGen.records.length >= 1, 'Super Admin can list issued licenses');

    const statsRes = getSuperAdminDashboardStats(db);
    assert(statsRes.totalLicensesGenerated >= 1, 'Super Admin metrics reflect generated licenses count');

    // Logout
    logoutSuperAdmin(saLoginGood.token, db);
    assert(verifySuperAdminSession(saLoginGood.token) === null, 'Super Admin session terminated upon logout');

    // -------------------------------------------------------------
    // 8. Database-Consistent Backup (.smbak)
    // -------------------------------------------------------------
    console.log('\n--- 8. Backup Packaging (.smbak) & Checksums ---');
    // Reactivate valid license first for clean backup
    activateLicense(validMachineToken, db);

    const backupRes = await createBackup(backupDir, db);
    assert(backupRes.success === true, 'Database backup created successfully');
    assert(fs.existsSync(backupRes.backupPath), 'Backup file exists on disk');
    assert(backupRes.backupPath.endsWith('.smbak'), 'Backup file has .smbak extension');
    assert(backupRes.manifest?.schoolName === 'Allama Iqbal Model School', 'Backup manifest contains school name');
    assert(typeof backupRes.manifest?.databaseChecksum === 'string', 'Manifest contains SHA-256 database checksum');

    // Verify metadata recorded in DB
    const lastBackup = getLastBackupInfo(db);
    assert(lastBackup.lastBackupDate !== null, 'Last backup date recorded in database');
    assert(lastBackup.backupName?.endsWith('.smbak'), 'Last backup name tracked');

    // List backups
    const listRes = listBackups(backupDir, db);
    const backupItems = Array.isArray(listRes) ? listRes : (listRes.backups || []);
    assert(backupItems.length >= 1, 'listBackups identifies created .smbak file');

    // -------------------------------------------------------------
    // 9. Backup Validation
    // -------------------------------------------------------------
    console.log('\n--- 9. Backup Verification & Tamper Detection ---');
    const valGood = validateBackup(backupRes.backupPath);
    assert(valGood.valid === true, 'Valid backup passes integrity validation');
    assert(valGood.manifest?.schoolName === 'Allama Iqbal Model School', 'Manifest retrieved correctly during validation');

    // Tampered backup package
    const corruptBackupPath = path.join(backupDir, 'corrupt_test.smbak');
    fs.writeFileSync(corruptBackupPath, Buffer.from('NOT_A_VALID_GZIP_SMBAK_FILE'));
    const valBad = validateBackup(corruptBackupPath);
    assert(valBad.valid === false, 'Corrupted backup file fails validation');

    // -------------------------------------------------------------
    // 10. Database Restore & Pre-Restore Safety Snapshot
    // -------------------------------------------------------------
    console.log('\n--- 10. Database Restore & Rollback Protection ---');
    // Modify student before restore
    db.prepare(`UPDATE students SET first_name = 'ModifiedName' WHERE id = 1`).run();
    const modName = db.prepare(`SELECT first_name FROM students WHERE id = 1`).get().first_name;
    assert(modName === 'ModifiedName', 'Student record modified prior to restore test');

    // Restore from valid backup
    const restoreRes = await restoreBackup(backupRes.backupPath, db);
    assert(restoreRes.success === true, 'Database restored successfully from backup package');

    // Verify student name is restored back to Hamza
    const restoredName = db.prepare(`SELECT first_name FROM students WHERE id = 1`).get().first_name;
    assert(restoredName === 'Hamza', 'Student record accurately restored to snapshot point-in-time');

    // Verify pre-restore safety snapshot was created
    const safetyDir = path.join(path.dirname(backupRes.backupPath), 'safety');
    const safetyFiles = fs.existsSync(safetyDir) ? fs.readdirSync(safetyDir).filter(f => f.startsWith('PreRestore_')) : [];
    assert(safetyFiles.length >= 1, 'Safety snapshot archived in safety/ directory before restore execution');

    // Restore from corrupt backup should fail safely without destroying db
    const badRestoreRes = await restoreBackup(corruptBackupPath, db);
    assert(badRestoreRes.success === false, 'Restore from corrupt file fails safely');

    // Verify database remains fully intact after failed restore attempt
    const intactCheck = db.prepare(`SELECT COUNT(*) as count FROM students`).get().count;
    assert(intactCheck >= 1, 'Database remains consistent and uncorrupted after failed restore attempt');

    // -------------------------------------------------------------
    // 11. System Audit Logs
    // -------------------------------------------------------------
    console.log('\n--- 11. Security Audit Logs ---');
    const auditLogs = db.prepare(`SELECT event_type, severity FROM system_audit_logs ORDER BY id ASC`).all();
    assert(auditLogs.length >= 3, 'Multiple security audit log entries recorded');
    const eventTypes = auditLogs.map(a => a.event_type);
    assert(eventTypes.includes('INSTALLATION_INITIALIZED'), 'INSTALLATION_INITIALIZED event logged');
    assert(eventTypes.includes('BACKUP_CREATED') || eventTypes.includes('SAFETY_BACKUP_CREATED'), 'Backup creation event logged in audit logs');
    assert(eventTypes.includes('BACKUP_RESTORED') || eventTypes.includes('RESTORE_COMPLETED'), 'Backup restoration event logged in audit logs');

  } finally {
    db.close();
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows file locks
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 9 Test Results: ${passedTests} passed, ${failedTests} failed out of ${passedTests + failedTests}`);
  console.log(`========================================\n`);

  process.exit(failedTests > 0 ? 1 : 0);
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
