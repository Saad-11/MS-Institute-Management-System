/**
 * Teacher Management Service
 * 
 * Manages teacher staff records, Teacher IDs, Employee IDs,
 * contact & professional profiles, and secure photo storage.
 */

import type Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface TeacherItem {
  id: number;
  teacherId: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  photoPath: string | null;
  photoDataUrl?: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  designation: string;
  employmentStatus: 'Active' | 'Inactive' | 'On Leave' | 'Resigned';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherFilterParams {
  searchQuery?: string;
  employmentStatus?: string;
  designation?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

interface TeacherRow {
  id: number;
  teacher_id: string;
  employee_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string;
  gender: string;
  date_of_birth: string | null;
  photo_path: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  qualification: string | null;
  specialization: string | null;
  joining_date: string | null;
  designation: string;
  employment_status: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function getTeachersDirectory(): string {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.resolve(process.cwd(), 'app-data');
  const dir = path.join(baseDir, 'uploads', 'teachers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const photoDataUrlCache = new Map<string, string>();

export function getTeacherPhotoDataUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  const cached = photoDataUrlCache.get(photoPath);
  if (cached) return cached;

  try {
    const dir = getTeachersDirectory();
    let filePath = path.isAbsolute(photoPath)
      ? photoPath
      : path.join(dir, path.basename(photoPath));

    if (!fs.existsSync(filePath)) {
      const altDir = path.resolve(process.cwd(), 'app-data', 'uploads', 'teachers');
      const altPath = path.join(altDir, path.basename(photoPath));
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        const appData = process.env.APPDATA;
        if (appData) {
          const newPath = path.join(appData, 'MS Institute Management System', 'uploads', 'teachers', path.basename(photoPath));
          const roamingPath = path.join(appData, 'school-management-system', 'uploads', 'teachers', path.basename(photoPath));
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

    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const buffer = fs.readFileSync(filePath);
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    photoDataUrlCache.set(photoPath, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('[TeacherService] Error loading photo data URL:', err);
    return null;
  }
}

export function invalidateTeacherPhotoCache(photoPath?: string | null): void {
  if (photoPath) {
    photoDataUrlCache.delete(photoPath);
  } else {
    photoDataUrlCache.clear();
  }
}

function mapTeacherRow(row: TeacherRow, includePhotoUrl = false): TeacherItem {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    employeeId: row.employee_id ?? '',
    firstName: row.first_name,
    middleName: row.middle_name ?? '',
    lastName: row.last_name,
    displayName: row.display_name,
    gender: (row.gender as 'Male' | 'Female' | 'Other') || 'Male',
    dateOfBirth: row.date_of_birth ?? '',
    photoPath: row.photo_path,
    photoDataUrl: includePhotoUrl ? getTeacherPhotoDataUrl(row.photo_path) : undefined,
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    province: row.province ?? '',
    qualification: row.qualification ?? '',
    specialization: row.specialization ?? '',
    joiningDate: row.joining_date ?? '',
    designation: row.designation || 'Teacher',
    employmentStatus: (row.employment_status as TeacherItem['employmentStatus']) || 'Active',
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── TEACHER ID GENERATION ─────────────────────────────────────────────────────

/**
 * Generates the next sequential Teacher ID.
 * Format: TCH-YYYY-XXXX (e.g. TCH-2026-0001)
 */
export function generateNextTeacherId(year?: string, db?: Database.Database): string {
  const database = db ?? getDatabase();
  const targetYear = year || new Date().getFullYear().toString();
  const prefix = `TCH-${targetYear}-`;

  const row = database.prepare(`
    SELECT teacher_id
    FROM teachers
    WHERE teacher_id LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(`${prefix}%`) as { teacher_id: string } | undefined;

  if (!row) {
    return `${prefix}0001`;
  }

  const parts = row.teacher_id.split('-');
  const seqPart = parts[parts.length - 1];
  const nextNum = parseInt(seqPart, 10) + 1;
  const padded = isNaN(nextNum) ? '0001' : nextNum.toString().padStart(4, '0');
  return `${prefix}${padded}`;
}

// ─── TEACHER CRUD OPERATIONS ───────────────────────────────────────────────────

/**
 * Creates a new teacher record.
 */
export function createTeacher(
  params: {
    sessionToken?: string;
    teacherId?: string;
    employeeId?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    qualification?: string;
    specialization?: string;
    joiningDate?: string;
    designation?: string;
    employmentStatus?: 'Active' | 'Inactive' | 'On Leave' | 'Resigned';
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; teacher?: TeacherItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();

  const firstName = (params.firstName || '').trim();
  const middleName = (params.middleName || '').trim();
  const lastName = (params.lastName || '').trim();
  const gender = params.gender || 'Male';

  if (!firstName) {
    return { success: false, error: 'First name is required.' };
  }
  if (!lastName) {
    return { success: false, error: 'Last name is required.' };
  }

  const displayName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;

  // Teacher ID handling & uniqueness check
  let teacherId = (params.teacherId || '').trim();
  if (!teacherId) {
    teacherId = generateNextTeacherId(undefined, database);
  }

  const existingTeacherId = database
    .prepare('SELECT id FROM teachers WHERE teacher_id = ? COLLATE NOCASE')
    .get(teacherId);
  if (existingTeacherId) {
    return { success: false, error: `Teacher ID "${teacherId}" is already in use.` };
  }

  // Employee ID check if provided
  const employeeId = (params.employeeId || '').trim();
  if (employeeId) {
    const existingEmp = database
      .prepare('SELECT id FROM teachers WHERE employee_id = ? COLLATE NOCASE')
      .get(employeeId);
    if (existingEmp) {
      return { success: false, error: `Employee ID "${employeeId}" is already in use.` };
    }
  }

  try {
    const stmt = database.prepare(`
      INSERT INTO teachers (
        teacher_id, employee_id, first_name, middle_name, last_name, display_name,
        gender, date_of_birth, phone, email, address, city, province,
        qualification, specialization, joining_date, designation, employment_status,
        is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, datetime('now'), datetime('now')
      )
    `);

    const res = stmt.run(
      teacherId,
      employeeId || null,
      firstName,
      middleName,
      lastName,
      displayName,
      gender,
      (params.dateOfBirth || '').trim(),
      (params.phone || '').trim(),
      (params.email || '').trim(),
      (params.address || '').trim(),
      (params.city || '').trim(),
      (params.province || '').trim(),
      (params.qualification || '').trim(),
      (params.specialization || '').trim(),
      (params.joiningDate || '').trim(),
      (params.designation || 'Teacher').trim(),
      params.employmentStatus || 'Active',
      params.isActive !== false ? 1 : 0
    );

    const newId = Number(res.lastInsertRowid);
    const createdTeacher = getTeacherById(newId, database);

    console.log(`[TeacherService] Created teacher: ${displayName} (ID: ${teacherId})`);

    return {
      success: true,
      teacher: createdTeacher ?? undefined,
    };
  } catch (err: unknown) {
    console.error('[TeacherService] Failed to create teacher:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed: teachers.teacher_id')) {
      return { success: false, error: `Teacher ID "${teacherId}" is already taken.` };
    }
    if (msg.includes('UNIQUE constraint failed: teachers.employee_id')) {
      return { success: false, error: `Employee ID "${employeeId}" is already in use.` };
    }
    return { success: false, error: 'Failed to create teacher record.' };
  }
}

/**
 * Updates an existing teacher record.
 */
export function updateTeacher(
  params: {
    sessionToken?: string;
    id: number;
    teacherId?: string;
    employeeId?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    qualification?: string;
    specialization?: string;
    joiningDate?: string;
    designation?: string;
    employmentStatus?: 'Active' | 'Inactive' | 'On Leave' | 'Resigned';
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; teacher?: TeacherItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  if (!id || id <= 0) {
    return { success: false, error: 'Invalid teacher ID.' };
  }

  const existing = database.prepare('SELECT id, teacher_id FROM teachers WHERE id = ?').get(id) as { id: number; teacher_id: string } | undefined;
  if (!existing) {
    return { success: false, error: 'Teacher record not found.' };
  }

  const firstName = (params.firstName || '').trim();
  const middleName = (params.middleName || '').trim();
  const lastName = (params.lastName || '').trim();
  const gender = params.gender || 'Male';

  if (!firstName) {
    return { success: false, error: 'First name is required.' };
  }
  if (!lastName) {
    return { success: false, error: 'Last name is required.' };
  }

  const displayName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;

  // Uniqueness checks excluding self
  const teacherId = (params.teacherId || existing.teacher_id).trim();
  if (teacherId) {
    const dupId = database
      .prepare('SELECT id FROM teachers WHERE teacher_id = ? COLLATE NOCASE AND id != ?')
      .get(teacherId, id);
    if (dupId) {
      return { success: false, error: `Teacher ID "${teacherId}" is already used by another teacher.` };
    }
  }

  const employeeId = (params.employeeId || '').trim();
  if (employeeId) {
    const dupEmp = database
      .prepare('SELECT id FROM teachers WHERE employee_id = ? COLLATE NOCASE AND id != ?')
      .get(employeeId, id);
    if (dupEmp) {
      return { success: false, error: `Employee ID "${employeeId}" is already used by another teacher.` };
    }
  }

  try {
    database.prepare(`
      UPDATE teachers SET
        teacher_id = ?,
        employee_id = ?,
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        display_name = ?,
        gender = ?,
        date_of_birth = ?,
        phone = ?,
        email = ?,
        address = ?,
        city = ?,
        province = ?,
        qualification = ?,
        specialization = ?,
        joining_date = ?,
        designation = ?,
        employment_status = ?,
        is_active = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      teacherId,
      employeeId || null,
      firstName,
      middleName,
      lastName,
      displayName,
      gender,
      (params.dateOfBirth || '').trim(),
      (params.phone || '').trim(),
      (params.email || '').trim(),
      (params.address || '').trim(),
      (params.city || '').trim(),
      (params.province || '').trim(),
      (params.qualification || '').trim(),
      (params.specialization || '').trim(),
      (params.joiningDate || '').trim(),
      (params.designation || 'Teacher').trim(),
      params.employmentStatus || 'Active',
      params.isActive !== false ? 1 : 0,
      id
    );

    const updated = getTeacherById(id, database);
    console.log(`[TeacherService] Updated teacher: ${displayName} (ID: ${id})`);

    return {
      success: true,
      teacher: updated ?? undefined,
    };
  } catch (err) {
    console.error('[TeacherService] Failed to update teacher:', err);
    return { success: false, error: 'Failed to update teacher record.' };
  }
}

/**
 * Toggles a teacher's active status.
 */
export function toggleTeacherStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; teacher?: TeacherItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;
  const status = params.isActive ? 'Active' : 'Inactive';

  try {
    if (!isActive) {
      // When deactivating, if status was Active, set to Inactive
      database.prepare(`
        UPDATE teachers
        SET is_active = 0,
            employment_status = CASE WHEN employment_status = 'Active' THEN 'Inactive' ELSE employment_status END,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
    } else {
      // When activating, restore is_active = 1, and if status was Inactive, set to Active
      database.prepare(`
        UPDATE teachers
        SET is_active = 1,
            employment_status = CASE WHEN employment_status = 'Inactive' THEN 'Active' ELSE employment_status END,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
    }

    const updated = getTeacherById(id, database);
    return { success: true, teacher: updated ?? undefined };
  } catch (err) {
    console.error('[TeacherService] Failed to toggle teacher status:', err);
    return { success: false, error: 'Failed to update teacher status.' };
  }
}

/**
 * Retrieves a single teacher by ID with photo URL.
 */
export function getTeacherById(id: number, db?: Database.Database): TeacherItem | null {
  const database = db ?? getDatabase();
  const row = database.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as TeacherRow | undefined;
  return row ? mapTeacherRow(row, true) : null;
}

/**
 * Lists all teachers with search, filters, and pagination.
 */
export function getAllTeachers(
  params: TeacherFilterParams = {},
  db?: Database.Database
): {
  success: boolean;
  teachers: TeacherItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  const database = db ?? getDatabase();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];

  // Search across teacher_id, employee_id, names, phone, qualification, specialization
  if (params.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    whereClause += ` AND (
      teacher_id LIKE ? OR
      employee_id LIKE ? OR
      first_name LIKE ? OR
      last_name LIKE ? OR
      display_name LIKE ? OR
      phone LIKE ? OR
      qualification LIKE ? OR
      specialization LIKE ?
    )`;
    queryParams.push(q, q, q, q, q, q, q, q);
  }

  // Active status
  if (params.isActive !== undefined) {
    whereClause += ' AND is_active = ?';
    queryParams.push(params.isActive ? 1 : 0);
  }

  // Employment status
  if (params.employmentStatus && params.employmentStatus !== 'all') {
    whereClause += ' AND employment_status = ?';
    queryParams.push(params.employmentStatus);
  }

  // Designation
  if (params.designation && params.designation !== 'all') {
    whereClause += ' AND designation = ?';
    queryParams.push(params.designation);
  }

  try {
    const countSql = `SELECT COUNT(*) as count FROM teachers ${whereClause}`;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const dataSql = `
      SELECT * FROM teachers
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as TeacherRow[];
    const teachers = rows.map((r) => mapTeacherRow(r, false));

    return {
      success: true,
      teachers,
      totalCount,
      page,
      totalPages,
    };
  } catch (err) {
    console.error('[TeacherService] Error querying teachers:', err);
    return {
      success: false,
      teachers: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Failed to query teachers.',
    };
  }
}

// ─── TEACHER PHOTO MANAGEMENT ──────────────────────────────────────────────────

/**
 * Saves a profile photo for a teacher.
 */
export function saveTeacherPhoto(
  params: {
    sessionToken?: string;
    teacherId: number;
    sourceFilePath?: string;
    base64Data?: string;
    fileExtension?: string;
  },
  db?: Database.Database
): { success: boolean; photoPath?: string; dataUrl?: string; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const teacherId = Number(params.teacherId);
  const teacher = database.prepare('SELECT id, photo_path FROM teachers WHERE id = ?').get(teacherId) as { id: number; photo_path: string | null } | undefined;
  if (!teacher) {
    return { success: false, error: 'Teacher not found.' };
  }

  const photosDir = getTeachersDirectory();

  try {
    let ext = '';
    let buffer: Buffer;

    if (params.sourceFilePath) {
      if (!fs.existsSync(params.sourceFilePath)) {
        return { success: false, error: 'Selected photo file does not exist.' };
      }
      ext = path.extname(params.sourceFilePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      buffer = fs.readFileSync(params.sourceFilePath);
    } else if (params.base64Data) {
      ext = (params.fileExtension || '.jpg').toLowerCase();
      if (!ext.startsWith('.')) ext = '.' + ext;
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        return { success: false, error: 'Supported image formats are PNG, JPG, or JPEG only.' };
      }
      const cleanBase64 = params.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      return { success: false, error: 'No image data provided.' };
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return { success: false, error: 'Photo exceeds maximum 5MB size limit.' };
    }

    const filename = `teacher_${teacherId}_${Date.now()}${ext}`;
    const targetPath = path.join(photosDir, filename);

    fs.writeFileSync(targetPath, buffer);

    if (teacher.photo_path) {
      const oldPath = path.isAbsolute(teacher.photo_path)
        ? teacher.photo_path
        : path.join(photosDir, path.basename(teacher.photo_path));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    database.prepare(`
      UPDATE teachers
      SET photo_path = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(filename, teacherId);

    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    photoDataUrlCache.set(filename, dataUrl);

    console.log(`[TeacherService] Saved photo for teacher ${teacherId}: ${filename}`);

    return {
      success: true,
      photoPath: filename,
      dataUrl,
    };
  } catch (err) {
    console.error('[TeacherService] Failed to save teacher photo:', err);
    return { success: false, error: 'Failed to process teacher photo.' };
  }
}

/**
 * Removes a teacher's profile photo.
 */
export function removeTeacherPhoto(
  params: { sessionToken?: string; teacherId: number },
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const teacherId = Number(params.teacherId);
  const teacher = database.prepare('SELECT id, photo_path FROM teachers WHERE id = ?').get(teacherId) as { id: number; photo_path: string | null } | undefined;
  if (!teacher) {
    return { success: false, error: 'Teacher not found.' };
  }

  try {
    if (teacher.photo_path) {
      invalidateTeacherPhotoCache(teacher.photo_path);
      const photosDir = getTeachersDirectory();
      const filePath = path.isAbsolute(teacher.photo_path)
        ? teacher.photo_path
        : path.join(photosDir, path.basename(teacher.photo_path));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    database.prepare(`
      UPDATE teachers
      SET photo_path = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(teacherId);

    console.log(`[TeacherService] Removed photo for teacher ${teacherId}`);
    return { success: true };
  } catch (err) {
    console.error('[TeacherService] Failed to remove teacher photo:', err);
    return { success: false, error: 'Failed to remove teacher photo.' };
  }
}
