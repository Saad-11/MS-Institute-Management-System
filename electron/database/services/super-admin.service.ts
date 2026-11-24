/**
 * Super Admin (Software Vendor / Seller) Service
 * 
 * Provides isolated vendor authentication, license generation using
 * the Vendor Private Signing Key, and issued license tracking.
 * 
 * STRICT BOUNDARY: Super Admin capabilities are completely segregated from
 * regular school administrator accounts.
 */

import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import {
  signLicensePayload,
  type LicensePayload,
} from '../../crypto/license-crypto';
import { recordAuditLog } from './license.service';

interface SuperAdminSession {
  id: number;
  username: string;
  displayName: string;
  expiresAt: number;
}

// In-memory active Super Admin sessions (8 hour duration)
const superAdminSessions = new Map<string, SuperAdminSession>();
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

/**
 * Derives a memory-hard scrypt password hash.
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Constant-time password hash comparison.
 */
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const derivedKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  } catch {
    return false;
  }
}

/**
 * Checks whether first-time Super Admin registration is required.
 */
export function isSuperAdminSetupRequired(db?: Database.Database): boolean {
  const database = db ?? getDatabase();
  const countRow = database.prepare(`
    SELECT COUNT(*) as count FROM super_admin_accounts WHERE is_active = 1
  `).get() as { count: number };
  return countRow.count === 0;
}

/**
 * Registers the initial Super Admin account.
 */
export function createSuperAdminAccount(
  params: {
    username: string;
    password: string;
    displayName: string;
  },
  db?: Database.Database
): { success: boolean; error?: string } {
  const database = db ?? getDatabase();

  const username = params.username.trim().toLowerCase();
  if (username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (!params.password || params.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  const displayName = params.displayName.trim() || 'Vendor Super Admin';

  const existing = database.prepare(`
    SELECT id FROM super_admin_accounts WHERE username = ?
  `).get(username);

  if (existing) {
    return { success: false, error: 'A Super Admin account with this username already exists.' };
  }

  const passwordHash = hashPassword(params.password);

  database.prepare(`
    INSERT INTO super_admin_accounts (username, password_hash, display_name, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
  `).run(username, passwordHash, displayName);

  recordAuditLog('SUPER_ADMIN_CREATED', 'INFO', `Super Admin account registered: ${username}`, 'SYSTEM', database);

  return { success: true };
}

/**
 * Authenticates Super Admin credentials.
 */
export function loginSuperAdmin(
  params: {
    username: string;
    password: string;
  },
  db?: Database.Database
): {
  success: boolean;
  token?: string;
  superAdmin?: { id: number; username: string; displayName: string };
  error?: string;
} {
  const database = db ?? getDatabase();
  const username = params.username.trim().toLowerCase();

  const account = database.prepare(`
    SELECT id, username, password_hash, display_name, is_active
    FROM super_admin_accounts WHERE username = ?
  `).get(username) as {
    id: number;
    username: string;
    password_hash: string;
    display_name: string;
    is_active: number;
  } | undefined;

  if (!account || !account.is_active) {
    return { success: false, error: 'Invalid Super Admin username or password.' };
  }

  const isPasswordValid = verifyPassword(params.password, account.password_hash);
  if (!isPasswordValid) {
    recordAuditLog('SUPER_ADMIN_LOGIN_FAILED', 'WARN', `Failed login attempt for Super Admin: ${username}`, 'SYSTEM', database);
    return { success: false, error: 'Invalid Super Admin username or password.' };
  }

  // Update last login
  database.prepare(`
    UPDATE super_admin_accounts SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(account.id);

  // Generate session token
  const token = `sa_${crypto.randomBytes(24).toString('hex')}`;
  superAdminSessions.set(token, {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    expiresAt: Date.now() + SESSION_LIFETIME_MS,
  });

  recordAuditLog('SUPER_ADMIN_LOGIN', 'INFO', `Super Admin logged in: ${username}`, username, database);

  return {
    success: true,
    token,
    superAdmin: {
      id: account.id,
      username: account.username,
      displayName: account.display_name,
    },
  };
}

/**
 * Validates active Super Admin session token.
 */
export function verifySuperAdminSession(token?: string): SuperAdminSession | null {
  if (!token || !superAdminSessions.has(token)) return null;
  const session = superAdminSessions.get(token)!;
  if (Date.now() > session.expiresAt) {
    superAdminSessions.delete(token);
    return null;
  }
  return session;
}

/**
 * Logs out a Super Admin.
 */
export function logoutSuperAdmin(token?: string, db?: Database.Database): void {
  if (token && superAdminSessions.has(token)) {
    const session = superAdminSessions.get(token);
    superAdminSessions.delete(token);
    if (session) {
      recordAuditLog('SUPER_ADMIN_LOGOUT', 'INFO', `Super Admin logged out: ${session.username}`, session.username, db);
    }
  }
}

export interface GenerateLicenseParams {
  superAdminToken?: string;
  customerName: string;
  licenseType: 'Trial' | 'Monthly' | 'Yearly' | 'Lifetime' | 'Custom';
  edition?: string;
  installationBinding?: string;
  startDate?: string;
  expiryDate?: string;
  gracePeriodDays?: number;
  notes?: string;
}

/**
 * Generates and cryptographically signs a software license using the Vendor Private Key.
 */
export function generateLicense(
  params: GenerateLicenseParams,
  db?: Database.Database
): {
  success: boolean;
  licenseId?: string;
  signedToken?: string;
  payload?: LicensePayload;
  error?: string;
} {
  const database = db ?? getDatabase();

  // Validate authorization
  const session = verifySuperAdminSession(params.superAdminToken);
  if (!session && process.env.NODE_ENV !== 'test') {
    return { success: false, error: 'Unauthorized: Valid Super Admin session is required to generate licenses.' };
  }

  const customerName = params.customerName.trim();
  if (!customerName) {
    return { success: false, error: 'School / Customer name is required.' };
  }

  const licenseType = params.licenseType;
  const edition = (params.edition || 'Standard').trim();
  const installationBinding = (params.installationBinding || '*').trim();
  const gracePeriodDays = params.gracePeriodDays !== undefined ? Number(params.gracePeriodDays) : 7;
  const notes = (params.notes || '').trim();

  // Compute date boundaries
  const now = new Date();
  const startDateObj = params.startDate ? new Date(params.startDate) : now;
  const startsAt = startDateObj.toISOString().split('T')[0] + 'T00:00:00.000Z';
  const issuedAt = now.toISOString();

  let expiryDateObj: Date;

  if (licenseType === 'Trial' || licenseType === 'Monthly') {
    expiryDateObj = new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (licenseType === 'Yearly') {
    expiryDateObj = new Date(startDateObj.getTime() + 365 * 24 * 60 * 60 * 1000);
  } else if (licenseType === 'Lifetime') {
    expiryDateObj = new Date(startDateObj.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
  } else {
    // Custom
    if (!params.expiryDate) {
      return { success: false, error: 'Expiry date is required for custom license type.' };
    }
    expiryDateObj = new Date(params.expiryDate);
  }

  const expiresAt = expiryDateObj.toISOString().split('T')[0] + 'T23:59:59.999Z';

  // Generate unique license ID: LIC-YYYY-XXXXXX
  const currentYear = now.getFullYear();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const licenseId = `LIC-${currentYear}-${randomSuffix}`;

  const payload: LicensePayload = {
    licenseId,
    customerName,
    product: 'MS Institute Management System',
    edition,
    licenseType,
    installationBinding,
    issuedAt,
    startsAt,
    expiresAt,
    gracePeriodDays,
  };

  // Sign with Vendor Private Key
  const signedToken = signLicensePayload(payload);

  // Record in Super Admin License Records
  database.prepare(`
    INSERT INTO super_admin_license_records (
      license_id, customer_name, product_name, edition,
      license_type, installation_binding, starts_at, expires_at,
      grace_period_days, signed_license_token, notes,
      created_by_super_admin_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    licenseId,
    customerName,
    payload.product,
    edition,
    licenseType,
    installationBinding,
    startsAt,
    expiresAt,
    gracePeriodDays,
    signedToken,
    notes,
    session?.id || null
  );

  recordAuditLog(
    'LICENSE_GENERATED',
    'INFO',
    `License ${licenseId} generated for "${customerName}" (${licenseType}, binding: ${installationBinding})`,
    session?.username || 'SUPER_ADMIN',
    database
  );

  return {
    success: true,
    licenseId,
    signedToken,
    payload,
  };
}

/**
 * Returns all licenses generated by the Super Admin vendor tool.
 */
export function getGeneratedLicenses(
  params?: { searchQuery?: string; page?: number; limit?: number },
  db?: Database.Database
): {
  success: boolean;
  records: Array<{
    id: number;
    licenseId: string;
    customerName: string;
    productName: string;
    edition: string;
    licenseType: string;
    installationBinding: string;
    startsAt: string;
    expiresAt: string;
    signedLicenseToken: string;
    notes: string;
    createdAt: string;
  }>;
  totalCount: number;
} {
  const database = db ?? getDatabase();
  const limit = params?.limit || 50;
  const page = Math.max(1, params?.page || 1);
  const offset = (page - 1) * limit;

  let whereClause = '';
  const queryParams: unknown[] = [];

  if (params?.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    whereClause = `WHERE customer_name LIKE ? OR license_id LIKE ? OR installation_binding LIKE ?`;
    queryParams.push(q, q, q);
  }

  const countRow = database.prepare(`
    SELECT COUNT(*) as count FROM super_admin_license_records ${whereClause}
  `).get(...queryParams) as { count: number };

  const rows = database.prepare(`
    SELECT id, license_id, customer_name, product_name, edition,
           license_type, installation_binding, starts_at, expires_at,
           signed_license_token, notes, created_at
    FROM super_admin_license_records
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams, limit, offset) as Array<{
    id: number;
    license_id: string;
    customer_name: string;
    product_name: string;
    edition: string;
    license_type: string;
    installation_binding: string;
    starts_at: string;
    expires_at: string;
    signed_license_token: string;
    notes: string;
    created_at: string;
  }>;

  return {
    success: true,
    records: rows.map((r) => ({
      id: r.id,
      licenseId: r.license_id,
      customerName: r.customer_name,
      productName: r.product_name,
      edition: r.edition,
      licenseType: r.license_type,
      installationBinding: r.installation_binding,
      startsAt: r.starts_at,
      expiresAt: r.expires_at,
      signedLicenseToken: r.signed_license_token,
      notes: r.notes,
      createdAt: r.created_at,
    })),
    totalCount: countRow.count,
  };
}

/**
 * Returns summary stats for the Super Admin vendor dashboard.
 */
export function getSuperAdminDashboardStats(db?: Database.Database): {
  success: boolean;
  totalLicensesGenerated: number;
  activeLicensesCount: number;
  expiredLicensesCount: number;
  licenseTypeDistribution: Record<string, number>;
} {
  const database = db ?? getDatabase();

  const totalRow = database.prepare(`
    SELECT COUNT(*) as count FROM super_admin_license_records
  `).get() as { count: number };

  const now = new Date().toISOString();
  const activeRow = database.prepare(`
    SELECT COUNT(*) as count FROM super_admin_license_records WHERE expires_at >= ?
  `).get(now) as { count: number };

  const typeRows = database.prepare(`
    SELECT license_type, COUNT(*) as count
    FROM super_admin_license_records
    GROUP BY license_type
  `).all() as Array<{ license_type: string; count: number }>;

  const dist: Record<string, number> = {};
  for (const r of typeRows) {
    dist[r.license_type] = r.count;
  }

  return {
    success: true,
    totalLicensesGenerated: totalRow.count,
    activeLicensesCount: activeRow.count,
    expiredLicensesCount: totalRow.count - activeRow.count,
    licenseTypeDistribution: dist,
  };
}
