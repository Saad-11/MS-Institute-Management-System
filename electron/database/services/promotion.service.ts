/**
 * Student Promotion & Academic History Service
 * 
 * Manages session-to-session student progression:
 * - Eligibility calculation (with attendance summary and examination results)
 * - Atomic bulk promotions within SQLite transactions
 * - Duplicate enrollment protection
 * - Permanent Student ID preservation
 * - Immutable historical academic record retention
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';
import { calculateAttendancePercentage } from './attendance.service';
import { ensureClassSection } from './student.service';

export type PromotionAction = 'Promote' | 'Retain' | 'Graduate' | 'Transfer' | 'Left';

export interface PromotionCandidate {
  studentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  gender: string;
  currentEnrollmentId: number;
  currentClassId: number;
  currentClassName: string;
  currentSectionId: number;
  currentSectionName: string;
  currentRollNumber: string;
  // Performance metrics for informed decision-making
  attendanceTotalDays: number;
  attendancePresentDays: number;
  attendancePercentage: number | null;
  examPercentage: number | null;
  examGrade: string | null;
  examResultStatus: 'Pass' | 'Fail' | 'N/A';
  // Destination validation status
  alreadyEnrolledInDestination: boolean;
  recommendedAction: PromotionAction;
}

export interface StudentAcademicHistoryEntry {
  enrollmentId: number;
  academicSessionId: number;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  rollNumber: string;
  admissionDate: string;
  status: string; // 'Active', 'Inactive', 'Transferred', 'Graduated', 'Left'
  promotionStatus: string; // 'None', 'Promoted', 'Retained', 'Graduated', 'Transferred', 'Left'
  promotionDate: string | null;
  remarks: string;
  attendancePercentage: number | null;
  examGrade: string | null;
  examPercentage: number | null;
}

export interface PromotionLogItem {
  id: number;
  studentId: number;
  studentSystemId: string;
  studentName: string;
  fromSessionName: string;
  toSessionName?: string;
  fromClassName: string;
  toClassName?: string;
  fromSectionName: string;
  toSectionName?: string;
  action: PromotionAction;
  promotionDate: string;
  performedByUserName?: string;
  remarks: string;
  createdAt: string;
}

/**
 * Retrieves the list of enrolled students in a given session, class, and section,
 * augmented with attendance stats, exam performance, and destination enrollment status.
 */
export function getPromotionCandidates(
  params: {
    fromSessionId: number;
    fromClassId: number;
    fromSectionId?: number;
    toSessionId?: number;
  },
  db?: Database.Database
): { success: boolean; candidates: PromotionCandidate[]; error?: string } {
  const database = db ?? getDatabase();
  const fromSessionId = Number(params.fromSessionId);
  const fromClassId = Number(params.fromClassId);
  const fromSectionId = params.fromSectionId ? Number(params.fromSectionId) : undefined;
  const toSessionId = params.toSessionId ? Number(params.toSessionId) : undefined;

  if (!fromSessionId || !fromClassId) {
    return { success: false, candidates: [], error: 'Source session and class are required.' };
  }

  try {
    let sql = `
      SELECT e.id as enrollment_id,
             e.student_id,
             s.student_id as system_student_id,
             s.admission_number,
             s.display_name,
             s.father_name,
             s.gender,
             e.class_id,
             COALESCE(c.name, 'Class ' || e.class_id) as class_name,
             e.section_id,
             COALESCE(sec.name, 'All Sections') as section_name,
             COALESCE(e.roll_number, '') as roll_number
      FROM student_enrollments e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN classes c ON c.id = e.class_id
      LEFT JOIN sections sec ON sec.id = e.section_id
      WHERE e.academic_session_id = ? AND e.class_id = ? 
        AND (e.status = 'Active' OR LOWER(e.status) = 'active') 
        AND (s.is_active = 1 OR s.is_active = '1')
    `;
    const queryParams: unknown[] = [fromSessionId, fromClassId];

    if (fromSectionId && fromSectionId > 0) {
      sql += ' AND e.section_id = ?';
      queryParams.push(fromSectionId);
    }

    sql += ' ORDER BY CAST(e.roll_number AS INTEGER) ASC, e.roll_number ASC, s.display_name ASC';

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      enrollment_id: number;
      student_id: number;
      system_student_id: string;
      admission_number: string | null;
      display_name: string;
      father_name: string | null;
      gender: string;
      class_id: number;
      class_name: string;
      section_id: number;
      section_name: string;
      roll_number: string | null;
    }>;

    // Resolve attendance stats and exam result for each student
    const candidates: PromotionCandidate[] = rows.map((r) => {
      // 1. Attendance Summary for fromSessionId
      const attStats = database.prepare(`
        SELECT 
          COUNT(*) as total_recorded,
          SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_count,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count
        FROM attendance
        WHERE student_id = ? AND academic_session_id = ?
      `).get(r.student_id, fromSessionId) as {
        total_recorded: number;
        attended_count: number;
        present_count: number;
        late_count: number;
      } | undefined;

      const totalDays = attStats?.total_recorded || 0;
      const presentDays = attStats?.present_count || 0;
      const lateDays = attStats?.late_count || 0;
      const attendancePercentage = calculateAttendancePercentage(presentDays, lateDays, totalDays);

      // 2. Exam Results for fromSessionId
      // Find latest closed or open exam for this session and class
      const examRow = database.prepare(`
        SELECT ex.id
        FROM examinations ex
        JOIN examination_subjects es ON es.examination_id = ex.id AND es.class_id = ?
        WHERE ex.academic_session_id = ?
        ORDER BY ex.id DESC LIMIT 1
      `).get(r.class_id, fromSessionId) as { id: number } | undefined;

      let examPercentage: number | null = null;
      let examGrade: string | null = null;
      let examResultStatus: 'Pass' | 'Fail' | 'N/A' = 'N/A';

      if (examRow) {
        // Calculate aggregate marks for student in this exam
        const marksRows = database.prepare(`
          SELECT em.obtained_marks, em.status, es.max_marks, es.passing_marks
          FROM exam_marks em
          JOIN examination_subjects es ON es.id = em.examination_subject_id
          WHERE em.examination_id = ? AND em.student_id = ?
        `).all(examRow.id, r.student_id) as Array<{
          obtained_marks: number | null;
          status: string;
          max_marks: number;
          passing_marks: number;
        }>;

        if (marksRows.length > 0) {
          let totalMax = 0;
          let totalObtained = 0;
          let allPassed = true;

          for (const m of marksRows) {
            totalMax += m.max_marks;
            const obt = m.status === 'Absent' ? 0 : (m.obtained_marks || 0);
            totalObtained += obt;
            if (m.status === 'Absent' || obt < m.passing_marks) {
              allPassed = false;
            }
          }

          if (totalMax > 0) {
            examPercentage = Math.round((totalObtained / totalMax) * 10000) / 100;
            examResultStatus = allPassed ? 'Pass' : 'Fail';

            // Lookup grade
            const rule = database.prepare(`
              SELECT grade FROM grading_rules
              WHERE ? >= min_percentage AND (? < max_percentage OR (? = 100 AND max_percentage = 100))
              ORDER BY min_percentage DESC LIMIT 1
            `).get(examPercentage, examPercentage, examPercentage) as { grade: string } | undefined;
            examGrade = rule?.grade || (allPassed ? 'Pass' : 'F');
          }
        }
      }

      // 3. Destination enrollment check
      let alreadyEnrolledInDestination = false;
      if (toSessionId && toSessionId > 0) {
        if (toSessionId === fromSessionId) {
          const destEnrollment = database.prepare(`
            SELECT id FROM student_enrollments
            WHERE student_id = ? AND academic_session_id = ? AND id != ? AND (status = 'Active' OR LOWER(status) = 'active')
          `).get(r.student_id, toSessionId, r.enrollment_id);
          alreadyEnrolledInDestination = !!destEnrollment;
        } else {
          const destEnrollment = database.prepare(`
            SELECT id FROM student_enrollments
            WHERE student_id = ? AND academic_session_id = ? AND (status = 'Active' OR LOWER(status) = 'active')
          `).get(r.student_id, toSessionId);
          alreadyEnrolledInDestination = !!destEnrollment;
        }
      }

      // 4. Recommendation
      let recommendedAction: PromotionAction = 'Promote';
      if (examResultStatus === 'Fail') {
        recommendedAction = 'Retain';
      }

      return {
        studentId: r.student_id,
        systemStudentId: r.system_student_id,
        admissionNumber: r.admission_number || '',
        displayName: r.display_name,
        fatherName: r.father_name || '—',
        gender: r.gender,
        currentEnrollmentId: r.enrollment_id,
        currentClassId: r.class_id,
        currentClassName: r.class_name,
        currentSectionId: r.section_id,
        currentSectionName: r.section_name,
        currentRollNumber: r.roll_number || '',
        attendanceTotalDays: totalDays,
        attendancePresentDays: presentDays,
        attendancePercentage,
        examPercentage,
        examGrade,
        examResultStatus,
        alreadyEnrolledInDestination,
        recommendedAction,
      };
    });

    return { success: true, candidates };
  } catch (err: unknown) {
    console.error('[PromotionService] Error getting promotion candidates:', err);
    return { success: false, candidates: [], error: 'Failed to load promotion candidates.' };
  }
}

/**
 * Executes student promotion/progression inside an atomic SQLite transaction.
 */
export function executePromotion(
  params: {
    sessionToken?: string;
    fromSessionId: number;
    toSessionId?: number;
    fromClassId: number;
    toClassId?: number;
    fromSectionId?: number;
    toSectionId?: number;
    promotions: Array<{
      studentId: number;
      action: PromotionAction;
      toClassId?: number;
      toSectionId?: number;
      rollNumber?: string;
      remarks?: string;
    }>;
  },
  db?: Database.Database
): { success: boolean; processedCount: number; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, processedCount: 0, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const { fromSessionId, toSessionId, fromClassId, toClassId, toSectionId, promotions } = params;

  if (!fromSessionId || !fromClassId) {
    return { success: false, processedCount: 0, error: 'Source session and class are required.' };
  }

  if (!promotions || promotions.length === 0) {
    return { success: false, processedCount: 0, error: 'No students selected for promotion.' };
  }

  // Verify source session exists
  const fromSess = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(fromSessionId);
  if (!fromSess) {
    return { success: false, processedCount: 0, error: 'Source academic session does not exist.' };
  }

  // If actions include Promote or Retain, destination session and class are mandatory
  const needsDestination = promotions.some((p) => p.action === 'Promote' || p.action === 'Retain');
  if (needsDestination) {
    if (!toSessionId) {
      return { success: false, processedCount: 0, error: 'Destination academic session is required for promotions.' };
    }
    const toSess = database.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(toSessionId);
    if (!toSess) {
      return { success: false, processedCount: 0, error: 'Destination academic session does not exist.' };
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const userId = sessionCheck.user?.id || null;

  try {
    const promotionTx = database.transaction(() => {
      let count = 0;

      for (const item of promotions) {
        const studentId = Number(item.studentId);
        const action = item.action;
        const remarks = (item.remarks || '').trim();

        // 1. Fetch Student & current active enrollment
        const student = database.prepare('SELECT id, student_id, display_name FROM students WHERE id = ?').get(studentId) as {
          id: number;
          student_id: string;
          display_name: string;
        } | undefined;

        if (!student) {
          throw new Error(`Student record not found (ID: ${studentId}).`);
        }

        const currentEnrollment = database.prepare(`
          SELECT id, class_id, section_id, COALESCE(roll_number, '') as roll_number
          FROM student_enrollments
          WHERE student_id = ? AND academic_session_id = ? AND (status = 'Active' OR LOWER(status) = 'active')
          ORDER BY id DESC LIMIT 1
        `).get(studentId, fromSessionId) as { id: number; class_id: number; section_id: number; roll_number: string } | undefined;

        if (!currentEnrollment) {
          throw new Error(`Student "${student.display_name}" does not have an active enrollment in the source session.`);
        }

        if (action === 'Promote' || action === 'Retain') {
          let targetClassId = item.toClassId || (action === 'Promote' ? toClassId : fromClassId);

          // If action is Promote and targetClassId was not specified (e.g. Auto / Same Class), auto-detect next class
          if (action === 'Promote' && (!targetClassId || targetClassId <= 0)) {
            const currCls = database.prepare('SELECT id, display_order FROM classes WHERE id = ?').get(currentEnrollment.class_id) as { id: number; display_order: number } | undefined;
            if (currCls) {
              const nextCls = database.prepare(`
                SELECT id FROM classes
                WHERE is_active = 1 AND (display_order > ? OR (display_order = ? AND id > ?))
                ORDER BY display_order ASC, id ASC
                LIMIT 1
              `).get(currCls.display_order, currCls.display_order, currCls.id) as { id: number } | undefined;
              if (nextCls) {
                targetClassId = nextCls.id;
              } else {
                targetClassId = currentEnrollment.class_id;
              }
            } else {
              targetClassId = currentEnrollment.class_id;
            }
          } else if (action === 'Retain' && (!targetClassId || targetClassId <= 0)) {
            targetClassId = fromClassId || currentEnrollment.class_id;
          }

          if (!targetClassId || targetClassId <= 0) {
            throw new Error(`Target class could not be determined for student "${student.display_name}".`);
          }

          // Resolve valid section in target class
          let preferredSectionId: number | undefined = item.toSectionId || toSectionId;
          if (action === 'Retain' && !item.toSectionId && targetClassId === currentEnrollment.class_id) {
            // Keep current section on retain
            preferredSectionId = currentEnrollment.section_id;
          } else if (!preferredSectionId || preferredSectionId <= 0) {
            // Auto / Same Section: try to find section in targetClass with SAME name as current section
            const currSec = database.prepare('SELECT name FROM sections WHERE id = ?').get(currentEnrollment.section_id) as { name: string } | undefined;
            if (currSec?.name) {
              const matchingSec = database.prepare('SELECT id FROM sections WHERE class_id = ? AND name = ? COLLATE NOCASE').get(targetClassId, currSec.name) as { id: number } | undefined;
              if (matchingSec) {
                preferredSectionId = matchingSec.id;
              }
            }
          }

          const targetSectionId = ensureClassSection(targetClassId, preferredSectionId, database);
          if (!targetSectionId) {
            throw new Error(`Unable to assign or create a valid section for student "${student.display_name}".`);
          }

          // Duplicate Enrollment Check: student cannot already be active in destination session under another enrollment
          const existingDest = database.prepare(`
            SELECT id FROM student_enrollments
            WHERE student_id = ? AND academic_session_id = ? AND (status = 'Active' OR LOWER(status) = 'active') AND id != ?
          `).get(studentId, toSessionId!, currentEnrollment.id);

          if (existingDest) {
            throw new Error(`Student "${student.display_name}" (${student.student_id}) is already enrolled in the destination session.`);
          }

          // 2. Transition old enrollment: update promotion_status and mark Inactive
          database.prepare(`
            UPDATE student_enrollments
            SET status = 'Inactive',
                promotion_status = ?,
                promotion_date = ?,
                remarks = CASE WHEN remarks = '' THEN ? ELSE remarks || ' | ' || ? END,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(action, today, remarks || action, remarks || action, currentEnrollment.id);

          // 3. Create new enrollment in destination session (Permanent Student ID preserved!)
          const rollNum = (item.rollNumber || '').trim() || (action === 'Retain' ? (currentEnrollment.roll_number || '') : '');
          database.prepare(`
            INSERT INTO student_enrollments (
              student_id, academic_session_id, class_id, section_id,
              roll_number, admission_date, status, promotion_status,
              remarks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'Active', 'None', '', datetime('now'), datetime('now'))
          `).run(
            studentId,
            toSessionId!,
            targetClassId,
            targetSectionId,
            rollNum,
            today
          );

          // 4. Audit log entry
          database.prepare(`
            INSERT INTO promotion_logs (
              student_id, from_session_id, to_session_id,
              from_class_id, to_class_id, from_section_id, to_section_id,
              action, promotion_date, performed_by_user_id, remarks, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            studentId,
            fromSessionId,
            toSessionId!,
            currentEnrollment.class_id,
            targetClassId,
            currentEnrollment.section_id,
            targetSectionId,
            action,
            today,
            userId,
            remarks
          );
        } else if (action === 'Graduate') {
          // Transition old enrollment to Graduated
          database.prepare(`
            UPDATE student_enrollments
            SET status = 'Graduated',
                promotion_status = 'Graduated',
                promotion_date = ?,
                remarks = CASE WHEN remarks = '' THEN ? ELSE remarks || ' | ' || ? END,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(today, remarks || 'Graduated', remarks || 'Graduated', currentEnrollment.id);

          // Set student isActive to 0 (graduated from school)
          database.prepare(`
            UPDATE students SET is_active = 0, updated_at = datetime('now') WHERE id = ?
          `).run(studentId);

          database.prepare(`
            INSERT INTO promotion_logs (
              student_id, from_session_id, to_session_id,
              from_class_id, to_class_id, from_section_id, to_section_id,
              action, promotion_date, performed_by_user_id, remarks, created_at
            ) VALUES (?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, datetime('now'))
          `).run(
            studentId,
            fromSessionId,
            currentEnrollment.class_id,
            currentEnrollment.section_id,
            action,
            today,
            userId,
            remarks
          );
        } else if (action === 'Transfer' || action === 'Left') {
          const statusValue = action === 'Transfer' ? 'Transferred' : 'Left';

          database.prepare(`
            UPDATE student_enrollments
            SET status = ?,
                promotion_status = ?,
                promotion_date = ?,
                remarks = CASE WHEN remarks = '' THEN ? ELSE remarks || ' | ' || ? END,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(statusValue, action, today, remarks || action, remarks || action, currentEnrollment.id);

          // Deactivate student record (not deleted)
          database.prepare(`
            UPDATE students SET is_active = 0, updated_at = datetime('now') WHERE id = ?
          `).run(studentId);

          database.prepare(`
            INSERT INTO promotion_logs (
              student_id, from_session_id, to_session_id,
              from_class_id, to_class_id, from_section_id, to_section_id,
              action, promotion_date, performed_by_user_id, remarks, created_at
            ) VALUES (?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, datetime('now'))
          `).run(
            studentId,
            fromSessionId,
            currentEnrollment.class_id,
            currentEnrollment.section_id,
            action,
            today,
            userId,
            remarks
          );
        }

        count++;
      }

      return count;
    });

    const processedCount = promotionTx();
    console.log(`[PromotionService] Successfully processed ${processedCount} student promotion actions.`);

    return { success: true, processedCount };
  } catch (err: unknown) {
    console.error('[PromotionService] Promotion transaction rolled back:', err);
    return {
      success: false,
      processedCount: 0,
      error: err instanceof Error ? err.message : 'Promotion could not be completed. All changes were rolled back.',
    };
  }
}

/**
 * Retrieves the comprehensive academic journey / enrollment history for a student.
 */
export function getStudentAcademicHistory(
  studentId: number,
  db?: Database.Database
): { success: boolean; history: StudentAcademicHistoryEntry[]; error?: string } {
  const database = db ?? getDatabase();

  try {
    const rows = database.prepare(`
      SELECT e.id as enrollment_id,
             e.academic_session_id,
             sess.name as academic_session_name,
             e.class_id,
             c.name as class_name,
             e.section_id,
             sec.name as section_name,
             e.roll_number,
             e.admission_date,
             e.status,
             e.promotion_status,
             e.promotion_date,
             e.remarks
      FROM student_enrollments e
      JOIN academic_sessions sess ON sess.id = e.academic_session_id
      JOIN classes c ON c.id = e.class_id
      JOIN sections sec ON sec.id = e.section_id
      WHERE e.student_id = ?
      ORDER BY e.admission_date DESC, e.id DESC
    `).all(studentId) as Array<{
      enrollment_id: number;
      academic_session_id: number;
      academic_session_name: string;
      class_id: number;
      class_name: string;
      section_id: number;
      section_name: string;
      roll_number: string | null;
      admission_date: string;
      status: string;
      promotion_status: string | null;
      promotion_date: string | null;
      remarks: string | null;
    }>;

    const history: StudentAcademicHistoryEntry[] = rows.map((r) => {
      // Fetch attendance percentage for that session
      const att = database.prepare(`
        SELECT 
          COUNT(*) as total_days,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_days
        FROM attendance
        WHERE student_id = ? AND academic_session_id = ?
      `).get(studentId, r.academic_session_id) as {
        total_days: number;
        present_days: number;
        late_days: number;
      } | undefined;

      const attendancePercentage = att
        ? calculateAttendancePercentage(att.present_days || 0, att.late_days || 0, att.total_days || 0)
        : null;

      // Fetch exam percentage and grade for that session
      const marks = database.prepare(`
        SELECT em.obtained_marks, em.status, es.max_marks, es.passing_marks
        FROM exam_marks em
        JOIN examinations ex ON ex.id = em.examination_id
        JOIN examination_subjects es ON es.id = em.examination_subject_id
        WHERE em.student_id = ? AND ex.academic_session_id = ?
      `).all(studentId, r.academic_session_id) as Array<{
        obtained_marks: number | null;
        status: string;
        max_marks: number;
        passing_marks: number;
      }>;

      let examPercentage: number | null = null;
      let examGrade: string | null = null;

      if (marks.length > 0) {
        let totalMax = 0;
        let totalObt = 0;
        for (const m of marks) {
          totalMax += m.max_marks;
          totalObt += m.status === 'Absent' ? 0 : (m.obtained_marks || 0);
        }
        if (totalMax > 0) {
          examPercentage = Math.round((totalObt / totalMax) * 10000) / 100;
          const rule = database.prepare(`
            SELECT grade FROM grading_rules
            WHERE ? >= min_percentage AND (? < max_percentage OR (? = 100 AND max_percentage = 100))
            ORDER BY min_percentage DESC LIMIT 1
          `).get(examPercentage, examPercentage, examPercentage) as { grade: string } | undefined;
          examGrade = rule?.grade || null;
        }
      }

      return {
        enrollmentId: r.enrollment_id,
        academicSessionId: r.academic_session_id,
        academicSessionName: r.academic_session_name,
        classId: r.class_id,
        className: r.class_name,
        sectionId: r.section_id,
        sectionName: r.section_name,
        rollNumber: r.roll_number || '',
        admissionDate: r.admission_date,
        status: r.status,
        promotionStatus: r.promotion_status || 'None',
        promotionDate: r.promotion_date || null,
        remarks: r.remarks || '',
        attendancePercentage,
        examGrade,
        examPercentage,
      };
    });

    return { success: true, history };
  } catch (err: unknown) {
    console.error('[PromotionService] Error fetching academic history:', err);
    return { success: false, history: [], error: 'Failed to retrieve academic history.' };
  }
}

/**
 * Retrieves paginated audit logs of past promotion operations.
 */
export function getPromotionLogs(
  params: { studentId?: number; sessionId?: number; page?: number; limit?: number } = {},
  db?: Database.Database
): {
  success: boolean;
  logs: PromotionLogItem[];
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
    whereClause += ' AND pl.student_id = ?';
    queryParams.push(Number(params.studentId));
  }

  if (params.sessionId) {
    whereClause += ' AND (pl.from_session_id = ? OR pl.to_session_id = ?)';
    queryParams.push(Number(params.sessionId), Number(params.sessionId));
  }

  const baseJoin = `
    FROM promotion_logs pl
    JOIN students s ON s.id = pl.student_id
    JOIN academic_sessions fs ON fs.id = pl.from_session_id
    LEFT JOIN academic_sessions ts ON ts.id = pl.to_session_id
    JOIN classes fc ON fc.id = pl.from_class_id
    LEFT JOIN classes tc ON tc.id = pl.to_class_id
    JOIN sections fsec ON fsec.id = pl.from_section_id
    LEFT JOIN sections tsec ON tsec.id = pl.to_section_id
    LEFT JOIN users u ON u.id = pl.performed_by_user_id
  `;

  try {
    const countSql = `SELECT COUNT(*) as count ${baseJoin} ${whereClause}`;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const dataSql = `
      SELECT pl.*,
             s.student_id as student_system_id,
             s.display_name as student_name,
             fs.name as from_session_name,
             ts.name as to_session_name,
             fc.name as from_class_name,
             tc.name as to_class_name,
             fsec.name as from_section_name,
             tsec.name as to_section_name,
             u.display_name as performed_by_user_name
      ${baseJoin}
      ${whereClause}
      ORDER BY pl.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as Array<{
      id: number;
      student_id: number;
      student_system_id: string;
      student_name: string;
      from_session_name: string;
      to_session_name: string | null;
      from_class_name: string;
      to_class_name: string | null;
      from_section_name: string;
      to_section_name: string | null;
      action: PromotionAction;
      promotion_date: string;
      performed_by_user_name: string | null;
      remarks: string;
      created_at: string;
    }>;

    const logs: PromotionLogItem[] = rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentSystemId: r.student_system_id,
      studentName: r.student_name,
      fromSessionName: r.from_session_name,
      toSessionName: r.to_session_name || undefined,
      fromClassName: r.from_class_name,
      toClassName: r.to_class_name || undefined,
      fromSectionName: r.from_section_name,
      toSectionName: r.to_section_name || undefined,
      action: r.action,
      promotionDate: r.promotion_date,
      performedByUserName: r.performed_by_user_name || undefined,
      remarks: r.remarks,
      createdAt: r.created_at,
    }));

    return { success: true, logs, totalCount, page, totalPages };
  } catch (err: unknown) {
    console.error('[PromotionService] Error fetching promotion logs:', err);
    return {
      success: false,
      logs: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Failed to retrieve promotion logs.',
    };
  }
}
