/**
 * Examination, Marks, Results & Dynamic DMC Service
 * 
 * Manages:
 * 1. Exam Types (CRUD, unique code/name, active toggle)
 * 2. Examinations (Session + Type + Name, Draft/Open/Closed status)
 * 3. Examination Subjects (Tied to Class & Subject validated against class_subjects)
 * 4. Grading Rules (Configurable percentage ranges, grades, grade points, remarks)
 * 5. Marks Entry (Bulk transactional saving, validation, explicit absent handling)
 * 6. Centralized Result Calculation (Pass/Fail criteria, percentages, positions)
 * 7. Dynamic DMC Generation (School branding, Student ID, dynamic subjects per class, print layout)
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';
import { getSchoolSettings, getSchoolLogoDataUrl, getPrincipalSignatureDataUrl, SchoolSettings } from './school.service';
import { getStudentPhotoDataUrl } from './student.service';

export type ExamStatus = 'Draft' | 'Open' | 'Closed';
export type MarkStatus = 'Entered' | 'Absent';

export interface ExamTypeItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExaminationItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  examTypeId: number;
  examTypeName?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  description: string;
  subjectCount?: number;
  participatingClasses?: string[];
  participatingClassNames?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExaminationSubjectItem {
  id: number;
  examinationId: number;
  classId: number;
  className?: string;
  subjectId: number;
  subjectName?: string;
  subjectCode?: string;
  maxMarks: number;
  passingMarks: number;
  displayOrder: number;
  examDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  isActive: boolean;
  marksEnteredCount?: number;
  totalStudentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GradingRuleItem {
  id: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  gradePoint: number;
  remarks: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentMarksEntryItem {
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  fatherName?: string;
  rollNumber?: string;
  obtainedMarks: number | null;
  status: MarkStatus;
  remarks: string;
  markId?: number;
}

export interface SubjectResultBreakdown {
  examinationSubjectId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
  obtainedMarks: number | null;
  status: MarkStatus;
  isPass: boolean;
  remarks: string;
}

export interface StudentExamResult {
  studentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  rollNumber?: string;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  overallRemarks: string;
  position?: number;
  totalStudentsInClass?: number;
  subjects: SubjectResultBreakdown[];
}

export interface ClassExamResults {
  examinationId: number;
  examinationName: string;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId?: number;
  sectionName?: string;
  totalStudents: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number;
  highestPercentage: number;
  averagePercentage: number;
  subjects: Array<{
    id: number;
    subjectName: string;
    maxMarks: number;
    passingMarks: number;
    averageMarks: number;
    passCount: number;
    failCount: number;
  }>;
  studentResults: StudentExamResult[];
}

export interface StudentDMCData {
  school: SchoolSettings;
  examination: {
    id: number;
    name: string;
    examTypeName: string;
    academicSessionName: string;
    startDate: string;
    endDate: string;
  };
  student: {
    id: number;
    systemStudentId: string; // Labeled "Student ID" on DMC
    admissionNumber: string;
    displayName: string;
    fatherName: string;
    className: string;
    sectionName: string;
    rollNumber?: string;
    dateOfBirth?: string;
    photoDataUrl?: string | null;
  };
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    passingMarks: number;
    obtainedMarks: number | null;
    status: MarkStatus | 'Pending'; // 'Entered', 'Absent', or 'Pending'
    grade: string;
    remarks: string;
  }>;
  summary: {
    totalMaxMarks: number;
    totalObtainedMarks: number;
    percentage: number;
    grade: string;
    gradePoint: number;
    result: 'Pass' | 'Fail' | 'Pending';
    overallRemarks: string;
    position?: number;
    totalStudents?: number;
  };
  gradingRules?: GradingRuleItem[];
  issueDate: string;
}

// ─── 1. EXAM TYPES ─────────────────────────────────────────────────────────────

interface ExamTypeRow {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapExamTypeRow(row: ExamTypeRow): ExamTypeItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || '',
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllExamTypes(db?: Database.Database): ExamTypeItem[] {
  const database = db ?? getDatabase();
  let rows = database
    .prepare('SELECT * FROM exam_types ORDER BY name ASC')
    .all() as ExamTypeRow[];

  // Self-healing: If no exam types exist, seed defaults automatically
  if (rows.length === 0) {
    const defaultExamTypes = [
      { name: 'Mid Term Examination', code: 'MID', description: 'Mid-academic term evaluation' },
      { name: 'Final Examination', code: 'FINAL', description: 'End of academic session comprehensive examination' },
      { name: 'First Term Examination', code: 'TERM1', description: 'First term assessment' },
      { name: 'Second Term Examination', code: 'TERM2', description: 'Second term assessment' },
      { name: 'Monthly Class Assessment', code: 'MNT', description: 'Monthly class performance test' },
      { name: 'Annual Examination', code: 'ANNUAL', description: 'Annual final examination' },
    ];
    const insertStmt = database.prepare(`
      INSERT OR IGNORE INTO exam_types (name, code, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    for (const t of defaultExamTypes) {
      insertStmt.run(t.name, t.code, t.description);
    }
    rows = database
      .prepare('SELECT * FROM exam_types ORDER BY name ASC')
      .all() as ExamTypeRow[];
  }

  return rows.map(mapExamTypeRow);
}

export function getExamTypeById(id: number, db?: Database.Database): ExamTypeItem | null {
  const database = db ?? getDatabase();
  const row = database
    .prepare('SELECT * FROM exam_types WHERE id = ?')
    .get(id) as ExamTypeRow | undefined;
  return row ? mapExamTypeRow(row) : null;
}

export function createExamType(
  params: { sessionToken?: string; name: string; code: string; description?: string },
  db?: Database.Database
): { success: boolean; examType?: ExamTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const code = (params.code || '').trim().toUpperCase();
  const description = (params.description || '').trim();

  if (!name) return { success: false, error: 'Exam type name is required.' };
  if (!code) return { success: false, error: 'Exam type code is required.' };

  const existingName = database.prepare('SELECT id FROM exam_types WHERE name = ? COLLATE NOCASE').get(name);
  if (existingName) return { success: false, error: `Exam type "${name}" already exists.` };

  const existingCode = database.prepare('SELECT id FROM exam_types WHERE code = ? COLLATE NOCASE').get(code);
  if (existingCode) return { success: false, error: `Exam type code "${code}" already exists.` };

  try {
    const result = database.prepare(`
      INSERT INTO exam_types (name, code, description, is_active)
      VALUES (?, ?, ?, 1)
    `).run(name, code, description);

    const created = getExamTypeById(Number(result.lastInsertRowid), database);
    return { success: true, examType: created ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to create exam type:', err);
    return { success: false, error: 'Failed to create exam type.' };
  }
}

export function updateExamType(
  params: { sessionToken?: string; id: number; name: string; code: string; description?: string; isActive?: boolean },
  db?: Database.Database
): { success: boolean; examType?: ExamTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const code = (params.code || '').trim().toUpperCase();
  const description = (params.description || '').trim();
  const isActive = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;

  if (!id || id <= 0) return { success: false, error: 'Invalid exam type ID.' };
  if (!name) return { success: false, error: 'Exam type name is required.' };
  if (!code) return { success: false, error: 'Exam type code is required.' };

  const existingName = database.prepare('SELECT id FROM exam_types WHERE name = ? COLLATE NOCASE AND id != ?').get(name, id);
  if (existingName) return { success: false, error: `Exam type "${name}" already exists.` };

  const existingCode = database.prepare('SELECT id FROM exam_types WHERE code = ? COLLATE NOCASE AND id != ?').get(code, id);
  if (existingCode) return { success: false, error: `Exam type code "${code}" already exists.` };

  try {
    database.prepare(`
      UPDATE exam_types
      SET name = ?, code = ?, description = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, code, description, isActive, id);

    const updated = getExamTypeById(id, database);
    return { success: true, examType: updated ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to update exam type:', err);
    return { success: false, error: 'Failed to update exam type.' };
  }
}

export function toggleExamTypeStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; examType?: ExamTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database.prepare(`
      UPDATE exam_types
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(isActive, id);

    const updated = getExamTypeById(id, database);
    return { success: true, examType: updated ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to toggle exam type status:', err);
    return { success: false, error: 'Failed to update exam type status.' };
  }
}

// ─── 2. EXAMINATIONS ──────────────────────────────────────────────────────────

interface ExamRow {
  id: number;
  academic_session_id: number;
  academic_session_name?: string;
  exam_type_id: number;
  exam_type_name?: string;
  name: string;
  start_date: string;
  end_date: string;
  status: ExamStatus;
  description: string;
  subject_count?: number;
  participating_class_names?: string;
  created_at: string;
  updated_at: string;
}

function mapExamRow(row: ExamRow): ExaminationItem {
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    academicSessionName: row.academic_session_name,
    examTypeId: row.exam_type_id,
    examTypeName: row.exam_type_name,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    description: row.description || '',
    subjectCount: row.subject_count ?? 0,
    participatingClassNames: row.participating_class_names || '',
    participatingClasses: row.participating_class_names
      ? row.participating_class_names.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllExaminations(
  params?: { academicSessionId?: number; examTypeId?: number; status?: ExamStatus },
  db?: Database.Database
): ExaminationItem[] {
  const database = db ?? getDatabase();
  let query = `
    SELECT e.*,
           sess.name as academic_session_name,
           et.name as exam_type_name,
           (SELECT COUNT(*) FROM examination_subjects es WHERE es.examination_id = e.id) as subject_count,
           (SELECT GROUP_CONCAT(DISTINCT c.name) FROM examination_subjects es JOIN classes c ON c.id = es.class_id WHERE es.examination_id = e.id) as participating_class_names
    FROM examinations e
    JOIN academic_sessions sess ON sess.id = e.academic_session_id
    JOIN exam_types et ON et.id = e.exam_type_id
    WHERE 1=1
  `;
  const queryParams: unknown[] = [];

  if (params?.academicSessionId) {
    query += ' AND e.academic_session_id = ?';
    queryParams.push(params.academicSessionId);
  }
  if (params?.examTypeId) {
    query += ' AND e.exam_type_id = ?';
    queryParams.push(params.examTypeId);
  }
  if (params?.status) {
    query += ' AND e.status = ?';
    queryParams.push(params.status);
  }

  query += ' ORDER BY e.start_date DESC, e.id DESC';

  const rows = database.prepare(query).all(...queryParams) as ExamRow[];
  return rows.map(mapExamRow);
}

export function getExaminationById(id: number, db?: Database.Database): ExaminationItem | null {
  const database = db ?? getDatabase();
  const query = `
    SELECT e.*,
           sess.name as academic_session_name,
           et.name as exam_type_name,
           (SELECT COUNT(*) FROM examination_subjects es WHERE es.examination_id = e.id) as subject_count,
           (SELECT GROUP_CONCAT(DISTINCT c.name) FROM examination_subjects es JOIN classes c ON c.id = es.class_id WHERE es.examination_id = e.id) as participating_class_names
    FROM examinations e
    JOIN academic_sessions sess ON sess.id = e.academic_session_id
    JOIN exam_types et ON et.id = e.exam_type_id
    WHERE e.id = ?
  `;
  const row = database.prepare(query).get(id) as ExamRow | undefined;
  return row ? mapExamRow(row) : null;
}

export function createExamination(
  params: {
    sessionToken?: string;
    academicSessionId: number;
    examTypeId: number;
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
  },
  db?: Database.Database
): { success: boolean; examination?: ExaminationItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const sessionId = Number(params.academicSessionId);
  const examTypeId = Number(params.examTypeId);
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const description = (params.description || '').trim();

  if (!sessionId || sessionId <= 0) return { success: false, error: 'Academic session is required.' };
  if (!examTypeId || examTypeId <= 0) return { success: false, error: 'Exam type is required.' };
  if (!name) return { success: false, error: 'Examination name is required.' };
  if (!startDate || !endDate) return { success: false, error: 'Start date and end date are required.' };
  if (startDate > endDate) return { success: false, error: 'Start date cannot be after end date.' };

  const session = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
  if (!session) return { success: false, error: 'Selected academic session does not exist.' };

  const examType = database.prepare('SELECT id FROM exam_types WHERE id = ?').get(examTypeId);
  if (!examType) return { success: false, error: 'Selected exam type does not exist.' };

  const duplicate = database
    .prepare('SELECT id FROM examinations WHERE academic_session_id = ? AND name = ? COLLATE NOCASE')
    .get(sessionId, name);
  if (duplicate) return { success: false, error: `Examination "${name}" already exists for this session.` };

  try {
    const result = database.prepare(`
      INSERT INTO examinations (academic_session_id, exam_type_id, name, start_date, end_date, status, description)
      VALUES (?, ?, ?, ?, ?, 'Draft', ?)
    `).run(sessionId, examTypeId, name, startDate, endDate, description);

    const created = getExaminationById(Number(result.lastInsertRowid), database);
    return { success: true, examination: created ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to create examination:', err);
    return { success: false, error: 'Failed to create examination.' };
  }
}

export function updateExamination(
  params: {
    sessionToken?: string;
    id: number;
    academicSessionId: number;
    examTypeId: number;
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
  },
  db?: Database.Database
): { success: boolean; examination?: ExaminationItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const sessionId = Number(params.academicSessionId);
  const examTypeId = Number(params.examTypeId);
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const description = (params.description || '').trim();

  if (!id || id <= 0) return { success: false, error: 'Invalid examination ID.' };
  if (!sessionId || sessionId <= 0) return { success: false, error: 'Academic session is required.' };
  if (!examTypeId || examTypeId <= 0) return { success: false, error: 'Exam type is required.' };
  if (!name) return { success: false, error: 'Examination name is required.' };
  if (!startDate || !endDate) return { success: false, error: 'Start date and end date are required.' };
  if (startDate > endDate) return { success: false, error: 'Start date cannot be after end date.' };

  const existing = database.prepare('SELECT status FROM examinations WHERE id = ?').get(id) as { status: ExamStatus } | undefined;
  if (!existing) return { success: false, error: 'Examination not found.' };

  const duplicate = database
    .prepare('SELECT id FROM examinations WHERE academic_session_id = ? AND name = ? COLLATE NOCASE AND id != ?')
    .get(sessionId, name, id);
  if (duplicate) return { success: false, error: `Examination "${name}" already exists for this session.` };

  try {
    database.prepare(`
      UPDATE examinations
      SET academic_session_id = ?, exam_type_id = ?, name = ?, start_date = ?, end_date = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(sessionId, examTypeId, name, startDate, endDate, description, id);

    const updated = getExaminationById(id, database);
    return { success: true, examination: updated ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to update examination:', err);
    return { success: false, error: 'Failed to update examination.' };
  }
}

export function updateExaminationStatus(
  params: { sessionToken?: string; id: number; status: ExamStatus },
  db?: Database.Database
): { success: boolean; examination?: ExaminationItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const status = params.status;

  if (!['Draft', 'Open', 'Closed'].includes(status)) {
    return { success: false, error: 'Invalid examination status. Must be Draft, Open, or Closed.' };
  }

  try {
    database.prepare(`
      UPDATE examinations
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);

    const updated = getExaminationById(id, database);
    return { success: true, examination: updated ?? undefined };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to update examination status:', err);
    return { success: false, error: 'Failed to update examination status.' };
  }
}

export function deleteExamination(
  params: { sessionToken?: string; id: number },
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  if (!id || id <= 0) return { success: false, error: 'Invalid examination ID.' };

  const existing = database.prepare('SELECT id, name FROM examinations WHERE id = ?').get(id) as { id: number; name: string } | undefined;
  if (!existing) return { success: false, error: 'Examination not found.' };

  try {
    const runInTransaction = database.transaction(() => {
      database.prepare('DELETE FROM exam_marks WHERE examination_id = ?').run(id);
      database.prepare('DELETE FROM examination_subjects WHERE examination_id = ?').run(id);
      database.prepare('DELETE FROM examinations WHERE id = ?').run(id);
    });
    runInTransaction();
    return { success: true };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to delete examination:', err);
    return { success: false, error: 'Failed to delete examination.' };
  }
}

// ─── 3. EXAMINATION SUBJECTS (DYNAMIC SUBJECT SYSTEM) ────────────────────────

interface ExamSubjectRow {
  id: number;
  examination_id: number;
  class_id: number;
  class_name?: string;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  max_marks: number;
  passing_marks: number;
  display_order: number;
  exam_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  is_active: number;
  marks_entered_count?: number;
  total_students_count?: number;
  created_at: string;
  updated_at: string;
}

function mapExamSubjectRow(row: ExamSubjectRow): ExaminationSubjectItem {
  return {
    id: row.id,
    examinationId: row.examination_id,
    classId: row.class_id,
    className: row.class_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    subjectCode: row.subject_code,
    maxMarks: row.max_marks,
    passingMarks: row.passing_marks,
    displayOrder: row.display_order,
    examDate: row.exam_date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active === 1,
    marksEnteredCount: row.marks_entered_count ?? 0,
    totalStudentsCount: row.total_students_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getExaminationSubjects(
  params: { examinationId: number; classId?: number },
  db?: Database.Database
): ExaminationSubjectItem[] {
  const database = db ?? getDatabase();
  const examId = Number(params.examinationId);
  const classId = params.classId ? Number(params.classId) : undefined;

  // Auto-synchronize assigned subjects from class_subjects into examination_subjects
  // if the examination is active (Draft or Open).
  if (examId > 0) {
    try {
      const exam = database
        .prepare('SELECT id, status FROM examinations WHERE id = ?')
        .get(examId) as { id: number; status: ExamStatus } | undefined;

      if (exam && exam.status !== 'Closed') {
        const classesToSync: number[] = [];
        if (classId && classId > 0) {
          classesToSync.push(classId);
        } else {
          // Sync any classes already associated with this exam
          const existingClasses = database
            .prepare('SELECT DISTINCT class_id FROM examination_subjects WHERE examination_id = ?')
            .all(examId) as Array<{ class_id: number }>;
          for (const ec of existingClasses) {
            classesToSync.push(ec.class_id);
          }
        }

        const insertStmt = database.prepare(`
          INSERT INTO examination_subjects (
            examination_id, class_id, subject_id, max_marks, passing_marks,
            display_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, 100, 40, ?, 1, datetime('now'), datetime('now'))
        `);

        for (const cid of classesToSync) {
          const assigned = database.prepare(`
            SELECT cs.subject_id, cs.display_order
            FROM class_subjects cs
            JOIN subjects s ON s.id = cs.subject_id
            WHERE cs.class_id = ? AND cs.is_active = 1 AND s.is_active = 1
            ORDER BY cs.display_order ASC, s.name ASC
          `).all(cid) as Array<{ subject_id: number; display_order: number }>;

          if (assigned.length > 0) {
            const existing = database.prepare(`
              SELECT subject_id FROM examination_subjects
              WHERE examination_id = ? AND class_id = ?
            `).all(examId, cid) as Array<{ subject_id: number }>;
            const existingSubjectIds = new Set(existing.map((e) => e.subject_id));

            for (const a of assigned) {
              if (!existingSubjectIds.has(a.subject_id)) {
                insertStmt.run(examId, cid, a.subject_id, a.display_order);
                existingSubjectIds.add(a.subject_id);
              }
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('[ExamService] Auto-sync examination subjects warning:', syncErr);
    }
  }

  let query = `
    SELECT es.*,
           c.name as class_name,
           s.name as subject_name,
           s.code as subject_code,
           (SELECT COUNT(*) FROM exam_marks em WHERE em.examination_subject_id = es.id) as marks_entered_count
    FROM examination_subjects es
    JOIN classes c ON c.id = es.class_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.examination_id = ?
  `;
  const queryParams: unknown[] = [examId];

  if (classId) {
    query += ' AND es.class_id = ?';
    queryParams.push(classId);
  }

  query += ' ORDER BY es.class_id ASC, es.display_order ASC, s.name ASC';

  const rows = database.prepare(query).all(...queryParams) as ExamSubjectRow[];
  return rows.map(mapExamSubjectRow);
}

/**
 * Validates and configures subjects for an examination and class.
 * CRITICAL RULE: Subjects MUST belong to class_subjects for the specified class.
 */
export function configureExaminationSubjects(
  params: {
    sessionToken?: string;
    examinationId: number;
    classId: number;
    subjects: Array<{
      subjectId: number;
      maxMarks: number;
      passingMarks: number;
      displayOrder?: number;
      examDate?: string;
      startTime?: string;
      durationMinutes?: number;
    }>;
  },
  db?: Database.Database
): { success: boolean; subjects?: ExaminationSubjectItem[]; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const examId = Number(params.examinationId);
  const classId = Number(params.classId);

  if (!examId || examId <= 0) return { success: false, error: 'Invalid examination ID.' };
  if (!classId || classId <= 0) return { success: false, error: 'Invalid class ID.' };

  const exam = database.prepare('SELECT id, status FROM examinations WHERE id = ?').get(examId) as { id: number; status: ExamStatus } | undefined;
  if (!exam) return { success: false, error: 'Examination not found.' };

  if (exam.status === 'Closed') {
    return { success: false, error: 'Cannot modify subjects for a Closed examination.' };
  }

  // Verify assigned subjects in class_subjects (from Phase 3)
  const classSubjects = database
    .prepare('SELECT subject_id FROM class_subjects WHERE class_id = ? AND is_active = 1')
    .all(classId) as Array<{ subject_id: number }>;
  const validSubjectIds = new Set(classSubjects.map((cs) => cs.subject_id));

  // Validate incoming subjects
  for (const s of params.subjects) {
    if (!validSubjectIds.has(s.subjectId)) {
      const subName = database.prepare('SELECT name FROM subjects WHERE id = ?').get(s.subjectId) as { name: string } | undefined;
      return {
        success: false,
        error: `Subject "${subName ? subName.name : s.subjectId}" is not assigned to this class in the academic curriculum.`,
      };
    }
    if (s.maxMarks <= 0) {
      return { success: false, error: 'Maximum marks must be greater than zero.' };
    }
    if (s.passingMarks < 0 || s.passingMarks > s.maxMarks) {
      return { success: false, error: 'Passing marks must be between 0 and maximum marks.' };
    }
  }

  try {
    const runTx = database.transaction(() => {
      const subjectIdsInRequest = params.subjects.map((s) => s.subjectId);

      // Check if any subject being removed has existing marks
      const existingExamSubs = database
        .prepare('SELECT id, subject_id FROM examination_subjects WHERE examination_id = ? AND class_id = ?')
        .all(examId, classId) as Array<{ id: number; subject_id: number }>;

      for (const es of existingExamSubs) {
        if (!subjectIdsInRequest.includes(es.subject_id)) {
          const marksCount = database
            .prepare('SELECT COUNT(*) as count FROM exam_marks WHERE examination_subject_id = ?')
            .get(es.id) as { count: number };
          if (marksCount && marksCount.count > 0) {
            const sub = database.prepare('SELECT name FROM subjects WHERE id = ?').get(es.subject_id) as { name: string } | undefined;
            throw new Error(`Cannot remove subject "${sub?.name ?? ''}" because student marks are already recorded for it.`);
          }
          // Safe to delete if no marks
          database.prepare('DELETE FROM examination_subjects WHERE id = ?').run(es.id);
        }
      }

      // Upsert subjects
      const upsertStmt = database.prepare(`
        INSERT INTO examination_subjects (
          examination_id, class_id, subject_id, max_marks, passing_marks,
          display_order, exam_date, start_time, duration_minutes, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(examination_id, class_id, subject_id) DO UPDATE SET
          max_marks = excluded.max_marks,
          passing_marks = excluded.passing_marks,
          display_order = excluded.display_order,
          exam_date = excluded.exam_date,
          start_time = excluded.start_time,
          duration_minutes = excluded.duration_minutes,
          is_active = 1,
          updated_at = datetime('now')
      `);

      for (let i = 0; i < params.subjects.length; i++) {
        const s = params.subjects[i];
        upsertStmt.run(
          examId,
          classId,
          s.subjectId,
          s.maxMarks,
          s.passingMarks,
          s.displayOrder ?? i + 1,
          s.examDate || null,
          s.startTime || null,
          s.durationMinutes || null
        );
      }
    });

    runTx();

    const configured = getExaminationSubjects({ examinationId: examId, classId }, database);
    return { success: true, subjects: configured };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to configure examination subjects:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to configure examination subjects.' };
  }
}

/**
 * Updates maximum marks and passing marks for an individual examination subject.
 */
export function updateExaminationSubjectMarks(
  params: {
    sessionToken?: string;
    examinationSubjectId: number;
    maxMarks: number;
    passingMarks: number;
  },
  db?: Database.Database
): { success: boolean; examinationSubject?: ExaminationSubjectItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.examinationSubjectId);
  const maxMarks = Number(params.maxMarks);
  const passingMarks = Number(params.passingMarks);

  if (!id || id <= 0) {
    return { success: false, error: 'Invalid examination subject ID.' };
  }
  if (isNaN(maxMarks) || maxMarks <= 0) {
    return { success: false, error: 'Maximum marks must be greater than zero.' };
  }
  if (isNaN(passingMarks) || passingMarks < 0 || passingMarks > maxMarks) {
    return { success: false, error: 'Passing marks must be between 0 and maximum marks.' };
  }

  const existing = database.prepare(`
    SELECT es.*, e.status as exam_status
    FROM examination_subjects es
    JOIN examinations e ON e.id = es.examination_id
    WHERE es.id = ?
  `).get(id) as (ExamSubjectRow & { exam_status: ExamStatus }) | undefined;

  if (!existing) {
    return { success: false, error: 'Examination subject not found.' };
  }

  if (existing.exam_status === 'Closed') {
    return { success: false, error: 'Cannot modify subject configuration for a Closed examination.' };
  }

  try {
    database.prepare(`
      UPDATE examination_subjects
      SET max_marks = ?, passing_marks = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(maxMarks, passingMarks, id);

    const updatedRow = database.prepare(`
      SELECT es.*, s.name as subject_name, s.code as subject_code, c.name as class_name,
             (SELECT COUNT(*) FROM exam_marks em WHERE em.examination_subject_id = es.id AND em.obtained_marks IS NOT NULL) as marks_entered_count,
             (SELECT COUNT(*) FROM student_enrollments se WHERE se.class_id = es.class_id AND se.academic_session_id = (SELECT academic_session_id FROM examinations WHERE id = es.examination_id) AND se.status = 'Active') as total_students_count
      FROM examination_subjects es
      JOIN subjects s ON s.id = es.subject_id
      JOIN classes c ON c.id = es.class_id
      WHERE es.id = ?
    `).get(id) as ExamSubjectRow;

    return { success: true, examinationSubject: mapExamSubjectRow(updatedRow) };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to update examination subject marks:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update subject marks.' };
  }
}

// ─── 4. GRADING RULES ─────────────────────────────────────────────────────────

interface GradingRuleRow {
  id: number;
  name: string;
  min_percentage: number;
  max_percentage: number;
  grade: string;
  grade_point: number;
  remarks: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

function mapGradingRuleRow(row: GradingRuleRow): GradingRuleItem {
  return {
    id: row.id,
    name: row.name,
    minPercentage: row.min_percentage,
    maxPercentage: row.max_percentage,
    grade: row.grade,
    gradePoint: row.grade_point,
    remarks: row.remarks || '',
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllGradingRules(db?: Database.Database): GradingRuleItem[] {
  const database = db ?? getDatabase();
  const rows = database
    .prepare('SELECT * FROM grading_rules ORDER BY display_order ASC, min_percentage DESC')
    .all() as GradingRuleRow[];
  return rows.map(mapGradingRuleRow);
}

export function saveGradingRule(
  params: {
    sessionToken?: string;
    id?: number;
    name: string;
    minPercentage: number;
    maxPercentage: number;
    grade: string;
    gradePoint?: number;
    remarks?: string;
    displayOrder?: number;
  },
  db?: Database.Database
): { success: boolean; rule?: GradingRuleItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const minPct = Number(params.minPercentage);
  const maxPct = Number(params.maxPercentage);
  const grade = (params.grade || '').trim().toUpperCase();
  const gradePoint = Number(params.gradePoint) || 0;
  const remarks = (params.remarks || '').trim();
  const displayOrder = Number(params.displayOrder) || 0;

  if (!name) return { success: false, error: 'Rule name is required.' };
  if (!grade) return { success: false, error: 'Grade symbol is required.' };
  if (minPct < 0 || minPct > 100 || maxPct < 0 || maxPct > 100) {
    return { success: false, error: 'Percentage range must be between 0 and 100.' };
  }
  if (minPct > maxPct) {
    return { success: false, error: 'Minimum percentage cannot exceed maximum percentage.' };
  }

  try {
    if (params.id && params.id > 0) {
      database.prepare(`
        UPDATE grading_rules
        SET name = ?, min_percentage = ?, max_percentage = ?, grade = ?, grade_point = ?, remarks = ?, display_order = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, minPct, maxPct, grade, gradePoint, remarks, displayOrder, params.id);
      const row = database.prepare('SELECT * FROM grading_rules WHERE id = ?').get(params.id) as GradingRuleRow;
      return { success: true, rule: mapGradingRuleRow(row) };
    } else {
      const res = database.prepare(`
        INSERT INTO grading_rules (name, min_percentage, max_percentage, grade, grade_point, remarks, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name, minPct, maxPct, grade, gradePoint, remarks, displayOrder);
      const row = database.prepare('SELECT * FROM grading_rules WHERE id = ?').get(Number(res.lastInsertRowid)) as GradingRuleRow;
      return { success: true, rule: mapGradingRuleRow(row) };
    }
  } catch (err: unknown) {
    console.error('[ExamService] Failed to save grading rule:', err);
    return { success: false, error: 'Failed to save grading rule.' };
  }
}

export function deleteGradingRule(
  params: { sessionToken?: string; id: number },
  db?: Database.Database
): { success: boolean; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  try {
    database.prepare('DELETE FROM grading_rules WHERE id = ?').run(params.id);
    return { success: true };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to delete grading rule:', err);
    return { success: false, error: 'Failed to delete grading rule.' };
  }
}

/**
 * Finds the grade and grade point for a given percentage based on grading rules.
 */
export function evaluateGrade(
  percentage: number,
  rules?: GradingRuleItem[],
  db?: Database.Database
): { grade: string; gradePoint: number; remarks: string } {
  const activeRules = rules && rules.length > 0 ? rules : getAllGradingRules(db);
  const roundedPct = Math.round(percentage * 100) / 100;

  for (const r of activeRules) {
    if (roundedPct >= r.minPercentage && roundedPct <= r.maxPercentage) {
      return { grade: r.grade, gradePoint: r.gradePoint, remarks: r.remarks };
    }
  }

  return { grade: 'F', gradePoint: 0, remarks: 'Fail' };
}

// ─── 5. MARKS ENTRY ───────────────────────────────────────────────────────────

export function getStudentsForMarksEntry(
  params: { examinationId: number; classId: number; sectionId?: number; examinationSubjectId: number },
  db?: Database.Database
): {
  success: boolean;
  students: StudentMarksEntryItem[];
  examinationSubject?: ExaminationSubjectItem;
  examinationStatus?: ExamStatus;
  error?: string;
} {
  const database = db ?? getDatabase();
  const { examinationId, classId, sectionId, examinationSubjectId } = params;

  const exam = database.prepare('SELECT id, status, academic_session_id FROM examinations WHERE id = ?').get(examinationId) as
    | { id: number; status: ExamStatus; academic_session_id: number }
    | undefined;
  if (!exam) return { success: false, students: [], error: 'Examination not found.' };

  const examSub = database.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code, c.name as class_name
    FROM examination_subjects es
    JOIN subjects s ON s.id = es.subject_id
    JOIN classes c ON c.id = es.class_id
    WHERE es.id = ? AND es.examination_id = ?
  `).get(examinationSubjectId, examinationId) as ExamSubjectRow | undefined;

  if (!examSub) return { success: false, students: [], error: 'Examination subject not found.' };

  let sql = `
    SELECT
      s.id as student_id,
      e.id as enrollment_id,
      s.student_id as system_student_id,
      s.admission_number,
      s.display_name,
      s.gender,
      s.father_name,
      e.roll_number,
      em.id as mark_id,
      em.obtained_marks,
      em.status as mark_status,
      em.remarks as mark_remarks
    FROM student_enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN exam_marks em ON em.examination_id = ?
                           AND em.examination_subject_id = ?
                           AND em.student_id = s.id
    WHERE e.academic_session_id = ?
      AND e.class_id = ?
      AND e.status = 'Active'
      AND s.is_active = 1
  `;
  const queryParams: unknown[] = [examinationId, examinationSubjectId, exam.academic_session_id, classId];

  if (sectionId) {
    sql += ' AND e.section_id = ?';
    queryParams.push(sectionId);
  }

  sql += ' ORDER BY s.display_name COLLATE NOCASE ASC';

  const rows = database.prepare(sql).all(...queryParams) as Array<{
    student_id: number;
    enrollment_id: number;
    system_student_id: string;
    admission_number: string;
    display_name: string;
    gender: string;
    father_name: string | null;
    roll_number: string | null;
    mark_id: number | null;
    obtained_marks: number | null;
    mark_status: MarkStatus | null;
    mark_remarks: string | null;
  }>;

  const students: StudentMarksEntryItem[] = rows.map((r) => ({
    studentId: r.student_id,
    enrollmentId: r.enrollment_id,
    systemStudentId: r.system_student_id,
    admissionNumber: r.admission_number || '',
    displayName: r.display_name,
    gender: r.gender,
    fatherName: r.father_name || '',
    rollNumber: r.roll_number || '',
    obtainedMarks: r.obtained_marks !== null && r.obtained_marks !== undefined ? r.obtained_marks : null,
    status: r.mark_status || 'Entered',
    remarks: r.mark_remarks || '',
    markId: r.mark_id ?? undefined,
  }));

  return {
    success: true,
    students,
    examinationSubject: mapExamSubjectRow(examSub),
    examinationStatus: exam.status,
  };
}

/**
 * Saves or updates student marks for an examination subject in a single transaction.
 * Enforces:
 * - Examination must not be Closed.
 * - Obtained marks must be between 0 and max_marks (or null if Absent).
 * - Explicit Absent status storage.
 */
export function saveMarks(
  params: {
    sessionToken?: string;
    examinationId: number;
    examinationSubjectId: number;
    marks: Array<{
      studentId: number;
      enrollmentId: number;
      obtainedMarks: number | null;
      status: MarkStatus;
      remarks?: string;
    }>;
  },
  db?: Database.Database
): { success: boolean; savedCount: number; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, savedCount: 0, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const { examinationId, examinationSubjectId, marks } = params;

  const exam = database.prepare('SELECT id, status FROM examinations WHERE id = ?').get(examinationId) as
    | { id: number; status: ExamStatus }
    | undefined;
  if (!exam) return { success: false, savedCount: 0, error: 'Examination not found.' };

  if (exam.status === 'Closed') {
    return { success: false, savedCount: 0, error: 'Cannot enter or modify marks for a Closed examination.' };
  }

  const examSub = database.prepare('SELECT id, max_marks FROM examination_subjects WHERE id = ? AND examination_id = ?').get(examinationSubjectId, examinationId) as
    | { id: number; max_marks: number }
    | undefined;
  if (!examSub) return { success: false, savedCount: 0, error: 'Examination subject not found.' };

  const maxMarks = examSub.max_marks;

  // Validate before starting transaction
  for (const m of marks) {
    if (m.status === 'Entered') {
      if (m.obtainedMarks === null || m.obtainedMarks === undefined || isNaN(m.obtainedMarks)) {
        return { success: false, savedCount: 0, error: `Valid marks are required for student ID ${m.studentId} when status is Entered.` };
      }
      if (m.obtainedMarks < 0 || m.obtainedMarks > maxMarks) {
        return {
          success: false,
          savedCount: 0,
          error: `Obtained marks (${m.obtainedMarks}) must be between 0 and maximum marks (${maxMarks}).`,
        };
      }
    }
  }

  try {
    const runTx = database.transaction(() => {
      const stmt = database.prepare(`
        INSERT INTO exam_marks (
          examination_id, examination_subject_id, student_id, enrollment_id,
          obtained_marks, status, remarks, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(examination_id, examination_subject_id, student_id) DO UPDATE SET
          obtained_marks = excluded.obtained_marks,
          status = excluded.status,
          remarks = excluded.remarks,
          updated_at = datetime('now')
      `);

      for (const m of marks) {
        const obtained = m.status === 'Absent' ? null : Math.round(Number(m.obtainedMarks) * 100) / 100;
        stmt.run(
          examinationId,
          examinationSubjectId,
          m.studentId,
          m.enrollmentId,
          obtained,
          m.status,
          (m.remarks || '').trim()
        );
      }
    });

    runTx();
    return { success: true, savedCount: marks.length };
  } catch (err: unknown) {
    console.error('[ExamService] Failed to save marks:', err);
    return { success: false, savedCount: 0, error: 'Failed to save examination marks.' };
  }
}

// ─── 6. RESULTS CALCULATION ───────────────────────────────────────────────────

export function calculateStudentExamResult(
  examinationId: number,
  studentId: number,
  db?: Database.Database,
  targetClassId?: number
): { success: boolean; result?: StudentExamResult; error?: string } {
  try {
    const database = db ?? getDatabase();

    const exam = database.prepare('SELECT id, name, academic_session_id FROM examinations WHERE id = ?').get(examinationId) as
      | { id: number; name: string; academic_session_id: number }
      | undefined;
    if (!exam) return { success: false, error: 'Examination not found.' };

    // Fetch student demographic and enrollment info
    // Prioritize active enrollments for the examination's academic session and class
    let studentSql = `
      SELECT s.id, s.student_id, s.admission_number, s.display_name, s.gender, s.father_name,
             c.name as class_name, sec.name as section_name, e.id as enrollment_id, e.class_id, e.roll_number
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id AND e.academic_session_id = ?
      JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections sec ON sec.id = e.section_id
      WHERE s.id = ?
    `;
    const queryParams: unknown[] = [exam.academic_session_id, studentId];

    if (targetClassId) {
      studentSql += ' AND e.class_id = ?';
      queryParams.push(targetClassId);
    }

    studentSql += `
      ORDER BY CASE WHEN e.status = 'Active' THEN 0 ELSE 1 END, e.id DESC
      LIMIT 1
    `;

    const student = database.prepare(studentSql).get(...queryParams) as {
      id: number;
      student_id: string;
      admission_number: string;
      display_name: string;
      gender: string;
      father_name: string;
      class_name: string;
      section_name: string;
      enrollment_id: number;
      class_id: number;
      roll_number?: string;
    } | undefined;

    if (!student) return { success: false, error: 'Student enrollment not found for this academic session.' };

  // Fetch all examination subjects for this student's class
  const examSubjects = database.prepare(`
    SELECT es.id as examination_subject_id, es.subject_id, es.max_marks, es.passing_marks,
           s.name as subject_name, s.code as subject_code
    FROM examination_subjects es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.examination_id = ? AND es.class_id = ? AND es.is_active = 1
    ORDER BY es.display_order ASC, s.name ASC
  `).all(examinationId, student.class_id) as Array<{
    examination_subject_id: number;
    subject_id: number;
    max_marks: number;
    passing_marks: number;
    subject_name: string;
    subject_code: string;
  }>;

  if (examSubjects.length === 0) {
    return { success: false, error: 'No subjects configured for this class in this examination.' };
  }

  // Fetch marks entered for this student
  const marksRows = database.prepare(`
    SELECT examination_subject_id, obtained_marks, status, remarks
    FROM exam_marks
    WHERE examination_id = ? AND student_id = ?
  `).all(examinationId, studentId) as Array<{
    examination_subject_id: number;
    obtained_marks: number | null;
    status: MarkStatus;
    remarks: string;
  }>;

  const marksMap = new Map<number, { obtained: number | null; status: MarkStatus; remarks: string }>();
  for (const m of marksRows) {
    marksMap.set(m.examination_subject_id, {
      obtained: m.obtained_marks,
      status: m.status,
      remarks: m.remarks,
    });
  }

  let totalMax = 0;
  let totalObtained = 0;
  let hasFailedSubject = false;

  const subjectsBreakdown: SubjectResultBreakdown[] = examSubjects.map((es) => {
    const markEntry = marksMap.get(es.examination_subject_id);
    const status: MarkStatus = markEntry ? markEntry.status : 'Entered';
    const obtained: number | null = markEntry ? markEntry.obtained : null;
    const marksNumeric = status === 'Absent' ? 0 : (obtained ?? 0);

    totalMax += es.max_marks;
    totalObtained += marksNumeric;

    // Fail if absent or if obtained marks < passing marks
    const isPass = status !== 'Absent' && obtained !== null && obtained >= es.passing_marks;
    if (!isPass) {
      hasFailedSubject = true;
    }

    return {
      examinationSubjectId: es.examination_subject_id,
      subjectId: es.subject_id,
      subjectName: es.subject_name,
      subjectCode: es.subject_code,
      maxMarks: es.max_marks,
      passingMarks: es.passing_marks,
      obtainedMarks: obtained,
      status,
      isPass,
      remarks: markEntry?.remarks || '',
    };
  });

  const rawPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const percentage = Math.round(rawPercentage * 100) / 100;
  const gradeInfo = evaluateGrade(percentage, undefined, database);

  const isPassed = !hasFailedSubject;
  const overallRemarks = isPassed ? gradeInfo.remarks : 'Failed';

  const result: StudentExamResult = {
    studentId: student.id,
    systemStudentId: student.student_id,
    admissionNumber: student.admission_number || '',
    displayName: student.display_name,
    gender: student.gender,
    fatherName: student.father_name || '',
    className: student.class_name,
    sectionName: student.section_name,
    rollNumber: student.roll_number || '',
    totalMaxMarks: totalMax,
    totalObtainedMarks: totalObtained,
    percentage,
    grade: isPassed ? gradeInfo.grade : 'F',
    gradePoint: isPassed ? gradeInfo.gradePoint : 0,
    isPassed,
    overallRemarks,
    subjects: subjectsBreakdown,
  };

  return { success: true, result };
} catch (err: unknown) {
  console.error('[ExamService] calculateStudentExamResult error:', err);
  return { success: false, error: err instanceof Error ? err.message : 'Failed to calculate student result.' };
}
}

export function getClassExamResults(
  params: { examinationId: number; classId: number; sectionId?: number },
  db?: Database.Database
): { success: boolean; results?: ClassExamResults; error?: string } {
  const database = db ?? getDatabase();
  const { examinationId, classId, sectionId } = params;

  const exam = database.prepare(`
    SELECT e.id, e.name, sess.name as academic_session_name, e.academic_session_id
    FROM examinations e
    JOIN academic_sessions sess ON sess.id = e.academic_session_id
    WHERE e.id = ?
  `).get(examinationId) as { id: number; name: string; academic_session_name: string; academic_session_id: number } | undefined;

  if (!exam) return { success: false, error: 'Examination not found.' };

  const cls = database.prepare('SELECT name FROM classes WHERE id = ?').get(classId) as { name: string } | undefined;
  if (!cls) return { success: false, error: 'Class not found.' };

  let sectionName: string | undefined;
  if (sectionId) {
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(sectionId) as { name: string } | undefined;
    sectionName = sec?.name;
  }

  // Get all active students enrolled in this class/section
  let studentSql = `
    SELECT s.id
    FROM student_enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.academic_session_id = ?
      AND e.class_id = ?
      AND e.status = 'Active'
      AND s.is_active = 1
  `;
  const studentParams: unknown[] = [exam.academic_session_id, classId];
  if (sectionId) {
    studentSql += ' AND e.section_id = ?';
    studentParams.push(sectionId);
  }

  const studentRows = database.prepare(studentSql).all(...studentParams) as Array<{ id: number }>;

  const studentResults: StudentExamResult[] = [];
  for (const s of studentRows) {
    const res = calculateStudentExamResult(examinationId, s.id, database, classId);
    if (res.success && res.result) {
      studentResults.push(res.result);
    }
  }

  // Rank / Positions: Sort by percentage descending, then totalObtained descending
  studentResults.sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return b.totalObtainedMarks - a.totalObtainedMarks;
  });

  // Assign positions
  let currentRank = 1;
  for (let i = 0; i < studentResults.length; i++) {
    if (i > 0) {
      const prev = studentResults[i - 1];
      const curr = studentResults[i];
      if (curr.percentage === prev.percentage && curr.totalObtainedMarks === prev.totalObtainedMarks) {
        curr.position = prev.position;
      } else {
        curr.position = currentRank;
      }
    } else {
      studentResults[0].position = 1;
    }
    currentRank++;
    studentResults[i].totalStudentsInClass = studentResults.length;
  }

  const totalStudents = studentResults.length;
  const passedStudents = studentResults.filter((r) => r.isPassed).length;
  const failedStudents = totalStudents - passedStudents;
  const passPercentage = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 10000) / 100 : 0;
  const highestPercentage = totalStudents > 0 ? studentResults[0].percentage : 0;
  const sumPercentage = studentResults.reduce((acc, r) => acc + r.percentage, 0);
  const averagePercentage = totalStudents > 0 ? Math.round((sumPercentage / totalStudents) * 100) / 100 : 0;

  // Aggregate Subject Statistics
  const examSubjects = database.prepare(`
    SELECT es.id, s.name as subject_name, es.max_marks, es.passing_marks
    FROM examination_subjects es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.examination_id = ? AND es.class_id = ? AND es.is_active = 1
    ORDER BY es.display_order ASC
  `).all(examinationId, classId) as Array<{
    id: number;
    subject_name: string;
    max_marks: number;
    passing_marks: number;
  }>;

  const subjectStats = examSubjects.map((es) => {
    let subSum = 0;
    let subPassCount = 0;
    let subFailCount = 0;
    let studentCountWithMarks = 0;

    for (const sr of studentResults) {
      const subRes = sr.subjects.find((s: SubjectResultBreakdown) => s.examinationSubjectId === es.id);
      if (subRes) {
        studentCountWithMarks++;
        const marks = subRes.obtainedMarks ?? 0;
        subSum += marks;
        if (subRes.isPass) subPassCount++;
        else subFailCount++;
      }
    }

    const avg = studentCountWithMarks > 0 ? Math.round((subSum / studentCountWithMarks) * 100) / 100 : 0;
    return {
      id: es.id,
      subjectName: es.subject_name,
      maxMarks: es.max_marks,
      passingMarks: es.passing_marks,
      averageMarks: avg,
      passCount: subPassCount,
      failCount: subFailCount,
    };
  });

  const results: ClassExamResults = {
    examinationId,
    examinationName: exam.name,
    academicSessionName: exam.academic_session_name,
    classId,
    className: cls.name,
    sectionId,
    sectionName,
    totalStudents,
    passedStudents,
    failedStudents,
    passPercentage,
    highestPercentage,
    averagePercentage,
    subjects: subjectStats,
    studentResults,
  };

  return { success: true, results };
}

// ─── 7. DYNAMIC DMC GENERATION ────────────────────────────────────────────────

export function generateStudentDMC(
  examinationId: number,
  studentId: number,
  db?: Database.Database,
  targetClassId?: number,
  precomputedPosition?: { position?: number; totalStudents?: number }
): { success: boolean; dmc?: StudentDMCData; error?: string } {
  try {
    const database = db ?? getDatabase();

    const exam = database.prepare(`
      SELECT e.id, e.name, e.start_date, e.end_date,
             et.name as exam_type_name,
             sess.name as academic_session_name
      FROM examinations e
      JOIN exam_types et ON et.id = e.exam_type_id
      JOIN academic_sessions sess ON sess.id = e.academic_session_id
      WHERE e.id = ?
    `).get(examinationId) as {
      id: number;
      name: string;
      start_date: string;
      end_date: string;
      exam_type_name: string;
      academic_session_name: string;
    } | undefined;

    if (!exam) return { success: false, error: 'Examination not found.' };

    // Fetch full student demographic for DMC
    // Prioritize active enrollment and targetClassId if specified
    let studentSql = `
      SELECT s.id, s.student_id, s.admission_number, s.display_name, s.father_name, s.date_of_birth,
             s.photo_path, c.id as class_id, sec.id as section_id, e.roll_number
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id
      JOIN examinations ex ON ex.id = ? AND ex.academic_session_id = e.academic_session_id
      JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections sec ON sec.id = e.section_id
      WHERE s.id = ?
    `;
    const studentParams: unknown[] = [examinationId, studentId];

    if (targetClassId) {
      studentSql += ' AND e.class_id = ?';
      studentParams.push(targetClassId);
    }

    studentSql += `
      ORDER BY CASE WHEN e.status = 'Active' THEN 0 ELSE 1 END, e.id DESC
      LIMIT 1
    `;

    const student = database.prepare(studentSql).get(...studentParams) as {
      id: number;
      student_id: string;
      admission_number: string;
      display_name: string;
      father_name: string;
      date_of_birth: string;
      photo_path: string | null;
      class_id: number;
      section_id: number;
      roll_number?: string;
    } | undefined;

    if (!student) return { success: false, error: 'Student details not found.' };

    const effectiveClassId = targetClassId || student.class_id;
    const studentRes = calculateStudentExamResult(examinationId, studentId, database, effectiveClassId);
    if (!studentRes.success || !studentRes.result) {
      return { success: false, error: studentRes.error || 'Failed to calculate student result.' };
    }

    const res = studentRes.result;

    // Calculate position in class or use precomputed rank
    let position: number | undefined = precomputedPosition?.position;
    let totalStudents: number | undefined = precomputedPosition?.totalStudents;
    if (position === undefined) {
      const classRes = getClassExamResults(
        { examinationId, classId: effectiveClassId, sectionId: student.section_id || undefined },
        database
      );
      if (classRes.success && classRes.results) {
        totalStudents = classRes.results.totalStudents;
        const ranked = classRes.results.studentResults.find((r: StudentExamResult) => r.studentId === studentId);
        position = ranked?.position;
      }
    }

    const school = getSchoolSettings(database);
    // Embed logo data URL if available
    const logoDataUrl = getSchoolLogoDataUrl(database);
    if (logoDataUrl) {
      school.logoPath = logoDataUrl;
      (school as any).logoDataUrl = logoDataUrl;
    }
    const signatureDataUrl = getPrincipalSignatureDataUrl(database);
    if (signatureDataUrl) {
      (school as any).signaturePath = signatureDataUrl;
      (school as any).signatureDataUrl = signatureDataUrl;
    }

    const subjects = res.subjects.map((sub: SubjectResultBreakdown) => {
      const isAbsent = sub.status === 'Absent';
      const isMissing = sub.obtainedMarks === null || sub.obtainedMarks === undefined;
      const subPct = sub.maxMarks > 0 && !isMissing ? ((sub.obtainedMarks ?? 0) / sub.maxMarks) * 100 : 0;
      const subGrade = isAbsent ? 'Absent' : isMissing ? 'Pending' : evaluateGrade(subPct, undefined, database).grade;
      return {
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        maxMarks: sub.maxMarks,
        passingMarks: sub.passingMarks,
        obtainedMarks: sub.obtainedMarks,
        status: sub.status,
        grade: subGrade,
        remarks: sub.remarks || (isAbsent ? 'Absent' : isMissing ? 'Pending' : sub.isPass ? 'Passed' : 'Failed'),
      };
    });

    const hasPendingSubjects = res.subjects.some((s: SubjectResultBreakdown) => (s.obtainedMarks === null || s.obtainedMarks === undefined) && s.status !== 'Absent');
    const finalResult = hasPendingSubjects ? 'Pending' : (res.isPassed ? 'Pass' : 'Fail');
    const finalGrade = hasPendingSubjects ? 'Pending' : res.grade;
    const finalGradePoint = hasPendingSubjects ? 0 : res.gradePoint;
    const finalRemarks = hasPendingSubjects ? 'Result Pending (Incomplete Marks)' : res.overallRemarks;
    const finalPosition = hasPendingSubjects ? undefined : position;

    const dmc: StudentDMCData = {
      school,
      examination: {
        id: exam.id,
        name: exam.name,
        examTypeName: exam.exam_type_name,
        academicSessionName: exam.academic_session_name,
        startDate: exam.start_date,
        endDate: exam.end_date,
      },
      student: {
        id: student.id,
        systemStudentId: student.student_id, // Labeled "Student Unique ID" on DMC
        admissionNumber: student.admission_number,
        displayName: student.display_name,
        fatherName: student.father_name,
        className: res.className,
        sectionName: res.sectionName,
        rollNumber: res.rollNumber || student.roll_number || '',
        dateOfBirth: student.date_of_birth,
        photoDataUrl: getStudentPhotoDataUrl(student.photo_path),
      },
      subjects,
      summary: {
        totalMaxMarks: res.totalMaxMarks,
        totalObtainedMarks: res.totalObtainedMarks,
        percentage: res.percentage,
        grade: finalGrade,
        gradePoint: finalGradePoint,
        result: finalResult,
        overallRemarks: finalRemarks,
        position: finalPosition,
        totalStudents,
      },
      gradingRules: getAllGradingRules(database),
      issueDate: new Date().toISOString().split('T')[0],
    };

    return { success: true, dmc };
  } catch (err: unknown) {
    console.error('[ExamService] generateStudentDMC error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate student DMC.' };
  }
}

export function generateClassDMC(
  params: { examinationId: number; classId: number; sectionId?: number },
  db?: Database.Database
): { success: boolean; dmcs?: StudentDMCData[]; error?: string } {
  try {
    const database = db ?? getDatabase();
    const { examinationId, classId, sectionId } = params;

    const classRes = getClassExamResults({ examinationId, classId, sectionId }, database);
    if (!classRes.success || !classRes.results) {
      return { success: false, error: classRes.error || 'Failed to calculate class results.' };
    }

    const dmcs: StudentDMCData[] = [];
    for (const sr of classRes.results.studentResults) {
      const dmcRes = generateStudentDMC(
        examinationId,
        sr.studentId,
        database,
        classId,
        { position: sr.position, totalStudents: classRes.results.totalStudents }
      );
      if (dmcRes.success && dmcRes.dmc) {
        dmcs.push(dmcRes.dmc);
      }
    }

    return { success: true, dmcs };
  } catch (err: unknown) {
    console.error('[ExamService] generateClassDMC error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate class DMCs.' };
  }
}
