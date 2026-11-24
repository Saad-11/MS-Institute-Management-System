/**
 * Student Management & Academic Enrollment Service
 * 
 * Manages student demographic records, unique Student IDs,
 * academic enrollments (Session -> Class -> Section), and secure photo storage.
 */

import type Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export interface StudentItem {
  id: number;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  photoPath: string | null;
  photoDataUrl?: string | null;
  bloodGroup: string;
  nationality: string;
  religion: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  guardianRelationship: string;
  phone: string;
  alternativePhone: string;
  currentAddress: string;
  permanentAddress: string;
  city: string;
  province: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Current / Latest Enrollment
  currentEnrollment?: StudentEnrollmentItem | null;
}

export interface StudentEnrollmentItem {
  id: number;
  studentId: number;
  academicSessionId: number;
  academicSessionName?: string;
  classId: number;
  className?: string;
  sectionId: number;
  sectionName?: string;
  rollNumber?: string;
  admissionDate: string;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
  createdAt: string;
  updatedAt: string;
}

export interface StudentFilterParams {
  searchQuery?: string;
  academicSessionId?: number;
  classId?: number;
  sectionId?: number;
  gender?: string;
  enrollmentStatus?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

interface StudentRow {
  id: number;
  student_id: string;
  admission_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string;
  gender: string;
  date_of_birth: string;
  photo_path: string | null;
  blood_group: string | null;
  nationality: string | null;
  religion: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  phone: string | null;
  alternative_phone: string | null;
  current_address: string | null;
  permanent_address: string | null;
  city: string | null;
  province: string | null;
  is_active: number;
  is_deleted?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined latest enrollment fields
  enrollment_id?: number | null;
  academic_session_id?: number | null;
  academic_session_name?: string | null;
  class_id?: number | null;
  class_name?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  admission_date?: string | null;
  enrollment_status?: string | null;
  enrollment_created_at?: string | null;
  enrollment_updated_at?: string | null;
}

interface EnrollmentRow {
  id: number;
  student_id: number;
  academic_session_id: number;
  academic_session_name: string;
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  roll_number?: string;
  admission_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function getStudentsDirectory(): string {
  const baseDir = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.resolve(process.cwd(), 'app-data');
  const dir = path.join(baseDir, 'uploads', 'students');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const photoDataUrlCache = new Map<string, string>();

export function getStudentPhotoDataUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  const cached = photoDataUrlCache.get(photoPath);
  if (cached) return cached;

  try {
    const dir = getStudentsDirectory();
    let filePath = path.isAbsolute(photoPath)
      ? photoPath
      : path.join(dir, path.basename(photoPath));

    if (!fs.existsSync(filePath)) {
      const altDir = path.resolve(process.cwd(), 'app-data', 'uploads', 'students');
      const altPath = path.join(altDir, path.basename(photoPath));
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        const appData = process.env.APPDATA;
        if (appData) {
          const newPath = path.join(appData, 'MS Institute Management System', 'uploads', 'students', path.basename(photoPath));
          const roamingPath = path.join(appData, 'school-management-system', 'uploads', 'students', path.basename(photoPath));
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
    console.error('[StudentService] Error loading photo data URL:', err);
    return null;
  }
}

export function invalidateStudentPhotoCache(photoPath?: string | null): void {
  if (photoPath) {
    photoDataUrlCache.delete(photoPath);
  } else {
    photoDataUrlCache.clear();
  }
}

/**
 * Ensures that a valid section exists for a class.
 * If sectionId is provided, validates it.
 * If not provided or doesn't exist, retrieves the first active section for the class.
 * If no sections exist at all for this class, creates a default "Section A" and returns its ID.
 */
export function ensureClassSection(classId: number, preferredSectionId?: number, db?: Database.Database): number | null {
  const database = db ?? getDatabase();
  const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
  if (!cls) return null;

  if (preferredSectionId && preferredSectionId > 0) {
    const sec = database.prepare('SELECT id FROM sections WHERE id = ? AND class_id = ?').get(preferredSectionId, classId) as { id: number } | undefined;
    if (sec) return sec.id;
  }

  // Look for any existing active section for this class
  const existingSec = database.prepare('SELECT id FROM sections WHERE class_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1').get(classId) as { id: number } | undefined;
  if (existingSec) return existingSec.id;

  // Look for any section (even inactive)
  const anySec = database.prepare('SELECT id FROM sections WHERE class_id = ? ORDER BY id ASC LIMIT 1').get(classId) as { id: number } | undefined;
  if (anySec) {
    database.prepare('UPDATE sections SET is_active = 1 WHERE id = ?').run(anySec.id);
    return anySec.id;
  }

  // Create default Section A
  const ins = database.prepare(`
    INSERT INTO sections (class_id, name, description, is_active, created_at, updated_at)
    VALUES (?, 'Section A', 'Default Section', 1, datetime('now'), datetime('now'))
  `).run(classId);
  return Number(ins.lastInsertRowid);
}

function mapStudentRow(row: StudentRow, includePhotoUrl = false): StudentItem {
  let currentEnrollment: StudentEnrollmentItem | null = null;
  if (row.enrollment_id && row.academic_session_id && row.class_id && row.section_id) {
    currentEnrollment = {
      id: row.enrollment_id,
      studentId: row.id,
      academicSessionId: row.academic_session_id,
      academicSessionName: row.academic_session_name ?? '',
      classId: row.class_id,
      className: row.class_name ?? '',
      sectionId: row.section_id,
      sectionName: row.section_name ?? '',
      admissionDate: row.admission_date ?? '',
      status: (row.enrollment_status as StudentEnrollmentItem['status']) || 'Active',
      createdAt: row.enrollment_created_at ?? '',
      updatedAt: row.enrollment_updated_at ?? '',
    };
  }

  return {
    id: row.id,
    studentId: row.student_id,
    admissionNumber: row.admission_number ?? '',
    firstName: row.first_name,
    middleName: row.middle_name ?? '',
    lastName: row.last_name,
    displayName: row.display_name,
    gender: (row.gender as 'Male' | 'Female' | 'Other') || 'Male',
    dateOfBirth: row.date_of_birth ?? '',
    photoPath: row.photo_path,
    photoDataUrl: includePhotoUrl ? getStudentPhotoDataUrl(row.photo_path) : undefined,
    bloodGroup: row.blood_group ?? '',
    nationality: row.nationality ?? '',
    religion: row.religion ?? '',
    fatherName: row.father_name ?? '',
    motherName: row.mother_name ?? '',
    guardianName: row.guardian_name ?? '',
    guardianRelationship: row.guardian_relationship ?? '',
    phone: row.phone ?? '',
    alternativePhone: row.alternative_phone ?? '',
    currentAddress: row.current_address ?? '',
    permanentAddress: row.permanent_address ?? '',
    city: row.city ?? '',
    province: row.province ?? '',
    isActive: row.is_active === 1,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentEnrollment,
  };
}

// ─── ID GENERATION ─────────────────────────────────────────────────────────────

/**
 * Generates the next sequential Student ID.
 * Format: STD-YYYY-XXXX (e.g. STD-2026-0001)
 */
export function generateNextStudentId(year?: string, db?: Database.Database): string {
  const database = db ?? getDatabase();
  const targetYear = year || new Date().getFullYear().toString();
  const prefix = `STD-${targetYear}-`;

  const row = database.prepare(`
    SELECT student_id
    FROM students
    WHERE student_id LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(`${prefix}%`) as { student_id: string } | undefined;

  if (!row) {
    return `${prefix}0001`;
  }

  const parts = row.student_id.split('-');
  const seqPart = parts[parts.length - 1];
  const nextNum = parseInt(seqPart, 10) + 1;
  const padded = isNaN(nextNum) ? '0001' : nextNum.toString().padStart(4, '0');
  return `${prefix}${padded}`;
}

// ─── STUDENT CRUD OPERATIONS ───────────────────────────────────────────────────

/**
 * Creates a new student and optionally an initial academic enrollment.
 */
export function createStudent(
  params: {
    sessionToken?: string;
    studentId?: string;
    admissionNumber?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    fatherName?: string;
    motherName?: string;
    guardianName?: string;
    guardianRelationship?: string;
    phone?: string;
    alternativePhone?: string;
    currentAddress?: string;
    permanentAddress?: string;
    city?: string;
    province?: string;
    isActive?: boolean;
    // Initial enrollment parameters
    enrollment?: {
      academicSessionId: number;
      classId: number;
      sectionId: number;
      rollNumber?: string;
      admissionDate?: string;
      status?: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
    };
  },
  db?: Database.Database
): { success: boolean; student?: StudentItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();

  const firstName = (params.firstName || '').trim();
  const middleName = (params.middleName || '').trim();
  const lastName = (params.lastName || '').trim();
  const gender = params.gender || 'Male';
  const dateOfBirth = (params.dateOfBirth || '').trim();

  if (!firstName) {
    return { success: false, error: 'First name is required.' };
  }
  if (!lastName) {
    return { success: false, error: 'Last name is required.' };
  }

  const displayName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;

  // Student ID handling & uniqueness check
  let studentId = (params.studentId || '').trim();
  if (!studentId) {
    studentId = generateNextStudentId(undefined, database);
  }

  const existingStudentId = database
    .prepare('SELECT id FROM students WHERE student_id = ? COLLATE NOCASE')
    .get(studentId);
  if (existingStudentId) {
    return { success: false, error: `Student ID "${studentId}" is already in use.` };
  }

  // Admission Number uniqueness check if supplied
  const admissionNumber = (params.admissionNumber || '').trim();
  if (admissionNumber) {
    const existingAdm = database
      .prepare('SELECT id FROM students WHERE admission_number = ? COLLATE NOCASE')
      .get(admissionNumber);
    if (existingAdm) {
      return { success: false, error: `Admission Number "${admissionNumber}" is already in use.` };
    }
  }

  // Normalize enrollment parameters whether passed under `params.enrollment` or directly at root
  const rawEnrollment = params.enrollment || (params as any);
  let enrollmentToCreate: {
    academicSessionId: number;
    classId: number;
    sectionId: number;
    rollNumber?: string;
    admissionDate?: string;
    status?: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
  } | null = null;

  const rawSessionId = Number(rawEnrollment?.academicSessionId);
  const rawClassId = Number(rawEnrollment?.classId);
  if (rawSessionId > 0 && rawClassId > 0) {
    const validSectionId = ensureClassSection(rawClassId, Number(rawEnrollment.sectionId) || undefined, database);
    if (validSectionId) {
      enrollmentToCreate = {
        academicSessionId: rawSessionId,
        classId: rawClassId,
        sectionId: validSectionId,
        rollNumber: rawEnrollment.rollNumber ? String(rawEnrollment.rollNumber).trim() : undefined,
        admissionDate: rawEnrollment.admissionDate ? String(rawEnrollment.admissionDate).trim() : undefined,
        status: (rawEnrollment.status as any) || 'Active',
      };
    }
  }

  try {
    const createTx = database.transaction(() => {
      const stmt = database.prepare(`
        INSERT INTO students (
          student_id, admission_number, first_name, middle_name, last_name, display_name,
          gender, date_of_birth, blood_group, nationality, religion,
          father_name, mother_name, guardian_name, guardian_relationship,
          phone, alternative_phone, current_address, permanent_address,
          city, province, is_active, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, datetime('now'), datetime('now')
        )
      `);

      const res = stmt.run(
        studentId,
        admissionNumber || null,
        firstName,
        middleName,
        lastName,
        displayName,
        gender,
        dateOfBirth,
        (params.bloodGroup || '').trim(),
        (params.nationality || '').trim(),
        (params.religion || '').trim(),
        (params.fatherName || '').trim(),
        (params.motherName || '').trim(),
        (params.guardianName || '').trim(),
        (params.guardianRelationship || '').trim(),
        (params.phone || '').trim(),
        (params.alternativePhone || '').trim(),
        (params.currentAddress || '').trim(),
        (params.permanentAddress || '').trim(),
        (params.city || '').trim(),
        (params.province || '').trim(),
        params.isActive !== false ? 1 : 0
      );

      const newStudentId = Number(res.lastInsertRowid);

      // Create initial enrollment if session and class were provided
      if (enrollmentToCreate) {
        const { academicSessionId, classId, sectionId, rollNumber, admissionDate, status } = enrollmentToCreate;
        const admDate = (admissionDate || '').trim() || new Date().toISOString().split('T')[0];
        const enrollStatus = status || 'Active';
        const rNum = (rollNumber || '').trim();

        database.prepare(`
          INSERT INTO student_enrollments (
            student_id, academic_session_id, class_id, section_id, roll_number,
            admission_date, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(newStudentId, academicSessionId, classId, sectionId, rNum, admDate, enrollStatus);
      }

      return newStudentId;
    });

    const newId = createTx();
    const createdStudent = getStudentById(newId, database);

    console.log(`[StudentService] Created student: ${displayName} (ID: ${studentId})`);

    return {
      success: true,
      student: createdStudent ?? undefined,
    };
  } catch (err: unknown) {
    console.error('[StudentService] Failed to create student:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed: students.student_id')) {
      return { success: false, error: `Student ID "${studentId}" is already taken.` };
    }
    if (msg.includes('UNIQUE constraint failed: students.admission_number')) {
      return { success: false, error: `Admission Number "${admissionNumber}" is already in use.` };
    }
    return { success: false, error: 'Failed to create student record.' };
  }
}

/**
 * Updates an existing student record and optionally creates/updates an enrollment.
 */
export function updateStudent(
  params: {
    sessionToken?: string;
    id: number;
    studentId?: string;
    admissionNumber?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    fatherName?: string;
    motherName?: string;
    guardianName?: string;
    guardianRelationship?: string;
    phone?: string;
    alternativePhone?: string;
    currentAddress?: string;
    permanentAddress?: string;
    city?: string;
    province?: string;
    isActive?: boolean;
    enrollment?: {
      academicSessionId: number;
      classId: number;
      sectionId: number;
      admissionDate?: string;
      status?: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
    };
  },
  db?: Database.Database
): { success: boolean; student?: StudentItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  let id = Number(params.id);
  if ((!id || isNaN(id) || id <= 0) && typeof (params as any).studentId === 'number') {
    id = Number((params as any).studentId);
  }

  let existing: { id: number; student_id: string } | undefined;
  if (id && id > 0) {
    existing = database.prepare('SELECT id, student_id FROM students WHERE id = ?').get(id) as { id: number; student_id: string } | undefined;
  }
  if (!existing && params.studentId && typeof params.studentId === 'string') {
    existing = database.prepare('SELECT id, student_id FROM students WHERE student_id = ?').get(params.studentId.trim()) as { id: number; student_id: string } | undefined;
    if (existing) {
      id = existing.id;
    }
  }

  if (!existing) {
    return { success: false, error: 'Student record not found.' };
  }

  const firstName = (params.firstName || '').trim();
  const middleName = (params.middleName || '').trim();
  const lastName = (params.lastName || '').trim();
  const gender = params.gender || 'Male';
  const dateOfBirth = (params.dateOfBirth || '').trim();

  if (!firstName) {
    return { success: false, error: 'First name is required.' };
  }
  if (!lastName) {
    return { success: false, error: 'Last name is required.' };
  }

  const displayName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;

  // Validate student ID uniqueness excluding self
  const studentId = (params.studentId || existing.student_id).trim();
  if (studentId) {
    const dupId = database
      .prepare('SELECT id FROM students WHERE student_id = ? COLLATE NOCASE AND id != ?')
      .get(studentId, id);
    if (dupId) {
      return { success: false, error: `Student ID "${studentId}" is already used by another student.` };
    }
  }

  // Validate admission number uniqueness excluding self
  const admissionNumber = (params.admissionNumber || '').trim();
  if (admissionNumber) {
    const dupAdm = database
      .prepare('SELECT id FROM students WHERE admission_number = ? COLLATE NOCASE AND id != ?')
      .get(admissionNumber, id);
    if (dupAdm) {
      return { success: false, error: `Admission Number "${admissionNumber}" is already in use by another student.` };
    }
  }

  // Validate enrollment if supplied
  if (params.enrollment) {
    const { academicSessionId, classId, sectionId } = params.enrollment;
    const session = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(academicSessionId);
    if (!session) {
      return { success: false, error: 'Selected academic session does not exist.' };
    }

    const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!cls) {
      return { success: false, error: 'Selected class does not exist.' };
    }

    const sec = database.prepare('SELECT id, class_id FROM sections WHERE id = ?').get(sectionId) as { id: number; class_id: number } | undefined;
    if (!sec) {
      return { success: false, error: 'Selected section does not exist.' };
    }
    if (sec.class_id !== classId) {
      return { success: false, error: 'Selected section does not belong to the chosen class.' };
    }
  }

  try {
    const updateTx = database.transaction(() => {
      database.prepare(`
        UPDATE students SET
          student_id = ?,
          admission_number = ?,
          first_name = ?,
          middle_name = ?,
          last_name = ?,
          display_name = ?,
          gender = ?,
          date_of_birth = ?,
          blood_group = ?,
          nationality = ?,
          religion = ?,
          father_name = ?,
          mother_name = ?,
          guardian_name = ?,
          guardian_relationship = ?,
          phone = ?,
          alternative_phone = ?,
          current_address = ?,
          permanent_address = ?,
          city = ?,
          province = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        studentId,
        admissionNumber || null,
        firstName,
        middleName,
        lastName,
        displayName,
        gender,
        dateOfBirth,
        (params.bloodGroup || '').trim(),
        (params.nationality || '').trim(),
        (params.religion || '').trim(),
        (params.fatherName || '').trim(),
        (params.motherName || '').trim(),
        (params.guardianName || '').trim(),
        (params.guardianRelationship || '').trim(),
        (params.phone || '').trim(),
        (params.alternativePhone || '').trim(),
        (params.currentAddress || '').trim(),
        (params.permanentAddress || '').trim(),
        (params.city || '').trim(),
        (params.province || '').trim(),
        params.isActive !== false ? 1 : 0,
        id
      );

      // Upsert enrollment if provided (either in params.enrollment or at root)
      const rawEnrollment = params.enrollment || (params as any);
      const rawSessionId = Number(rawEnrollment?.academicSessionId);
      const rawClassId = Number(rawEnrollment?.classId);
      if (rawSessionId > 0 && rawClassId > 0) {
        const validSectionId = ensureClassSection(rawClassId, Number(rawEnrollment.sectionId) || undefined, database);
        if (validSectionId) {
          const admDate = (rawEnrollment.admissionDate || '').trim() || new Date().toISOString().split('T')[0];
          const enrollStatus = rawEnrollment.status || 'Active';

          // Check if an enrollment for this student in this academic session exists
          const existingEnrollment = database.prepare(`
            SELECT id FROM student_enrollments
            WHERE student_id = ? AND academic_session_id = ?
          `).get(id, rawSessionId) as { id: number } | undefined;

          if (existingEnrollment) {
            database.prepare(`
              UPDATE student_enrollments SET
                class_id = ?,
                section_id = ?,
                admission_date = ?,
                status = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(rawClassId, validSectionId, admDate, enrollStatus, existingEnrollment.id);
          } else {
            database.prepare(`
              INSERT INTO student_enrollments (
                student_id, academic_session_id, class_id, section_id,
                admission_date, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(id, rawSessionId, rawClassId, validSectionId, admDate, enrollStatus);
          }
        }
      }
    });

    updateTx();

    const updated = getStudentById(id, database);
    console.log(`[StudentService] Updated student: ${displayName} (ID: ${id})`);

    return {
      success: true,
      student: updated ?? undefined,
    };
  } catch (err) {
    console.error('[StudentService] Failed to update student:', err);
    return { success: false, error: 'Failed to update student record.' };
  }
}

/**
 * Toggles a student's active status.
 */
export function toggleStudentStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; student?: StudentItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database.prepare(`
      UPDATE students
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive, id);

    const updated = getStudentById(id, database);
    return { success: true, student: updated ?? undefined };
  } catch (err) {
    console.error('[StudentService] Failed to toggle student status:', err);
    return { success: false, error: 'Failed to update student status.' };
  }
}

/**
 * Retrieves a single student by ID with current enrollment and photo.
 */
export function getStudentById(id: number, db?: Database.Database, includeDeleted = false): StudentItem | null {
  const database = db ?? getDatabase();

  const deletedClause = includeDeleted ? '' : 'AND (s.is_deleted = 0 OR s.is_deleted IS NULL)';
  const query = `
    SELECT s.*,
           e.id as enrollment_id,
           e.academic_session_id,
           sess.name as academic_session_name,
           e.class_id,
           c.name as class_name,
           e.section_id,
           sec.name as section_name,
           e.admission_date,
           e.status as enrollment_status,
           e.created_at as enrollment_created_at,
           e.updated_at as enrollment_updated_at
    FROM students s
    LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.id = (
      SELECT id FROM student_enrollments
      WHERE student_id = s.id
      ORDER BY (status = 'Active') DESC, id DESC
      LIMIT 1
    )
    LEFT JOIN academic_sessions sess ON sess.id = e.academic_session_id
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
    WHERE s.id = ? ${deletedClause}
  `;

  const row = database.prepare(query).get(id) as StudentRow | undefined;
  return row ? mapStudentRow(row, true) : null;
}

/**
 * Lists all students with multi-field search, filters, and pagination.
 */
export function getAllStudents(
  params: StudentFilterParams = {},
  db?: Database.Database
): {
  success: boolean;
  students: StudentItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  const database = db ?? getDatabase();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)';
  const queryParams: unknown[] = [];

  // Search query across student_id, admission_number, names, father_name, phone
  if (params.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    whereClause += ` AND (
      s.student_id LIKE ? OR
      s.admission_number LIKE ? OR
      s.first_name LIKE ? OR
      s.last_name LIKE ? OR
      s.display_name LIKE ? OR
      s.father_name LIKE ? OR
      s.phone LIKE ?
    )`;
    queryParams.push(q, q, q, q, q, q, q);
  }

  // Active status
  if (params.isActive !== undefined) {
    whereClause += ' AND s.is_active = ?';
    queryParams.push(params.isActive ? 1 : 0);
  }

  // Gender filter
  if (params.gender && params.gender !== 'all') {
    whereClause += ' AND s.gender = ?';
    queryParams.push(params.gender);
  }

  // Academic session filter
  if (params.academicSessionId) {
    whereClause += ' AND e.academic_session_id = ?';
    queryParams.push(params.academicSessionId);
  }

  // Class filter
  if (params.classId) {
    whereClause += ' AND e.class_id = ?';
    queryParams.push(params.classId);
  }

  // Section filter
  if (params.sectionId) {
    whereClause += ' AND e.section_id = ?';
    queryParams.push(params.sectionId);
  }

  // Enrollment status filter
  if (params.enrollmentStatus && params.enrollmentStatus !== 'all') {
    whereClause += ' AND e.status = ?';
    queryParams.push(params.enrollmentStatus);
  }

  const sessionScopeClause = params.academicSessionId && Number(params.academicSessionId) > 0
    ? `AND academic_session_id = ${Number(params.academicSessionId)}`
    : '';

  const baseJoin = `
    FROM students s
    LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.id = (
      SELECT id FROM student_enrollments
      WHERE student_id = s.id ${sessionScopeClause}
      ORDER BY (status = 'Active') DESC, id DESC
      LIMIT 1
    )
    LEFT JOIN academic_sessions sess ON sess.id = e.academic_session_id
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
  `;

  try {
    // 1. Total count
    const countSql = `SELECT COUNT(*) as count ${baseJoin} ${whereClause}`;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // 2. Paginated data
    const dataSql = `
      SELECT s.*,
             e.id as enrollment_id,
             e.academic_session_id,
             sess.name as academic_session_name,
             e.class_id,
             c.name as class_name,
             e.section_id,
             sec.name as section_name,
             e.admission_date,
             e.status as enrollment_status,
             e.created_at as enrollment_created_at,
             e.updated_at as enrollment_updated_at
      ${baseJoin}
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as StudentRow[];
    // Only embed full photo data URLs if page limit is reasonable (not on count-only queries)
    const includePhotos = limit > 2;
    const students = rows.map((r) => mapStudentRow(r, includePhotos));

    return {
      success: true,
      students,
      totalCount,
      page,
      totalPages,
    };
  } catch (err) {
    console.error('[StudentService] Error querying students:', err);
    return {
      success: false,
      students: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Failed to query students.',
    };
  }
}

/**
 * Fast aggregate statistics for the Students directory.
 * Executes in <1ms via single database query instead of multiple pagination joins.
 */
export function getStudentStats(academicSessionId?: number, db?: Database.Database): {
  total: number;
  active: number;
  inactive: number;
  sessionCount: number;
} {
  const database = db ?? getDatabase();
  const general = database.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
      COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive
    FROM students
    WHERE (is_deleted = 0 OR is_deleted IS NULL)
  `).get() as { total: number; active: number; inactive: number };

  let sessionCount = general.active;
  if (academicSessionId && academicSessionId > 0) {
    const sessRow = database.prepare(`
      SELECT COUNT(DISTINCT se.student_id) as count
      FROM student_enrollments se
      JOIN students s ON s.id = se.student_id
      WHERE se.academic_session_id = ? AND se.status = 'Active' AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
    `).get(academicSessionId) as { count: number } | undefined;
    if (sessRow) sessionCount = sessRow.count;
  }

  return {
    total: general.total || 0,
    active: general.active || 0,
    inactive: general.inactive || 0,
    sessionCount,
  };
}

// ─── ENROLLMENT HISTORY ────────────────────────────────────────────────────────

/**
 * Returns all academic enrollment records for a student.
 */
export function getStudentEnrollments(studentId: number, db?: Database.Database): StudentEnrollmentItem[] {
  const database = db ?? getDatabase();

  const query = `
    SELECT e.id,
           e.student_id,
           e.academic_session_id,
           sess.name as academic_session_name,
           e.class_id,
           c.name as class_name,
           e.section_id,
           sec.name as section_name,
           e.roll_number,
           e.admission_date,
           e.status,
           e.created_at,
           e.updated_at
    FROM student_enrollments e
    JOIN academic_sessions sess ON sess.id = e.academic_session_id
    JOIN classes c ON c.id = e.class_id
    JOIN sections sec ON sec.id = e.section_id
    WHERE e.student_id = ?
    ORDER BY e.admission_date DESC, e.id DESC
  `;

  const rows = database.prepare(query).all(studentId) as EnrollmentRow[];

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    academicSessionId: r.academic_session_id,
    academicSessionName: r.academic_session_name,
    classId: r.class_id,
    className: r.class_name,
    sectionId: r.section_id,
    sectionName: r.section_name,
    rollNumber: r.roll_number || '',
    admissionDate: r.admission_date,
    status: (r.status as StudentEnrollmentItem['status']) || 'Active',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Enrolls a student in a new academic session, class, and section.
 * Validates relationships and prevents duplicate active enrollment in the same session.
 */
export function createEnrollment(
  params: {
    sessionToken?: string;
    studentId: number;
    academicSessionId: number;
    classId: number;
    sectionId: number;
    rollNumber?: string;
    admissionDate?: string;
    status?: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
  },
  db?: Database.Database
): { success: boolean; enrollment?: StudentEnrollmentItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);
  const sessionId = Number(params.academicSessionId);
  const classId = Number(params.classId);
  const sectionId = Number(params.sectionId);
  const status = params.status || 'Active';
  const admissionDate = (params.admissionDate || '').trim() || new Date().toISOString().split('T')[0];
  const rollNumber = (params.rollNumber || '').trim();

  if (!studentId || !sessionId || !classId || !sectionId) {
    return { success: false, error: 'Student, Session, Class, and Section are all required.' };
  }

  // 1. Verify student exists
  const student = database.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
  if (!student) {
    return { success: false, error: 'Student does not exist.' };
  }

  // 2. Verify academic session exists
  const sess = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
  if (!sess) {
    return { success: false, error: 'Academic session does not exist.' };
  }

  // 3. Verify class exists
  const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
  if (!cls) {
    return { success: false, error: 'Class does not exist.' };
  }

  // 4. Verify section belongs to class
  const sec = database.prepare('SELECT id, class_id FROM sections WHERE id = ?').get(sectionId) as { id: number; class_id: number } | undefined;
  if (!sec) {
    return { success: false, error: 'Section does not exist.' };
  }
  if (sec.class_id !== classId) {
    return { success: false, error: 'Selected section does not belong to the chosen class.' };
  }

  try {
    const enrollTx = database.transaction(() => {
      // If new enrollment is Active, deactivate any previous active enrollment for this student in this session
      if (status === 'Active') {
        database.prepare(`
          UPDATE student_enrollments
          SET status = 'Inactive', updated_at = datetime('now')
          WHERE student_id = ? AND academic_session_id = ? AND status = 'Active'
        `).run(studentId, sessionId);
      }

      const stmt = database.prepare(`
        INSERT INTO student_enrollments (
          student_id, academic_session_id, class_id, section_id, roll_number,
          admission_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const res = stmt.run(studentId, sessionId, classId, sectionId, rollNumber, admissionDate, status);
      return Number(res.lastInsertRowid);
    });

    const newId = enrollTx();
    const history = getStudentEnrollments(studentId, database);
    const created = history.find((h) => h.id === newId);

    console.log(`[StudentService] Enrolled student ${studentId} into session ${sessionId}, class ${classId}`);

    return {
      success: true,
      enrollment: created,
    };
  } catch (err: unknown) {
    console.error('[StudentService] Failed to create enrollment:', err);
    return { success: false, error: 'Failed to create enrollment record.' };
  }
}

// ─── STUDENT PHOTO MANAGEMENT ──────────────────────────────────────────────────

/**
 * Securely saves an image as the student's profile photo.
 */
export function saveStudentPhoto(
  params: {
    sessionToken?: string;
    studentId: number;
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
  const studentId = Number(params.studentId);
  const student = database.prepare('SELECT id, photo_path FROM students WHERE id = ?').get(studentId) as { id: number; photo_path: string | null } | undefined;
  if (!student) {
    return { success: false, error: 'Student not found.' };
  }

  const photosDir = getStudentsDirectory();

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

    const filename = `student_${studentId}_${Date.now()}${ext}`;
    const targetPath = path.join(photosDir, filename);

    fs.writeFileSync(targetPath, buffer);

    // Delete old photo file if exists
    if (student.photo_path) {
      invalidateStudentPhotoCache(student.photo_path);
      const oldPath = path.isAbsolute(student.photo_path)
        ? student.photo_path
        : path.join(photosDir, path.basename(student.photo_path));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    // Save relative filename in DB
    database.prepare(`
      UPDATE students
      SET photo_path = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(filename, studentId);

    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    photoDataUrlCache.set(filename, dataUrl);

    console.log(`[StudentService] Saved photo for student ${studentId}: ${filename}`);

    return {
      success: true,
      photoPath: filename,
      dataUrl,
    };
  } catch (err) {
    console.error('[StudentService] Failed to save student photo:', err);
    return { success: false, error: 'Failed to process student photo.' };
  }
}

/**
 * Removes a student's profile photo.
 */
export function removeStudentPhoto(
  params: { sessionToken?: string; studentId: number },
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);
  const student = database.prepare('SELECT id, photo_path FROM students WHERE id = ?').get(studentId) as { id: number; photo_path: string | null } | undefined;
  if (!student) {
    return { success: false, error: 'Student not found.' };
  }

  try {
    if (student.photo_path) {
      invalidateStudentPhotoCache(student.photo_path);
      const photosDir = getStudentsDirectory();
      const filePath = path.isAbsolute(student.photo_path)
        ? student.photo_path
        : path.join(photosDir, path.basename(student.photo_path));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    database.prepare(`
      UPDATE students
      SET photo_path = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(studentId);

    console.log(`[StudentService] Removed photo for student ${studentId}`);
    return { success: true };
  } catch (err) {
    console.error('[StudentService] Failed to remove student photo:', err);
    return { success: false, error: 'Failed to remove student photo.' };
  }
}

/**
 * Safely deletes or archives a student record.
 * 
 * Safety protocol:
 * - If the student has associated historical records (financial transactions, fee records,
 *   payments, examination marks, attendance, documents, or promotions):
 *   Soft-deletes the student (is_deleted = 1, is_active = 0, deleted_at = now, enrollment status = 'Left')
 *   to preserve full institutional audit trails and prevent foreign key violations.
 * - If the student is a test/accidental entry with NO historical logs:
 *   Safely permanently removes the student demographic record, initial enrollment, and photo.
 */
export function deleteStudent(
  params: { sessionToken?: string; id: number },
  db?: Database.Database
): { success: boolean; mode?: 'archived' | 'permanent'; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);

  if (!id || isNaN(id) || id <= 0) {
    return { success: false, error: 'Valid student ID is required.' };
  }

  const student = database.prepare('SELECT id, student_id, display_name, photo_path FROM students WHERE id = ?').get(id) as {
    id: number;
    student_id: string;
    display_name: string;
    photo_path: string | null;
  } | undefined;

  if (!student) {
    return { success: false, error: 'Student record not found.' };
  }

  try {
    // Check for historical financial, academic, and document records
    const historyCounts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM fee_records WHERE student_id = ?) as fees_count,
        (SELECT COUNT(*) FROM fee_payments WHERE student_id = ?) as payments_count,
        (SELECT COUNT(*) FROM exam_marks WHERE student_id = ?) as exams_count,
        (SELECT COUNT(*) FROM attendance WHERE student_id = ?) as attendance_count,
        (SELECT COUNT(*) FROM student_documents WHERE student_id = ?) as docs_count,
        (SELECT COUNT(*) FROM promotion_logs WHERE student_id = ?) as promo_count
    `).get(id, id, id, id, id, id) as {
      fees_count: number;
      payments_count: number;
      exams_count: number;
      attendance_count: number;
      docs_count: number;
      promo_count: number;
    };

    const hasHistory = (
      (historyCounts?.fees_count || 0) > 0 ||
      (historyCounts?.payments_count || 0) > 0 ||
      (historyCounts?.exams_count || 0) > 0 ||
      (historyCounts?.attendance_count || 0) > 0 ||
      (historyCounts?.docs_count || 0) > 0 ||
      (historyCounts?.promo_count || 0) > 0
    );

    let mode: 'archived' | 'permanent' = 'permanent';

    if (hasHistory) {
      // Safely archive / soft-delete to preserve all historical records and prevent FK constraint violations
      const archiveTx = database.transaction(() => {
        database.prepare(`
          UPDATE students
          SET is_deleted = 1, is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(id);

        database.prepare(`
          UPDATE student_enrollments
          SET status = 'Left', updated_at = datetime('now')
          WHERE student_id = ?
        `).run(id);
      });
      archiveTx();
      mode = 'archived';
      console.log(`[StudentService] Archived student ${student.display_name} (ID: ${student.student_id}) due to existing historical records.`);
    } else {
      // Safe permanent deletion of student record with no historical logs/finances
      const deleteTx = database.transaction(() => {
        database.prepare('DELETE FROM student_fee_adjustments WHERE student_id = ?').run(id);
        database.prepare('DELETE FROM student_enrollments WHERE student_id = ?').run(id);
        database.prepare('DELETE FROM students WHERE id = ?').run(id);
      });
      deleteTx();

      // Clean up photo file if exists
      if (student.photo_path) {
        try {
          const photosDir = getStudentsDirectory();
          const filePath = path.isAbsolute(student.photo_path)
            ? student.photo_path
            : path.join(photosDir, path.basename(student.photo_path));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (photoErr) {
          console.warn('[StudentService] Could not remove photo file:', photoErr);
        }
      }
      mode = 'permanent';
      console.log(`[StudentService] Permanently deleted student ${student.display_name} (ID: ${student.student_id}).`);
    }

    if (student.photo_path) {
      invalidateStudentPhotoCache(student.photo_path);
    }

    return { success: true, mode };
  } catch (err) {
    console.error('[StudentService] Failed to delete student:', err);
    return { success: false, error: 'Failed to delete student record.' };
  }
}
