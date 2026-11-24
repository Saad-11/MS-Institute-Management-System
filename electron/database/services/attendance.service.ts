/**
 * Attendance Service
 * 
 * Manages daily attendance, bulk saves/updates within database transactions,
 * date validation, attendance history queries, daily summaries, and student attendance statistics.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface EnrolledStudentForAttendance {
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  rollNumber?: string;
  status?: AttendanceStatus;
  remarks?: string;
  attendanceId?: number;
}

export interface AttendanceRecordItem {
  id: number;
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  studentName: string;
  academicSessionId: number;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceHistoryParams {
  academicSessionId?: number;
  classId?: number;
  sectionId?: number;
  studentId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  searchQuery?: string;
  sortBy?: 'date' | 'studentName' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DailyAttendanceSummary {
  academicSessionId: number;
  classId: number;
  sectionId: number;
  attendanceDate: string;
  isRecorded: boolean;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number | null;
}

export interface StudentAttendanceStats {
  studentId: number;
  totalDaysRecorded: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number | null; // (Present + Late) / totalDays * 100 rounded to 2 decimal places
}

/**
 * Calculates attendance percentage: (Present + Late) / Total Recorded * 100
 * Centralized calculation shared across all modules.
 */
export function calculateAttendancePercentage(
  present: number,
  late: number,
  totalRecorded: number
): number | null {
  if (totalRecorded <= 0) return null;
  const pct = ((present + late) / totalRecorded) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Validates that an attendance date string is in YYYY-MM-DD format and not in the future.
 */
export function validateAttendanceDate(dateStr: string): { isValid: boolean; error?: string } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { isValid: false, error: 'Attendance date is required.' };
  }

  const trimmed = dateStr.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid date format. Expected YYYY-MM-DD.' };
  }

  const dateObj = new Date(trimmed + 'T00:00:00Z');
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid calendar date.' };
  }

  // Future date rejection: today's date in local time
  const today = new Date().toISOString().split('T')[0];
  if (trimmed > today) {
    return { isValid: false, error: 'Attendance cannot be recorded for a future date.' };
  }

  return { isValid: true };
}

/**
 * Retrieves enrolled students for a class and section on a specific date.
 * If attendance was already recorded for that date, loads the saved statuses and remarks.
 */
export function getEnrolledStudentsForAttendance(
  params: {
    academicSessionId: number;
    classId: number;
    sectionId: number;
    attendanceDate: string;
  },
  db?: Database.Database
): {
  success: boolean;
  students: EnrolledStudentForAttendance[];
  isRecorded: boolean;
  error?: string;
} {
  const database = db ?? getDatabase();
  const { academicSessionId, classId, sectionId, attendanceDate } = params;

  if (!academicSessionId || !classId || !sectionId || !attendanceDate) {
    return {
      success: false,
      students: [],
      isRecorded: false,
      error: 'Session, Class, Section, and Date are all required.',
    };
  }

  const dateValidation = validateAttendanceDate(attendanceDate);
  if (!dateValidation.isValid) {
    return {
      success: false,
      students: [],
      isRecorded: false,
      error: dateValidation.error,
    };
  }

  try {
    // 1. Verify relationships: Session, Class, Section
    const session = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(academicSessionId);
    if (!session) {
      return { success: false, students: [], isRecorded: false, error: 'Academic session not found.' };
    }

    const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!cls) {
      return { success: false, students: [], isRecorded: false, error: 'Class not found.' };
    }

    const sec = database.prepare('SELECT id, class_id FROM sections WHERE id = ?').get(sectionId) as
      | { id: number; class_id: number }
      | undefined;
    if (!sec) {
      return { success: false, students: [], isRecorded: false, error: 'Section not found.' };
    }
    if (sec.class_id !== classId) {
      return { success: false, students: [], isRecorded: false, error: 'Selected section does not belong to the selected class.' };
    }

    // 2. Fetch all actively enrolled students in this session, class, and section
    const sql = `
      SELECT 
        s.id as studentId,
        e.id as enrollmentId,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as displayName,
        s.gender,
        att.id as attendanceId,
        att.status as attendanceStatus,
        att.remarks as attendanceRemarks
      FROM student_enrollments e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN attendance att ON att.student_id = s.id 
                              AND att.attendance_date = ?
                              AND att.academic_session_id = e.academic_session_id
      WHERE e.academic_session_id = ?
        AND e.class_id = ?
        AND e.section_id = ?
        AND e.status = 'Active'
        AND s.is_active = 1
      ORDER BY 
        s.display_name COLLATE NOCASE ASC
    `;

    const rows = database.prepare(sql).all(attendanceDate, academicSessionId, classId, sectionId) as Array<{
      studentId: number;
      enrollmentId: number;
      systemStudentId: string;
      admissionNumber: string | null;
      displayName: string;
      gender: string;
      attendanceId: number | null;
      attendanceStatus: AttendanceStatus | null;
      attendanceRemarks: string | null;
    }>;

    const hasAnyRecorded = rows.some((r) => r.attendanceId !== null);

    const students: EnrolledStudentForAttendance[] = rows.map((r) => ({
      studentId: r.studentId,
      enrollmentId: r.enrollmentId,
      systemStudentId: r.systemStudentId,
      admissionNumber: r.admissionNumber ?? '',
      displayName: r.displayName,
      gender: r.gender,
      attendanceId: r.attendanceId ?? undefined,
      status: r.attendanceStatus ?? undefined,
      remarks: r.attendanceRemarks ?? '',
    }));

    return {
      success: true,
      students,
      isRecorded: hasAnyRecorded,
    };
  } catch (err) {
    console.error('[AttendanceService] getEnrolledStudentsForAttendance error:', err);
    return {
      success: false,
      students: [],
      isRecorded: false,
      error: 'Failed to load enrolled students.',
    };
  }
}

/**
 * Saves or updates attendance records in bulk within an ACID SQLite transaction.
 * Performs deep verification of student, enrollment, session, class, section, and status integrity.
 */
export function saveAttendance(
  params: {
    sessionToken?: string;
    academicSessionId: number;
    classId: number;
    sectionId: number;
    attendanceDate: string;
    records: Array<{
      studentId: number;
      enrollmentId: number;
      status: AttendanceStatus;
      remarks?: string;
    }>;
  },
  db?: Database.Database
): {
  success: boolean;
  savedCount: number;
  error?: string;
} {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, savedCount: 0, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const { academicSessionId, classId, sectionId, attendanceDate, records } = params;

  if (!academicSessionId || !classId || !sectionId || !attendanceDate) {
    return { success: false, savedCount: 0, error: 'Session, Class, Section, and Date are all required.' };
  }

  const dateValidation = validateAttendanceDate(attendanceDate);
  if (!dateValidation.isValid) {
    return { success: false, savedCount: 0, error: dateValidation.error };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, savedCount: 0, error: 'No attendance records provided to save.' };
  }

  const validStatuses = new Set<AttendanceStatus>(['Present', 'Absent', 'Late', 'Leave']);

  try {
    // Verify session exists
    const session = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(academicSessionId);
    if (!session) {
      return { success: false, savedCount: 0, error: 'Academic session does not exist.' };
    }

    // Verify class exists
    const cls = database.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
    if (!cls) {
      return { success: false, savedCount: 0, error: 'Class does not exist.' };
    }

    // Verify section belongs to class
    const sec = database.prepare('SELECT id, class_id FROM sections WHERE id = ?').get(sectionId) as
      | { id: number; class_id: number }
      | undefined;
    if (!sec || sec.class_id !== classId) {
      return { success: false, savedCount: 0, error: 'Section does not exist or does not belong to the selected class.' };
    }

    // Prepared statements for enrollment relationship verification
    const verifyEnrollmentStmt = database.prepare(`
      SELECT e.id
      FROM student_enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.id = ?
        AND e.student_id = ?
        AND e.academic_session_id = ?
        AND e.class_id = ?
        AND e.section_id = ?
        AND e.status = 'Active'
        AND s.is_active = 1
    `);

    // Prepared upsert statement: SQLite INSERT ... ON CONFLICT(student_id, attendance_date) DO UPDATE
    const upsertStmt = database.prepare(`
      INSERT INTO attendance (
        student_id, enrollment_id, academic_session_id, class_id, section_id,
        attendance_date, status, remarks, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, datetime('now'), datetime('now')
      )
      ON CONFLICT(student_id, attendance_date) DO UPDATE SET
        enrollment_id = excluded.enrollment_id,
        academic_session_id = excluded.academic_session_id,
        class_id = excluded.class_id,
        section_id = excluded.section_id,
        status = excluded.status,
        remarks = excluded.remarks,
        updated_at = datetime('now')
    `);

    // Execute bulk operation inside a transaction
    const saveTx = database.transaction(() => {
      let count = 0;
      for (const rec of records) {
        if (!validStatuses.has(rec.status)) {
          throw new Error(`Invalid attendance status: "${rec.status}". Allowed values: Present, Absent, Late, Leave.`);
        }

        const cleanRemarks = (rec.remarks || '').trim();
        if (cleanRemarks.length > 255) {
          throw new Error(`Remarks for student ${rec.studentId} exceeds maximum length of 255 characters.`);
        }

        // Main process relationship check
        const validEnroll = verifyEnrollmentStmt.get(
          rec.enrollmentId,
          rec.studentId,
          academicSessionId,
          classId,
          sectionId
        );

        if (!validEnroll) {
          throw new Error(`Student ${rec.studentId} does not have an active enrollment matching this session, class, and section.`);
        }

        upsertStmt.run(
          rec.studentId,
          rec.enrollmentId,
          academicSessionId,
          classId,
          sectionId,
          attendanceDate,
          rec.status,
          cleanRemarks
        );

        count++;
      }
      return count;
    });

    const savedCount = saveTx();

    console.log(
      `[AttendanceService] Saved ${savedCount} attendance records for date ${attendanceDate} in Class ${classId}, Section ${sectionId}`
    );

    return {
      success: true,
      savedCount,
    };
  } catch (err: unknown) {
    console.error('[AttendanceService] saveAttendance error (rolled back):', err);
    const msg = err instanceof Error ? err.message : 'Database error while saving attendance.';
    return {
      success: false,
      savedCount: 0,
      error: msg,
    };
  }
}

/**
 * Computes a daily summary for a class and section on a specific date.
 */
export function getDailyAttendanceSummary(
  params: {
    academicSessionId: number;
    classId: number;
    sectionId: number;
    attendanceDate: string;
  },
  db?: Database.Database
): {
  success: boolean;
  summary?: DailyAttendanceSummary;
  error?: string;
} {
  const database = db ?? getDatabase();
  const { academicSessionId, classId, sectionId, attendanceDate } = params;

  if (!academicSessionId || !classId || !sectionId || !attendanceDate) {
    return { success: false, error: 'Session, Class, Section, and Date are all required.' };
  }

  try {
    // Total eligible enrolled students
    const totalRow = database.prepare(`
      SELECT COUNT(*) as count
      FROM student_enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.academic_session_id = ?
        AND e.class_id = ?
        AND e.section_id = ?
        AND e.status = 'Active'
        AND s.is_active = 1
    `).get(academicSessionId, classId, sectionId) as { count: number };

    const totalStudents = totalRow.count ?? 0;

    // Actual attendance records on this date
    const rows = database.prepare(`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE academic_session_id = ?
        AND class_id = ?
        AND section_id = ?
        AND attendance_date = ?
      GROUP BY status
    `).all(academicSessionId, classId, sectionId, attendanceDate) as Array<{ status: AttendanceStatus; count: number }>;

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;

    for (const r of rows) {
      if (r.status === 'Present') presentCount = r.count;
      else if (r.status === 'Absent') absentCount = r.count;
      else if (r.status === 'Late') lateCount = r.count;
      else if (r.status === 'Leave') leaveCount = r.count;
    }

    const recordedCount = presentCount + absentCount + lateCount + leaveCount;
    const isRecorded = recordedCount > 0;
    const attendancePercentage = isRecorded ? calculateAttendancePercentage(presentCount, lateCount, recordedCount) : null;

    return {
      success: true,
      summary: {
        academicSessionId,
        classId,
        sectionId,
        attendanceDate,
        isRecorded,
        totalStudents,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        attendancePercentage,
      },
    };
  } catch (err) {
    console.error('[AttendanceService] getDailyAttendanceSummary error:', err);
    return { success: false, error: 'Failed to retrieve attendance summary.' };
  }
}

/**
 * Retrieves paginated attendance history matching multiple filter criteria.
 */
export function getAttendanceHistory(
  params: AttendanceHistoryParams = {},
  db?: Database.Database
): {
  success: boolean;
  records: AttendanceRecordItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  const database = db ?? getDatabase();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 25));
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];

  if (params.academicSessionId) {
    whereClause += ' AND att.academic_session_id = ?';
    queryParams.push(params.academicSessionId);
  }

  if (params.classId) {
    whereClause += ' AND att.class_id = ?';
    queryParams.push(params.classId);
  }

  if (params.sectionId) {
    whereClause += ' AND att.section_id = ?';
    queryParams.push(params.sectionId);
  }

  if (params.studentId) {
    whereClause += ' AND att.student_id = ?';
    queryParams.push(params.studentId);
  }

  if (params.dateFrom) {
    whereClause += ' AND att.attendance_date >= ?';
    queryParams.push(params.dateFrom);
  }

  if (params.dateTo) {
    whereClause += ' AND att.attendance_date <= ?';
    queryParams.push(params.dateTo);
  }

  if (params.status) {
    whereClause += ' AND att.status = ?';
    queryParams.push(params.status);
  }

  if (params.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    whereClause += ` AND (
      s.student_id LIKE ? OR
      s.admission_number LIKE ? OR
      s.display_name LIKE ? OR
      att.remarks LIKE ?
    )`;
    queryParams.push(q, q, q, q);
  }

  // Sorting
  let orderBy = 'att.attendance_date DESC, s.display_name ASC';
  if (params.sortBy === 'date') {
    orderBy = `att.attendance_date ${params.sortOrder === 'asc' ? 'ASC' : 'DESC'}, s.display_name ASC`;
  } else if (params.sortBy === 'studentName') {
    orderBy = `s.display_name ${params.sortOrder === 'desc' ? 'DESC' : 'ASC'}, att.attendance_date DESC`;
  } else if (params.sortBy === 'status') {
    orderBy = `att.status ${params.sortOrder === 'desc' ? 'DESC' : 'ASC'}, att.attendance_date DESC`;
  }

  try {
    const countSql = `
      SELECT COUNT(*) as count
      FROM attendance att
      JOIN students s ON s.id = att.student_id
      ${whereClause}
    `;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const dataSql = `
      SELECT 
        att.id,
        att.student_id as studentId,
        att.enrollment_id as enrollmentId,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as studentName,
        att.academic_session_id as academicSessionId,
        sess.name as academicSessionName,
        att.class_id as classId,
        c.name as className,
        att.section_id as sectionId,
        sec.name as sectionName,
        att.attendance_date as attendanceDate,
        att.status,
        att.remarks,
        att.created_at as createdAt,
        att.updated_at as updatedAt
      FROM attendance att
      JOIN students s ON s.id = att.student_id
      JOIN academic_sessions sess ON sess.id = att.academic_session_id
      JOIN classes c ON c.id = att.class_id
      JOIN sections sec ON sec.id = att.section_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as Array<{
      id: number;
      studentId: number;
      enrollmentId: number;
      systemStudentId: string;
      admissionNumber: string | null;
      studentName: string;
      academicSessionId: number;
      academicSessionName: string;
      classId: number;
      className: string;
      sectionId: number;
      sectionName: string;
      attendanceDate: string;
      status: AttendanceStatus;
      remarks: string;
      createdAt: string;
      updatedAt: string;
    }>;

    const records: AttendanceRecordItem[] = rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      enrollmentId: r.enrollmentId,
      systemStudentId: r.systemStudentId,
      admissionNumber: r.admissionNumber ?? '',
      studentName: r.studentName,
      academicSessionId: r.academicSessionId,
      academicSessionName: r.academicSessionName,
      classId: r.classId,
      className: r.className,
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      attendanceDate: r.attendanceDate,
      status: r.status,
      remarks: r.remarks,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      success: true,
      records,
      totalCount,
      page,
      totalPages,
    };
  } catch (err) {
    console.error('[AttendanceService] getAttendanceHistory error:', err);
    return {
      success: false,
      records: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Failed to query attendance history.',
    };
  }
}

/**
 * Returns attendance history and statistics for an individual student.
 */
export function getStudentAttendanceHistory(
  params: {
    studentId: number;
    academicSessionId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
  db?: Database.Database
): {
  success: boolean;
  history: AttendanceRecordItem[];
  stats: StudentAttendanceStats;
  error?: string;
} {
  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);
  const limit = Math.max(1, Math.min(500, Number(params.limit) || 100));

  if (!studentId) {
    return {
      success: false,
      history: [],
      stats: {
        studentId: 0,
        totalDaysRecorded: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        leaveCount: 0,
        attendancePercentage: null,
      },
      error: 'Student ID is required.',
    };
  }

  try {
    let whereClause = 'WHERE att.student_id = ?';
    const queryParams: unknown[] = [studentId];

    if (params.academicSessionId) {
      whereClause += ' AND att.academic_session_id = ?';
      queryParams.push(params.academicSessionId);
    }
    if (params.dateFrom) {
      whereClause += ' AND att.attendance_date >= ?';
      queryParams.push(params.dateFrom);
    }
    if (params.dateTo) {
      whereClause += ' AND att.attendance_date <= ?';
      queryParams.push(params.dateTo);
    }

    // 1. Fetch statistics
    const statsSql = `
      SELECT status, COUNT(*) as count
      FROM attendance att
      ${whereClause}
      GROUP BY status
    `;
    const statRows = database.prepare(statsSql).all(...queryParams) as Array<{ status: AttendanceStatus; count: number }>;

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;

    for (const r of statRows) {
      if (r.status === 'Present') presentCount = r.count;
      else if (r.status === 'Absent') absentCount = r.count;
      else if (r.status === 'Late') lateCount = r.count;
      else if (r.status === 'Leave') leaveCount = r.count;
    }

    const totalDaysRecorded = presentCount + absentCount + lateCount + leaveCount;
    const attendancePercentage = calculateAttendancePercentage(presentCount, lateCount, totalDaysRecorded);

    // 2. Fetch recent records
    const historySql = `
      SELECT 
        att.id,
        att.student_id as studentId,
        att.enrollment_id as enrollmentId,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as studentName,
        att.academic_session_id as academicSessionId,
        sess.name as academicSessionName,
        att.class_id as classId,
        c.name as className,
        att.section_id as sectionId,
        sec.name as sectionName,
        att.attendance_date as attendanceDate,
        att.status,
        att.remarks,
        att.created_at as createdAt,
        att.updated_at as updatedAt
      FROM attendance att
      JOIN students s ON s.id = att.student_id
      JOIN academic_sessions sess ON sess.id = att.academic_session_id
      JOIN classes c ON c.id = att.class_id
      JOIN sections sec ON sec.id = att.section_id
      ${whereClause}
      ORDER BY att.attendance_date DESC
      LIMIT ?
    `;

    const rows = database.prepare(historySql).all(...queryParams, limit) as Array<{
      id: number;
      studentId: number;
      enrollmentId: number;
      systemStudentId: string;
      admissionNumber: string | null;
      studentName: string;
      academicSessionId: number;
      academicSessionName: string;
      classId: number;
      className: string;
      sectionId: number;
      sectionName: string;
      attendanceDate: string;
      status: AttendanceStatus;
      remarks: string;
      createdAt: string;
      updatedAt: string;
    }>;

    const history: AttendanceRecordItem[] = rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      enrollmentId: r.enrollmentId,
      systemStudentId: r.systemStudentId,
      admissionNumber: r.admissionNumber ?? '',
      studentName: r.studentName,
      academicSessionId: r.academicSessionId,
      academicSessionName: r.academicSessionName,
      classId: r.classId,
      className: r.className,
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      attendanceDate: r.attendanceDate,
      status: r.status,
      remarks: r.remarks,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      success: true,
      history,
      stats: {
        studentId,
        totalDaysRecorded,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        attendancePercentage,
      },
    };
  } catch (err) {
    console.error('[AttendanceService] getStudentAttendanceHistory error:', err);
    return {
      success: false,
      history: [],
      stats: {
        studentId,
        totalDaysRecorded: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        leaveCount: 0,
        attendancePercentage: null,
      },
      error: 'Failed to retrieve student attendance history.',
    };
  }
}
