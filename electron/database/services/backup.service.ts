/**
 * Backup & Restore Service
 * 
 * Provides database-consistent snapshots, local asset bundling,
 * integrity validation, safety pre-restore snapshots, and recovery.
 * 
 * Format: Gzip-compressed `.smbak` package with SHA-256 verified manifest.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import * as os from 'os';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { getDatabase, getDatabasePath, closeDatabase, initDatabase } from '../connection';
import { runMigrations } from '../migrations';
import { getSchoolSettings } from './school.service';
import { getInstallationIdentity, recordAuditLog } from './license.service';
import { generateMachineBinding } from '../../crypto/license-crypto';

export interface BackupManifest {
  formatVersion: '1.0';
  backupName: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  schoolName: string;
  schoolCode?: string;
  databaseChecksum: string;
  databaseSize: number;
  installationId: string;
  assetCount: number;
  assets: Array<{
    relativePath: string;
    size: number;
    sha256: string;
  }>;
}

export interface BackupPackage {
  manifest: BackupManifest;
  databaseBase64: string;
  assets: Array<{
    relativePath: string;
    dataBase64: string;
  }>;
}

export interface BackupValidationResult {
  valid: boolean;
  manifest?: BackupManifest;
  stats?: {
    fileSizeBytes: number;
    dbSizeBytes: number;
    assetCount: number;
  };
  error?: string;
}

export interface BackupListItem {
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  createdAt: string;
  schoolName: string;
  schemaVersion: number;
  isValid: boolean;
  isSafetySnapshot: boolean;
}

const MAGIC_HEADER = 'SMBAK_V1\n';

/**
 * Generates dynamic runtime filename for backups.
 * Format: MSIMS_Backup_YYYY-MM-DD_HHmmss.smbak (or PreRestore_YYYY-MM-DD_HHmmss.smbak for safety snapshots)
 */
export function generateBackupFilename(isSafetySnapshot = false): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
  const prefix = isSafetySnapshot ? 'PreRestore_MSIMS_Backup_' : 'MSIMS_Backup_';
  return `${prefix}${timestamp}.smbak`;
}

function getAppBaseDir(): string {
  if (app && typeof app.getPath === 'function') {
    const userData = app.getPath('userData');
    if (userData) {
      return userData;
    }
  }
  let appDataDir = '';
  try {
    appDataDir = app && typeof app.getPath === 'function' ? app.getPath('appData') : (process.env.APPDATA || '');
  } catch {
    appDataDir = process.env.APPDATA || '';
  }
  if (appDataDir) {
    const canonical = path.join(appDataDir, 'MS Institute Management System');
    if (fs.existsSync(canonical)) return canonical;
    const legacy = path.join(appDataDir, 'school-management-system');
    if (fs.existsSync(legacy)) return legacy;
    return canonical;
  }
  return path.resolve(process.cwd(), 'app-data');
}

export function getDefaultBackupDir(): string {
  const dir = path.join(getAppBaseDir(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getSafetyBackupDir(): string {
  const dir = path.join(getDefaultBackupDir(), 'safety');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getUploadsDir(): string {
  const dir = path.join(getAppBaseDir(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Collects all application assets recursively from the uploads directory.
 */
function collectAssets(uploadsDir: string): Array<{ relativePath: string; absolutePath: string }> {
  const results: Array<{ relativePath: string; absolutePath: string }> = [];

  function scan(currentDir: string, currentRelative: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = currentRelative ? path.join(currentRelative, entry.name) : entry.name;
      if (entry.isDirectory()) {
        scan(fullPath, relPath);
      } else if (entry.isFile()) {
        results.push({ relativePath: relPath.replace(/\\/g, '/'), absolutePath: fullPath });
      }
    }
  }

  scan(uploadsDir, '');
  return results;
}

/**
 * Creates a database-consistent `.smbak` backup package.
 */
export async function createBackup(
  options?: {
    customDestinationPath?: string;
    isSafetySnapshot?: boolean;
    performedBy?: string;
  },
  db?: Database.Database
): Promise<{ success: boolean; backupPath?: string; manifest?: BackupManifest; error?: string }> {
  const database = db ?? getDatabase();
  const identity = getInstallationIdentity(database);
  const settings = getSchoolSettings(database);

  try {
    const now = new Date();
    const defaultFileName = generateBackupFilename(options?.isSafetySnapshot);

    let destinationPath: string;
    if (options?.customDestinationPath && options.customDestinationPath.trim()) {
      const rawTarget = options.customDestinationPath.trim();
      // If user supplied a path ending in .smbak, treat as full file path
      if (rawTarget.toLowerCase().endsWith('.smbak')) {
        destinationPath = path.resolve(rawTarget);
      } else {
        // User selected a folder (from browse folder dialog, USB drive, desktop, etc.)
        const targetDir = path.resolve(rawTarget);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        destinationPath = path.join(targetDir, defaultFileName);
      }
    } else {
      const targetDir = options?.isSafetySnapshot ? getSafetyBackupDir() : getDefaultBackupDir();
      destinationPath = path.join(targetDir, defaultFileName);
    }

    // Ensure parent directory exists
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Record creation log prior to snapshot so it is captured inside the backup image
    recordAuditLog(
      options?.isSafetySnapshot ? 'SAFETY_BACKUP_CREATED' : 'BACKUP_CREATED',
      'INFO',
      `Backup initiated: ${path.basename(destinationPath)}`,
      options?.performedBy || 'ADMIN',
      database
    );

    // 1. Checkpoint SQLite WAL to ensure all pending transactions are flushed to disk
    database.pragma('wal_checkpoint(TRUNCATE)');

    // 2. Perform online SQLite snapshot using database.backup() to a local temp file in os.tmpdir()
    const tempDbPath = path.join(os.tmpdir(), `msims_snap_${Date.now()}_${process.pid}.sqlite`);
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch {}

    await database.backup(tempDbPath);

    if (!fs.existsSync(tempDbPath) || fs.statSync(tempDbPath).size === 0) {
      throw new Error('Failed to generate SQLite snapshot: temporary snapshot file is missing or empty.');
    }

    const dbBuffer = fs.readFileSync(tempDbPath);
    const dbChecksum = calculateSha256(dbBuffer);
    const dbBase64 = dbBuffer.toString('base64');

    // Clean up temporary snapshot file
    try {
      fs.unlinkSync(tempDbPath);
    } catch {
      // Ignore temp file unlink failure
    }

    // 3. Collect application assets (photos, logos)
    const uploadsDir = getUploadsDir();
    const assetFiles = collectAssets(uploadsDir);

    const packedAssets: Array<{ relativePath: string; dataBase64: string }> = [];
    const manifestAssets: Array<{ relativePath: string; size: number; sha256: string }> = [];

    for (const a of assetFiles) {
      try {
        const fileBuf = fs.readFileSync(a.absolutePath);
        packedAssets.push({
          relativePath: a.relativePath,
          dataBase64: fileBuf.toString('base64'),
        });
        manifestAssets.push({
          relativePath: a.relativePath,
          size: fileBuf.length,
          sha256: calculateSha256(fileBuf),
        });
      } catch (err) {
        console.warn(`[Backup] Warning: could not read asset ${a.absolutePath}:`, err);
      }
    }

    // 4. Construct manifest
    const schemaRow = database.prepare(`
      SELECT MAX(version) as max_v FROM schema_migrations
    `).get() as { max_v: number } | undefined;

    const manifest: BackupManifest = {
      formatVersion: '1.0',
      backupName: path.basename(destinationPath),
      appVersion: '1.0.0',
      schemaVersion: schemaRow?.max_v || 8,
      createdAt: now.toISOString(),
      schoolName: settings.schoolName || 'MS Institute Management System',
      schoolCode: settings.schoolCode || '',
      databaseChecksum: dbChecksum,
      databaseSize: dbBuffer.length,
      installationId: identity.installationId,
      assetCount: packedAssets.length,
      assets: manifestAssets,
    };

    // 5. Serialize package and compress using Gzip
    const packagePayload: BackupPackage = {
      manifest,
      databaseBase64: dbBase64,
      assets: packedAssets,
    };

    const jsonString = JSON.stringify(packagePayload);
    const gzipped = zlib.gzipSync(Buffer.from(jsonString, 'utf8'), { level: 9 });

    // Write file with magic header
    const fileContent = Buffer.concat([Buffer.from(MAGIC_HEADER, 'utf8'), gzipped]);
    fs.writeFileSync(destinationPath, fileContent);

    // Verify file exists on disk and is non-zero
    if (!fs.existsSync(destinationPath)) {
      throw new Error(`Backup file was not created on disk at destination: ${destinationPath}`);
    }
    const writtenStats = fs.statSync(destinationPath);
    if (writtenStats.size === 0) {
      try { fs.unlinkSync(destinationPath); } catch {}
      throw new Error('Backup file created on disk is zero bytes.');
    }

    // Immediately run validation on the generated file to guarantee integrity
    const selfValidation = validateBackup(destinationPath);
    if (!selfValidation.valid) {
      try { fs.unlinkSync(destinationPath); } catch {}
      throw new Error(`Generated backup failed integrity check: ${selfValidation.error}`);
    }

    // 6. Record metadata in backup_metadata table
    database.prepare(`
      INSERT INTO backup_metadata (
        backup_name, backup_path, backup_size, database_version,
        app_version, school_name, checksum, asset_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Valid', datetime('now'))
    `).run(
      manifest.backupName,
      destinationPath,
      writtenStats.size,
      manifest.schemaVersion,
      manifest.appVersion,
      manifest.schoolName,
      dbChecksum,
      manifest.assetCount
    );

    recordAuditLog(
      options?.isSafetySnapshot ? 'SAFETY_BACKUP_CREATED' : 'BACKUP_CREATED',
      'INFO',
      `Backup created successfully: ${manifest.backupName} (${(writtenStats.size / (1024 * 1024)).toFixed(2)} MB)`,
      options?.performedBy || 'ADMIN',
      database
    );

    console.log(`[Backup] Successfully created verified backup at: ${destinationPath} (${writtenStats.size} bytes)`);

    return {
      success: true,
      backupPath: destinationPath,
      manifest,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown backup error';
    recordAuditLog('BACKUP_FAILED', 'ERROR', `Backup creation failed: ${msg}`, options?.performedBy || 'ADMIN', database);
    return { success: false, error: `Backup creation failed: ${msg}` };
  }
}

/**
 * Validates a `.smbak` backup file without restoring it.
 */
export function validateBackup(filePath: string): BackupValidationResult {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Backup file does not exist on disk.' };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeBytes = fileBuffer.length;

    // Check magic header
    const headerBuffer = Buffer.from(MAGIC_HEADER, 'utf8');
    if (fileBuffer.length < headerBuffer.length || !fileBuffer.subarray(0, headerBuffer.length).equals(headerBuffer)) {
      return { valid: false, error: 'Invalid backup file format: missing SMBAK header.' };
    }

    // Gunzip payload
    const gzippedPayload = fileBuffer.subarray(headerBuffer.length);
    const uncompressedBuffer = zlib.gunzipSync(gzippedPayload);
    const packageData = JSON.parse(uncompressedBuffer.toString('utf8')) as BackupPackage;

    if (!packageData.manifest || !packageData.databaseBase64) {
      return { valid: false, error: 'Backup package missing manifest or database snapshot.' };
    }

    const { manifest, databaseBase64, assets } = packageData;

    // Verify database checksum
    const dbBuffer = Buffer.from(databaseBase64, 'base64');
    const computedDbChecksum = calculateSha256(dbBuffer);
    if (computedDbChecksum !== manifest.databaseChecksum) {
      return { valid: false, error: 'Database integrity checksum mismatch. File is corrupted.' };
    }

    // Verify database SQLite structure by opening read-only temp instance
    const tempValidatePath = path.join(os.tmpdir(), `validate_${Date.now()}_${process.pid}_temp.sqlite`);
    fs.writeFileSync(tempValidatePath, dbBuffer);

    try {
      const testDb = new Database(tempValidatePath, { readonly: true });
      const integrityCheck = testDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      if (integrityCheck.integrity_check !== 'ok') {
        testDb.close();
        fs.unlinkSync(tempValidatePath);
        return { valid: false, error: 'SQLite integrity check failed on backup database.' };
      }

      // Check required tables exist
      const requiredTables = ['schema_migrations', 'users', 'school_settings', 'students', 'classes', 'academic_sessions'];
      for (const table of requiredTables) {
        const tableExists = testDb.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name = ?
        `).get(table);
        if (!tableExists) {
          testDb.close();
          fs.unlinkSync(tempValidatePath);
          return { valid: false, error: `Corrupt backup: missing core table "${table}".` };
        }
      }

      testDb.close();
      fs.unlinkSync(tempValidatePath);
    } catch (testErr: unknown) {
      try { fs.unlinkSync(tempValidatePath); } catch { /* ignore */ }
      const msg = testErr instanceof Error ? testErr.message : 'Database error';
      return { valid: false, error: `SQLite validation failed: ${msg}` };
    }

    // Verify asset checksums
    if (assets && manifest.assets) {
      for (const assetEntry of manifest.assets) {
        const found = assets.find((a) => a.relativePath === assetEntry.relativePath);
        if (found) {
          const assetBuf = Buffer.from(found.dataBase64, 'base64');
          if (calculateSha256(assetBuf) !== assetEntry.sha256) {
            return { valid: false, error: `Corrupted asset checksum for "${assetEntry.relativePath}".` };
          }
        }
      }
    }

    return {
      valid: true,
      manifest,
      stats: {
        fileSizeBytes,
        dbSizeBytes: dbBuffer.length,
        assetCount: manifest.assetCount || 0,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown validation error';
    return { valid: false, error: `Backup validation failed: ${msg}` };
  }
}

/**
 * Restores the application state from a `.smbak` backup file.
 * Automatically creates a pre-restore safety snapshot before any modifications.
 * Preserves the host machine's hardware installation identity and licensing across computers.
 * Rolls back to the safety snapshot if restore fails validation.
 */
export async function restoreBackup(
  backupFilePath: string,
  options?: { performedBy?: string } | Database.Database,
  db?: Database.Database
): Promise<{ success: boolean; restoredAt?: string; manifest?: BackupManifest; error?: string }> {
  const targetDb = db ?? (options && typeof (options as Database.Database).prepare === 'function' ? (options as Database.Database) : undefined);
  const opts = options && typeof (options as Database.Database).prepare !== 'function' ? (options as { performedBy?: string }) : undefined;

  // 1. Step 1: Validate target backup before touching current state
  const validation = validateBackup(backupFilePath);
  if (!validation.valid || !validation.manifest) {
    return { success: false, error: `Restore aborted: ${validation.error || 'The backup file is invalid.'}` };
  }

  const manifest = validation.manifest;
  const currentDbPath = targetDb ? (targetDb.name || getDatabasePath()) : getDatabasePath();
  const uploadsDir = getUploadsDir();

  // 2. Step 2: Read current machine identity & license before modifying anything
  let currentMachineIdentity: {
    installation_id: string;
    machine_fingerprint: string;
  } | null = null;
  let currentMachineLicense: any = null;

  try {
    const preDb = targetDb || getDatabase();
    const idRow = preDb.prepare('SELECT installation_id, machine_fingerprint FROM installation_identity WHERE id = 1').get() as any;
    if (idRow) currentMachineIdentity = idRow;
    const licRow = preDb.prepare('SELECT * FROM license_state WHERE id = 1').get() as any;
    if (licRow) currentMachineLicense = licRow;
  } catch {
    // Tables may not exist yet if fresh database
  }

  // 3. Step 3: Create automatic safety snapshot of current installation
  console.log('[Restore] Creating pre-restore safety snapshot...');
  const safetyResult = await createBackup(
    {
      isSafetySnapshot: true,
      performedBy: opts?.performedBy || 'SYSTEM',
    },
    targetDb
  );

  if (!safetyResult.success || !safetyResult.backupPath) {
    return {
      success: false,
      error: 'Could not create safety snapshot of current data before restore. Restore cancelled for safety.',
    };
  }

  const safetyBackupPath = safetyResult.backupPath;
  console.log(`[Restore] Safety snapshot created at: ${safetyBackupPath}`);

  try {
    // 4. Step 4: Read and extract the backup package
    const fileBuffer = fs.readFileSync(backupFilePath);
    const headerBuffer = Buffer.from(MAGIC_HEADER, 'utf8');
    const gzippedPayload = fileBuffer.subarray(headerBuffer.length);
    const uncompressed = zlib.gunzipSync(gzippedPayload);
    const packageData = JSON.parse(uncompressed.toString('utf8')) as BackupPackage;

    const restoredDbBuffer = Buffer.from(packageData.databaseBase64, 'base64');

    if (targetDb) {
      // Custom test/isolated database provided
      const tempRestoreFile = path.join(os.tmpdir(), `temp_restore_${Date.now()}_${process.pid}.sqlite`);
      fs.writeFileSync(tempRestoreFile, restoredDbBuffer);
      const srcDb = new Database(tempRestoreFile);
      const destDbPath = targetDb.name;
      // Copy tables into targetDb via backup
      const backupInstance = srcDb.backup(destDbPath);
      await backupInstance;
      srcDb.close();
      try { fs.unlinkSync(tempRestoreFile); } catch { /* ignore */ }
      runMigrations(targetDb);
    } else {
      // 5. Step 5: Close current active database cleanly
      closeDatabase();

      // 6. Step 6: Overwrite SQLite database file
      fs.writeFileSync(currentDbPath, restoredDbBuffer);

      // Also delete any existing WAL and SHM files to avoid state mismatch
      const walPath = `${currentDbPath}-wal`;
      const shmPath = `${currentDbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      // 7. Step 7: Restore asset files (school logo, student photos, teacher photos)
      if (packageData.assets) {
        for (const asset of packageData.assets) {
          const targetPath = path.join(uploadsDir, asset.relativePath);
          const parentDir = path.dirname(targetPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, Buffer.from(asset.dataBase64, 'base64'));
        }
      }

      // 8. Step 8: Re-initialize database and run any migrations
      const restoredDb = initDatabase();
      runMigrations(restoredDb);
    }

    const activeDb = targetDb || getDatabase();

    // 9. Step 9: Re-bind machine identity to current host computer for Cross-Computer Recovery
    try {
      const hostBinding = generateMachineBinding();
      const instId = currentMachineIdentity?.installation_id || hostBinding.installationId;
      const machineFp = currentMachineIdentity?.machine_fingerprint || hostBinding.machineFingerprint;
      const nowIso = new Date().toISOString();

      activeDb.prepare(`
        INSERT OR REPLACE INTO installation_identity (
          id, installation_id, machine_fingerprint, first_installed_at,
          last_validated_timestamp, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?)
      `).run(instId, machineFp, nowIso, nowIso, nowIso, nowIso);

      // If this computer already had an active license token on this machine, preserve it
      if (currentMachineLicense && currentMachineLicense.license_token) {
        activeDb.prepare(`
          INSERT OR REPLACE INTO license_state (
            id, license_token, license_id, customer_name, product_name,
            edition, license_type, installation_binding, issued_at,
            starts_at, expires_at, grace_period_days, status, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          currentMachineLicense.license_token,
          currentMachineLicense.license_id,
          currentMachineLicense.customer_name,
          currentMachineLicense.product_name,
          currentMachineLicense.edition,
          currentMachineLicense.license_type,
          currentMachineLicense.installation_binding,
          currentMachineLicense.issued_at,
          currentMachineLicense.starts_at,
          currentMachineLicense.expires_at,
          currentMachineLicense.grace_period_days,
          currentMachineLicense.status
        );
      }
    } catch (bindErr) {
      console.warn('[Restore] Notice during host identity preservation:', bindErr);
    }

    // 10. Step 10: Validate restored database
    const integrityCheck = activeDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (integrityCheck.integrity_check !== 'ok') {
      throw new Error('Restored database failed SQLite integrity check.');
    }

    // Verify core settings and users query
    const schoolSettings = getSchoolSettings(activeDb);
    const userCount = activeDb.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };

    console.log(`[Restore] Successfully restored database for "${schoolSettings.schoolName}" (${userCount.c} users).`);

    recordAuditLog(
      'BACKUP_RESTORED',
      'INFO',
      `Restored backup "${manifest.backupName}" created on ${manifest.createdAt}`,
      opts?.performedBy || 'ADMIN',
      activeDb
    );

    return {
      success: true,
      restoredAt: new Date().toISOString(),
      manifest,
    };
  } catch (restoreErr: unknown) {
    const msg = restoreErr instanceof Error ? restoreErr.message : 'Unknown restore error';
    console.error('[Restore] Restore failed! Rolling back to pre-restore safety snapshot...', restoreErr);

    // Attempt rollback to safety backup
    try {
      const rollbackFileBuffer = fs.readFileSync(safetyBackupPath);
      const rollbackGzipped = rollbackFileBuffer.subarray(MAGIC_HEADER.length);
      const rollbackUncompressed = zlib.gunzipSync(rollbackGzipped);
      const rollbackPackage = JSON.parse(rollbackUncompressed.toString('utf8')) as BackupPackage;

      closeDatabase();
      fs.writeFileSync(currentDbPath, Buffer.from(rollbackPackage.databaseBase64, 'base64'));
      initDatabase();
      console.log('[Restore] Rollback to safety snapshot completed successfully.');
    } catch (rollbackErr) {
      console.error('[Restore] CRITICAL: Rollback failed:', rollbackErr);
    }

    return {
      success: false,
      error: `Restore failed: ${msg}. Previous data was restored from safety snapshot.`,
    };
  }
}

/**
 * Lists available backups in default backup directory, safety snapshot directory,
 * and records tracked in the database.
 */
export function listBackups(db?: Database.Database): BackupListItem[] {
  const results: BackupListItem[] = [];
  const seenPaths = new Set<string>();

  const scanDirs = [
    { dir: getDefaultBackupDir(), isSafety: false },
    { dir: getSafetyBackupDir(), isSafety: true },
  ];

  // Also scan legacy backups folder if it exists
  let appDataDir = '';
  try {
    appDataDir = app && typeof app.getPath === 'function' ? app.getPath('appData') : (process.env.APPDATA || '');
  } catch {
    appDataDir = process.env.APPDATA || '';
  }
  if (appDataDir) {
    const legacyBackupDir = path.join(appDataDir, 'school-management-system', 'backups');
    if (fs.existsSync(legacyBackupDir) && path.resolve(legacyBackupDir) !== path.resolve(getDefaultBackupDir())) {
      scanDirs.push({ dir: legacyBackupDir, isSafety: false });
    }
  }

  for (const { dir, isSafety } of scanDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.toLowerCase().endsWith('.smbak')) {
          const fullPath = path.resolve(path.join(dir, f));
          if (seenPaths.has(fullPath)) continue;
          seenPaths.add(fullPath);

          try {
            const stats = fs.statSync(fullPath);
            const validation = validateBackup(fullPath);

            results.push({
              fileName: f,
              filePath: fullPath,
              fileSizeBytes: stats.size,
              createdAt: validation.manifest?.createdAt || stats.mtime.toISOString(),
              schoolName: validation.manifest?.schoolName || 'MS Institute Management System',
              schemaVersion: validation.manifest?.schemaVersion || 0,
              isValid: validation.valid,
              isSafetySnapshot: isSafety || f.startsWith('PreRestore_'),
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {}
  }

  // Also check database metadata table for custom location backups that exist on disk
  try {
    const database = db ?? getDatabase();
    const rows = database.prepare(`
      SELECT backup_name, backup_path, backup_size, database_version, app_version, school_name, created_at
      FROM backup_metadata
      WHERE status = 'Valid'
      ORDER BY id DESC
    `).all() as Array<{
      backup_name: string;
      backup_path: string;
      backup_size: number;
      database_version: number;
      app_version: string;
      school_name: string;
      created_at: string;
    }>;

    for (const r of rows) {
      if (r.backup_path && fs.existsSync(r.backup_path)) {
        const fullPath = path.resolve(r.backup_path);
        if (!seenPaths.has(fullPath)) {
          seenPaths.add(fullPath);
          const stats = fs.statSync(fullPath);
          results.push({
            fileName: r.backup_name || path.basename(fullPath),
            filePath: fullPath,
            fileSizeBytes: stats.size || r.backup_size,
            createdAt: r.created_at,
            schoolName: r.school_name || 'MS Institute Management System',
            schemaVersion: r.database_version || 8,
            isValid: true,
            isSafetySnapshot: (r.backup_name || '').startsWith('PreRestore_'),
          });
        }
      }
    }
  } catch {}

  // Sort descending by creation date
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}

/**
 * Retrieves the last successful backup record.
 */
export function getLastBackupInfo(db?: Database.Database): {
  lastBackupDate: string | null;
  backupName: string | null;
  backupSizeBytes: number | null;
} {
  const database = db ?? getDatabase();
  const row = database.prepare(`
    SELECT created_at, backup_name, backup_size
    FROM backup_metadata
    WHERE status = 'Valid'
    ORDER BY id DESC
    LIMIT 1
  `).get() as { created_at: string; backup_name: string; backup_size: number } | undefined;

  if (!row) {
    return {
      lastBackupDate: null,
      backupName: null,
      backupSizeBytes: null,
    };
  }

  return {
    lastBackupDate: row.created_at,
    backupName: row.backup_name,
    backupSizeBytes: row.backup_size,
  };
}



