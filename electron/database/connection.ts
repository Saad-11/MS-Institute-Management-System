/**
 * SQLite Database Connection Management
 * 
 * Manages the SQLite database connection using `better-sqlite3`.
 * Stores the database in Electron's `app.getPath('userData')` directory.
 * Configures WAL mode and foreign key enforcement for high performance and integrity.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let dbInstance: Database.Database | null = null;
let activeDbPath = '';

/**
 * Ensures backward compatibility with existing installations.
 * If data exists in the legacy AppData folder (%APPDATA%\school-management-system),
 * it is safely migrated to the active userData directory (%APPDATA%\MS Institute Management System).
 * The original legacy files are preserved untouched as a safety backup.
 * If migration cannot be performed, it safely falls back to the legacy path.
 */
export function ensureUserDataMigrated(): void {
  if (!app || typeof app.getPath !== 'function') return;

  try {
    const currentUserData = app.getPath('userData');
    let appDataDir: string;
    try {
      appDataDir = app.getPath('appData');
    } catch {
      appDataDir = process.env.APPDATA || '';
    }

    if (!appDataDir) return;

    const targetDbPath = path.join(currentUserData, 'school_data.sqlite');

    // Candidate legacy directories
    const legacyDirs = [
      path.join(appDataDir, 'school-management-system'),
      path.join(appDataDir, 'School Management System'),
    ];

    // Find first legacy dir that actually has school_data.sqlite
    let existingLegacyDir: string | null = null;
    for (const lDir of legacyDirs) {
      if (path.resolve(lDir) !== path.resolve(currentUserData)) {
        if (fs.existsSync(path.join(lDir, 'school_data.sqlite'))) {
          existingLegacyDir = lDir;
          break;
        }
      }
    }

    if (!existingLegacyDir) {
      return;
    }

    const legacyDbPath = path.join(existingLegacyDir, 'school_data.sqlite');

    // If target DB doesn't exist yet, copy database and assets safely
    if (!fs.existsSync(targetDbPath)) {
      console.log(`[DataMigration] Found existing database in legacy directory: ${existingLegacyDir}`);
      fs.mkdirSync(currentUserData, { recursive: true });

      // Copy main database file
      fs.copyFileSync(legacyDbPath, targetDbPath);
      console.log(`[DataMigration] Copied database to: ${targetDbPath}`);

      // Copy WAL & SHM files if present
      const walSource = path.join(existingLegacyDir, 'school_data.sqlite-wal');
      const walTarget = path.join(currentUserData, 'school_data.sqlite-wal');
      if (fs.existsSync(walSource)) {
        try { fs.copyFileSync(walSource, walTarget); } catch {}
      }

      const shmSource = path.join(existingLegacyDir, 'school_data.sqlite-shm');
      const shmTarget = path.join(currentUserData, 'school_data.sqlite-shm');
      if (fs.existsSync(shmSource)) {
        try { fs.copyFileSync(shmSource, shmTarget); } catch {}
      }

      // Copy uploads directory (logos, student & teacher photos)
      const legacyUploads = path.join(existingLegacyDir, 'uploads');
      const targetUploads = path.join(currentUserData, 'uploads');
      if (fs.existsSync(legacyUploads)) {
        try {
          fs.cpSync(legacyUploads, targetUploads, { recursive: true });
          console.log(`[DataMigration] Copied uploads folder to: ${targetUploads}`);
        } catch (copyErr) {
          console.warn('[DataMigration] Warning copying uploads directory:', copyErr);
        }
      }

      // Copy backups directory
      const legacyBackups = path.join(existingLegacyDir, 'backups');
      const targetBackups = path.join(currentUserData, 'backups');
      if (fs.existsSync(legacyBackups)) {
        try {
          fs.cpSync(legacyBackups, targetBackups, { recursive: true });
          console.log(`[DataMigration] Copied backups folder to: ${targetBackups}`);
        } catch (copyErr) {
          console.warn('[DataMigration] Warning copying backups directory:', copyErr);
        }
      }

      console.log('[DataMigration] Migration completed successfully. Legacy data preserved intact.');
    }
  } catch (err) {
    console.error('[DataMigration] Error during data migration check:', err);
  }
}

/**
 * Resolves the path to the SQLite database file.
 * Stored in %APPDATA%/MS Institute Management System/school_data.sqlite on Windows.
 */
export function getDatabasePath(): string {
  if (activeDbPath) {
    return activeDbPath;
  }
  // If running inside Electron
  if (app && typeof app.getPath === 'function') {
    ensureUserDataMigrated();
    const userDataPath = app.getPath('userData');
    const primaryPath = path.join(userDataPath, 'school_data.sqlite');
    if (fs.existsSync(primaryPath)) {
      return primaryPath;
    }
    // Fallback check: if primary doesn't exist, check legacy path directly
    const appData = process.env.APPDATA || (typeof app.getPath === 'function' ? app.getPath('appData') : '');
    if (appData) {
      const legacyPath = path.join(appData, 'school-management-system', 'school_data.sqlite');
      if (fs.existsSync(legacyPath)) {
        return legacyPath;
      }
    }
    return primaryPath;
  }
  // Fallback for tests/standalone scripts
  const localDir = path.resolve(process.cwd(), 'app-data');
  return path.join(localDir, 'school_data.sqlite');
}

/**
 * Initializes and opens the SQLite database.
 * @param customPath Optional custom database file path (used during automated tests).
 */
export function initDatabase(customPath?: string): Database.Database {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const targetPath = customPath || getDatabasePath();
  activeDbPath = targetPath;

  // Ensure directory exists
  const dbDir = path.dirname(targetPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[Database] Connecting to SQLite database at: ${targetPath}`);

  try {
    dbInstance = new Database(targetPath, {
      verbose: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[SQL] ${msg}`) : undefined,
    });

    // ─── Database Integrity & Performance PRAGMAs ───────────────────────────
    dbInstance.pragma('foreign_keys = ON');       // Enforce relational integrity
    dbInstance.pragma('journal_mode = WAL');       // Write-Ahead Logging for high reliability
    dbInstance.pragma('synchronous = NORMAL');     // Faster writes with safe durability in WAL
    dbInstance.pragma('cache_size = -64000');      // 64MB memory cache for snappy queries
    dbInstance.pragma('temp_store = MEMORY');      // Use RAM for temporary tables & sorting
    dbInstance.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O for direct RAM reads
    dbInstance.pragma('busy_timeout = 5000');      // Wait up to 5s before failing on lock
    dbInstance.pragma('journal_size_limit = 67108864'); // Limit WAL file size to 64MB

    return dbInstance;
  } catch (error) {
    console.error(`[Database] Failed to open SQLite database at ${targetPath}:`, error);
    throw error;
  }
}

/**
 * Returns the active database instance. Throws if not initialized.
 */
export function getDatabase(): Database.Database {
  if (!dbInstance || !dbInstance.open) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Closes the database connection cleanly.
 */
export function closeDatabase(): void {
  if (dbInstance && dbInstance.open) {
    console.log('[Database] Closing SQLite database connection');
    dbInstance.close();
    dbInstance = null;
  }
}
