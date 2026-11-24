/**
 * Security & Cryptography Utilities
 * 
 * Uses Node.js built-in `crypto` for high-security password hashing
 * using scrypt with per-user cryptographic salts and timing-safe comparison.
 */

import * as crypto from 'crypto';

/**
 * Generates a secure salt and hashes the password using scrypt.
 * Output format: `${salt}:${derivedKeyHex}`
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  // Generate 16 bytes (128 bits) of cryptographic random salt
  const salt = crypto.randomBytes(16).toString('hex');
  // Hash with scrypt: 64 bytes output length, standard N=16384, r=8, p=1
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Securely verifies a plain password against the stored salt:hash string.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) {
      return false;
    }
    const [salt, keyHex] = parts;
    if (!salt || !keyHex) {
      return false;
    }
    const key = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (key.length !== derivedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(key, derivedKey);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

/**
 * In-memory Login Rate Limiter / Throttling
 * Protects local admin login against brute force attempts.
 */
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30 seconds temporary lockout

export function checkLoginThrottling(key: string): { allowed: boolean; remainingLockoutSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingLockoutSeconds: 0 };
  }

  if (record.lockedUntil > now) {
    const remaining = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingLockoutSeconds: remaining };
  }

  if (record.lockedUntil <= now && record.attempts >= MAX_ATTEMPTS) {
    // Lockout expired, reset counter
    loginAttempts.delete(key);
    return { allowed: true, remainingLockoutSeconds: 0 };
  }

  return { allowed: true, remainingLockoutSeconds: 0 };
}

export function recordFailedLogin(key: string): { isLocked: boolean; remainingLockoutSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(key) ?? { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    loginAttempts.set(key, record);
    return { isLocked: true, remainingLockoutSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  loginAttempts.set(key, record);
  return { isLocked: false, remainingLockoutSeconds: 0 };
}

export function recordSuccessfulLogin(key: string): void {
  loginAttempts.delete(key);
}
