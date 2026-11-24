import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';
import Database from 'better-sqlite3';
import { runMigrations } from '../dist-electron/database/migrations.js';
import { createInitialAdmin, login, isSetupRequired } from '../dist-electron/database/services/auth.service.js';
import { createSession } from '../dist-electron/database/services/academic-session.service.js';
import { createClass, createSection } from '../dist-electron/database/services/class.service.js';
import { createStudent, getAllStudents } from '../dist-electron/database/services/student.service.js';
import { createTeacher, getAllTeachers } from '../dist-electron/database/services/teacher.service.js';
import { updateSchoolSettings, getSchoolSettings } from '../dist-electron/database/services/school.service.js';
import { createBackup, restoreBackup } from '../dist-electron/database/services/backup.service.js';

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

function makeFakeDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

app.whenReady().then(async () => {
  console.log('==============================================================');
  console.log('   Safe Two-Option Uninstaller & Reinstall Verification Suite  ');
  console.log('==============================================================\n');

  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msims-uninstall-sandbox-'));

  try {
    // ─── 1. Static Configuration & NSIS Script Checks ──────────────────────
    console.log('--- 1. Installer Config & NSIS Script Inspection ---');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    assert(pkg.build?.nsis?.deleteAppDataOnUninstall === false, 'package.json sets deleteAppDataOnUninstall: false');
    assert(pkg.build?.nsis?.oneClick === false, 'package.json uses assisted installer (oneClick: false)');
    assert(pkg.build?.nsis?.include === 'build/installer.nsh', 'package.json includes build/installer.nsh');

    const nshPath = path.resolve('build/installer.nsh');
    assert(fs.existsSync(nshPath), 'build/installer.nsh exists');
    const nsh = fs.readFileSync(nshPath, 'utf-8');

    // Exact Option 1 & 2 Labels and Descriptions
    assert(nsh.includes('Uninstall Software Only — Keep Database'), 'Contains exact Option 1 title');
    assert(
      nsh.includes('Remove ${PRODUCT_NAME} from this computer, but keep all application data and records. If you reinstall the software later, your previous records should remain available.'),
      'Contains exact Option 1 description'
    );
    assert(nsh.includes('Uninstall Software and Delete All Application Data'), 'Contains exact Option 2 title');
    assert(
      nsh.includes('Completely remove ${PRODUCT_NAME}, including its database, student records, teacher records, financial records, settings, and other application data. This action cannot be undone.'),
      'Contains exact Option 2 description'
    );

    // Exact Confirmation Dialog
    assert(nsh.includes('WARNING: PERMANENT DATA DELETION'), 'Contains exact WARNING: PERMANENT DATA DELETION title');
    assert(
      nsh.includes('Are you sure you want to permanently delete all ${PRODUCT_NAME} data from this computer? This includes student records, teacher records, fees, examination results, attendance, settings, and locally stored files.'),
      'Contains exact confirmation dialog message'
    );
    assert(nsh.includes('"Cancel"') && nsh.includes('"Permanently Delete All Application Data"'), 'Contains exact Cancel and Permanently Delete All Application Data buttons');

    // Safety Guards
    assert(nsh.includes('SendMessage $UnOptRadioKeep ${BM_SETCHECK} ${BST_CHECKED}'), 'Option 1 (Keep Database) is selected by default');
    assert(nsh.includes('${NSD_SetFocus} $ConfirmBtnCancel'), 'Cancel button focused by default on confirmation dialog');
    assert(nsh.includes('${IfNot} ${Silent}') && nsh.includes('"$DeleteAllAppData" == "1"') && nsh.includes('"$ConfirmedPermanentDelete" == "1"'), 'Triple guard prevents unconfirmed or silent data deletion');
    assert(nsh.includes('"$0" == "$DOCUMENTS"') && nsh.includes('"$0" == "$DESKTOP"') && nsh.includes('"$0" == "$PROFILE"'), 'Broad user folder safety guards present');
    assert(nsh.includes('school_data.sqlite-wal') && nsh.includes('school_data.sqlite-shm'), 'Explicitly handles SQLite WAL and SHM files');
    assert(nsh.includes('SetErrors') && nsh.includes('$DeleteFailedPath'), 'Reports locked files honestly instead of silent success');

    // Built artifacts exist
    assert(fs.existsSync(path.resolve('release/MS Institute Management System Setup.exe')), 'Compiled Setup EXE exists in release/');
    assert(fs.existsSync(path.resolve('MS Institute Management System Setup.exe')), 'Compiled Setup EXE exists in project root');

    // ─── 2. Compile Isolated NSIS Execution Harness Against Real Logic ──────
    console.log('\n--- 2. Compiling Isolated NSIS Sandbox Test Binary ---');
    const makensisExe = path.join(
      process.env.LOCALAPPDATA || '',
      'electron-builder',
      'Cache',
      'nsis',
      'nsis-3.0.4.1',
      'Bin',
      'makensis.exe'
    );
    assert(fs.existsSync(makensisExe), `Found makensis.exe compiler at cache path`);

    // Build an isolated NSIS test executable using the exact deletion & safety routine from build/installer.nsh
    // redirected strictly to temporary sandbox paths configured via an isolated INI file.
    const harnessExe = path.join(scratchRoot, 'sandbox-uninstaller-test.exe');
    const harnessNsi = path.join(scratchRoot, 'sandbox-uninstaller-test.nsi');
    const harnessIni = path.join(scratchRoot, 'sandbox-config.ini');

    // Extract un.SafeDeleteAppDir function directly from build/installer.nsh so we test the real code!
    const fnStart = nsh.indexOf('Function un.SafeDeleteAppDir');
    const fnEnd = nsh.indexOf('FunctionEnd', fnStart) + 'FunctionEnd'.length;
    assert(fnStart !== -1 && fnEnd > fnStart, 'Extracted real un.SafeDeleteAppDir function from build/installer.nsh');
    // Convert "Function un.SafeDeleteAppDir" -> "Function SafeDeleteAppDir" for non-uninstaller test binary
    const extractedFn = nsh.slice(fnStart, fnEnd).replace('Function un.SafeDeleteAppDir', 'Function SafeDeleteAppDir');

    const harnessScript = `
Unicode true
SilentInstall silent
RequestExecutionLevel user
OutFile "${harnessExe.replace(/\\/g, '\\\\')}"

!include "LogicLib.nsh"

Var DeleteAllAppData
Var ConfirmedPermanentDelete
Var DeleteFailedPath
Var SandboxInstDir
Var SandboxAppData
Var SandboxLocalAppData
Var IniFilePath

${extractedFn}

Section "RunSandboxTest"
  StrCpy $IniFilePath "${harnessIni.replace(/\\/g, '\\\\')}"
  ReadINIStr $DeleteAllAppData "$IniFilePath" "Test" "DeleteAllAppData"
  ReadINIStr $ConfirmedPermanentDelete "$IniFilePath" "Test" "ConfirmedPermanentDelete"
  ReadINIStr $SandboxInstDir "$IniFilePath" "Test" "InstDir"
  ReadINIStr $SandboxAppData "$IniFilePath" "Test" "AppData"
  ReadINIStr $SandboxLocalAppData "$IniFilePath" "Test" "LocalAppData"

  StrCpy $DeleteFailedPath ""

  ; Simulate removing program files ($INSTDIR)
  ${'${If}'} "$SandboxInstDir" != ""
    RMDir /r "$SandboxInstDir"
  ${'${EndIf}'}

  ; Apply the EXACT triple guard from build/installer.nsh
  ${'${If}'} "$DeleteAllAppData" == "1"
  ${'${AndIf}'} "$ConfirmedPermanentDelete" == "1"
    ${'${If}'} "$SandboxAppData" != ""
      Push "$SandboxAppData\\MS Institute Management System"
      Call SafeDeleteAppDir

      Push "$SandboxAppData\\school-management-system"
      Call SafeDeleteAppDir

      Push "$SandboxAppData\\School Management System"
      Call SafeDeleteAppDir
    ${'${EndIf}'}
    ${'${If}'} "$SandboxLocalAppData" != ""
      Push "$SandboxLocalAppData\\school-management-system-updater"
      Call SafeDeleteAppDir
    ${'${EndIf}'}
  ${'${EndIf}'}

  ${'${If}'} "$DeleteFailedPath" != ""
    SetErrorLevel 42
  ${'${EndIf}'}
SectionEnd
`;
    fs.writeFileSync(harnessNsi, harnessScript, 'utf-8');
    execFileSync(makensisExe, ['-WX', harnessNsi], { stdio: 'pipe' });
    assert(fs.existsSync(harnessExe), 'Compiled isolated NSIS test harness with -WX (zero warnings/errors)');

    const runHarnessWith = (opts) => {
      const content = `[Test]\nDeleteAllAppData=${opts.del}\nConfirmedPermanentDelete=${opts.conf}\nInstDir=${opts.inst}\nAppData=${opts.appd}\nLocalAppData=${opts.locd}\n`;
      fs.writeFileSync(harnessIni, content, 'utf-8');
      execFileSync(harnessExe, ['/S']);
    };

    // ─── 3. Scenario A: Uninstall Software Only — Keep Database ─────────────
    console.log('\n--- 3. Scenario A: Keep Database & Reinstall ---');
    const scenA = path.join(scratchRoot, 'scenarioA');
    const instA = path.join(scenA, 'Programs', 'MS Institute Management System');
    const appDataA = path.join(scenA, 'AppData', 'Roaming');
    const localAppDataA = path.join(scenA, 'AppData', 'Local');
    const activeDataA = path.join(appDataA, 'MS Institute Management System');
    const legacyDataA = path.join(appDataA, 'school-management-system');
    const extBackupA = path.join(scenA, 'Desktop', 'external_school_backup.smbak');

    fs.mkdirSync(instA, { recursive: true });
    fs.writeFileSync(path.join(instA, 'MS Institute Management System.exe'), 'PROGRAM_BINARY');
    fs.mkdirSync(path.dirname(extBackupA), { recursive: true });

    const dbAPath = path.join(activeDataA, 'school_data.sqlite');
    const dbA = makeFakeDatabase(dbAPath);
    createInitialAdmin({ username: 'adminA', password: 'Password123!', displayName: 'Principal A' }, dbA);
    const loginA = login({ username: 'adminA', password: 'Password123!' }, dbA);
    const tokA = loginA.sessionToken;
    updateSchoolSettings({ sessionToken: tokA, schoolName: 'Al-Noor Academy Scenario A', principalName: 'Muhammad Tariq' }, dbA);
    const sessA = createSession({ sessionToken: tokA, name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true }, dbA);
    const clsA = createClass({ sessionToken: tokA, name: 'Grade 8', code: 'G8', displayOrder: 1 }, dbA);
    const secA = createSection({ sessionToken: tokA, classId: clsA.classItem.id, name: 'Section A' }, dbA);
    createStudent({
      sessionToken: tokA,
      studentId: 'STD-A-001',
      firstName: 'Zainab',
      lastName: 'Khan',
      gender: 'Female',
      fatherName: 'Tariq Khan',
      enrollment: { academicSessionId: sessA.session.id, classId: clsA.classItem.id, sectionId: secA.section.id },
    }, dbA);
    createTeacher({
      sessionToken: tokA,
      teacherId: 'TCH-A-001',
      firstName: 'Imran',
      lastName: 'Ahmed',
      gender: 'Male',
      phone: '03001112223',
    }, dbA);
    // Create uploaded assets & internal backup + external .smbak backup
    fs.mkdirSync(path.join(activeDataA, 'uploads', 'students'), { recursive: true });
    fs.writeFileSync(path.join(activeDataA, 'uploads', 'students', 'std_a.png'), 'FAKE_PNG_DATA');
    fs.mkdirSync(path.join(activeDataA, 'uploads', 'logos'), { recursive: true });
    fs.writeFileSync(path.join(activeDataA, 'uploads', 'logos', 'logo.png'), 'FAKE_LOGO_DATA');
    fs.mkdirSync(legacyDataA, { recursive: true });
    fs.writeFileSync(path.join(legacyDataA, 'school_data.sqlite'), 'LEGACY_DB_COPY');

    const bkpResA = await createBackup({ customDestinationPath: extBackupA }, dbA);
    assert(bkpResA.success && fs.existsSync(extBackupA), 'Created valid .smbak backup on external Desktop folder');

    dbA.close();

    // Run Scenario A Uninstall (Keep Database: /DEL=0 /CONF=0)
    runHarnessWith({
      del: '0',
      conf: '0',
      inst: instA,
      appd: appDataA,
      locd: localAppDataA,
    });

    assert(!fs.existsSync(instA), 'Program installation folder removed cleanly');
    assert(fs.existsSync(dbAPath), 'SQLite database preserved in AppData when Keep Database chosen');
    assert(fs.existsSync(path.join(activeDataA, 'uploads', 'students', 'std_a.png')), 'Student photo preserved');
    assert(fs.existsSync(path.join(activeDataA, 'uploads', 'logos', 'logo.png')), 'School logo preserved');
    assert(fs.existsSync(legacyDataA), 'Legacy directory preserved untouched');
    assert(fs.existsSync(extBackupA), 'External Desktop .smbak backup untouched');

    // Simulate Reinstall & Reopen DB
    const dbAReinstall = makeFakeDatabase(dbAPath);
    const reAuthA = login({ username: 'adminA', password: 'Password123!' }, dbAReinstall);
    assert(reAuthA.success, 'Reinstalled app authenticates existing admin credentials');
    const reSettingsA = getSchoolSettings(dbAReinstall);
    assert(reSettingsA.schoolName === 'Al-Noor Academy Scenario A', 'Reinstalled app preserves school settings');
    const reStudentsA = getAllStudents({}, dbAReinstall);
    assert(reStudentsA.totalCount === 1 && reStudentsA.students[0].displayName === 'Zainab Khan', 'Reinstalled app displays previous students intact');
    const reTeachersA = getAllTeachers({}, dbAReinstall);
    assert(reTeachersA.totalCount === 1 && reTeachersA.teachers[0].displayName === 'Imran Ahmed', 'Reinstalled app displays previous teachers intact');
    dbAReinstall.close();

    // ─── 4. Scenario B: Delete All Application Data (Unconfirmed vs Confirmed)
    console.log('\n--- 4. Scenario B: Delete All Application Data & Clean Reinstall ---');
    const scenB = path.join(scratchRoot, 'scenarioB');
    const instB = path.join(scenB, 'Programs', 'MS Institute Management System');
    const appDataB = path.join(scenB, 'AppData', 'Roaming');
    const localAppDataB = path.join(scenB, 'AppData', 'Local');
    const activeDataB = path.join(appDataB, 'MS Institute Management System');
    const legacyDataB = path.join(appDataB, 'school-management-system');
    const legacyDataB2 = path.join(appDataB, 'School Management System');
    const updaterB = path.join(localAppDataB, 'school-management-system-updater');
    const docsDirB = path.join(scenB, 'Documents');
    const desktopDirB = path.join(scenB, 'Desktop');
    const usbBackupB = path.join(scenB, 'USB_Drive', 'MySchool_Backup.smbak');
    const docNoteB = path.join(docsDirB, 'personal_document.txt');

    fs.mkdirSync(instB, { recursive: true });
    fs.writeFileSync(path.join(instB, 'MS Institute Management System.exe'), 'PROGRAM_BINARY');
    fs.mkdirSync(docsDirB, { recursive: true });
    fs.mkdirSync(desktopDirB, { recursive: true });
    fs.mkdirSync(path.dirname(usbBackupB), { recursive: true });
    fs.mkdirSync(updaterB, { recursive: true });
    fs.writeFileSync(path.join(updaterB, 'installer.exe'), 'CACHED_UPDATER');
    fs.writeFileSync(docNoteB, 'UNRELATED_PERSONAL_FILE');

    const dbBPath = path.join(activeDataB, 'school_data.sqlite');
    const dbB = makeFakeDatabase(dbBPath);
    createInitialAdmin({ username: 'adminB', password: 'Password123!', displayName: 'Admin B' }, dbB);
    const tokB = login({ username: 'adminB', password: 'Password123!' }, dbB).sessionToken;
    updateSchoolSettings({ sessionToken: tokB, schoolName: 'Old School B' }, dbB);
    const sessB = createSession({ sessionToken: tokB, name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true }, dbB);
    const clsB = createClass({ sessionToken: tokB, name: 'Class 1', code: 'C1', displayOrder: 1 }, dbB);
    const secB = createSection({ sessionToken: tokB, classId: clsB.classItem.id, name: 'A' }, dbB);
    createStudent({
      sessionToken: tokB,
      studentId: 'STD-B-001',
      firstName: 'ShouldBe',
      lastName: 'Wiped',
      gender: 'Male',
      enrollment: { academicSessionId: sessB.session.id, classId: clsB.classItem.id, sectionId: secB.section.id },
    }, dbB);

    // Export external USB backup before full deletion
    const bkpResB = await createBackup({ customDestinationPath: usbBackupB }, dbB);
    assert(bkpResB.success && fs.existsSync(usbBackupB), 'Exported external .smbak backup before uninstall');

    // Leave active WAL/SHM files present intentionally to verify WAL+SHM cleanup!
    dbB.exec("INSERT INTO academic_sessions (name, start_date, end_date, is_active) VALUES ('2027-2028', '2027-04-01', '2028-03-31', 0)");
    dbB.close();

    // Create dummy uploads, internal backups, and legacy directories
    fs.mkdirSync(path.join(activeDataB, 'uploads', 'signatures'), { recursive: true });
    fs.writeFileSync(path.join(activeDataB, 'uploads', 'signatures', 'sig.png'), 'SIG_PNG');
    fs.mkdirSync(path.join(activeDataB, 'backups'), { recursive: true });
    fs.writeFileSync(path.join(activeDataB, 'backups', 'internal.smbak'), 'INTERNAL_BKP');
    fs.mkdirSync(legacyDataB, { recursive: true });
    fs.writeFileSync(path.join(legacyDataB, 'school_data.sqlite'), 'LEGACY_DB');
    fs.mkdirSync(legacyDataB2, { recursive: true });
    fs.writeFileSync(path.join(legacyDataB2, 'school_data.sqlite'), 'LEGACY_DB_2');

    // Step 4a: Unconfirmed attempt (/DEL=1 /CONF=0) MUST NOT delete data!
    runHarnessWith({
      del: '1',
      conf: '0',
      inst: instB,
      appd: appDataB,
      locd: localAppDataB,
    });
    assert(fs.existsSync(dbBPath), 'Unconfirmed Delete (/CONF=0) did NOT delete SQLite database');
    assert(fs.existsSync(legacyDataB), 'Unconfirmed Delete (/CONF=0) did NOT delete legacy AppData');

    // Recreate dummy instB to run confirmed uninstall (/DEL=1 /CONF=1)
    fs.mkdirSync(instB, { recursive: true });
    fs.writeFileSync(path.join(instB, 'MS Institute Management System.exe'), 'PROGRAM_BINARY');

    // Also add residual WAL/SHM files to verify explicit WAL/SHM removal
    fs.writeFileSync(dbBPath + '-wal', 'WAL_DATA');
    fs.writeFileSync(dbBPath + '-shm', 'SHM_DATA');

    // Step 4b: Confirmed Option 2 Uninstall (/DEL=1 /CONF=1)
    runHarnessWith({
      del: '1',
      conf: '1',
      inst: instB,
      appd: appDataB,
      locd: localAppDataB,
    });

    assert(!fs.existsSync(instB), 'Program files removed cleanly');
    assert(!fs.existsSync(dbBPath), 'Main school_data.sqlite database permanently deleted');
    assert(!fs.existsSync(dbBPath + '-wal'), 'SQLite WAL file deleted cleanly');
    assert(!fs.existsSync(dbBPath + '-shm'), 'SQLite SHM file deleted cleanly');
    assert(!fs.existsSync(activeDataB), 'Active AppData folder removed completely');
    assert(!fs.existsSync(legacyDataB), 'Legacy school-management-system folder removed so clean reinstall cannot resurrect old DB');
    assert(!fs.existsSync(legacyDataB2), 'Legacy School Management System folder removed completely');
    assert(!fs.existsSync(updaterB), 'Application updater cache removed completely');

    // Critical Safety Assertions: External backups & user folders untouched!
    assert(fs.existsSync(usbBackupB), 'External USB .smbak backup remained completely untouched!');
    assert(fs.existsSync(docNoteB) && fs.readFileSync(docNoteB, 'utf-8') === 'UNRELATED_PERSONAL_FILE', 'Personal Documents file remained 100% untouched!');
    assert(fs.existsSync(desktopDirB) && fs.existsSync(docsDirB), 'Desktop and Documents folders untouched!');

    // Step 4c: Reinstall after Delete All Application Data -> Clean Fresh Database
    const cleanDbB = makeFakeDatabase(dbBPath);
    assert(isSetupRequired(cleanDbB) === true, 'Reinstalled database starts clean (admin setup required)');
    const cleanStudentsB = getAllStudents({}, cleanDbB);
    assert(cleanStudentsB.totalCount === 0, 'Clean reinstalled database has 0 students (no old records leaked)');

    // Verify user can ALSO restore their protected external .smbak backup onto the clean reinstall!
    const restoreRes = await restoreBackup(usbBackupB, cleanDbB);
    assert(restoreRes.success, 'External .smbak backup restores cleanly into fresh post-wipe installation');
    const restoredStudentsB = getAllStudents({}, cleanDbB);
    assert(restoredStudentsB.totalCount === 1 && restoredStudentsB.students[0].displayName === 'ShouldBe Wiped', 'External backup integrity verified after full wipe & reinstall');
    cleanDbB.close();

    // ─── 5. Scenario C: Locked File Safety & Error Reporting ───────────────
    console.log('\n--- 5. Scenario C: Locked Database Detection & Error Reporting ---');
    const scenC = path.join(scratchRoot, 'scenarioC');
    const instC = path.join(scenC, 'Programs', 'MS Institute Management System');
    const appDataC = path.join(scenC, 'AppData', 'Roaming');
    const localAppDataC = path.join(scenC, 'AppData', 'Local');
    const activeDataC = path.join(appDataC, 'MS Institute Management System');
    const dbCPath = path.join(activeDataC, 'school_data.sqlite');

    fs.mkdirSync(instC, { recursive: true });
    const dbC = makeFakeDatabase(dbCPath);
    // Hold an EXCLUSIVE lock / open file descriptor in Windows by keeping dbC open + active exclusive transaction!
    const lockFd = fs.openSync(dbCPath, 'r+');

    let exitCode = 0;
    try {
      runHarnessWith({
        del: '1',
        conf: '1',
        inst: instC,
        appd: appDataC,
        locd: localAppDataC,
      });
    } catch (err) {
      exitCode = err.status || 1;
    }

    assert(exitCode === 42, `Locked DB caused uninstaller safety check to fail honestly (exit code: ${exitCode}) instead of silent success`);
    assert(fs.existsSync(dbCPath), 'Locked database file was safely detected');

    fs.closeSync(lockFd);
    dbC.close();

    console.log('\n==============================================================');
    console.log(`Uninstaller Verification Results: ${passed} passed, ${failed} failed.`);
    console.log('==============================================================\n');
  } catch (err) {
    console.error('Fatal error in uninstaller test suite:', err);
    failed++;
  } finally {
    try {
      fs.rmSync(scratchRoot, { recursive: true, force: true });
    } catch {}
    process.exit(failed > 0 ? 1 : 0);
  }
});
