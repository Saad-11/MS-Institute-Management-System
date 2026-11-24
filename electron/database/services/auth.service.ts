/**
 * Authentication and User Management Service
 * 
 * Manages administrator setup, local authentication, password verification,
 * and secure in-memory sessions in the Electron main process.
 */

import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { hashPassword, verifyPassword, checkLoginThrottling, recordFailedLogin, recordSuccessfulLogin } from '../security';

export interface SafeUser {
  id: number;
  username: string;
  displayName: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'admin';
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SessionData {
  sessionToken: string;
  user: SafeUser;
  createdAt: number;
}

// In-memory active sessions map (never persisted to disk)
const activeSessions = new Map<string, SessionData>();

function mapUserRowToSafe(row: UserRow): SafeUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Checks if the system requires first-run administrator account setup.
 * Returns true if no administrator user exists.
 */
export function isSetupRequired(db?: Database.Database): boolean {
  const database = db ?? getDatabase();
  const stmt = database.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  const result = stmt.get() as { count: number };
  return result.count === 0;
}

/**
 * Creates the initial administrator account during first-run setup.
 * Rejects if an administrator already exists or if inputs fail validation.
 */
export function createInitialAdmin(
  params: { username: string; displayName: string; password: string },
  db?: Database.Database
): { success: boolean; user?: SafeUser; error?: string } {
  const database = db ?? getDatabase();

  const username = (params.username || '').trim();
  const displayName = (params.displayName || '').trim();
  const password = params.password || '';

  // Validation
  if (!displayName || displayName.length < 2 || displayName.length > 100) {
    return { success: false, error: 'Full name must be between 2 and 100 characters.' };
  }

  const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return {
      success: false,
      error: 'Username must be 3-30 characters and contain only letters, numbers, hyphens, or underscores.',
    };
  }

  if (password.length < 12) {
    return {
      success: false,
      error: 'Password must be at least 12 characters long for administrator security.',
    };
  }

  // Check if admin already exists
  if (!isSetupRequired(database)) {
    return {
      success: false,
      error: 'Administrator account already exists. Please log in instead.',
    };
  }

  // Check duplicate username
  const existingUser = database
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .get(username);
  if (existingUser) {
    return { success: false, error: 'This username is already taken. Please choose another.' };
  }

  try {
    const passwordHash = hashPassword(password);

    const insertStmt = database.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
    `);

    const result = insertStmt.run(username, passwordHash, displayName);
    const userId = Number(result.lastInsertRowid);

    const createdRow = database
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow;

    console.log(`[Auth] Initial administrator created: ${username} (ID: ${userId})`);

    return {
      success: true,
      user: mapUserRowToSafe(createdRow),
    };
  } catch (err: unknown) {
    console.error('[Auth] Failed to create initial admin:', err);
    return { success: false, error: 'Failed to create administrator account. Please try again.' };
  }
}

/**
 * Authenticates a user and returns a session token if valid.
 */
export function login(
  params: { username: string; password: string },
  db?: Database.Database
): { success: boolean; sessionToken?: string; user?: SafeUser; error?: string } {
  const database = db ?? getDatabase();
  const username = (params.username || '').trim();
  const password = params.password || '';

  if (!username || !password) {
    return { success: false, error: 'Please enter both username and password.' };
  }

  // Check rate limiting
  const throttleCheck = checkLoginThrottling(username.toLowerCase());
  if (!throttleCheck.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Please wait ${throttleCheck.remainingLockoutSeconds} seconds before trying again.`,
    };
  }

  // Generic invalid credentials message (prevents username enumeration)
  const INVALID_CREDENTIALS_MSG = 'Username or password is incorrect.';

  const userRow = database
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .get(username) as UserRow | undefined;

  if (!userRow) {
    const lockStatus = recordFailedLogin(username.toLowerCase());
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for ${lockStatus.remainingLockoutSeconds} seconds.`,
      };
    }
    return { success: false, error: INVALID_CREDENTIALS_MSG };
  }

  if (userRow.is_active !== 1) {
    return {
      success: false,
      error: 'This account has been deactivated. Please contact support.',
    };
  }

  const isPasswordValid = verifyPassword(password, userRow.password_hash);
  if (!isPasswordValid) {
    const lockStatus = recordFailedLogin(username.toLowerCase());
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for ${lockStatus.remainingLockoutSeconds} seconds.`,
      };
    }
    return { success: false, error: INVALID_CREDENTIALS_MSG };
  }

  // Successful login
  recordSuccessfulLogin(username.toLowerCase());

  // Update last login timestamp
  database
    .prepare("UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(userRow.id);

  // Generate secure in-memory session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const safeUser = mapUserRowToSafe(userRow);
  safeUser.lastLoginAt = new Date().toISOString();

  activeSessions.set(sessionToken, {
    sessionToken,
    user: safeUser,
    createdAt: Date.now(),
  });

  console.log(`[Auth] User logged in: ${username} (Session created)`);

  return {
    success: true,
    sessionToken,
    user: safeUser,
  };
}

/**
 * Validates an active session token and returns the authenticated user.
 */
export function verifySession(sessionToken?: string): { isValid: boolean; user?: SafeUser } {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { isValid: false };
  }

  const session = activeSessions.get(sessionToken);
  if (!session) {
    return { isValid: false };
  }

  return { isValid: true, user: session.user };
}

/**
 * Terminates an active session.
 */
export function logout(sessionToken?: string): { success: boolean } {
  if (sessionToken && activeSessions.has(sessionToken)) {
    activeSessions.delete(sessionToken);
    console.log('[Auth] Session terminated');
  }
  return { success: true };
}

/**
 * Clears all active sessions (e.g. on application exit).
 */
export function clearAllSessions(): void {
  activeSessions.clear();
}
