/**
 * Subject Management & Class-Subject Assignment Service
 * 
 * Manages academic subjects (Mathematics, English, Physics, etc.)
 * and associates them with classes through the class_subjects junction table.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface SubjectItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  assignedClassesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubjectItem {
  id: number;
  classId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface SubjectRow {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: number;
  assigned_classes_count?: number;
  created_at: string;
  updated_at: string;
}

interface ClassSubjectRow {
  id: number;
  class_id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  display_order: number;
  is_active: number;
  created_at: string;
}

function mapSubjectRow(row: SubjectRow): SubjectItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? '',
    description: row.description ?? '',
    isActive: row.is_active === 1,
    assignedClassesCount: row.assigned_classes_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClassSubjectRow(row: ClassSubjectRow): ClassSubjectItem {
  return {
    id: row.id,
    classId: row.class_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectCode: row.subject_code ?? '',
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

// ─── SUBJECT OPERATIONS ────────────────────────────────────────────────────────

/**
 * Returns all subjects, optionally filtered by search query.
 */
export function getAllSubjects(
  searchQuery?: string,
  includeInactive = true,
  db?: Database.Database
): SubjectItem[] {
  const database = db ?? getDatabase();
  const q = (searchQuery || '').trim();

  let query = `
    SELECT s.*,
           (SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id = s.id) as assigned_classes_count
    FROM subjects s
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (!includeInactive) {
    query += ' AND s.is_active = 1';
  }

  if (q) {
    query += ' AND (s.name LIKE ? OR s.code LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY s.name ASC';

  const rows = database.prepare(query).all(...params) as SubjectRow[];
  return rows.map(mapSubjectRow);
}

/**
 * Gets a single subject by ID.
 */
export function getSubjectById(id: number, db?: Database.Database): SubjectItem | null {
  const database = db ?? getDatabase();
  const row = database.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id = s.id) as assigned_classes_count
    FROM subjects s
    WHERE s.id = ?
  `).get(id) as SubjectRow | undefined;

  return row ? mapSubjectRow(row) : null;
}

/**
 * Creates a new subject.
 */
export function createSubject(
  params: {
    sessionToken?: string;
    name: string;
    code?: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; subject?: SubjectItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const code = (params.code || '').trim();
  const description = (params.description || '').trim();
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!name) {
    return { success: false, error: 'Subject name is required (e.g. Mathematics, English).' };
  }

  // Duplicate check (case-insensitive)
  const existing = database
    .prepare('SELECT id FROM subjects WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) {
    return { success: false, error: `Subject "${name}" already exists.` };
  }

  try {
    const stmt = database.prepare(`
      INSERT INTO subjects (name, code, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const res = stmt.run(name, code, description, isActive);
    const newId = Number(res.lastInsertRowid);

    const created = getSubjectById(newId, database);
    console.log(`[SubjectService] Created subject: ${name} (ID: ${newId})`);

    return {
      success: true,
      subject: created ?? undefined,
    };
  } catch (err) {
    console.error('[SubjectService] Failed to create subject:', err);
    return { success: false, error: 'Failed to create subject.' };
  }
}

/**
 * Updates an existing subject.
 */
export function updateSubject(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    code?: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; subject?: SubjectItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const code = (params.code || '').trim();
  const description = (params.description || '').trim();
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!id || id <= 0) {
    return { success: false, error: 'Invalid subject ID.' };
  }

  if (!name) {
    return { success: false, error: 'Subject name is required.' };
  }

  // Duplicate check excluding self
  const existing = database
    .prepare('SELECT id FROM subjects WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, id);
  if (existing) {
    return { success: false, error: `Subject "${name}" already exists.` };
  }

  try {
    database.prepare(`
      UPDATE subjects
      SET name = ?, code = ?, description = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, code, description, isActive, id);

    const updated = getSubjectById(id, database);
    console.log(`[SubjectService] Updated subject: ${name} (ID: ${id})`);

    return {
      success: true,
      subject: updated ?? undefined,
    };
  } catch (err) {
    console.error('[SubjectService] Failed to update subject:', err);
    return { success: false, error: 'Failed to update subject.' };
  }
}

/**
 * Toggles a subject's active status.
 */
export function toggleSubjectStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; subject?: SubjectItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database.prepare(`
      UPDATE subjects
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive, id);

    const updated = getSubjectById(id, database);
    return { success: true, subject: updated ?? undefined };
  } catch (err) {
    console.error('[SubjectService] Failed to toggle subject status:', err);
    return { success: false, error: 'Failed to update subject status.' };
  }
}

// ─── CLASS-SUBJECT ASSIGNMENT OPERATIONS ───────────────────────────────────────

/**
 * Returns all subjects assigned to a specified class.
 */
export function getClassSubjects(classId: number, db?: Database.Database): ClassSubjectItem[] {
  const database = db ?? getDatabase();
  const rows = database.prepare(`
    SELECT cs.id,
           cs.class_id,
           cs.subject_id,
           s.name as subject_name,
           s.code as subject_code,
           cs.display_order,
           cs.is_active,
           cs.created_at
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    WHERE cs.class_id = ?
    ORDER BY cs.display_order ASC, s.name ASC
  `).all(classId) as ClassSubjectRow[];

  return rows.map(mapClassSubjectRow);
}

/**
 * Assigns an existing subject to a class.
 */
export function assignSubjectToClass(
  params: {
    sessionToken?: string;
    classId: number;
    subjectId: number;
    displayOrder?: number;
  },
  db?: Database.Database
): { success: boolean; classSubject?: ClassSubjectItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const classId = Number(params.classId);
  const subjectId = Number(params.subjectId);
  const displayOrder = Number(params.displayOrder) || 0;

  if (!classId || classId <= 0 || !subjectId || subjectId <= 0) {
    return { success: false, error: 'Valid Class and Subject are required.' };
  }

  // Verify class exists
  const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
  if (!cls) {
    return { success: false, error: 'Selected class does not exist.' };
  }

  // Verify subject exists
  const subj = database.prepare('SELECT id FROM subjects WHERE id = ?').get(subjectId);
  if (!subj) {
    return { success: false, error: 'Selected subject does not exist.' };
  }

  // Check duplicate assignment
  const existing = database
    .prepare('SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?')
    .get(classId, subjectId);
  if (existing) {
    return { success: false, error: 'This subject is already assigned to this class.' };
  }

  try {
    const stmt = database.prepare(`
      INSERT INTO class_subjects (class_id, subject_id, display_order, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `);
    const res = stmt.run(classId, subjectId, displayOrder);
    const newId = Number(res.lastInsertRowid);

    const created = database.prepare(`
      SELECT cs.id,
             cs.class_id,
             cs.subject_id,
             s.name as subject_name,
             s.code as subject_code,
             cs.display_order,
             cs.is_active,
             cs.created_at
      FROM class_subjects cs
      JOIN subjects s ON s.id = cs.subject_id
      WHERE cs.id = ?
    `).get(newId) as ClassSubjectRow;

    console.log(`[SubjectService] Assigned subject ${subjectId} to class ${classId}`);

    // Auto-sync into active examinations that include this class
    try {
      const activeExams = database.prepare("SELECT id FROM examinations WHERE status != 'Closed'").all() as Array<{ id: number }>;
      const insertExamSub = database.prepare(`
        INSERT INTO examination_subjects (
          examination_id, class_id, subject_id, max_marks, passing_marks,
          display_order, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, 100, 40, ?, 1, datetime('now'), datetime('now'))
      `);
      for (const ex of activeExams) {
        const hasClass = database.prepare('SELECT 1 FROM examination_subjects WHERE examination_id = ? AND class_id = ? LIMIT 1').get(ex.id, classId);
        if (hasClass) {
          const alreadyAssigned = database.prepare('SELECT 1 FROM examination_subjects WHERE examination_id = ? AND class_id = ? AND subject_id = ?').get(ex.id, classId, subjectId);
          if (!alreadyAssigned) {
            insertExamSub.run(ex.id, classId, subjectId, displayOrder);
          }
        }
      }
    } catch (examSyncErr) {
      console.warn('[SubjectService] Auto-sync to active examinations warning:', examSyncErr);
    }

    return {
      success: true,
      classSubject: mapClassSubjectRow(created),
    };
  } catch (err) {
    console.error('[SubjectService] Failed to assign subject to class:', err);
    return { success: false, error: 'Failed to assign subject to class.' };
  }
}

/**
 * Removes a subject assignment from a class.
 */
export function removeClassSubject(
  params: { sessionToken?: string; classId: number; subjectId: number },
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const classId = Number(params.classId);
  const subjectId = Number(params.subjectId);

  try {
    database
      .prepare('DELETE FROM class_subjects WHERE class_id = ? AND subject_id = ?')
      .run(classId, subjectId);

    // Also remove from active examinations if no student marks are recorded
    try {
      const unrecordedExamSubs = database.prepare(`
        SELECT es.id FROM examination_subjects es
        JOIN examinations e ON e.id = es.examination_id
        WHERE es.class_id = ? AND es.subject_id = ? AND e.status != 'Closed'
          AND NOT EXISTS (SELECT 1 FROM exam_marks em WHERE em.examination_subject_id = es.id)
      `).all(classId, subjectId) as Array<{ id: number }>;

      for (const es of unrecordedExamSubs) {
        database.prepare('DELETE FROM examination_subjects WHERE id = ?').run(es.id);
      }
    } catch (cleanupErr) {
      console.warn('[SubjectService] Examination subject cleanup warning:', cleanupErr);
    }

    console.log(`[SubjectService] Removed subject ${subjectId} from class ${classId}`);
    return { success: true };
  } catch (err) {
    console.error('[SubjectService] Failed to remove subject from class:', err);
    return { success: false, error: 'Failed to remove class-subject assignment.' };
  }
}
