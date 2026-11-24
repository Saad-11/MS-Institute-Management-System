/**
 * School Settings & Branding Service
 * 
 * Manages school identity, contact information, branding (logo uploads),
 * and academic profile.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface SchoolSettings {
  id: number;
  schoolName: string;
  schoolCode: string;
  schoolType: 'School' | 'College';
  principalName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  country: string;
  logoPath: string | null;
  logoDataUrl?: string | null;
  signaturePath?: string | null;
  signatureDataUrl?: string | null;
  academicSession: string;
  createdAt: string;
  updatedAt: string;
}

interface SchoolSettingsRow {
  id: number;
  school_name: string;
  school_code: string;
  school_type: string;
  principal_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  country: string;
  logo_path: string | null;
  signature_path?: string | null;
  academic_session: string;
  created_at: string;
  updated_at: string;
}

function mapRowToSettings(row: SchoolSettingsRow): SchoolSettings {
  return {
    id: row.id,
    schoolName: row.school_name,
    schoolCode: row.school_code ?? '',
    schoolType: (row.school_type === 'College' ? 'College' : 'School') as 'School' | 'College',
    principalName: row.principal_name,
    phone: row.phone,
    email: row.email ?? '',
    address: row.address,
    city: row.city ?? '',
    province: row.province ?? '',
    country: row.country ?? 'Pakistan',
    logoPath: row.logo_path,
    signaturePath: row.signature_path ?? null,
    academicSession: row.academic_session,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getLogosDirectory(): string {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.resolve(process.cwd(), 'app-data');
  const logosDir = path.join(baseDir, 'uploads', 'logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }
  return logosDir;
}

function getSignaturesDirectory(): string {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.resolve(process.cwd(), 'app-data');
  const sigDir = path.join(baseDir, 'uploads', 'signatures');
  if (!fs.existsSync(sigDir)) {
    fs.mkdirSync(sigDir, { recursive: true });
  }
  return sigDir;
}

/**
 * Gets the current school settings from the database.
 */
export function getSchoolSettings(db?: Database.Database): SchoolSettings {
  const database = db ?? getDatabase();
  const row = database
    .prepare('SELECT * FROM school_settings WHERE id = 1')
    .get() as SchoolSettingsRow | undefined;

  if (!row) {
    return {
      id: 1,
      schoolName: 'My School',
      schoolCode: '',
      schoolType: 'School',
      principalName: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      province: '',
      country: 'Pakistan',
      logoPath: null,
      signaturePath: null,
      academicSession: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const mapped = mapRowToSettings(row);
  try {
    mapped.logoDataUrl = getSchoolLogoDataUrl(database);
  } catch {
    mapped.logoDataUrl = null;
  }
  try {
    mapped.signatureDataUrl = getPrincipalSignatureDataUrl(database);
  } catch {
    mapped.signatureDataUrl = null;
  }
  return mapped;
}

/**
 * Updates the school settings. Requires an active administrator session.
 */
export function updateSchoolSettings(
  params: {
    sessionToken?: string;
    schoolName?: string;
    schoolCode?: string;
    schoolType?: string;
    principalName?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    country?: string;
    academicSession?: string;
  },
  db?: Database.Database
): { success: boolean; settings?: SchoolSettings; error?: string } {
  // Verify authenticated session
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const current = getSchoolSettings(database);

  const schoolName = params.schoolName !== undefined ? params.schoolName.trim() : current.schoolName;
  const schoolCode = params.schoolCode !== undefined ? params.schoolCode.trim() : current.schoolCode;
  const schoolType = params.schoolType === 'College' ? 'College' : 'School';
  const principalName = params.principalName !== undefined ? params.principalName.trim() : current.principalName;
  const phone = params.phone !== undefined ? params.phone.trim() : current.phone;
  const email = params.email !== undefined ? params.email.trim() : current.email;
  const address = params.address !== undefined ? params.address.trim() : current.address;
  const city = params.city !== undefined ? params.city.trim() : current.city;
  const province = params.province !== undefined ? params.province.trim() : current.province;
  const country = params.country !== undefined ? params.country.trim() : current.country;
  const academicSession = params.academicSession !== undefined ? params.academicSession.trim() : current.academicSession;

  if (schoolName.length === 0) {
    return { success: false, error: 'School or College name cannot be empty.' };
  }

  try {
    const updateStmt = database.prepare(`
      UPDATE school_settings
      SET school_name = ?,
          school_code = ?,
          school_type = ?,
          principal_name = ?,
          phone = ?,
          email = ?,
          address = ?,
          city = ?,
          province = ?,
          country = ?,
          academic_session = ?,
          updated_at = datetime('now')
      WHERE id = 1
    `);

    updateStmt.run(
      schoolName,
      schoolCode,
      schoolType,
      principalName,
      phone,
      email,
      address,
      city,
      province,
      country,
      academicSession
    );

    const updated = getSchoolSettings(database);
    console.log(`[SchoolService] Updated school settings: ${schoolName}`);

    return {
      success: true,
      settings: updated,
    };
  } catch (err) {
    console.error('[SchoolService] Failed to update school settings:', err);
    return { success: false, error: 'Failed to save school settings.' };
  }
}

/**
 * Saves a new school logo from a chosen file path or base64 data.
 * Validates file format, manages storage in app-data/uploads/logos,
 * cleans up previous logo, and updates database reference.
 */
export function saveSchoolLogo(
  params: {
    sessionToken?: string;
    sourceFilePath?: string;
    base64Data?: string;
    fileExtension?: string;
  },
  db?: Database.Database
): { success: boolean; logoPath?: string; dataUrl?: string; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const current = getSchoolSettings(database);
  const logosDir = getLogosDirectory();

  try {
    let ext = '';
    let buffer: Buffer;

    if (params.sourceFilePath) {
      if (!fs.existsSync(params.sourceFilePath)) {
        return { success: false, error: 'Selected logo file does not exist.' };
      }
      ext = path.extname(params.sourceFilePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      buffer = fs.readFileSync(params.sourceFilePath);
    } else if (params.base64Data) {
      ext = (params.fileExtension || '.png').toLowerCase();
      if (!ext.startsWith('.')) ext = '.' + ext;
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      // Strip potential data URL prefix
      const cleanBase64 = params.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      return { success: false, error: 'No image data provided.' };
    }

    // Safety check: max 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return { success: false, error: 'Logo file size exceeds the 5MB maximum limit.' };
    }

    const filename = `logo_${Date.now()}${ext}`;
    const targetPath = path.join(logosDir, filename);

    // Write new logo file
    fs.writeFileSync(targetPath, buffer);

    // Delete old logo if present and in managed dir
    if (current.logoPath) {
      const oldPath = path.isAbsolute(current.logoPath)
        ? current.logoPath
        : path.join(logosDir, path.basename(current.logoPath));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    // Store relative file name in DB for portability
    database.prepare(`
      UPDATE school_settings
      SET logo_path = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(filename);

    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    cachedSchoolLogo = null;
    console.log(`[SchoolService] Saved school logo: ${filename}`);

    return {
      success: true,
      logoPath: filename,
      dataUrl,
    };
  } catch (err) {
    console.error('[SchoolService] Failed to save school logo:', err);
    return { success: false, error: 'Failed to process and save logo file.' };
  }
}

/**
 * Removes the current school logo and deletes the stored file.
 */
export function removeSchoolLogo(
  sessionToken?: string,
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const current = getSchoolSettings(database);

  try {
    if (current.logoPath) {
      const logosDir = getLogosDirectory();
      const filePath = path.isAbsolute(current.logoPath)
        ? current.logoPath
        : path.join(logosDir, path.basename(current.logoPath));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    database.prepare(`
      UPDATE school_settings
      SET logo_path = NULL, updated_at = datetime('now')
      WHERE id = 1
    `).run();

    cachedSchoolLogo = null;
    console.log('[SchoolService] Removed school logo');
    return { success: true };
  } catch (err) {
    console.error('[SchoolService] Failed to remove school logo:', err);
    return { success: false, error: 'Failed to remove logo.' };
  }
}

let cachedSchoolLogo: { path: string; dataUrl: string } | null = null;

/**
 * Retrieves the current school logo as a safe base64 data URL for renderer display.
 * Avoids direct filesystem access or CSP violations in the UI.
 */
export function getSchoolLogoDataUrl(db?: Database.Database): string | null {
  const database = db ?? getDatabase();
  const row = database
    .prepare('SELECT logo_path FROM school_settings WHERE id = 1')
    .get() as { logo_path: string | null } | undefined;

  if (!row || !row.logo_path) {
    cachedSchoolLogo = null;
    return null;
  }

  const logoPath = row.logo_path;
  if (logoPath.startsWith('data:image/')) {
    return logoPath;
  }

  if (cachedSchoolLogo && cachedSchoolLogo.path === logoPath) {
    return cachedSchoolLogo.dataUrl;
  }

  try {
    const logosDir = getLogosDirectory();
    let filePath = path.isAbsolute(logoPath)
      ? logoPath
      : path.join(logosDir, path.basename(logoPath));

    if (!fs.existsSync(filePath)) {
      const altDir = path.resolve(process.cwd(), 'app-data', 'uploads', 'logos');
      const altPath = path.join(altDir, path.basename(logoPath));
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        const appData = process.env.APPDATA;
        if (appData) {
          const newPath = path.join(appData, 'MS Institute Management System', 'uploads', 'logos', path.basename(logoPath));
          const roamingPath = path.join(appData, 'school-management-system', 'uploads', 'logos', path.basename(logoPath));
          if (fs.existsSync(newPath)) {
            filePath = newPath;
          } else if (fs.existsSync(roamingPath)) {
            filePath = roamingPath;
          } else {
            return null;
          }
        } else {
          return null;
        }
      }
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    cachedSchoolLogo = { path: logoPath, dataUrl };
    return dataUrl;
  } catch (err) {
    console.warn('[SchoolService] Could not read logo data URL:', err);
    return null;
  }
}

let cachedPrincipalSignature: { path: string; dataUrl: string } | null = null;

/**
 * Saves a new Principal / Head of Institution signature from a file path or base64 data.
 * Validates file format, manages storage in app-data/uploads/signatures,
 * cleans up previous signature, and updates database reference.
 */
export function savePrincipalSignature(
  params: {
    sessionToken?: string;
    sourceFilePath?: string;
    base64Data?: string;
    fileExtension?: string;
  },
  db?: Database.Database
): { success: boolean; signaturePath?: string; dataUrl?: string; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const current = getSchoolSettings(database);
  const sigDir = getSignaturesDirectory();

  try {
    let ext = '';
    let buffer: Buffer;

    if (params.sourceFilePath) {
      if (!fs.existsSync(params.sourceFilePath)) {
        return { success: false, error: 'Selected signature file does not exist.' };
      }
      ext = path.extname(params.sourceFilePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      buffer = fs.readFileSync(params.sourceFilePath);
    } else if (params.base64Data) {
      ext = (params.fileExtension || '.png').toLowerCase();
      if (!ext.startsWith('.')) ext = '.' + ext;
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      const cleanBase64 = params.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      return { success: false, error: 'No signature image data provided.' };
    }

    // Safety check: max 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return { success: false, error: 'Signature file size exceeds the 5MB maximum limit.' };
    }

    const filename = `signature_${Date.now()}${ext}`;
    const targetPath = path.join(sigDir, filename);

    // Write new signature file
    fs.writeFileSync(targetPath, buffer);

    // Delete old signature if present
    if (current.signaturePath) {
      const oldPath = path.isAbsolute(current.signaturePath)
        ? current.signaturePath
        : path.join(sigDir, path.basename(current.signaturePath));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    // Store relative file name in DB for portability
    database.prepare(`
      UPDATE school_settings
      SET signature_path = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(filename);

    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    cachedPrincipalSignature = null;
    console.log(`[SchoolService] Saved principal signature: ${filename}`);

    return {
      success: true,
      signaturePath: filename,
      dataUrl,
    };
  } catch (err) {
    console.error('[SchoolService] Failed to save principal signature:', err);
    return { success: false, error: 'Failed to process and save signature file.' };
  }
}

/**
 * Removes the current Principal signature and deletes the stored file.
 */
export function removePrincipalSignature(
  sessionToken?: string,
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const current = getSchoolSettings(database);

  try {
    if (current.signaturePath) {
      const sigDir = getSignaturesDirectory();
      const filePath = path.isAbsolute(current.signaturePath)
        ? current.signaturePath
        : path.join(sigDir, path.basename(current.signaturePath));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    database.prepare(`
      UPDATE school_settings
      SET signature_path = NULL, updated_at = datetime('now')
      WHERE id = 1
    `).run();

    cachedPrincipalSignature = null;
    console.log('[SchoolService] Removed principal signature');
    return { success: true };
  } catch (err) {
    console.error('[SchoolService] Failed to remove principal signature:', err);
    return { success: false, error: 'Failed to remove signature.' };
  }
}

/**
 * Retrieves the current Principal signature as a safe base64 data URL for renderer display.
 * Avoids direct filesystem access or CSP violations in the UI.
 */
export function getPrincipalSignatureDataUrl(db?: Database.Database): string | null {
  const database = db ?? getDatabase();
  const row = database
    .prepare('SELECT signature_path FROM school_settings WHERE id = 1')
    .get() as { signature_path: string | null } | undefined;

  if (!row || !row.signature_path) {
    cachedPrincipalSignature = null;
    return null;
  }

  const sigPath = row.signature_path;
  if (sigPath.startsWith('data:image/')) {
    return sigPath;
  }

  if (cachedPrincipalSignature && cachedPrincipalSignature.path === sigPath) {
    return cachedPrincipalSignature.dataUrl;
  }

  try {
    const sigDir = getSignaturesDirectory();
    let filePath = path.isAbsolute(sigPath)
      ? sigPath
      : path.join(sigDir, path.basename(sigPath));

    if (!fs.existsSync(filePath)) {
      const altDir = path.resolve(process.cwd(), 'app-data', 'uploads', 'signatures');
      const altPath = path.join(altDir, path.basename(sigPath));
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        const appData = process.env.APPDATA;
        if (appData) {
          const newPath = path.join(appData, 'MS Institute Management System', 'uploads', 'signatures', path.basename(sigPath));
          const roamingPath = path.join(appData, 'school-management-system', 'uploads', 'signatures', path.basename(sigPath));
          if (fs.existsSync(newPath)) {
            filePath = newPath;
          } else if (fs.existsSync(roamingPath)) {
            filePath = roamingPath;
          } else {
            return null;
          }
        } else {
          return null;
        }
      }
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    cachedPrincipalSignature = { path: sigPath, dataUrl };
    return dataUrl;
  } catch (err) {
    console.warn('[SchoolService] Could not read signature data URL:', err);
    return null;
  }
}
