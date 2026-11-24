/**
 * Student Document Management Service
 * 
 * Handles generation, preview, issuance, and audit history for official student documents:
 * - Bonafide / Student Certificate
 * - Character Certificate
 * - School Leaving / Transfer Certificate
 * - General Student Certificate (customizable)
 * 
 * All institutional branding and student particulars are dynamically retrieved
 * from the database with zero hardcoding.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';
import { getSchoolSettings, getSchoolLogoDataUrl, SchoolSettings } from './school.service';
import { getStudentById, StudentItem } from './student.service';

export type DocumentType = 'Bonafide' | 'Character' | 'Leaving' | 'General';

export interface StudentDocumentRecord {
  id: number;
  documentNumber: string;
  studentId: number;
  studentSystemId: string;
  admissionNumber: string;
  studentName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  documentType: DocumentType;
  title: string;
  academicSessionId: number;
  academicSessionName: string;
  issueDate: string;
  generatedByUserId: number | null;
  generatedByUserName?: string;
  contentJson: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentDocumentPayload {
  documentNumber?: string;
  documentType: DocumentType;
  title: string;
  issueDate: string;
  school: SchoolSettings;
  schoolLogoDataUrl?: string | null;
  student: {
    id: number;
    studentId: string;
    admissionNumber: string;
    displayName: string;
    fatherName: string;
    motherName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    religion: string;
    bloodGroup: string;
    phone: string;
    currentAddress: string;
    admissionDate: string;
    className: string;
    sectionName: string;
    rollNumber: string;
    academicSessionName: string;
    academicSessionId: number;
    photoDataUrl?: string | null;
  };
  details: {
    conduct?: string;
    reasonForLeaving?: string;
    duesCleared?: boolean;
    customContent?: string;
    remarks?: string;
  };
}

/**
 * Generates the next sequential Document Number: DOC-YYYY-XXXXXX
 */
export function generateNextDocumentNumber(db?: Database.Database): string {
  const database = db ?? getDatabase();
  const currentYear = new Date().getFullYear();
  const prefix = `DOC-${currentYear}-`;

  const row = database
    .prepare(
      `SELECT document_number FROM student_documents 
       WHERE document_number LIKE ? 
       ORDER BY id DESC LIMIT 1`
    )
    .get(`${prefix}%`) as { document_number: string } | undefined;

  let nextSequence = 1;
  if (row && row.document_number) {
    const parts = row.document_number.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

/**
 * Builds full document preview data from actual database records.
 */
export function getStudentDocumentPreview(
  params: {
    studentId: number;
    documentType: DocumentType;
    academicSessionId?: number;
    customTitle?: string;
    customRemarks?: string;
    reasonForLeaving?: string;
    conduct?: string;
    customContent?: string;
    duesCleared?: boolean;
    issueDate?: string;
  },
  db?: Database.Database
): { success: boolean; document?: StudentDocumentPayload; error?: string } {
  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);

  if (!studentId) {
    return { success: false, error: 'A valid Student ID is required.' };
  }

  // 1. Fetch Student
  const student = getStudentById(studentId, database);
  if (!student) {
    return { success: false, error: 'Student not found.' };
  }

  // 2. Fetch School Settings & Logo
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  // 3. Resolve Academic Enrollment
  let enrollmentQuery = `
    SELECT e.*, sess.name as academic_session_name, c.name as class_name, sec.name as section_name
    FROM student_enrollments e
    JOIN academic_sessions sess ON sess.id = e.academic_session_id
    JOIN classes c ON c.id = e.class_id
    JOIN sections sec ON sec.id = e.section_id
    WHERE e.student_id = ?
  `;
  const queryParams: unknown[] = [studentId];

  if (params.academicSessionId) {
    enrollmentQuery += ` AND e.academic_session_id = ? ORDER BY e.id DESC LIMIT 1`;
    queryParams.push(Number(params.academicSessionId));
  } else {
    enrollmentQuery += ` ORDER BY (e.status = 'Active') DESC, e.id DESC LIMIT 1`;
  }

  const enrollment = database.prepare(enrollmentQuery).get(...queryParams) as {
    academic_session_id: number;
    academic_session_name: string;
    class_name: string;
    section_name: string;
    roll_number?: string;
    admission_date?: string;
    status: string;
  } | undefined;

  const className = enrollment?.class_name || student.currentEnrollment?.className || 'N/A';
  const sectionName = enrollment?.section_name || student.currentEnrollment?.sectionName || 'N/A';
  const sessionName = enrollment?.academic_session_name || student.currentEnrollment?.academicSessionName || school.academicSession || 'Current Session';
  const sessionId = enrollment?.academic_session_id || student.currentEnrollment?.academicSessionId || 0;
  const rollNumber = enrollment?.roll_number || '';
  const admissionDate = enrollment?.admission_date || '';

  // 4. Resolve Title according to document type
  let title = (params.customTitle || '').trim();
  if (!title) {
    switch (params.documentType) {
      case 'Bonafide':
        title = 'BONAFIDE / STUDENT CERTIFICATE';
        break;
      case 'Character':
        title = 'CHARACTER CERTIFICATE';
        break;
      case 'Leaving':
        title = 'SCHOOL LEAVING / TRANSFER CERTIFICATE';
        break;
      case 'General':
      default:
        title = 'STUDENT CERTIFICATE';
        break;
    }
  }

  const issueDate = params.issueDate || new Date().toISOString().split('T')[0];

  const payload: StudentDocumentPayload = {
    documentNumber: generateNextDocumentNumber(database),
    documentType: params.documentType,
    title,
    issueDate,
    school,
    schoolLogoDataUrl,
    student: {
      id: student.id,
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      fatherName: student.fatherName || '—',
      motherName: student.motherName || '—',
      dateOfBirth: student.dateOfBirth || '—',
      gender: student.gender,
      nationality: student.nationality || 'Pakistani',
      religion: student.religion || 'Islam',
      bloodGroup: student.bloodGroup || '—',
      phone: student.phone || '—',
      currentAddress: student.currentAddress || '—',
      admissionDate: admissionDate || student.createdAt?.split(' ')[0] || '—',
      className,
      sectionName,
      rollNumber,
      academicSessionName: sessionName,
      academicSessionId: sessionId,
      photoDataUrl: student.photoDataUrl,
    },
    details: {
      conduct: params.conduct || 'Good',
      reasonForLeaving: params.reasonForLeaving || "Parents' Request",
      duesCleared: params.duesCleared !== false,
      customContent: params.customContent || '',
      remarks: params.customRemarks || '',
    },
  };

  return { success: true, document: payload };
}

/**
 * Issues and persists an official student document into the database history.
 */
export function issueStudentDocument(
  params: {
    sessionToken?: string;
    studentId: number;
    documentType: DocumentType;
    academicSessionId: number;
    title: string;
    issueDate?: string;
    details?: {
      conduct?: string;
      reasonForLeaving?: string;
      duesCleared?: boolean;
      customContent?: string;
      remarks?: string;
    };
    remarks?: string;
  },
  db?: Database.Database
): { success: boolean; document?: StudentDocumentRecord; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);
  const sessionId = Number(params.academicSessionId);
  const documentType = params.documentType;
  const title = (params.title || '').trim();
  const issueDate = params.issueDate || new Date().toISOString().split('T')[0];
  const remarks = (params.remarks || '').trim();

  if (!studentId) {
    return { success: false, error: 'Student ID is required.' };
  }
  if (!sessionId) {
    return { success: false, error: 'Academic Session is required.' };
  }
  if (!title) {
    return { success: false, error: 'Document title cannot be empty.' };
  }

  // Validate student exists
  const student = database.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
  if (!student) {
    return { success: false, error: 'Student does not exist.' };
  }

  // Validate session exists
  const session = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return { success: false, error: 'Academic session does not exist.' };
  }

  const contentJson = JSON.stringify(params.details || {});

  try {
    const documentNumber = generateNextDocumentNumber(database);
    const userId = sessionCheck.user?.id || null;

    const stmt = database.prepare(`
      INSERT INTO student_documents (
        document_number, student_id, document_type, title,
        academic_session_id, issue_date, generated_by_user_id,
        content_json, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      documentNumber,
      studentId,
      documentType,
      title,
      sessionId,
      issueDate,
      userId,
      contentJson,
      remarks
    );

    const docId = Number(result.lastInsertRowid);
    const record = getDocumentById(docId, database);

    console.log(`[DocumentService] Issued document ${documentNumber} (${documentType}) for student ${studentId}`);

    return { success: true, document: record ?? undefined };
  } catch (err: unknown) {
    console.error('[DocumentService] Failed to issue student document:', err);
    return { success: false, error: 'Failed to record issued document.' };
  }
}

/**
 * Retrieves a single issued document by ID.
 */
export function getDocumentById(id: number, db?: Database.Database): StudentDocumentRecord | null {
  const database = db ?? getDatabase();

  const query = `
    SELECT d.*,
           s.student_id as student_system_id,
           s.admission_number,
           s.display_name as student_name,
           s.father_name,
           sess.name as academic_session_name,
           u.display_name as generated_by_user_name,
           c.name as class_name,
           sec.name as section_name
    FROM student_documents d
    JOIN students s ON s.id = d.student_id
    JOIN academic_sessions sess ON sess.id = d.academic_session_id
    LEFT JOIN users u ON u.id = d.generated_by_user_id
    LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.academic_session_id = d.academic_session_id
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
    WHERE d.id = ?
  `;

  const row = database.prepare(query).get(id) as {
    id: number;
    document_number: string;
    student_id: number;
    student_system_id: string;
    admission_number: string | null;
    student_name: string;
    father_name: string | null;
    document_type: DocumentType;
    title: string;
    academic_session_id: number;
    academic_session_name: string;
    issue_date: string;
    generated_by_user_id: number | null;
    generated_by_user_name: string | null;
    content_json: string;
    remarks: string;
    created_at: string;
    updated_at: string;
    class_name: string | null;
    section_name: string | null;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    documentNumber: row.document_number,
    studentId: row.student_id,
    studentSystemId: row.student_system_id,
    admissionNumber: row.admission_number || '',
    studentName: row.student_name,
    fatherName: row.father_name || '',
    className: row.class_name || '—',
    sectionName: row.section_name || '—',
    documentType: row.document_type,
    title: row.title,
    academicSessionId: row.academic_session_id,
    academicSessionName: row.academic_session_name,
    issueDate: row.issue_date,
    generatedByUserId: row.generated_by_user_id,
    generatedByUserName: row.generated_by_user_name || undefined,
    contentJson: row.content_json,
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Retrieves paginated document history with optional filters.
 */
export function getDocumentHistory(
  params: {
    studentId?: number;
    documentType?: string;
    academicSessionId?: number;
    searchQuery?: string;
    page?: number;
    limit?: number;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  documents: StudentDocumentRecord[];
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

  if (params.studentId) {
    whereClause += ' AND d.student_id = ?';
    queryParams.push(Number(params.studentId));
  }

  if (params.documentType && params.documentType !== 'all') {
    whereClause += ' AND d.document_type = ?';
    queryParams.push(params.documentType);
  }

  if (params.academicSessionId) {
    whereClause += ' AND d.academic_session_id = ?';
    queryParams.push(Number(params.academicSessionId));
  }

  if (params.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    whereClause += ` AND (
      d.document_number LIKE ? OR
      s.display_name LIKE ? OR
      s.student_id LIKE ? OR
      s.admission_number LIKE ? OR
      d.title LIKE ?
    )`;
    queryParams.push(q, q, q, q, q);
  }

  const baseJoin = `
    FROM student_documents d
    JOIN students s ON s.id = d.student_id
    JOIN academic_sessions sess ON sess.id = d.academic_session_id
    LEFT JOIN users u ON u.id = d.generated_by_user_id
    LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.academic_session_id = d.academic_session_id
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
  `;

  try {
    const countSql = `SELECT COUNT(*) as count ${baseJoin} ${whereClause}`;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const dataSql = `
      SELECT d.*,
             s.student_id as student_system_id,
             s.admission_number,
             s.display_name as student_name,
             s.father_name,
             sess.name as academic_session_name,
             u.display_name as generated_by_user_name,
             c.name as class_name,
             sec.name as section_name
      ${baseJoin}
      ${whereClause}
      ORDER BY d.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as Array<{
      id: number;
      document_number: string;
      student_id: number;
      student_system_id: string;
      admission_number: string | null;
      student_name: string;
      father_name: string | null;
      document_type: DocumentType;
      title: string;
      academic_session_id: number;
      academic_session_name: string;
      issue_date: string;
      generated_by_user_id: number | null;
      generated_by_user_name: string | null;
      content_json: string;
      remarks: string;
      created_at: string;
      updated_at: string;
      class_name: string | null;
      section_name: string | null;
    }>;

    const documents: StudentDocumentRecord[] = rows.map((r) => ({
      id: r.id,
      documentNumber: r.document_number,
      studentId: r.student_id,
      studentSystemId: r.student_system_id,
      admissionNumber: r.admission_number || '',
      studentName: r.student_name,
      fatherName: r.father_name || '',
      className: r.class_name || '—',
      sectionName: r.section_name || '—',
      documentType: r.document_type,
      title: r.title,
      academicSessionId: r.academic_session_id,
      academicSessionName: r.academic_session_name,
      issueDate: r.issue_date,
      generatedByUserId: r.generated_by_user_id,
      generatedByUserName: r.generated_by_user_name || undefined,
      contentJson: r.content_json,
      remarks: r.remarks,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return {
      success: true,
      documents,
      totalCount,
      page,
      totalPages,
    };
  } catch (err) {
    console.error('[DocumentService] Failed to query document history:', err);
    return {
      success: false,
      documents: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Failed to query document history.',
    };
  }
}
