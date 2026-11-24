/**
 * Dashboard Metrics & Summary Service
 * 
 * Computes live, honest metrics from the local SQLite database
 * without fabricating statistics.
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { getSchoolSettings } from './school.service';
import { getActiveSession } from './academic-session.service';

export interface DashboardSummary {
  schoolName: string;
  schoolType: 'School' | 'College';
  activeSession: string | null;
  activeClassesCount: number;
  activeSubjectsCount: number;
  activeStudentsCount: number;
  activeTeachersCount: number;
  hasLogo: boolean;
  totalFeesBilled?: number;
  totalFeesCollected?: number;
  totalFeesOutstanding?: number;
  todayCollection?: number;
}

export function getDashboardSummary(db?: Database.Database): DashboardSummary {
  const database = db ?? getDatabase();

  const settings = getSchoolSettings(database);
  const activeSessionObj = getActiveSession(database);

  const classesRow = database
    .prepare('SELECT COUNT(*) as count FROM classes WHERE is_active = 1')
    .get() as { count: number };

  const subjectsRow = database
    .prepare('SELECT COUNT(*) as count FROM subjects WHERE is_active = 1')
    .get() as { count: number };

  let activeStudentsCount = 0;
  let activeTeachersCount = 0;

  try {
    const studentsRow = database
      .prepare('SELECT COUNT(*) as count FROM students WHERE is_active = 1 AND (is_deleted = 0 OR is_deleted IS NULL)')
      .get() as { count: number } | undefined;
    activeStudentsCount = studentsRow?.count ?? 0;
  } catch {}

  try {
    const teachersRow = database
      .prepare('SELECT COUNT(*) as count FROM teachers WHERE is_active = 1')
      .get() as { count: number } | undefined;
    activeTeachersCount = teachersRow?.count ?? 0;
  } catch {}

  let totalFeesBilled = 0;
  let totalFeesCollected = 0;
  let totalFeesOutstanding = 0;
  let todayCollection = 0;

  try {
    const feeRow = database
      .prepare(
        `SELECT 
           COALESCE(SUM(original_amount), 0) as billed,
           COALESCE(SUM(paid_amount), 0) as collected,
           COALESCE(SUM(remaining_balance), 0) as outstanding
         FROM fee_records
         WHERE status NOT IN ('Waived', 'Cancelled')`
      )
      .get() as { billed: number; collected: number; outstanding: number } | undefined;

    if (feeRow) {
      totalFeesBilled = feeRow.billed;
      totalFeesCollected = feeRow.collected;
      totalFeesOutstanding = feeRow.outstanding;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRow = database
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as todayPaid
         FROM fee_payments
         WHERE payment_date = ?`
      )
      .get(todayStr) as { todayPaid: number } | undefined;

    if (todayRow) {
      todayCollection = todayRow.todayPaid;
    }
  } catch {}

  return {
    schoolName: settings.schoolName,
    schoolType: settings.schoolType,
    activeSession: activeSessionObj ? activeSessionObj.name : (settings.academicSession || null),
    activeClassesCount: classesRow.count ?? 0,
    activeSubjectsCount: subjectsRow.count ?? 0,
    activeStudentsCount,
    activeTeachersCount,
    hasLogo: Boolean(settings.logoPath),
    totalFeesBilled,
    totalFeesCollected,
    totalFeesOutstanding,
    todayCollection,
  };
}
