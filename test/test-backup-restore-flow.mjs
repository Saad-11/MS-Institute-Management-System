import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as zlib from 'zlib';

import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  createBackup,
  validateBackup,
  restoreBackup,
  listBackups,
  getLastBackupInfo,
  generateBackupFilename,
} from '../dist-electron/database/services/backup.service.js';
import { createInitialAdmin, login } from '../dist-electron/database/services/auth.service.js';
import { createStudent } from '../dist-electron/database/services/student.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { updateSchoolSettings } from '../dist-electron/database/services/school.service.js';
import { getInstallationIdentity, activateLicense, getLicenseStatus } from '../dist-electron/database/services/license.service.js';
import { signLicensePayload } from '../dist-electron/crypto/license-crypto.js';

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

async function run() {
  console.log('=== Starting Comprehensive Backup & Restore Flow Tests ===\n');

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msims-backup-test-'));
  const simulatedUsbDrive = path.join(testTempDir, 'usb_drive_destination');
  fs.mkdirSync(simulatedUsbDrive, { recursive: true });

  const compADbPath = path.join(testTempDir, 'computer_a.sqlite');
  const dbA = new Database(compADbPath);
  dbA.pragma('foreign_keys = ON');

  try {
    // 1. Check generated filename format
    console.log('\n--- Test 1: Dynamic Filename Format ---');
    const filename = generateBackupFilename();
    console.log(`  Generated filename: ${filename}`);
    const filenameRegex = /^MSIMS_Backup_\d{4}-\d{2}-\d{2}_\d{6}\.smbak$/;
    assert(filenameRegex.test(filename), 'Filename matches MSIMS_Backup_YYYY-MM-DD_HHmmss.smbak pattern');

    const safetyFilename = generateBackupFilename(true);
    console.log(`  Generated safety filename: ${safetyFilename}`);
    const safetyRegex = /^PreRestore_MSIMS_Backup_\d{4}-\d{2}-\d{2}_\d{6}\.smbak$/;
    assert(safetyRegex.test(safetyFilename), 'Safety filename matches PreRestore_MSIMS_Backup_YYYY-MM-DD_HHmmss.smbak pattern');

    // 2. Setup Computer A Database
    console.log('\n--- Test 2: Setup Database on Computer A ---');
    runMigrations(dbA);
    const idA = getInstallationIdentity(dbA);
    assert(!!idA.installationId, `Computer A has installation ID: ${idA.installationId}`);

    createInitialAdmin({ username: 'admin', displayName: 'System Admin', password: 'Password123!' }, dbA);
    const loginRes = login({ username: 'admin', password: 'Password123!' }, dbA);
    const tokenA = loginRes.sessionToken;

    updateSchoolSettings({
      sessionToken: tokenA,
      schoolName: 'Muhammad Saad Model Academy',
      schoolCode: 'MSMA-2026',
      city: 'Islamabad',
    }, dbA);

    const sessRes = createSession({
      sessionToken: tokenA,
      name: '2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isCurrent: true,
    }, dbA);

    const clsRes = createClass({
      sessionToken: tokenA,
      name: 'Class 10',
      displayOrder: 1,
    }, dbA);

    const secRes = createSection({
      sessionToken: tokenA,
      classId: clsRes.classItem.id,
      name: 'Section Alpha',
    }, dbA);

    const stuRes = createStudent({
      sessionToken: tokenA,
      studentId: 'STD-2026-0001',
      admissionNumber: 'ADM-2026-001',
      firstName: 'Hamza',
      lastName: 'Khan',
      gender: 'Male',
      dateOfBirth: '2010-05-15',
      primaryContact: '03001234567',
    }, dbA);

    assert(stuRes.success && !!stuRes.student, 'Student created on Computer A');

    // 3. Create Backup to User-Selected Custom Destination Folder (e.g. USB drive)
    console.log('\n--- Test 3: Create Backup to Selected Custom Folder ---');
    const backupResult = await createBackup(
      { customDestinationPath: simulatedUsbDrive },
      dbA
    );

    assert(backupResult.success === true, 'Backup creation reported success');
    assert(!!backupResult.backupPath, `Backup path returned: ${backupResult.backupPath}`);
    assert(fs.existsSync(backupResult.backupPath), 'Backup file physically exists on disk');
    
    // Verify file is inside simulated USB directory
    assert(
      path.dirname(backupResult.backupPath).toLowerCase() === simulatedUsbDrive.toLowerCase(),
      'Backup file was written directly into the user-selected folder'
    );

    const baseName = path.basename(backupResult.backupPath);
    assert(filenameRegex.test(baseName), `Backup file has exact name: ${baseName}`);

    const stat = fs.statSync(backupResult.backupPath);
    assert(stat.size > 0, `Backup file has non-zero size (${stat.size} bytes)`);

    // Verify magic header: SMBAK_V1\n followed by gzip magic bytes 0x1F, 0x8B
    const fd = fs.openSync(backupResult.backupPath, 'r');
    const headerBuf = Buffer.alloc(11);
    fs.readSync(fd, headerBuf, 0, 11, 0);
    fs.closeSync(fd);
    assert(headerBuf.subarray(0, 9).toString('utf8') === 'SMBAK_V1\n', 'File begins with SMBAK_V1 magic header');
    assert(headerBuf[9] === 0x1f && headerBuf[10] === 0x8b, 'Payload is a valid GZIP compressed archive');

    // 4. Validate the generated backup
    console.log('\n--- Test 4: Validate Backup File Integrity ---');
    const valResult = await validateBackup(backupResult.backupPath, dbA);
    assert(valResult.valid === true, 'Validation confirms backup package is cryptographically valid');
    assert(valResult.manifest?.schoolName === 'Muhammad Saad Model Academy', 'Manifest contains correct school name');
    assert(valResult.manifest?.schoolCode === 'MSMA-2026', 'Manifest contains correct school code');
    assert(!!valResult.manifest?.databaseChecksum, 'Manifest has SHA-256 database checksum');

    // 5. Test Cross-Computer Recovery: Restore onto Computer B
    console.log('\n--- Test 5: Cross-Computer Recovery (Restore Computer A backup on Computer B) ---');
    const compBDbPath = path.join(testTempDir, 'computer_b.sqlite');
    const dbB = new Database(compBDbPath);
    dbB.pragma('foreign_keys = ON');
    runMigrations(dbB);

    const idB = getInstallationIdentity(dbB);
    assert(!!idB.installationId, `Computer B has installation ID: ${idB.installationId}`);

    // Activate a valid license on Computer B
    const licPayload = {
      formatVersion: '1.0',
      licenseId: 'LIC-COMPB-2026',
      product: 'MS Institute Management System',
      edition: 'Pro',
      licenseType: 'Standard',
      customerName: 'Computer B User',
      installationBinding: idB.installationId,
      issuedAt: '2026-01-01',
      startsAt: '2026-01-01',
      expiresAt: '2027-01-01',
      gracePeriodDays: 14,
    };
    const compBToken = signLicensePayload(licPayload);
    const actResult = activateLicense(compBToken, dbB);
    assert(actResult.success === true, 'Computer B licensed successfully');

    // Confirm initial state of Computer B
    const bStudentsBefore = dbB.prepare('SELECT count(*) as cnt FROM students').get();
    assert(bStudentsBefore.cnt === 0, 'Computer B has 0 students before restore');

    // Restore Computer A's backup onto Computer B
    const restoreResult = await restoreBackup(backupResult.backupPath, dbB);
    assert(restoreResult.success === true, 'Restore on Computer B completed successfully');

    // Verify school data restored on Computer B
    const restoredSchool = dbB.prepare('SELECT school_name, school_code FROM school_settings WHERE id = 1').get();
    assert(restoredSchool.school_name === 'Muhammad Saad Model Academy', 'School name restored to Muhammad Saad Model Academy');
    assert(restoredSchool.school_code === 'MSMA-2026', 'School code restored to MSMA-2026');

    const restoredStudents = dbB.prepare('SELECT first_name, last_name, admission_number FROM students').all();
    assert(restoredStudents.length === 1, 'Restored student found in database');
    assert(restoredStudents[0].first_name === 'Hamza', 'Student first name is Hamza');

    const restoredClasses = dbB.prepare('SELECT name FROM classes').all();
    assert(restoredClasses.some(c => c.name === 'Class 10'), 'Class 10 restored');

    // Verify Cross-Computer Identity Preservation: Computer B's hardware identity and license state MUST NOT be overwritten by Computer A
    const idBAfter = getInstallationIdentity(dbB);
    assert(
      idBAfter.installationId === idB.installationId,
      `Computer B installation ID preserved: ${idBAfter.installationId}`
    );

    const licBStatus = getLicenseStatus(dbB);
    assert(licBStatus.status === 'Valid', 'Computer B license remained Valid after restore');
    assert(licBStatus.installationId === idB.installationId, 'Computer B license still matches Computer B hardware identity');

    // 6. Test listBackups and getLastBackupInfo
    console.log('\n--- Test 6: Metadata & Backup List ---');
    const backupsList = listBackups(dbA);
    assert(backupsList.length >= 1, `Found ${backupsList.length} recorded backups`);
    const foundCustom = backupsList.find(b => b.fileName === baseName);
    assert(!!foundCustom, `Found ${baseName} in backups list`);

    const lastInfo = getLastBackupInfo(dbA);
    assert(lastInfo.backupName === baseName, `getLastBackupInfo correctly identifies last backup: ${lastInfo.backupName}`);

    dbA.close();
    dbB.close();

    console.log('\n=== All Tests Completed ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
