/**
 * Cryptographic Offline Licensing Engine
 * 
 * Uses standard asymmetric Ed25519 digital signatures (Node.js crypto)
 * to provide tamper-proof, offline software licenses.
 * 
 * The client installation holds only the VENDOR_PUBLIC_KEY.
 * Only the Super Admin / Seller holds the VENDOR_PRIVATE_KEY.
 */

import * as crypto from 'crypto';
import * as os from 'os';

export interface LicensePayload {
  licenseId: string;
  customerName: string;
  product: string;
  edition: string;
  licenseType: 'Trial' | 'Monthly' | 'Yearly' | 'Lifetime' | 'Custom';
  installationBinding: string;
  issuedAt: string;
  startsAt: string;
  expiresAt: string;
  gracePeriodDays: number;
}

export interface SignedLicensePackage {
  payload: LicensePayload;
  signature: string;
  version: string;
}

/**
 * Official Vendor Public Key (SPKI PEM)
 * Embedded in all school installations for license verification.
 */
export const VENDOR_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAdB72N6+vlssWVYj1+2/WVmzN2dXWcHHWZ27EueuWOiU=
-----END PUBLIC KEY-----`;

/**
 * Official Vendor Private Key (PKCS8 PEM)
 * Used strictly by the Super Admin / Seller license generator.
 */
export const VENDOR_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIHtM2Nmr/NerNA9l/+zon8ftzkDmvpiU4Rbm8ZRfIP8s
-----END PRIVATE KEY-----`;

/**
 * Produces a deterministic canonical string representing the license payload.
 * Any modification to any field will result in a different canonical string,
 * causing digital signature verification to fail.
 */
export function serializeCanonicalPayload(payload: LicensePayload): string {
  return [
    payload.licenseId.trim(),
    payload.customerName.trim(),
    payload.product.trim(),
    payload.edition.trim(),
    payload.licenseType.trim(),
    payload.installationBinding.trim(),
    payload.issuedAt.trim(),
    payload.startsAt.trim(),
    payload.expiresAt.trim(),
    (payload.gracePeriodDays ?? 0).toString(),
  ].join('||');
}

/**
 * Signs a license payload using the Vendor Private Key.
 * Returns a portable Base64-encoded license package string.
 */
export function signLicensePayload(
  payload: LicensePayload,
  privateKeyPem: string = VENDOR_PRIVATE_KEY_PEM
): string {
  const canonicalString = serializeCanonicalPayload(payload);
  const dataBuffer = Buffer.from(canonicalString, 'utf8');

  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
  });

  const signatureBuffer = crypto.sign(null, dataBuffer, privateKey);
  const signature = signatureBuffer.toString('base64');

  const signedPackage: SignedLicensePackage = {
    version: '1.0',
    payload,
    signature,
  };

  const jsonString = JSON.stringify(signedPackage, null, 2);
  const base64Package = Buffer.from(jsonString, 'utf8').toString('base64');

  return `SMS-LIC-${base64Package}`;
}

/**
 * Decodes and verifies a license package against the Vendor Public Key.
 */
export function verifyLicenseSignature(
  licenseToken: string,
  publicKeyPem: string = VENDOR_PUBLIC_KEY_PEM
): { valid: boolean; payload?: LicensePayload; error?: string } {
  try {
    if (!licenseToken || typeof licenseToken !== 'string') {
      return { valid: false, error: 'Empty or invalid license token format.' };
    }

    let rawJson: string;
    const trimmed = licenseToken.trim();

    if (trimmed.startsWith('SMS-LIC-')) {
      const base64Data = trimmed.replace('SMS-LIC-', '');
      rawJson = Buffer.from(base64Data, 'base64').toString('utf8');
    } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      rawJson = trimmed;
    } else {
      // Try raw base64
      try {
        rawJson = Buffer.from(trimmed, 'base64').toString('utf8');
      } catch {
        return { valid: false, error: 'Malformed license token string.' };
      }
    }

    const parsed = JSON.parse(rawJson) as SignedLicensePackage;
    if (!parsed || !parsed.payload || !parsed.signature) {
      return { valid: false, error: 'License package is missing payload or signature.' };
    }

    const { payload, signature } = parsed;

    // Validate required fields
    if (
      !payload.licenseId ||
      !payload.customerName ||
      !payload.product ||
      !payload.startsAt ||
      !payload.expiresAt ||
      !payload.installationBinding
    ) {
      return { valid: false, error: 'License payload is missing mandatory fields.' };
    }

    const canonicalString = serializeCanonicalPayload(payload);
    const dataBuffer = Buffer.from(canonicalString, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');

    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem',
    });

    const isVerified = crypto.verify(null, dataBuffer, publicKey, signatureBuffer);

    if (!isVerified) {
      return { valid: false, error: 'Digital signature verification failed. License has been tampered with or is invalid.' };
    }

    return { valid: true, payload };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown cryptographic verification error';
    return { valid: false, error: `Cryptographic verification failed: ${msg}` };
  }
}

/**
 * Generates a stable machine fingerprint and Installation ID.
 * Bound to OS platform, hostname, CPU model, architecture, and network hardware MACs.
 * Format: INST-XXXX-XXXX-XXXX (16 hex characters).
 */
export function generateMachineBinding(): { installationId: string; machineFingerprint: string } {
  try {
    const hostname = os.hostname() || 'localhost';
    const platform = os.platform() || 'windows';
    const arch = os.arch() || 'x64';
    const cpus = os.cpus();
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : 'generic-cpu';
    const networkInterfaces = os.networkInterfaces();
    
    // Collect non-internal MAC addresses
    const macs: string[] = [];
    for (const iface of Object.values(networkInterfaces)) {
      if (iface) {
        for (const detail of iface) {
          if (!detail.internal && detail.mac && detail.mac !== '00:00:00:00:00:00') {
            macs.push(detail.mac.toLowerCase());
          }
        }
      }
    }
    macs.sort();

    const rawFingerprint = [
      platform,
      arch,
      cpuModel,
      hostname.toLowerCase(),
      macs.join(';'),
    ].join('::');

    const sha256 = crypto.createHash('sha256').update(rawFingerprint, 'utf8').digest('hex');
    const segment1 = sha256.substring(0, 4).toUpperCase();
    const segment2 = sha256.substring(4, 8).toUpperCase();
    const segment3 = sha256.substring(8, 12).toUpperCase();
    const segment4 = sha256.substring(12, 16).toUpperCase();

    const installationId = `INST-${segment1}-${segment2}-${segment3}-${segment4}`;

    return {
      installationId,
      machineFingerprint: sha256,
    };
  } catch {
    // Ultra-safe fallback using UUID
    const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
    return {
      installationId: `INST-${randomHex.substring(0, 4)}-${randomHex.substring(4, 8)}-${randomHex.substring(8, 12)}-${randomHex.substring(12, 16)}`,
      machineFingerprint: 'fallback-random-fingerprint',
    };
  }
}
