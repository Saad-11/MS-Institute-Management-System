/**
 * Class & Section Management Service
 * 
 * Manages classes (e.g. Nursery, Class 1, Class 10) and their associated sections (A, B, Blue).
 * Supports ordering, activation/deactivation, and duplicate prevention.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface ClassItem {
  id: number;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  sectionCount: number;
  subjectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectionItem {
  id: number;
  classId: number;
  name: string;
  description: string;
  isActive: boolean;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSectionInput {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface ClassRow {
  id: number;
  name: string;
  code: string;
  display_order: number;
  is_active: number;
  section_count?: number;
  subject_count?: number;
  created_at: string;
  updated_at: string;
}

interface SectionRow {
  id: number;
  class_id: number;
  name: string;
  description: string;
  is_active: number;
  student_count?: number;
  created_at: string;
  updated_at: string;
}

function mapClassRow(row: ClassRow): ClassItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? '',
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active === 1,
    sectionCount: row.section_count ?? 0,
    subjectCount: row.subject_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSectionRow(row: SectionRow): SectionItem {
  return {
    id: row.id,
    classId: row.class_id,
    name: row.name,
    description: row.description ?? '',
    isActive: row.is_active === 1,
    studentCount: row.student_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── CLASS OPERATIONS ──────────────────────────────────────────────────────────

/**
 * Returns all classes ordered by display_order then name.
 * Includes calculated counts of sections and assigned subjects.
 */
export function getAllClasses(
  searchQuery?: string,
  includeInactive = true,
  db?: Database.Database
): ClassItem[] {
  const database = db ?? getDatabase();
  const q = (searchQuery || '').trim();

  let query = `
    SELECT c.*,
           (SELECT COUNT(*) FROM sections s WHERE s.class_id = c.id) as section_count,
           (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id = c.id) as subject_count
    FROM classes c
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (!includeInactive) {
    query += ' AND c.is_active = 1';
  }

  if (q) {
    query += ' AND (c.name LIKE ? OR c.code LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY c.display_order ASC, c.name ASC';

  const rows = database.prepare(query).all(...params) as ClassRow[];
  return rows.map(mapClassRow);
}

/**
 * Gets a single class by ID.
 */
export function getClassById(id: number, db?: Database.Database): ClassItem | null {
  const database = db ?? getDatabase();
  const row = database.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM sections s WHERE s.class_id = c.id) as section_count,
           (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id = c.id) as subject_count
    FROM classes c
    WHERE c.id = ?
  `).get(id) as ClassRow | undefined;

  return row ? mapClassRow(row) : null;
}

/**
 * Creates a new class with optional initial sections.
 */
export function createClass(
  params: {
    sessionToken?: string;
    name: string;
    code?: string;
    displayOrder?: number;
    isActive?: boolean;
    sections?: Array<string | ClassSectionInput>;
  },
  db?: Database.Database
): { success: boolean; classItem?: ClassItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const code = (params.code || '').trim();
  const displayOrder = Number(params.displayOrder) || 0;
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!name) {
    return { success: false, error: 'Class name is required (e.g. Class 1, Grade 9).' };
  }

  // Duplicate check (case-insensitive)
  const existing = database
    .prepare('SELECT id FROM classes WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) {
    return { success: false, error: `Class "${name}" already exists.` };
  }

  // Process and validate sections if provided
  const cleanedSections: Array<{ name: string; description: string; isActive: number }> = [];
  if (params.sections && Array.isArray(params.sections)) {
    const sectionNameSet = new Set<string>();
    for (const item of params.sections) {
      const sName = typeof item === 'string' ? item.trim() : (item.name || '').trim();
      const sDesc = typeof item === 'string' ? '' : (item.description || '').trim();
      const sActive = typeof item === 'string' ? 1 : (item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1);

      if (!sName) continue; // ignore empty entries
      const lower = sName.toLowerCase();
      if (sectionNameSet.has(lower)) {
        return { success: false, error: `Duplicate section name "${sName}" specified for this class.` };
      }
      sectionNameSet.add(lower);
      cleanedSections.push({ name: sName, description: sDesc, isActive: sActive });
    }
  }

  try {
    const runTransaction = database.transaction(() => {
      const stmt = database.prepare(`
        INSERT INTO classes (name, code, display_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      const res = stmt.run(name, code, displayOrder, isActive);
      const newClassId = Number(res.lastInsertRowid);

      if (cleanedSections.length > 0) {
        const insertSecStmt = database.prepare(`
          INSERT INTO sections (class_id, name, description, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        for (const sec of cleanedSections) {
          insertSecStmt.run(newClassId, sec.name, sec.description, sec.isActive);
        }
      }
      return newClassId;
    });

    const newId = runTransaction();
    const created = getClassById(newId, database);
    console.log(`[ClassService] Created class: ${name} (ID: ${newId}) with ${cleanedSections.length} sections`);

    return {
      success: true,
      classItem: created ?? undefined,
    };
  } catch (err: unknown) {
    console.error('[ClassService] Failed to create class:', err);
    const message = err instanceof Error ? err.message : 'Failed to create class.';
    return { success: false, error: message };
  }
}

/**
 * Updates an existing class and synchronizes its sections safely.
 */
export function updateClass(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    code?: string;
    displayOrder?: number;
    isActive?: boolean;
    sections?: Array<string | ClassSectionInput>;
  },
  db?: Database.Database
): { success: boolean; classItem?: ClassItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const code = (params.code || '').trim();
  const displayOrder = Number(params.displayOrder) || 0;
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!id || id <= 0) {
    return { success: false, error: 'Invalid class ID.' };
  }

  if (!name) {
    return { success: false, error: 'Class name is required.' };
  }

  // Duplicate check excluding self
  const existing = database
    .prepare('SELECT id FROM classes WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, id);
  if (existing) {
    return { success: false, error: `Class "${name}" already exists.` };
  }

  // Process and validate sections if provided
  let cleanedSections: Array<{ id?: number; name: string; description: string; isActive: number }> | null = null;
  if (params.sections !== undefined) {
    cleanedSections = [];
    if (Array.isArray(params.sections)) {
      const sectionNameSet = new Set<string>();
      for (const item of params.sections) {
        const sId = typeof item === 'object' && item.id ? Number(item.id) : undefined;
        const sName = typeof item === 'string' ? item.trim() : (item.name || '').trim();
        const sDesc = typeof item === 'string' ? '' : (item.description || '').trim();
        const sActive = typeof item === 'string' ? 1 : (item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1);

        if (!sName) continue;
        const lower = sName.toLowerCase();
        if (sectionNameSet.has(lower)) {
          return { success: false, error: `Duplicate section name "${sName}" specified for this class.` };
        }
        sectionNameSet.add(lower);
        cleanedSections.push({ id: sId, name: sName, description: sDesc, isActive: sActive });
      }
    }
  }

  try {
    const runTransaction = database.transaction(() => {
      // 1. Update class details
      database.prepare(`
        UPDATE classes
        SET name = ?, code = ?, display_order = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, code, displayOrder, isActive, id);

      // 2. Synchronize sections if provided
      if (cleanedSections !== null) {
        const existingSections = database.prepare('SELECT * FROM sections WHERE class_id = ?').all(id) as SectionRow[];
        const processedSectionIds = new Set<number>();

        const updateSecStmt = database.prepare(`
          UPDATE sections
          SET name = ?, description = ?, is_active = ?, updated_at = datetime('now')
          WHERE id = ? AND class_id = ?
        `);
        const insertSecStmt = database.prepare(`
          INSERT INTO sections (class_id, name, description, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `);

        for (const sec of cleanedSections) {
          if (sec.id) {
            // Updating existing section by ID
            updateSecStmt.run(sec.name, sec.description, sec.isActive, sec.id, id);
            processedSectionIds.add(sec.id);
          } else {
            // Check if section with same name already exists in this class
            const matchExisting = existingSections.find(
              (e) => e.name.toLowerCase() === sec.name.toLowerCase()
            );
            if (matchExisting) {
              updateSecStmt.run(sec.name, sec.description, sec.isActive, matchExisting.id, id);
              processedSectionIds.add(matchExisting.id);
            } else {
              // Brand new section
              const insertRes = insertSecStmt.run(id, sec.name, sec.description, sec.isActive);
              processedSectionIds.add(Number(insertRes.lastInsertRowid));
            }
          }
        }

        // For removed sections: check references across student enrollments, attendance, fee records, promotion logs
        const checkRefsStmt = database.prepare(`
          SELECT (
            (SELECT COUNT(*) FROM student_enrollments WHERE section_id = ?) +
            (SELECT COUNT(*) FROM attendance WHERE section_id = ?) +
            (SELECT COUNT(*) FROM fee_records WHERE section_id = ?) +
            (SELECT COUNT(*) FROM promotion_logs WHERE from_section_id = ? OR to_section_id = ?)
          ) as total_refs
        `);

        for (const existingSec of existingSections) {
          if (!processedSectionIds.has(existingSec.id)) {
            const refRow = checkRefsStmt.get(existingSec.id, existingSec.id, existingSec.id, existingSec.id, existingSec.id) as { total_refs: number };
            if (refRow.total_refs > 0) {
              // Section has historic records: deactivate safely instead of deleting to maintain relational integrity
              database.prepare(`
                UPDATE sections
                SET is_active = 0, updated_at = datetime('now')
                WHERE id = ?
              `).run(existingSec.id);
              console.log(`[ClassService] Safely deactivated section ID ${existingSec.id} ("${existingSec.name}") because it has ${refRow.total_refs} active/historic records.`);
            } else {
              // Safe to delete clean
              database.prepare('DELETE FROM sections WHERE id = ?').run(existingSec.id);
              console.log(`[ClassService] Deleted unreferenced section ID ${existingSec.id} ("${existingSec.name}").`);
            }
          }
        }
      }
    });

    runTransaction();

    const updated = getClassById(id, database);
    console.log(`[ClassService] Updated class: ${name} (ID: ${id})`);

    return {
      success: true,
      classItem: updated ?? undefined,
    };
  } catch (err: unknown) {
    console.error('[ClassService] Failed to update class:', err);
    const message = err instanceof Error ? err.message : 'Failed to update class.';
    return { success: false, error: message };
  }
}

/**
 * Activates or deactivates a class.
 */
export function toggleClassStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; classItem?: ClassItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database.prepare(`
      UPDATE classes
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive, id);

    const updated = getClassById(id, database);
    return { success: true, classItem: updated ?? undefined };
  } catch (err) {
    console.error('[ClassService] Failed to toggle class status:', err);
    return { success: false, error: 'Failed to change class status.' };
  }
}

// ─── SECTION OPERATIONS ────────────────────────────────────────────────────────

/**
 * Gets all sections for a specific class.
 */
export function getSectionsByClassId(
  classId: number,
  searchQuery?: string,
  db?: Database.Database
): SectionItem[] {
  const database = db ?? getDatabase();
  const q = (searchQuery || '').trim();

  let query = `
    SELECT s.*,
           (SELECT COUNT(*) FROM student_enrollments se WHERE se.section_id = s.id AND se.status = 'Active') as student_count
    FROM sections s
    WHERE s.class_id = ?
  `;
  const params: unknown[] = [classId];

  if (q) {
    query += ' AND s.name LIKE ?';
    params.push(`%${q}%`);
  }

  query += ' ORDER BY s.name ASC';

  const rows = database.prepare(query).all(...params) as SectionRow[];
  return rows.map(mapSectionRow);
}

/**
 * Creates a section within a class.
 */
export function createSection(
  params: {
    sessionToken?: string;
    classId: number;
    name: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; section?: SectionItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const classId = Number(params.classId);
  const name = (params.name || '').trim();
  const description = (params.description || '').trim();
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!classId || classId <= 0) {
    return { success: false, error: 'Valid class ID is required.' };
  }

  if (!name) {
    return { success: false, error: 'Section name is required (e.g. A, B, Blue).' };
  }

  // Verify parent class exists
  const parentClass = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
  if (!parentClass) {
    return { success: false, error: 'Specified class does not exist.' };
  }

  // Check duplicate section name within this class
  const existing = database
    .prepare('SELECT id FROM sections WHERE class_id = ? AND name = ? COLLATE NOCASE')
    .get(classId, name);
  if (existing) {
    return { success: false, error: `Section "${name}" already exists in this class.` };
  }

  try {
    const stmt = database.prepare(`
      INSERT INTO sections (class_id, name, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const res = stmt.run(classId, name, description, isActive);
    const newId = Number(res.lastInsertRowid);

    const created = database.prepare('SELECT * FROM sections WHERE id = ?').get(newId) as SectionRow;
    console.log(`[ClassService] Created section: ${name} in class ID ${classId}`);

    return {
      success: true,
      section: mapSectionRow(created),
    };
  } catch (err) {
    console.error('[ClassService] Failed to create section:', err);
    return { success: false, error: 'Failed to create section.' };
  }
}

/**
 * Updates an existing section.
 */
export function updateSection(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; section?: SectionItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const description = (params.description || '').trim();
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!id || id <= 0) {
    return { success: false, error: 'Invalid section ID.' };
  }

  if (!name) {
    return { success: false, error: 'Section name is required.' };
  }

  const existing = database.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow | undefined;
  if (!existing) {
    return { success: false, error: 'Section not found.' };
  }

  // Duplicate check within same class
  const duplicate = database
    .prepare('SELECT id FROM sections WHERE class_id = ? AND name = ? COLLATE NOCASE AND id != ?')
    .get(existing.class_id, name, id);
  if (duplicate) {
    return { success: false, error: `Section "${name}" already exists in this class.` };
  }

  try {
    database.prepare(`
      UPDATE sections
      SET name = ?, description = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description, isActive, id);

    const updated = database.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow;
    console.log(`[ClassService] Updated section: ${name} (ID: ${id})`);

    return {
      success: true,
      section: mapSectionRow(updated),
    };
  } catch (err) {
    console.error('[ClassService] Failed to update section:', err);
    return { success: false, error: 'Failed to update section.' };
  }
}

/**
 * Activates or deactivates a section.
 */
export function toggleSectionStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; section?: SectionItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database.prepare(`
      UPDATE sections
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive, id);

    const updated = database.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow;
    return { success: true, section: mapSectionRow(updated) };
  } catch (err) {
    console.error('[ClassService] Failed to toggle section status:', err);
    return { success: false, error: 'Failed to change section status.' };
  }
}
