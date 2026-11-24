/**
 * Institutional Reports Service
 * 
 * Aggregates analytical and printable administrative reports:
 * - Student Directory & Comprehensive Profile Reports
 * - Class Attendance Summaries
 * - Fee Collections & Outstanding Dues Reports
 * - Examination Marks & Class Result Sheets
 * - Class Strength Demographics
 * - Faculty & Teacher Directory
 * 
 * Reuses existing domain services as the single source of truth.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { getSchoolSettings, getSchoolLogoDataUrl, SchoolSettings } from './school.service';
import { calculateAttendancePercentage } from './attendance.service';
import { getClassExamResults, ClassExamResults } from './exam.service';
import { formatMoney } from './fee.service';

export interface ReportHeaderMetadata {
  school: SchoolSettings;
  schoolLogoDataUrl?: string | null;
  reportTitle: string;
  generatedAt: string;
  filtersApplied: Record<string, string>;
}

// ─── 1. Student Reports ─────────────────────────────────────────────────────────

export interface StudentListReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  gender: string;
  status: string;
  phone: string;
  admissionDate: string;
}

export function getStudentListReport(
  filters: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    status?: string;
    gender?: string;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: StudentListReportRow[];
  totalStudents: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let whereClause = 'WHERE (s.is_deleted = 0 OR s.is_deleted IS NULL)';
  const queryParams: unknown[] = [];
  const filtersApplied: Record<string, string> = {};

  if (filters.academicSessionId) {
    whereClause += ' AND e.academic_session_id = ?';
    queryParams.push(filters.academicSessionId);
    const s = database.prepare('SELECT name FROM academic_sessions WHERE id = ?').get(filters.academicSessionId) as { name: string } | undefined;
    if (s) filtersApplied['Academic Session'] = s.name;
  }

  if (filters.classId) {
    whereClause += ' AND e.class_id = ?';
    queryParams.push(filters.classId);
    const c = database.prepare('SELECT name FROM classes WHERE id = ?').get(filters.classId) as { name: string } | undefined;
    if (c) filtersApplied['Class'] = c.name;
  }

  if (filters.sectionId && filters.sectionId > 0) {
    whereClause += ' AND e.section_id = ?';
    queryParams.push(filters.sectionId);
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(filters.sectionId) as { name: string } | undefined;
    if (sec) filtersApplied['Section'] = sec.name;
  }

  if (filters.gender && filters.gender !== 'all') {
    whereClause += ' AND s.gender = ?';
    queryParams.push(filters.gender);
    filtersApplied['Gender'] = filters.gender;
  }

  if (filters.status && filters.status !== 'all') {
    whereClause += ' AND e.status = ?';
    queryParams.push(filters.status);
    filtersApplied['Status'] = filters.status;
  } else {
    whereClause += " AND e.status = 'Active'";
    filtersApplied['Status'] = 'Active Only';
  }

  try {
    const sql = `
      SELECT s.student_id,
             s.admission_number,
             s.display_name,
             s.father_name,
             c.name as class_name,
             sec.name as section_name,
             s.gender,
             e.status,
             s.phone,
             e.admission_date
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id
      JOIN classes c ON c.id = e.class_id
      JOIN sections sec ON sec.id = e.section_id
      ${whereClause}
      ORDER BY c.display_order ASC, c.name ASC, sec.name ASC, s.display_name ASC
    `;

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      student_id: string;
      admission_number: string | null;
      display_name: string;
      father_name: string | null;
      class_name: string;
      section_name: string;
      gender: string;
      status: string;
      phone: string | null;
      admission_date: string;
    }>;

    const records: StudentListReportRow[] = rows.map((r) => ({
      studentId: r.student_id,
      admissionNumber: r.admission_number || '—',
      displayName: r.display_name,
      fatherName: r.father_name || '—',
      className: r.class_name,
      sectionName: r.section_name,
      gender: r.gender,
      status: r.status,
      phone: r.phone || '—',
      admissionDate: r.admission_date || '—',
    }));

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Student Directory Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalStudents: records.length,
    };
  } catch (err) {
    console.error('[ReportService] Error generating student list report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Student Directory Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalStudents: 0,
      error: 'Failed to generate student list report.',
    };
  }
}

// ─── 2. Attendance Summary Report ──────────────────────────────────────────────

export interface AttendanceReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  className: string;
  sectionName: string;
  totalDays: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  attendancePercentage: number | null;
}

export function getAttendanceReport(
  filters: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    studentId?: number;
    startDate?: string;
    endDate?: string;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: AttendanceReportRow[];
  totalRecordedDays: number;
  classAveragePercentage: number | null;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];
  const filtersApplied: Record<string, string> = {};

  if (filters.academicSessionId) {
    whereClause += ' AND a.academic_session_id = ?';
    queryParams.push(filters.academicSessionId);
    const s = database.prepare('SELECT name FROM academic_sessions WHERE id = ?').get(filters.academicSessionId) as { name: string } | undefined;
    if (s) filtersApplied['Academic Session'] = s.name;
  }

  if (filters.classId) {
    whereClause += ' AND a.class_id = ?';
    queryParams.push(filters.classId);
    const c = database.prepare('SELECT name FROM classes WHERE id = ?').get(filters.classId) as { name: string } | undefined;
    if (c) filtersApplied['Class'] = c.name;
  }

  if (filters.sectionId && filters.sectionId > 0) {
    whereClause += ' AND a.section_id = ?';
    queryParams.push(filters.sectionId);
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(filters.sectionId) as { name: string } | undefined;
    if (sec) filtersApplied['Section'] = sec.name;
  }

  if (filters.studentId) {
    whereClause += ' AND a.student_id = ?';
    queryParams.push(filters.studentId);
  }

  if (filters.startDate) {
    whereClause += ' AND a.attendance_date >= ?';
    queryParams.push(filters.startDate);
    filtersApplied['From Date'] = filters.startDate;
  }

  if (filters.endDate) {
    whereClause += ' AND a.attendance_date <= ?';
    queryParams.push(filters.endDate);
    filtersApplied['To Date'] = filters.endDate;
  }

  try {
    const sql = `
      SELECT s.student_id,
             s.admission_number,
             s.display_name,
             c.name as class_name,
             sec.name as section_name,
             COUNT(a.id) as total_days,
             SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
             SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
             SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
             SUM(CASE WHEN a.status = 'Leave' THEN 1 ELSE 0 END) as leave_count
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = a.class_id
      JOIN sections sec ON sec.id = a.section_id
      ${whereClause}
      GROUP BY a.student_id, s.student_id, s.admission_number, s.display_name, c.name, sec.name
      ORDER BY c.name ASC, sec.name ASC, s.display_name ASC
    `;

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      student_id: string;
      admission_number: string | null;
      display_name: string;
      class_name: string;
      section_name: string;
      total_days: number;
      present_count: number;
      late_count: number;
      absent_count: number;
      leave_count: number;
    }>;

    let sumPct = 0;
    let pctCount = 0;
    let maxRecordedDays = 0;

    const records: AttendanceReportRow[] = rows.map((r) => {
      const pct = calculateAttendancePercentage(r.present_count, r.late_count, r.total_days);
      if (pct !== null) {
        sumPct += pct;
        pctCount++;
      }
      if (r.total_days > maxRecordedDays) {
        maxRecordedDays = r.total_days;
      }

      return {
        studentId: r.student_id,
        admissionNumber: r.admission_number || '—',
        displayName: r.display_name,
        className: r.class_name,
        sectionName: r.section_name,
        totalDays: r.total_days,
        presentCount: r.present_count,
        lateCount: r.late_count,
        absentCount: r.absent_count,
        leaveCount: r.leave_count,
        attendancePercentage: pct,
      };
    });

    const classAveragePercentage = pctCount > 0 ? Math.round((sumPct / pctCount) * 100) / 100 : null;

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Attendance Summary Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalRecordedDays: maxRecordedDays,
      classAveragePercentage,
    };
  } catch (err) {
    console.error('[ReportService] Error generating attendance report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Attendance Summary Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalRecordedDays: 0,
      classAveragePercentage: null,
      error: 'Failed to generate attendance report.',
    };
  }
}

// ─── 3. Fee Reports ────────────────────────────────────────────────────────────

export interface FeeCollectionReportRow {
  receiptNumber: string;
  paymentDate: string;
  studentId: string;
  admissionNumber: string;
  displayName: string;
  className: string;
  feePeriodName: string;
  feeTypeName: string;
  amountMinor: number;
  amountFormatted: string;
  paymentMode: string;
  receivedBy: string;
}

export function getFeeCollectionReport(
  filters: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    feeTypeId?: number;
    startDate?: string;
    endDate?: string;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: FeeCollectionReportRow[];
  totalCollectedMinor: number;
  totalCollectedFormatted: string;
  totalTransactions: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];
  const filtersApplied: Record<string, string> = {};

  if (filters.academicSessionId) {
    whereClause += ' AND fp.academic_session_id = ?';
    queryParams.push(filters.academicSessionId);
    const s = database.prepare('SELECT name FROM academic_sessions WHERE id = ?').get(filters.academicSessionId) as { name: string } | undefined;
    if (s) filtersApplied['Academic Session'] = s.name;
  }

  if (filters.classId) {
    whereClause += ' AND fr.class_id = ?';
    queryParams.push(filters.classId);
    const c = database.prepare('SELECT name FROM classes WHERE id = ?').get(filters.classId) as { name: string } | undefined;
    if (c) filtersApplied['Class'] = c.name;
  }

  if (filters.sectionId && filters.sectionId > 0) {
    whereClause += ' AND fr.section_id = ?';
    queryParams.push(filters.sectionId);
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(filters.sectionId) as { name: string } | undefined;
    if (sec) filtersApplied['Section'] = sec.name;
  }

  if (filters.feeTypeId && filters.feeTypeId > 0) {
    whereClause += ' AND fr.fee_type_id = ?';
    queryParams.push(filters.feeTypeId);
    const ft = database.prepare('SELECT name FROM fee_types WHERE id = ?').get(filters.feeTypeId) as { name: string } | undefined;
    if (ft) filtersApplied['Fee Type'] = ft.name;
  }

  if (filters.startDate) {
    whereClause += ' AND p.payment_date >= ?';
    queryParams.push(filters.startDate);
    filtersApplied['From Date'] = filters.startDate;
  }

  if (filters.endDate) {
    whereClause += ' AND p.payment_date <= ?';
    queryParams.push(filters.endDate);
    filtersApplied['To Date'] = filters.endDate;
  }

  try {
    const sql = `
      SELECT p.receipt_number,
             p.payment_date,
             p.amount as paid_amount,
             p.payment_method as payment_mode,
             s.student_id,
             s.admission_number,
             s.display_name,
             c.name as class_name,
             fp.name as period_name,
             ft.name as fee_type_name,
             u.display_name as receiver_name
      FROM fee_payments p
      JOIN fee_records fr ON fr.id = p.fee_record_id
      JOIN students s ON s.id = fr.student_id
      JOIN classes c ON c.id = fr.class_id
      JOIN fee_periods fp ON fp.id = fr.fee_period_id
      JOIN fee_types ft ON ft.id = fr.fee_type_id
      LEFT JOIN users u ON u.id = p.received_by_user_id
      ${whereClause}
      ORDER BY p.id DESC
    `;

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      receipt_number: string;
      payment_date: string;
      paid_amount: number;
      payment_mode: string;
      student_id: string;
      admission_number: string | null;
      display_name: string;
      class_name: string;
      period_name: string;
      fee_type_name: string;
      receiver_name: string | null;
    }>;

    let totalCollectedMinor = 0;
    const records: FeeCollectionReportRow[] = rows.map((r) => {
      totalCollectedMinor += r.paid_amount;
      return {
        receiptNumber: r.receipt_number,
        paymentDate: r.payment_date,
        studentId: r.student_id,
        admissionNumber: r.admission_number || '—',
        displayName: r.display_name,
        className: r.class_name,
        feePeriodName: r.period_name,
        feeTypeName: r.fee_type_name,
        amountMinor: r.paid_amount,
        amountFormatted: formatMoney(r.paid_amount),
        paymentMode: r.payment_mode,
        receivedBy: r.receiver_name || 'Admin',
      };
    });

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Fee Collection Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalCollectedMinor,
      totalCollectedFormatted: formatMoney(totalCollectedMinor),
      totalTransactions: records.length,
    };
  } catch (err) {
    console.error('[ReportService] Error generating fee collection report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Fee Collection Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalCollectedMinor: 0,
      totalCollectedFormatted: 'Rs. 0.00',
      totalTransactions: 0,
      error: 'Failed to generate fee collection report.',
    };
  }
}

export interface FeeOutstandingReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  feePeriodName: string;
  feeTypeName: string;
  dueDate: string;
  netAmountFormatted: string;
  paidAmountFormatted: string;
  remainingBalanceMinor: number;
  remainingBalanceFormatted: string;
  status: string;
}

export function getFeeOutstandingReport(
  filters: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    feePeriodId?: number;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: FeeOutstandingReportRow[];
  totalOutstandingMinor: number;
  totalOutstandingFormatted: string;
  totalDefaulters: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let whereClause = "WHERE fr.remaining_balance > 0 AND fr.status != 'Waived' AND fr.status != 'Cancelled'";
  const queryParams: unknown[] = [];
  const filtersApplied: Record<string, string> = {};

  if (filters.academicSessionId) {
    whereClause += ' AND fp.academic_session_id = ?';
    queryParams.push(filters.academicSessionId);
    const s = database.prepare('SELECT name FROM academic_sessions WHERE id = ?').get(filters.academicSessionId) as { name: string } | undefined;
    if (s) filtersApplied['Academic Session'] = s.name;
  }

  if (filters.classId) {
    whereClause += ' AND fr.class_id = ?';
    queryParams.push(filters.classId);
    const c = database.prepare('SELECT name FROM classes WHERE id = ?').get(filters.classId) as { name: string } | undefined;
    if (c) filtersApplied['Class'] = c.name;
  }

  if (filters.sectionId && filters.sectionId > 0) {
    whereClause += ' AND fr.section_id = ?';
    queryParams.push(filters.sectionId);
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(filters.sectionId) as { name: string } | undefined;
    if (sec) filtersApplied['Section'] = sec.name;
  }

  if (filters.feePeriodId && filters.feePeriodId > 0) {
    whereClause += ' AND fr.fee_period_id = ?';
    queryParams.push(filters.feePeriodId);
    const p = database.prepare('SELECT name FROM fee_periods WHERE id = ?').get(filters.feePeriodId) as { name: string } | undefined;
    if (p) filtersApplied['Fee Period'] = p.name;
  }

  try {
    const sql = `
      SELECT fr.remaining_balance,
             fr.net_amount,
             fr.paid_amount,
             fr.status,
             fr.due_date,
             s.student_id,
             s.admission_number,
             s.display_name,
             s.father_name,
             c.name as class_name,
             sec.name as section_name,
             fp.name as period_name,
             ft.name as fee_type_name
      FROM fee_records fr
      JOIN students s ON s.id = fr.student_id
      JOIN classes c ON c.id = fr.class_id
      JOIN sections sec ON sec.id = fr.section_id
      JOIN fee_periods fp ON fp.id = fr.fee_period_id
      JOIN fee_types ft ON ft.id = fr.fee_type_id
      ${whereClause}
      ORDER BY c.name ASC, sec.name ASC, fr.remaining_balance DESC
    `;

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      remaining_balance: number;
      net_amount: number;
      paid_amount: number;
      status: string;
      due_date: string;
      student_id: string;
      admission_number: string | null;
      display_name: string;
      father_name: string | null;
      class_name: string;
      section_name: string;
      period_name: string;
      fee_type_name: string;
    }>;

    let totalOutstandingMinor = 0;
    const studentSet = new Set<string>();

    const records: FeeOutstandingReportRow[] = rows.map((r) => {
      totalOutstandingMinor += r.remaining_balance;
      studentSet.add(r.student_id);

      return {
        studentId: r.student_id,
        admissionNumber: r.admission_number || '—',
        displayName: r.display_name,
        fatherName: r.father_name || '—',
        className: r.class_name,
        sectionName: r.section_name,
        feePeriodName: r.period_name,
        feeTypeName: r.fee_type_name,
        dueDate: r.due_date,
        netAmountFormatted: formatMoney(r.net_amount),
        paidAmountFormatted: formatMoney(r.paid_amount),
        remainingBalanceMinor: r.remaining_balance,
        remainingBalanceFormatted: formatMoney(r.remaining_balance),
        status: r.status,
      };
    });

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Fee Outstanding & Dues Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalOutstandingMinor,
      totalOutstandingFormatted: formatMoney(totalOutstandingMinor),
      totalDefaulters: studentSet.size,
    };
  } catch (err) {
    console.error('[ReportService] Error generating fee outstanding report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Fee Outstanding & Dues Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalOutstandingMinor: 0,
      totalOutstandingFormatted: 'Rs. 0.00',
      totalDefaulters: 0,
      error: 'Failed to generate fee outstanding report.',
    };
  }
}

// ─── 4. Examination & Result Reports ───────────────────────────────────────────

export interface ExamMarksReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  rollNumber: string;
  subjectName: string;
  maxMarks: number;
  passingMarks: number;
  obtainedMarks: number | null;
  status: string;
  grade: string;
  isPass: boolean;
  remarks: string;
}

export function getExamMarksReport(
  filters: {
    examinationId: number;
    classId: number;
    sectionId?: number;
    subjectId?: number;
  },
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: ExamMarksReportRow[];
  totalEntered: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  const { examinationId, classId, sectionId, subjectId } = filters;
  const filtersApplied: Record<string, string> = {};

  const exam = database.prepare('SELECT name, academic_session_id FROM examinations WHERE id = ?').get(examinationId) as { name: string; academic_session_id: number } | undefined;
  if (exam) filtersApplied['Examination'] = exam.name;

  const cls = database.prepare('SELECT name FROM classes WHERE id = ?').get(classId) as { name: string } | undefined;
  if (cls) filtersApplied['Class'] = cls.name;

  let whereClause = 'WHERE em.examination_id = ? AND es.class_id = ?';
  const queryParams: unknown[] = [examinationId, classId];

  if (sectionId && sectionId > 0) {
    whereClause += ' AND e.section_id = ?';
    queryParams.push(sectionId);
    const sec = database.prepare('SELECT name FROM sections WHERE id = ?').get(sectionId) as { name: string } | undefined;
    if (sec) filtersApplied['Section'] = sec.name;
  }

  if (subjectId && subjectId > 0) {
    whereClause += ' AND es.subject_id = ?';
    queryParams.push(subjectId);
    const sub = database.prepare('SELECT name FROM subjects WHERE id = ?').get(subjectId) as { name: string } | undefined;
    if (sub) filtersApplied['Subject'] = sub.name;
  }

  try {
    const sql = `
      SELECT s.student_id,
             s.admission_number,
             s.display_name,
             e.roll_number,
             sub.name as subject_name,
             es.max_marks,
             es.passing_marks,
             em.obtained_marks,
             em.status,
             em.remarks
      FROM exam_marks em
      JOIN examination_subjects es ON es.id = em.examination_subject_id
      JOIN subjects sub ON sub.id = es.subject_id
      JOIN students s ON s.id = em.student_id
      JOIN student_enrollments e ON e.student_id = s.id AND e.academic_session_id = ?
      ${whereClause}
      ORDER BY e.roll_number ASC, s.display_name ASC
    `;

    const rows = database.prepare(sql).all(exam?.academic_session_id || 0, ...queryParams) as Array<{
      student_id: string;
      admission_number: string | null;
      display_name: string;
      roll_number: string | null;
      subject_name: string;
      max_marks: number;
      passing_marks: number;
      obtained_marks: number | null;
      status: string;
      remarks: string;
    }>;

    let passCount = 0;
    let failCount = 0;

    const records: ExamMarksReportRow[] = rows.map((r) => {
      const isAbsent = r.status === 'Absent';
      const obt = isAbsent ? 0 : (r.obtained_marks || 0);
      const isPass = !isAbsent && obt >= r.passing_marks;

      if (isPass) passCount++;
      else failCount++;

      const pct = r.max_marks > 0 ? (obt / r.max_marks) * 100 : 0;
      const rule = database.prepare(`
        SELECT grade FROM grading_rules
        WHERE ? >= min_percentage AND (? < max_percentage OR (? = 100 AND max_percentage = 100))
        ORDER BY min_percentage DESC LIMIT 1
      `).get(pct, pct, pct) as { grade: string } | undefined;

      return {
        studentId: r.student_id,
        admissionNumber: r.admission_number || '—',
        displayName: r.display_name,
        rollNumber: r.roll_number || '—',
        subjectName: r.subject_name,
        maxMarks: r.max_marks,
        passingMarks: r.passing_marks,
        obtainedMarks: isAbsent ? null : r.obtained_marks,
        status: r.status,
        grade: isAbsent ? 'F' : (rule?.grade || (isPass ? 'P' : 'F')),
        isPass,
        remarks: r.remarks || (isAbsent ? 'Absent' : ''),
      };
    });

    const total = records.length;
    const passPercentage = total > 0 ? Math.round((passCount / total) * 10000) / 100 : 0;

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Examination Marks Sheet',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalEntered: total,
      passCount,
      failCount,
      passPercentage,
    };
  } catch (err) {
    console.error('[ReportService] Error generating exam marks report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Examination Marks Sheet',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalEntered: 0,
      passCount: 0,
      failCount: 0,
      passPercentage: 0,
      error: 'Failed to generate marks report.',
    };
  }
}

export function getClassResultsReport(
  params: { examinationId: number; classId: number; sectionId?: number },
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  results?: ClassExamResults;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  const res = getClassExamResults(params, database);
  if (!res.success || !res.results) {
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Class Result & Merit List',
        generatedAt: new Date().toLocaleString(),
        filtersApplied: {},
      },
      error: res.error || 'Failed to retrieve class results.',
    };
  }

  const filtersApplied: Record<string, string> = {
    Examination: res.results.examinationName,
    Session: res.results.academicSessionName,
    Class: res.results.className,
  };
  if (res.results.sectionName) {
    filtersApplied['Section'] = res.results.sectionName;
  }

  return {
    success: true,
    metadata: {
      school,
      schoolLogoDataUrl,
      reportTitle: 'Class Result & Merit List',
      generatedAt: new Date().toLocaleString(),
      filtersApplied,
    },
    results: res.results,
  };
}

// ─── 5. Class Demographics / Strength Report ───────────────────────────────────

export interface ClassStrengthRow {
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  maleCount: number;
  femaleCount: number;
  otherCount: number;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
}

export function getClassStrengthReport(
  academicSessionId?: number,
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: ClassStrengthRow[];
  grandTotal: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let sessionId = academicSessionId;
  if (!sessionId) {
    const active = database.prepare('SELECT id FROM academic_sessions WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined;
    sessionId = active?.id || 1;
  }

  const sessionRow = database.prepare('SELECT name FROM academic_sessions WHERE id = ?').get(sessionId) as { name: string } | undefined;
  const filtersApplied: Record<string, string> = {
    'Academic Session': sessionRow?.name || 'Active Session',
  };

  try {
    const sql = `
      SELECT c.id as class_id,
             c.name as class_name,
             sec.id as section_id,
             sec.name as section_name,
             SUM(CASE WHEN s.gender = 'Male' THEN 1 ELSE 0 END) as male_count,
             SUM(CASE WHEN s.gender = 'Female' THEN 1 ELSE 0 END) as female_count,
             SUM(CASE WHEN s.gender = 'Other' THEN 1 ELSE 0 END) as other_count,
             SUM(CASE WHEN e.status = 'Active' THEN 1 ELSE 0 END) as active_count,
             SUM(CASE WHEN e.status != 'Active' THEN 1 ELSE 0 END) as inactive_count,
             COUNT(e.id) as total_count
      FROM classes c
      JOIN sections sec ON sec.class_id = c.id
      LEFT JOIN student_enrollments e ON e.class_id = c.id AND e.section_id = sec.id AND e.academic_session_id = ?
      LEFT JOIN students s ON s.id = e.student_id
      GROUP BY c.id, c.name, sec.id, sec.name, c.display_order
      ORDER BY c.display_order ASC, c.name ASC, sec.name ASC
    `;

    const rows = database.prepare(sql).all(sessionId) as Array<{
      class_id: number;
      class_name: string;
      section_id: number;
      section_name: string;
      male_count: number;
      female_count: number;
      other_count: number;
      active_count: number;
      inactive_count: number;
      total_count: number;
    }>;

    let grandTotal = 0;
    const records: ClassStrengthRow[] = rows.map((r) => {
      grandTotal += r.total_count;
      return {
        classId: r.class_id,
        className: r.class_name,
        sectionId: r.section_id,
        sectionName: r.section_name,
        maleCount: r.male_count,
        femaleCount: r.female_count,
        otherCount: r.other_count,
        activeCount: r.active_count,
        inactiveCount: r.inactive_count,
        totalCount: r.total_count,
      };
    });

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Class Strength & Enrollment Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      grandTotal,
    };
  } catch (err) {
    console.error('[ReportService] Error generating class strength report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Class Strength & Enrollment Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      grandTotal: 0,
      error: 'Failed to generate class strength report.',
    };
  }
}

// ─── 6. Teacher Directory Report ───────────────────────────────────────────────

export interface TeacherReportRow {
  teacherId: string;
  employeeId: string;
  displayName: string;
  gender: string;
  designation: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  phone: string;
  email: string;
  employmentStatus: string;
}

export function getTeacherReport(
  filters: {
    designation?: string;
    employmentStatus?: string;
    isActive?: boolean;
  } = {},
  db?: Database.Database
): {
  success: boolean;
  metadata: ReportHeaderMetadata;
  records: TeacherReportRow[];
  totalTeachers: number;
  error?: string;
} {
  const database = db ?? getDatabase();
  const school = getSchoolSettings(database);
  const schoolLogoDataUrl = getSchoolLogoDataUrl(database);

  let whereClause = 'WHERE 1=1';
  const queryParams: unknown[] = [];
  const filtersApplied: Record<string, string> = {};

  if (filters.designation && filters.designation.trim()) {
    whereClause += ' AND designation = ?';
    queryParams.push(filters.designation.trim());
    filtersApplied['Designation'] = filters.designation;
  }

  if (filters.employmentStatus && filters.employmentStatus !== 'all') {
    whereClause += ' AND employment_status = ?';
    queryParams.push(filters.employmentStatus);
    filtersApplied['Status'] = filters.employmentStatus;
  }

  if (filters.isActive !== undefined) {
    whereClause += ' AND is_active = ?';
    queryParams.push(filters.isActive ? 1 : 0);
  }

  try {
    const sql = `
      SELECT teacher_id,
             employee_id,
             display_name,
             gender,
             designation,
             qualification,
             specialization,
             joining_date,
             phone,
             email,
             employment_status
      FROM teachers
      ${whereClause}
      ORDER BY display_name ASC
    `;

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      teacher_id: string;
      employee_id: string | null;
      display_name: string;
      gender: string;
      designation: string | null;
      qualification: string | null;
      specialization: string | null;
      joining_date: string | null;
      phone: string | null;
      email: string | null;
      employment_status: string;
    }>;

    const records: TeacherReportRow[] = rows.map((r) => ({
      teacherId: r.teacher_id,
      employeeId: r.employee_id || '—',
      displayName: r.display_name,
      gender: r.gender,
      designation: r.designation || 'Teacher',
      qualification: r.qualification || '—',
      specialization: r.specialization || '—',
      joiningDate: r.joining_date || '—',
      phone: r.phone || '—',
      email: r.email || '—',
      employmentStatus: r.employment_status,
    }));

    return {
      success: true,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Faculty & Teacher Directory Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records,
      totalTeachers: records.length,
    };
  } catch (err) {
    console.error('[ReportService] Error generating teacher report:', err);
    return {
      success: false,
      metadata: {
        school,
        schoolLogoDataUrl,
        reportTitle: 'Faculty & Teacher Directory Report',
        generatedAt: new Date().toLocaleString(),
        filtersApplied,
      },
      records: [],
      totalTeachers: 0,
      error: 'Failed to generate teacher report.',
    };
  }
}
