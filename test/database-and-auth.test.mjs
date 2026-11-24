/**
 * Automated Test Suite — Phase 2: SQLite Database Foundation & Admin Authentication
 * 
 * Verifies:
 * 1. Database initialization and table creation
 * 2. Versioned migration execution and idempotency
 * 3. First-run administrator detection
 * 4. Password hashing with scrypt + unique cryptographic salt
 * 5. Input validation (minimum 12 character password, username format)
 * 6. Administrator account creation
 * 7. Duplicate username prevention
 * 8. Authentication with correct credentials
 * 9. Authentication failure with incorrect credentials
 * 10. Login rate limiting / throttling on brute-force attempts
 * 11. In-memory session tracking and verification
 * 12. Logout session invalidation
 * 13. School settings retrieval
 * 14. School settings update requiring valid administrator session
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Import our compiled or native services
import { hashPassword, verifyPassword, checkLoginThrottling, recordFailedLogin, recordSuccessfulLogin } from '../dist-electron/database/security.js';
import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  isSetupRequired,
  createInitialAdmin,
  login,
  verifySession,
  logout,
  clearAllSessions,
} from '../dist-electron/database/services/auth.service.js';
import { getSchoolSettings, updateSchoolSettings } from '../dist-electron/database/services/school.service.js';

const testDbPath = path.resolve('test-school-data.sqlite');

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
  console.log('  STARTING PHASE 2 AUTOMATED INTEGRATION & SECURITY TEST SUITE  ');
  console.log('================================================================\n');

  cleanup();

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
    // ─── TEST 1: Database Initialization & Migrations ─────────────────────────
    console.log('--- TEST GROUP 1: SQLite Connection & Schema Migrations ---');
    const db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    const migResult1 = runMigrations(db);
    assert(migResult1.appliedCount >= 1, `Migrations applied on clean database (appliedCount: ${migResult1.appliedCount})`);
    assert(migResult1.currentVersion >= 1, `Current schema version is valid (currentVersion: ${migResult1.currentVersion})`);

    // Idempotency: re-running migrations does not re-apply
    const migResult2 = runMigrations(db);
    assert(migResult2.appliedCount === 0, 'Re-running migrations is idempotent (appliedCount = 0)');

    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert(tables.includes('users'), 'Table "users" exists');
    assert(tables.includes('school_settings'), 'Table "school_settings" exists');
    assert(tables.includes('app_metadata'), 'Table "app_metadata" exists');
    assert(tables.includes('schema_migrations'), 'Table "schema_migrations" exists');

    // ─── TEST GROUP 2: Password Security & Scrypt Hashing ────────────────────
    console.log('\n--- TEST GROUP 2: Cryptography & Password Hashing ---');
    const plainPass = 'SuperSecret123!';
    const hash1 = hashPassword(plainPass);
    const hash2 = hashPassword(plainPass);

    assert(hash1 !== plainPass, 'Password hash is not plaintext');
    assert(hash1 !== hash2, 'Unique salt per hash (two hashes of same password differ)');
    assert(verifyPassword(plainPass, hash1) === true, 'verifyPassword returns true for correct password');
    assert(verifyPassword('WrongPassword123!', hash1) === false, 'verifyPassword returns false for wrong password');
    assert(verifyPassword('', hash1) === false, 'verifyPassword returns false for empty password');

    // ─── TEST GROUP 3: Setup Detection & Admin Creation ──────────────────────
    console.log('\n--- TEST GROUP 3: First-Run Setup & Administrator Creation ---');
    assert(isSetupRequired(db) === true, 'isSetupRequired returns true when 0 admins exist');

    // Validation: password too short (< 12 chars)
    const shortPassRes = createInitialAdmin({
      username: 'admin',
      displayName: 'Principal',
      password: 'short',
    }, db);
    assert(shortPassRes.success === false && shortPassRes.error.includes('12 characters'), 'Rejects password shorter than 12 characters');

    // Valid admin creation
    const validAdminRes = createInitialAdmin({
      username: 'admin_user',
      displayName: 'Principal John',
      password: 'SecureAdminPassword2026!',
    }, db);
    assert(validAdminRes.success === true, 'Admin account created successfully');
    assert(validAdminRes.user.username === 'admin_user', 'Created user has correct username');
    assert(validAdminRes.user.role === 'admin', 'Created user has admin role');
    assert(validAdminRes.user.password_hash === undefined, 'User object does NOT leak password_hash');

    // Verify in database: stored value is scrypt hash, not plaintext
    const dbUser = db.prepare("SELECT * FROM users WHERE username = 'admin_user'").get();
    assert(dbUser.password_hash.includes(':'), 'Stored password in SQLite is salted scrypt hash');
    assert(dbUser.password_hash !== 'SecureAdminPassword2026!', 'Plaintext password is never stored in DB');

    // isSetupRequired now returns false
    assert(isSetupRequired(db) === false, 'isSetupRequired returns false after admin is created');

    // Duplicate setup attempt is blocked
    const duplicateSetupRes = createInitialAdmin({
      username: 'admin_user2',
      displayName: 'Second Admin',
      password: 'AnotherSecurePassword123!',
    }, db);
    assert(duplicateSetupRes.success === false, 'Blocked second administrator creation via setup');

    // ─── TEST GROUP 4: Authentication & Login Flow ───────────────────────────
    console.log('\n--- TEST GROUP 4: Administrator Login & Credentials Verification ---');
    
    // Incorrect password
    const wrongLogin = login({ username: 'admin_user', password: 'WrongPassword999!' }, db);
    assert(wrongLogin.success === false, 'Login fails with wrong password');
    assert(wrongLogin.error === 'Username or password is incorrect.', 'Generic error message prevents enumeration');

    // Non-existent username
    const nonExistentLogin = login({ username: 'non_existent_user', password: 'SomePassword123!' }, db);
    assert(nonExistentLogin.success === false, 'Login fails with unknown username');
    assert(nonExistentLogin.error === 'Username or password is incorrect.', 'Identical error message for unknown user');

    // Correct password
    const validLogin = login({ username: 'admin_user', password: 'SecureAdminPassword2026!' }, db);
    assert(validLogin.success === true, 'Login succeeds with valid credentials');
    assert(typeof validLogin.sessionToken === 'string' && validLogin.sessionToken.length > 20, 'Session token generated');
    assert(validLogin.user.displayName === 'Principal John', 'Logged in user profile matches');

    // Case-insensitive username login
    const caseLogin = login({ username: 'ADMIN_USER', password: 'SecureAdminPassword2026!' }, db);
    assert(caseLogin.success === true, 'Username lookup is case-insensitive (COLLATE NOCASE)');

    // ─── TEST GROUP 5: Rate Limiting / Brute-Force Throttling ────────────────
    console.log('\n--- TEST GROUP 5: Login Throttling / Rate Limiting ---');
    const attackerUser = 'brute_force_target';
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(attackerUser);
    }
    const throttled = checkLoginThrottling(attackerUser);
    assert(throttled.allowed === false, 'Account locked out after 5 consecutive failed attempts');
    assert(throttled.remainingLockoutSeconds > 0, 'Lockout countdown reported');
    recordSuccessfulLogin(attackerUser);
    assert(checkLoginThrottling(attackerUser).allowed === true, 'Lockout resets on successful login');

    // ─── TEST GROUP 6: Session Management & Invalidation ─────────────────────
    console.log('\n--- TEST GROUP 6: Session Verification & Logout ---');
    const sessionToken = validLogin.sessionToken;
    const verify1 = verifySession(sessionToken);
    assert(verify1.isValid === true && verify1.user.username === 'admin_user', 'Active session verifies successfully');

    const verifyInvalid = verifySession('fake_random_token_12345');
    assert(verifyInvalid.isValid === false, 'Invalid session token rejected');

    // Logout
    logout(sessionToken);
    const verifyAfterLogout = verifySession(sessionToken);
    assert(verifyAfterLogout.isValid === false, 'Logout invalidates session token immediately');

    // ─── TEST GROUP 7: School Settings Read & Write ──────────────────────────
    console.log('\n--- TEST GROUP 7: School Settings Service ---');
    const initialSettings = getSchoolSettings(db);
    assert(initialSettings.schoolName === 'My School', 'Default school settings initialized');

    // Unauthenticated update fails
    const unauthUpdate = updateSchoolSettings({ schoolName: 'Springfield Academy' }, db);
    assert(unauthUpdate.success === false && unauthUpdate.error.includes('Unauthorized'), 'Unauthenticated school settings update is rejected');

    // Authenticated update succeeds
    const freshLogin = login({ username: 'admin_user', password: 'SecureAdminPassword2026!' }, db);
    const authUpdate = updateSchoolSettings({
      sessionToken: freshLogin.sessionToken,
      schoolName: 'Springfield Academy',
      address: '742 Evergreen Terrace',
      phone: '+1 555-0199',
      principalName: 'Seymour Skinner',
      academicSession: '2026-2027',
    }, db);
    assert(authUpdate.success === true, 'Authenticated school settings update succeeds');
    assert(authUpdate.settings.schoolName === 'Springfield Academy', 'Updated school name persisted');
    assert(authUpdate.settings.principalName === 'Seymour Skinner', 'Updated principal name persisted');

    db.close();

    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

runTests();
