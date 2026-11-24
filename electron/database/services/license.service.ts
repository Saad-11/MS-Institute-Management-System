/**
 * Offline License Management Service
 * 
 * Manages installation identification, machine binding, offline license
 * activation, cryptographic validation, and tamper detection.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import {
  verifyLicenseSignature,
  generateMachineBinding,
  type LicensePayload,
} from '../../crypto/license-crypto';

export type LicenseStatus =
  | 'Valid'
  | 'Not Yet Active'
  | 'Expired'
  | 'Invalid Signature'
  | 'Wrong Product'
  | 'Wrong Installation'
  | 'Corrupted'
  | 'Unlicensed';

export interface LicenseStatusInfo {
  status: LicenseStatus;
  installationId: string;
  isClockTampered: boolean;
  isValid?: boolean;
  isExpired?: boolean;
  isInGracePeriod?: boolean;
  licenseId?: string;
  customerName?: string;
  productName?: string;
  edition?: string;
  licenseType?: string;
  issuedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  gracePeriodDays?: number;
  daysRemaining?: number;
  isNearExpiry?: boolean;
  message?: string;
  error?: string;
}

export interface InstallationIdentity {
  installationId: string;
  machineFingerprint: string;
  firstInstalledAt: string;
  lastValidatedTimestamp: string;
}

/**
 * Records a security event in the audit log.
 */
export function recordAuditLog(
  eventType: string,
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
  details: string,
  performedBy: string = 'SYSTEM',
  db?: Database.Database
): void {
  const database = db ?? getDatabase();
  try {
    database.prepare(`
      INSERT INTO system_audit_logs (event_type, severity, details, performed_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(eventType, severity, details, performedBy);
  } catch (err) {
    console.error('[AuditLog] Failed to record event:', err);
  }
}

/**
 * Retrieves or initializes the stable installation identity for this machine.
 */
export function getInstallationIdentity(db?: Database.Database): InstallationIdentity {
  const database = db ?? getDatabase();

  const row = database.prepare(`
    SELECT installation_id, machine_fingerprint, first_installed_at, last_validated_timestamp
    FROM installation_identity WHERE id = 1
  `).get() as {
    installation_id: string;
    machine_fingerprint: string;
    first_installed_at: string;
    last_validated_timestamp: string;
  } | undefined;

  if (row) {
    return {
      installationId: row.installation_id,
      machineFingerprint: row.machine_fingerprint,
      firstInstalledAt: row.first_installed_at,
      lastValidatedTimestamp: row.last_validated_timestamp,
    };
  }

  // First time run on this installation: generate stable identity
  const binding = generateMachineBinding();
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO installation_identity (id, installation_id, machine_fingerprint, first_installed_at, last_validated_timestamp, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(
    binding.installationId,
    binding.machineFingerprint,
    now,
    now,
    now,
    now
  );

  recordAuditLog('INSTALLATION_INITIALIZED', 'INFO', `Installation identity registered: ${binding.installationId}`, 'SYSTEM', database);

  return {
    installationId: binding.installationId,
    machineFingerprint: binding.machineFingerprint,
    firstInstalledAt: now,
    lastValidatedTimestamp: now,
  };
}

/**
 * Checks for system clock rollback attempts.
 */
export function checkClockTampering(db?: Database.Database): boolean {
  const database = db ?? getDatabase();
  const identity = getInstallationIdentity(database);

  const lastValidated = new Date(identity.lastValidatedTimestamp).getTime();
  const now = Date.now();

  // Allow up to 1 hour backwards drift for timezone/daylight saving adjustment
  const maxAllowedBackwardMs = 60 * 60 * 1000;
  const isTampered = now < lastValidated - maxAllowedBackwardMs;

  if (isTampered) {
    recordAuditLog(
      'CLOCK_TAMPERING_DETECTED',
      'WARN',
      `System clock was moved backwards. Current: ${new Date(now).toISOString()}, Recorded: ${identity.lastValidatedTimestamp}`,
      'SYSTEM',
      database
    );
  } else {
    // Progressively record the latest valid timestamp
    database.prepare(`
      UPDATE installation_identity
      SET last_validated_timestamp = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(new Date(now).toISOString());
  }

  return isTampered;
}

/**
 * Retrieves the comprehensive license status of this installation.
 */
export function getLicenseStatus(db?: Database.Database): LicenseStatusInfo {
  const database = db ?? getDatabase();
  const identity = getInstallationIdentity(database);
  const isClockTampered = checkClockTampering(database);

  const stateRow = database.prepare(`
    SELECT * FROM license_state WHERE id = 1
  `).get() as {
    license_token: string | null;
    license_id: string | null;
    customer_name: string | null;
    product_name: string | null;
    edition: string | null;
    license_type: string | null;
    installation_binding: string | null;
    issued_at: string | null;
    starts_at: string | null;
    expires_at: string | null;
    grace_period_days: number | null;
    status: string;
  } | undefined;

  if (!stateRow || !stateRow.license_token) {
    return {
      status: 'Unlicensed',
      installationId: identity.installationId,
      isClockTampered,
      message: 'No license installed. Please activate a valid license.',
    };
  }

  // Verify digital signature
  const verification = verifyLicenseSignature(stateRow.license_token);
  if (!verification.valid || !verification.payload) {
    database.prepare(`
      UPDATE license_state
      SET status = 'Invalid Signature', updated_at = datetime('now')
      WHERE id = 1
    `).run();

    return {
      status: 'Invalid Signature',
      installationId: identity.installationId,
      isClockTampered,
      error: verification.error || 'Digital signature verification failed. License has been altered.',
    };
  }

  const payload: LicensePayload = verification.payload;

  // Verify product (supports both new brand and backward-compatible licenses)
  const validProducts = ['MS Institute Management System', 'School Management System'];
  if (!validProducts.includes(payload.product)) {
    database.prepare(`
      UPDATE license_state SET status = 'Wrong Product', updated_at = datetime('now') WHERE id = 1
    `).run();

    return {
      status: 'Wrong Product',
      installationId: identity.installationId,
      isClockTampered,
      error: `License was issued for product "${payload.product}", not "MS Institute Management System".`,
    };
  }

  // Verify installation binding
  const binding = payload.installationBinding.trim();
  const isBindingValid = binding === '*' || binding === identity.installationId;

  if (!isBindingValid) {
    database.prepare(`
      UPDATE license_state SET status = 'Wrong Installation', updated_at = datetime('now') WHERE id = 1
    `).run();

    return {
      status: 'Wrong Installation',
      installationId: identity.installationId,
      isClockTampered,
      error: `This license is bound to installation "${binding}", but this installation is "${identity.installationId}".`,
    };
  }

  // Verify date boundaries
  const now = new Date();
  const startsAt = new Date(payload.startsAt);
  const expiresAt = new Date(payload.expiresAt);
  const graceDays = payload.gracePeriodDays ?? 0;
  const graceExpiry = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  let status: LicenseStatus = 'Valid';
  let message = 'License is active and valid.';
  let isInGracePeriod = false;
  let isExpired = false;

  if (now < startsAt) {
    status = 'Not Yet Active';
    message = `This license becomes active on ${startsAt.toISOString().split('T')[0]}.`;
  } else if (now > expiresAt && now <= graceExpiry) {
    status = 'Expired';
    isInGracePeriod = true;
    isExpired = true;
    message = `License expired on ${expiresAt.toISOString().split('T')[0]}, currently in ${graceDays}-day grace period.`;
  } else if (now > graceExpiry) {
    status = 'Expired';
    isExpired = true;
    message = `This license expired on ${expiresAt.toISOString().split('T')[0]}. All school data remains safe.`;
  }

  // Calculate days remaining
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  const isNearExpiry = status === 'Valid' && daysRemaining <= 30 && daysRemaining > 0;

  // Persist current status
  database.prepare(`
    UPDATE license_state
    SET status = ?, last_verified_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 1
  `).run(status);

  return {
    status,
    installationId: identity.installationId,
    isClockTampered,
    isValid: status === 'Valid',
    isExpired,
    isInGracePeriod,
    licenseId: payload.licenseId,
    customerName: payload.customerName,
    productName: payload.product,
    edition: payload.edition,
    licenseType: payload.licenseType,
    issuedAt: payload.issuedAt,
    startsAt: payload.startsAt,
    expiresAt: payload.expiresAt,
    gracePeriodDays: graceDays,
    daysRemaining: Math.max(0, daysRemaining),
    isNearExpiry,
    message,
  };
}

/**
 * Activates or imports a new signed license token.
 * Validates the new license before replacing the current license.
 */
export function activateLicense(
  licenseToken: string,
  db?: Database.Database
): { success: boolean; statusInfo?: LicenseStatusInfo; error?: string } {
  const database = db ?? getDatabase();
  const identity = getInstallationIdentity(database);

  if (!licenseToken || typeof licenseToken !== 'string') {
    return { success: false, error: 'Please provide a valid license code or file content.' };
  }

  // 1. Verify digital signature
  const verification = verifyLicenseSignature(licenseToken);
  if (!verification.valid || !verification.payload) {
    recordAuditLog('LICENSE_ACTIVATION_FAILED', 'WARN', `Invalid signature: ${verification.error}`, 'ADMIN', database);
    return {
      success: false,
      error: verification.error || 'Digital signature verification failed. License has been altered or is corrupt.',
    };
  }

  const payload = verification.payload;

  // 2. Verify product (supports both new brand and backward-compatible licenses)
  const validProducts = ['MS Institute Management System', 'School Management System'];
  if (!validProducts.includes(payload.product)) {
    return {
      success: false,
      error: `License product mismatch: expected "MS Institute Management System", found "${payload.product}".`,
    };
  }

  // 3. Verify installation binding
  const binding = payload.installationBinding.trim();
  const isBindingValid = binding === '*' || binding === identity.installationId;

  if (!isBindingValid) {
    recordAuditLog(
      'LICENSE_ACTIVATION_FAILED',
      'WARN',
      `Installation mismatch: Bound to "${binding}", current is "${identity.installationId}"`,
      'ADMIN',
      database
    );
    return {
      success: false,
      error: `This license is bound to a different installation (${binding}). This machine's Installation ID is ${identity.installationId}.`,
    };
  }

  // 4. Determine status
  const now = new Date();
  const startsAt = new Date(payload.startsAt);
  const expiresAt = new Date(payload.expiresAt);
  const graceDays = payload.gracePeriodDays ?? 0;
  const graceExpiry = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  let initialStatus: LicenseStatus = 'Valid';
  if (now < startsAt) {
    initialStatus = 'Not Yet Active';
  } else if (now > graceExpiry) {
    initialStatus = 'Expired';
  }

  // 5. Atomic save into database
  database.prepare(`
    INSERT INTO license_state (
      id, license_token, license_id, customer_name, product_name, edition,
      license_type, installation_binding, issued_at, starts_at, expires_at,
      grace_period_days, status, last_verified_at, created_at, updated_at
    ) VALUES (
      1, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, datetime('now'), datetime('now'), datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      license_token = excluded.license_token,
      license_id = excluded.license_id,
      customer_name = excluded.customer_name,
      product_name = excluded.product_name,
      edition = excluded.edition,
      license_type = excluded.license_type,
      installation_binding = excluded.installation_binding,
      issued_at = excluded.issued_at,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      grace_period_days = excluded.grace_period_days,
      status = excluded.status,
      last_verified_at = datetime('now'),
      updated_at = datetime('now')
  `).run(
    licenseToken.trim(),
    payload.licenseId,
    payload.customerName,
    payload.product,
    payload.edition,
    payload.licenseType,
    payload.installationBinding,
    payload.issuedAt,
    payload.startsAt,
    payload.expiresAt,
    graceDays,
    initialStatus
  );

  recordAuditLog(
    'LICENSE_ACTIVATED',
    'INFO',
    `License ${payload.licenseId} activated for "${payload.customerName}" (${payload.licenseType}, expires: ${payload.expiresAt})`,
    'ADMIN',
    database
  );

  const statusInfo = getLicenseStatus(database);
  return { success: true, statusInfo };
}
