/**
 * Academic Session Management Service
 * 
 * Manages academic sessions (e.g. 2026-2027), active status synchronization,
 * date validation, and transactional updates to school settings.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface AcademicSession {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AcademicSessionRow {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: AcademicSessionRow): AcademicSession {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Returns all academic sessions, optionally filtered by search query.
 */
export function getAllSessions(searchQuery?: string, db?: Database.Database): AcademicSession[] {
  const database = db ?? getDatabase();
  const q = (searchQuery || '').trim();

  let query = 'SELECT * FROM academic_sessions';
  const params: unknown[] = [];

  if (q) {
    query += ' WHERE name LIKE ?';
    params.push(`%${q}%`);
  }

  query += ' ORDER BY start_date DESC, name DESC';

  const rows = database.prepare(query).all(...params) as AcademicSessionRow[];
  return rows.map(mapRow);
}

/**
 * Gets the currently active academic session if one exists.
 */
export function getActiveSession(db?: Database.Database): AcademicSession | null {
  const database = db ?? getDatabase();
  const row = database
    .prepare('SELECT * FROM academic_sessions WHERE is_active = 1 LIMIT 1')
    .get() as AcademicSessionRow | undefined;
  return row ? mapRow(row) : null;
}

/**
 * Creates a new academic session.
 */
export function createSession(
  params: {
    sessionToken?: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; session?: AcademicSession; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const isActive = Boolean(params.isActive);

  if (!name) {
    return { success: false, error: 'Session name is required (e.g. 2026-2027).' };
  }

  if (!isValidDate(startDate)) {
    return { success: false, error: 'Start date must be in YYYY-MM-DD format.' };
  }

  if (!isValidDate(endDate)) {
    return { success: false, error: 'End date must be in YYYY-MM-DD format.' };
  }

  if (startDate > endDate) {
    return { success: false, error: 'End date cannot be earlier than start date.' };
  }

  // Duplicate check (case-insensitive)
  const existing = database
    .prepare('SELECT id FROM academic_sessions WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) {
    return { success: false, error: `Academic session "${name}" already exists.` };
  }

  try {
    let newId = 0;

    const tx = database.transaction(() => {
      // If marked active, ensure only one active session exists
      if (isActive) {
        database.prepare('UPDATE academic_sessions SET is_active = 0').run();
      }

      const stmt = database.prepare(`
        INSERT INTO academic_sessions (name, start_date, end_date, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const res = stmt.run(name, startDate, endDate, isActive ? 1 : 0);
      newId = Number(res.lastInsertRowid);

      // If active, sync to school_settings
      if (isActive) {
        database.prepare(`
          UPDATE school_settings
          SET academic_session = ?, updated_at = datetime('now')
          WHERE id = 1
        `).run(name);
      }
    });

    tx();

    const createdRow = database
      .prepare('SELECT * FROM academic_sessions WHERE id = ?')
      .get(newId) as AcademicSessionRow;

    console.log(`[AcademicSession] Created session: ${name} (ID: ${newId}, Active: ${isActive})`);

    return {
      success: true,
      session: mapRow(createdRow),
    };
  } catch (err) {
    console.error('[AcademicSession] Failed to create session:', err);
    return { success: false, error: 'Failed to create academic session.' };
  }
}

/**
 * Updates an existing academic session.
 */
export function updateSession(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; session?: AcademicSession; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const isActive = Boolean(params.isActive);

  if (!id || id <= 0) {
    return { success: false, error: 'Invalid session ID.' };
  }

  if (!name) {
    return { success: false, error: 'Session name is required.' };
  }

  if (!isValidDate(startDate)) {
    return { success: false, error: 'Start date must be in YYYY-MM-DD format.' };
  }

  if (!isValidDate(endDate)) {
    return { success: false, error: 'End date must be in YYYY-MM-DD format.' };
  }

  if (startDate > endDate) {
    return { success: false, error: 'End date cannot be earlier than start date.' };
  }

  // Duplicate check excluding self
  const existing = database
    .prepare('SELECT id FROM academic_sessions WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, id);
  if (existing) {
    return { success: false, error: `Academic session "${name}" already exists.` };
  }

  try {
    const tx = database.transaction(() => {
      if (isActive) {
        database.prepare('UPDATE academic_sessions SET is_active = 0 WHERE id != ?').run(id);
      }

      database.prepare(`
        UPDATE academic_sessions
        SET name = ?, start_date = ?, end_date = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, startDate, endDate, isActive ? 1 : 0, id);

      if (isActive) {
        database.prepare(`
          UPDATE school_settings
          SET academic_session = ?, updated_at = datetime('now')
          WHERE id = 1
        `).run(name);
      }
    });

    tx();

    const updatedRow = database
      .prepare('SELECT * FROM academic_sessions WHERE id = ?')
      .get(id) as AcademicSessionRow;

    console.log(`[AcademicSession] Updated session: ${name} (ID: ${id})`);

    return {
      success: true,
      session: mapRow(updatedRow),
    };
  } catch (err) {
    console.error('[AcademicSession] Failed to update session:', err);
    return { success: false, error: 'Failed to update academic session.' };
  }
}

/**
 * Activates an academic session and deactivates all others in a transaction.
 */
export function activateSession(
  params: { sessionToken?: string; id: number },
  db?: Database.Database
): { success: boolean; session?: AcademicSession; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);

  const target = database
    .prepare('SELECT * FROM academic_sessions WHERE id = ?')
    .get(id) as AcademicSessionRow | undefined;

  if (!target) {
    return { success: false, error: 'Academic session not found.' };
  }

  try {
    const tx = database.transaction(() => {
      // Deactivate all
      database.prepare('UPDATE academic_sessions SET is_active = 0').run();
      // Activate target
      database.prepare("UPDATE academic_sessions SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      // Sync with school_settings
      database.prepare(`
        UPDATE school_settings
        SET academic_session = ?, updated_at = datetime('now')
        WHERE id = 1
      `).run(target.name);
    });

    tx();

    const updatedRow = database
      .prepare('SELECT * FROM academic_sessions WHERE id = ?')
      .get(id) as AcademicSessionRow;

    console.log(`[AcademicSession] Activated session: ${target.name} (ID: ${id})`);

    return {
      success: true,
      session: mapRow(updatedRow),
    };
  } catch (err) {
    console.error('[AcademicSession] Failed to activate session:', err);
    return { success: false, error: 'Failed to activate academic session.' };
  }
}

/**
 * Deactivates an academic session.
 */
export function deactivateSession(
  params: { sessionToken?: string; id: number },
  db?: Database.Database
): { success: boolean; session?: AcademicSession; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);

  const target = database
    .prepare('SELECT * FROM academic_sessions WHERE id = ?')
    .get(id) as AcademicSessionRow | undefined;

  if (!target) {
    return { success: false, error: 'Academic session not found.' };
  }

  try {
    const tx = database.transaction(() => {
      database.prepare("UPDATE academic_sessions SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);

      // If this was the active session recorded in school_settings, clear it
      const settings = database.prepare('SELECT academic_session FROM school_settings WHERE id = 1').get() as { academic_session: string } | undefined;
      if (settings && settings.academic_session === target.name) {
        database.prepare("UPDATE school_settings SET academic_session = '', updated_at = datetime('now') WHERE id = 1").run();
      }
    });

    tx();

    const updatedRow = database
      .prepare('SELECT * FROM academic_sessions WHERE id = ?')
      .get(id) as AcademicSessionRow;

    console.log(`[AcademicSession] Deactivated session: ${target.name} (ID: ${id})`);

    return {
      success: true,
      session: mapRow(updatedRow),
    };
  } catch (err) {
    console.error('[AcademicSession] Failed to deactivate session:', err);
    return { success: false, error: 'Failed to deactivate academic session.' };
  }
}
