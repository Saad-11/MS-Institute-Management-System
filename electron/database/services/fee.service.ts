/**
 * Fees & Fee Slips Management Service
 * 
 * Manages:
 * 1. Fee Types (Tuition, Admission, Exam, Transport, etc.)
 * 2. Class-wise Fee Structures with frequencies and integer minor currency units (paisa)
 * 3. Fee Periods (Open/Closed periods with due dates)
 * 4. Student-Specific Fee Adjustments (Individual custom recurring/one-time fees)
 * 5. Atomic Fee Generation for enrolled students with duplicate generation protection
 * 6. Fee Invoices / Records querying, filtering, and student dues tracking
 * 7. Transactional Payment Recording with unique receipt numbering (REC-YYYY-XXXXXX),
 *    overpayment rejection, and safe balance & status calculations
 * 8. Payment history searching, receipt retrieval, and student fee profiles
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { verifySession } from './auth.service';

export const DEFAULT_CURRENCY = 'PKR';
export const DEFAULT_CURRENCY_SYMBOL = 'Rs.';

export function toMinorUnits(majorAmount: number | string | null | undefined): number {
  if (majorAmount === null || majorAmount === undefined) return 0;
  const str = String(majorAmount).trim();
  if (!str) return 0;
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;
  const sanitized = cleanStr.replace(/[^0-9.]/g, '');
  if (!sanitized) return 0;
  const parts = sanitized.split('.');
  const wholePart = parts[0] || '0';
  let decimalPart = parts[1] || '';
  if (decimalPart.length > 2) decimalPart = decimalPart.slice(0, 2);
  else decimalPart = decimalPart.padEnd(2, '0');
  const wholeInt = parseInt(wholePart, 10) || 0;
  const decInt = parseInt(decimalPart, 10) || 0;
  const total = wholeInt * 100 + decInt;
  return isNegative ? -total : total;
}

export function toMajorUnits(minorUnits: number | null | undefined): number {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) return 0;
  return Math.round(minorUnits) / 100;
}

export function formatMoney(
  minorUnits: number | null | undefined,
  symbol: string = DEFAULT_CURRENCY_SYMBOL
): string {
  if (minorUnits === null || minorUnits === undefined || isNaN(minorUnits)) {
    return `${symbol} 0.00`;
  }
  const isNegative = minorUnits < 0;
  const abs = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const wholeFormatted = whole.toLocaleString('en-US');
  const formattedFraction = fraction < 10 ? `0${fraction}` : `${fraction}`;
  return `${isNegative ? '-' : ''}${symbol} ${wholeFormatted}.${formattedFraction}`;
}

export function calculateNetFee(
  originalAmount: number,
  discount: number = 0,
  fine: number = 0
): number {
  const safeOriginal = Math.max(0, Math.round(originalAmount));
  const safeFine = Math.max(0, Math.round(fine));
  const maxDiscount = safeOriginal + safeFine;
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), maxDiscount);
  return Math.max(0, safeOriginal - safeDiscount + safeFine);
}

export function calculatePercentageDiscount(originalAmount: number, percentage: number): number {
  if (originalAmount <= 0 || percentage <= 0) return 0;
  const safePct = Math.min(100, Math.max(0, percentage));
  return Math.round((originalAmount * safePct) / 100);
}

export function calculateFeeStatus(
  paidAmount: number,
  netAmount: number
): 'Unpaid' | 'Partially Paid' | 'Paid' {
  const safePaid = Math.max(0, Math.round(paidAmount));
  const safeNet = Math.max(0, Math.round(netAmount));
  if (safeNet <= 0 || safePaid >= safeNet) return 'Paid';
  if (safePaid > 0) return 'Partially Paid';
  return 'Unpaid';
}

export type FeeFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'One-Time';
export type FeeRecordStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Waived' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface FeeTypeItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  classId: number;
  className?: string;
  feeTypeId: number;
  feeTypeName?: string;
  amount: number; // In minor units (paisa)
  frequency: FeeFrequency;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeePeriodItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: 'Open' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeAdjustmentItem {
  id: number;
  studentId: number;
  enrollmentId: number;
  feeTypeId: number;
  feeTypeName?: string;
  amount: number; // In minor units (paisa)
  frequency: FeeFrequency;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeRecordItem {
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
  feePeriodId: number;
  feePeriodName: string;
  feeTypeId: number;
  feeTypeName: string;
  originalAmount: number; // Minor units (paisa)
  discount: number; // Minor units (paisa)
  fine: number; // Minor units (paisa)
  netAmount: number; // Minor units (paisa)
  paidAmount: number; // Minor units (paisa)
  remainingBalance: number; // Minor units (paisa)
  dueDate: string;
  status: FeeRecordStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeePaymentItem {
  id: number;
  receiptNumber: string;
  studentId: number;
  enrollmentId: number;
  feeRecordId: number;
  paymentDate: string;
  amount: number; // Minor units (paisa)
  paymentMethod: PaymentMethod;
  referenceNotes: string;
  receivedByUserId: number | null;
  receivedByUsername?: string;
  createdAt: string;
  // Expanded fields for receipt printing & receipt lookup
  systemStudentId?: string;
  admissionNumber?: string;
  studentName?: string;
  className?: string;
  sectionName?: string;
  academicSessionName?: string;
  feeTypeName?: string;
  feePeriodName?: string;
  originalAmount?: number;
  discount?: number;
  fine?: number;
  netAmount?: number;
  remainingBalanceAfterPayment?: number;
}

export interface StudentFeeSummary {
  studentId: number;
  totalBilled: number;
  totalDiscount: number;
  totalFine: number;
  totalPaid: number;
  totalOutstanding: number;
}

// ─── RECEIPT NUMBER GENERATOR ──────────────────────────────────────────────────

/**
 * Generates a unique, non-repeating receipt number.
 * Format: REC-YYYY-XXXXXX (e.g. REC-2026-000001)
 */
export function generateNextReceiptNumber(year?: string, db?: Database.Database): string {
  const database = db ?? getDatabase();
  const targetYear = year || new Date().getFullYear().toString();
  const prefix = `REC-${targetYear}-`;

  const row = database
    .prepare(
      `SELECT receipt_number 
       FROM fee_payments 
       WHERE receipt_number LIKE ? 
       ORDER BY id DESC 
       LIMIT 1`
    )
    .get(`${prefix}%`) as { receipt_number: string } | undefined;

  if (!row) {
    return `${prefix}000001`;
  }

  const parts = row.receipt_number.split('-');
  const seqPart = parts[parts.length - 1];
  const nextNum = parseInt(seqPart, 10) + 1;
  const padded = isNaN(nextNum) ? '000001' : nextNum.toString().padStart(6, '0');
  return `${prefix}${padded}`;
}

// ─── SECTION 1: FEE TYPES ──────────────────────────────────────────────────────

export function getAllFeeTypes(
  includeInactive = true,
  db?: Database.Database
): { success: boolean; types: FeeTypeItem[]; error?: string } {
  try {
    const database = db ?? getDatabase();
    const query = includeInactive
      ? 'SELECT * FROM fee_types ORDER BY name COLLATE NOCASE ASC'
      : 'SELECT * FROM fee_types WHERE is_active = 1 ORDER BY name COLLATE NOCASE ASC';

    let rows = database.prepare(query).all() as Array<{
      id: number;
      name: string;
      code: string;
      description: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>;

    // Self-healing: If no fee types exist, seed defaults automatically
    if (rows.length === 0) {
      const defaultFeeTypes = [
        { name: 'Tuition Fee', code: 'TUIT', description: 'Regular monthly tuition fee' },
        { name: 'Admission Fee', code: 'ADM', description: 'One-time admission processing fee' },
        { name: 'Examination Fee', code: 'EXAM', description: 'Term examination and materials fee' },
        { name: 'Sports & Activity Fee', code: 'SPRT', description: 'Annual extracurricular activities fee' },
        { name: 'Annual Charges', code: 'ANNL', description: 'Annual institutional charges' },
        { name: 'Lab Charges', code: 'LAB', description: 'Science and computer laboratory charges' },
      ];
      const insertStmt = database.prepare(`
        INSERT OR IGNORE INTO fee_types (name, code, description, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      `);
      for (const f of defaultFeeTypes) {
        insertStmt.run(f.name, f.code, f.description);
      }
      rows = database.prepare(query).all() as Array<{
        id: number;
        name: string;
        code: string;
        description: string;
        is_active: number;
        created_at: string;
        updated_at: string;
      }>;
    }

    return {
      success: true,
      types: rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        description: r.description || '',
        isActive: r.is_active === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  } catch (err: unknown) {
    console.error('[FeeService] getAllFeeTypes error:', err);
    return { success: false, types: [], error: 'Failed to retrieve fee types.' };
  }
}

export function createFeeType(
  params: {
    sessionToken?: string;
    name: string;
    code: string;
    description?: string;
  },
  db?: Database.Database
): { success: boolean; feeType?: FeeTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const name = (params.name || '').trim();
  const code = (params.code || '').trim().toUpperCase();
  const description = (params.description || '').trim();

  if (!name) return { success: false, error: 'Fee type name is required.' };
  if (!code) return { success: false, error: 'Fee type code is required.' };

  // Duplicate checks
  const existingName = database
    .prepare('SELECT id FROM fee_types WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existingName) {
    return { success: false, error: `A fee type with name "${name}" already exists.` };
  }

  const existingCode = database
    .prepare('SELECT id FROM fee_types WHERE code = ? COLLATE NOCASE')
    .get(code);
  if (existingCode) {
    return { success: false, error: `A fee type with code "${code}" already exists.` };
  }

  try {
    const info = database
      .prepare('INSERT INTO fee_types (name, code, description, is_active) VALUES (?, ?, ?, 1)')
      .run(name, code, description);

    const created = database
      .prepare('SELECT * FROM fee_types WHERE id = ?')
      .get(info.lastInsertRowid) as {
      id: number;
      name: string;
      code: string;
      description: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    };

    return {
      success: true,
      feeType: {
        id: created.id,
        name: created.name,
        code: created.code,
        description: created.description || '',
        isActive: created.is_active === 1,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
    };
  } catch (err: unknown) {
    console.error('[FeeService] createFeeType error:', err);
    return { success: false, error: 'Database error creating fee type.' };
  }
}

export function updateFeeType(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; feeType?: FeeTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const code = (params.code || '').trim().toUpperCase();
  const description = (params.description || '').trim();

  if (!id) return { success: false, error: 'Valid fee type ID is required.' };
  if (!name) return { success: false, error: 'Fee type name cannot be blank.' };
  if (!code) return { success: false, error: 'Fee type code cannot be blank.' };

  // Check unique constraints against other records
  const duplicateName = database
    .prepare('SELECT id FROM fee_types WHERE name = ? COLLATE NOCASE AND id != ?')
    .get(name, id);
  if (duplicateName) {
    return { success: false, error: `Another fee type with name "${name}" already exists.` };
  }

  const duplicateCode = database
    .prepare('SELECT id FROM fee_types WHERE code = ? COLLATE NOCASE AND id != ?')
    .get(code, id);
  if (duplicateCode) {
    return { success: false, error: `Another fee type with code "${code}" already exists.` };
  }

  try {
    const isActiveVal = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;
    database
      .prepare(
        `UPDATE fee_types 
         SET name = ?, code = ?, description = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(name, code, description, isActiveVal, id);

    const updated = database
      .prepare('SELECT * FROM fee_types WHERE id = ?')
      .get(id) as {
      id: number;
      name: string;
      code: string;
      description: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    };

    return {
      success: true,
      feeType: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        description: updated.description || '',
        isActive: updated.is_active === 1,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    };
  } catch (err: unknown) {
    console.error('[FeeService] updateFeeType error:', err);
    return { success: false, error: 'Database error updating fee type.' };
  }
}

export function toggleFeeTypeStatus(
  params: {
    sessionToken?: string;
    id: number;
    isActive: boolean;
  },
  db?: Database.Database
): { success: boolean; feeType?: FeeTypeItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database
      .prepare(
        `UPDATE fee_types 
         SET is_active = ?, updated_at = datetime('now') 
         WHERE id = ?`
      )
      .run(isActive, id);

    const updated = database
      .prepare('SELECT * FROM fee_types WHERE id = ?')
      .get(id) as {
      id: number;
      name: string;
      code: string;
      description: string;
      is_active: number;
      created_at: string;
      updated_at: string;
    };

    return {
      success: true,
      feeType: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        description: updated.description || '',
        isActive: updated.is_active === 1,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    };
  } catch (err: unknown) {
    console.error('[FeeService] toggleFeeTypeStatus error:', err);
    return { success: false, error: 'Failed to toggle fee type status.' };
  }
}

// ─── SECTION 2: FEE STRUCTURES (CLASS-WISE) ────────────────────────────────────

export function getFeeStructures(
  params?: {
    academicSessionId?: number;
    classId?: number;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; structures: FeeStructureItem[]; error?: string } {
  try {
    const database = db ?? getDatabase();
    let sql = `
      SELECT 
        fs.id,
        fs.academic_session_id as academicSessionId,
        s.name as academicSessionName,
        fs.class_id as classId,
        c.name as className,
        fs.fee_type_id as feeTypeId,
        ft.name as feeTypeName,
        fs.amount,
        fs.frequency,
        fs.effective_from as effectiveFrom,
        fs.effective_to as effectiveTo,
        fs.description,
        fs.is_active as isActive,
        fs.created_at as createdAt,
        fs.updated_at as updatedAt
      FROM fee_structures fs
      JOIN academic_sessions s ON s.id = fs.academic_session_id
      JOIN classes c ON c.id = fs.class_id
      JOIN fee_types ft ON ft.id = fs.fee_type_id
      WHERE 1=1
    `;
    const queryParams: unknown[] = [];

    if (params?.academicSessionId) {
      sql += ' AND fs.academic_session_id = ?';
      queryParams.push(params.academicSessionId);
    }
    if (params?.classId) {
      sql += ' AND fs.class_id = ?';
      queryParams.push(params.classId);
    }
    if (params?.isActive !== undefined) {
      sql += ' AND fs.is_active = ?';
      queryParams.push(params.isActive ? 1 : 0);
    }

    sql += ' ORDER BY c.display_order ASC, ft.name COLLATE NOCASE ASC';

    const rows = database.prepare(sql).all(...queryParams) as Array<{
      id: number;
      academicSessionId: number;
      academicSessionName: string;
      classId: number;
      className: string;
      feeTypeId: number;
      feeTypeName: string;
      amount: number;
      frequency: FeeFrequency;
      effectiveFrom: string;
      effectiveTo: string;
      description: string;
      isActive: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return {
      success: true,
      structures: rows.map((r) => ({
        id: r.id,
        academicSessionId: r.academicSessionId,
        academicSessionName: r.academicSessionName,
        classId: r.classId,
        className: r.className,
        feeTypeId: r.feeTypeId,
        feeTypeName: r.feeTypeName,
        amount: r.amount,
        frequency: r.frequency,
        effectiveFrom: r.effectiveFrom || '',
        effectiveTo: r.effectiveTo || '',
        description: r.description || '',
        isActive: r.isActive === 1,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  } catch (err: unknown) {
    console.error('[FeeService] getFeeStructures error:', err);
    return { success: false, structures: [], error: 'Failed to retrieve fee structures.' };
  }
}

export function createFeeStructure(
  params: {
    sessionToken?: string;
    academicSessionId: number;
    classId: number;
    feeTypeId: number;
    amount: number;
    frequency: FeeFrequency;
    effectiveFrom?: string;
    effectiveTo?: string;
    description?: string;
  },
  db?: Database.Database
): { success: boolean; structure?: FeeStructureItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized.' };
  }

  const database = db ?? getDatabase();
  const academicSessionId = Number(params.academicSessionId);
  const classId = Number(params.classId);
  const feeTypeId = Number(params.feeTypeId);
  const amount = Math.round(Number(params.amount));
  const frequency = params.frequency;
  const effectiveFrom = (params.effectiveFrom || '').trim();
  const effectiveTo = (params.effectiveTo || '').trim();
  const description = (params.description || '').trim();

  if (!academicSessionId || !classId || !feeTypeId) {
    return { success: false, error: 'Academic Session, Class, and Fee Type are required.' };
  }
  if (isNaN(amount) || amount < 0) {
    return { success: false, error: 'Fee amount cannot be negative.' };
  }

  // Prevent duplicate structure
  const existing = database
    .prepare(
      `SELECT id FROM fee_structures 
       WHERE academic_session_id = ? AND class_id = ? AND fee_type_id = ? AND frequency = ?`
    )
    .get(academicSessionId, classId, feeTypeId, frequency);

  if (existing) {
    return {
      success: false,
      error: 'A fee structure for this Class, Fee Type, and Frequency already exists in this Academic Session.',
    };
  }

  try {
    const info = database
      .prepare(
        `INSERT INTO fee_structures 
         (academic_session_id, class_id, fee_type_id, amount, frequency, effective_from, effective_to, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        academicSessionId,
        classId,
        feeTypeId,
        amount,
        frequency,
        effectiveFrom,
        effectiveTo,
        description
      );

    const createdRes = getFeeStructures({ academicSessionId, classId }, database);
    const createdItem = createdRes.structures.find((s) => s.id === Number(info.lastInsertRowid));

    return {
      success: true,
      structure: createdItem,
    };
  } catch (err: unknown) {
    console.error('[FeeService] createFeeStructure error:', err);
    return { success: false, error: 'Database error creating fee structure.' };
  }
}

export function updateFeeStructure(
  params: {
    sessionToken?: string;
    id: number;
    amount: number;
    frequency: FeeFrequency;
    effectiveFrom?: string;
    effectiveTo?: string;
    description?: string;
    isActive?: boolean;
  },
  db?: Database.Database
): { success: boolean; structure?: FeeStructureItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized.' };
  }

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const amount = Math.round(Number(params.amount));
  const frequency = params.frequency;
  const effectiveFrom = (params.effectiveFrom || '').trim();
  const effectiveTo = (params.effectiveTo || '').trim();
  const description = (params.description || '').trim();

  if (!id) return { success: false, error: 'Structure ID is required.' };
  if (isNaN(amount) || amount < 0) {
    return { success: false, error: 'Fee amount cannot be negative.' };
  }

  try {
    const isActiveVal = params.isActive !== undefined ? (params.isActive ? 1 : 0) : 1;
    database
      .prepare(
        `UPDATE fee_structures 
         SET amount = ?, frequency = ?, effective_from = ?, effective_to = ?, description = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(amount, frequency, effectiveFrom, effectiveTo, description, isActiveVal, id);

    const res = getFeeStructures(undefined, database);
    const item = res.structures.find((s) => s.id === id);

    return { success: true, structure: item };
  } catch (err: unknown) {
    console.error('[FeeService] updateFeeStructure error:', err);
    return { success: false, error: 'Database error updating fee structure.' };
  }
}

export function toggleFeeStructureStatus(
  params: { sessionToken?: string; id: number; isActive: boolean },
  db?: Database.Database
): { success: boolean; structure?: FeeStructureItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) return { success: false, error: 'Unauthorized.' };

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const isActive = params.isActive ? 1 : 0;

  try {
    database
      .prepare("UPDATE fee_structures SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(isActive, id);
    const res = getFeeStructures(undefined, database);
    return { success: true, structure: res.structures.find((s) => s.id === id) };
  } catch (err: unknown) {
    console.error('[FeeService] toggleFeeStructureStatus error:', err);
    return { success: false, error: 'Failed to update structure status.' };
  }
}

// ─── SECTION 3: FEE PERIODS ────────────────────────────────────────────────────

export function generateDefaultFeePeriodsForSession(
  academicSessionId: number,
  db?: Database.Database
): void {
  const database = db ?? getDatabase();
  const sess = database
    .prepare('SELECT id, name, start_date, end_date FROM academic_sessions WHERE id = ?')
    .get(academicSessionId) as { id: number; name: string; start_date: string; end_date: string } | undefined;

  if (!sess) return;

  const insertPeriod = database.prepare(`
    INSERT OR IGNORE INTO fee_periods (
      academic_session_id, name, start_date, end_date, due_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'Open', datetime('now'), datetime('now'))
  `);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let startYear = parseInt(sess.start_date ? sess.start_date.substring(0, 4) : '2026', 10);
  let startMonth = parseInt(sess.start_date && sess.start_date.length >= 7 ? sess.start_date.substring(5, 7) : '8', 10) - 1;
  if (isNaN(startYear)) {
    const m = sess.name.match(/\b(20\d\d)\b/);
    startYear = m ? parseInt(m[1], 10) : 2026;
  }
  if (isNaN(startMonth) || startMonth < 0 || startMonth > 11) {
    startMonth = 7; // August default
  }

  for (let i = 0; i < 12; i++) {
    const curDate = new Date(Date.UTC(startYear, startMonth + i, 1));
    const y = curDate.getUTCFullYear();
    const mIdx = curDate.getUTCMonth();
    const mNum = (mIdx + 1).toString().padStart(2, '0');
    const name = `${monthNames[mIdx]} ${y}`;
    const startDate = `${y}-${mNum}-01`;
    const lastDay = new Date(Date.UTC(y, mIdx + 1, 0)).getUTCDate();
    const endDate = `${y}-${mNum}-${lastDay.toString().padStart(2, '0')}`;
    const dueDate = `${y}-${mNum}-10`;

    insertPeriod.run(sess.id, name, startDate, endDate, dueDate);
  }
}

export function getFeePeriods(
  academicSessionId?: number,
  db?: Database.Database
): { success: boolean; periods: FeePeriodItem[]; error?: string } {
  try {
    const database = db ?? getDatabase();
    let sql = `
      SELECT 
        fp.id,
        fp.academic_session_id as academicSessionId,
        s.name as academicSessionName,
        fp.name,
        fp.start_date as startDate,
        fp.end_date as endDate,
        fp.due_date as dueDate,
        fp.status,
        fp.created_at as createdAt,
        fp.updated_at as updatedAt
      FROM fee_periods fp
      JOIN academic_sessions s ON s.id = fp.academic_session_id
      WHERE 1=1
    `;
    const queryParams: unknown[] = [];

    if (academicSessionId) {
      sql += ' AND fp.academic_session_id = ?';
      queryParams.push(academicSessionId);
    }

    sql += ' ORDER BY fp.start_date ASC';

    let rows = database.prepare(sql).all(...queryParams) as Array<{
      id: number;
      academicSessionId: number;
      academicSessionName: string;
      name: string;
      startDate: string;
      endDate: string;
      dueDate: string;
      status: 'Open' | 'Closed';
      createdAt: string;
      updatedAt: string;
    }>;

    // Self-healing: If no fee periods exist for this session, auto-generate standard 12 monthly periods
    if (rows.length === 0) {
      if (academicSessionId) {
        generateDefaultFeePeriodsForSession(academicSessionId, database);
      } else {
        const activeSessions = database.prepare('SELECT id FROM academic_sessions WHERE is_active = 1').all() as Array<{ id: number }>;
        const targetSessions = activeSessions.length > 0 ? activeSessions : (database.prepare('SELECT id FROM academic_sessions').all() as Array<{ id: number }>);
        for (const s of targetSessions) {
          generateDefaultFeePeriodsForSession(s.id, database);
        }
      }

      rows = database.prepare(sql).all(...queryParams) as Array<{
        id: number;
        academicSessionId: number;
        academicSessionName: string;
        name: string;
        startDate: string;
        endDate: string;
        dueDate: string;
        status: 'Open' | 'Closed';
        createdAt: string;
        updatedAt: string;
      }>;
    }

    return {
      success: true,
      periods: rows.map((r) => ({
        id: r.id,
        academicSessionId: r.academicSessionId,
        academicSessionName: r.academicSessionName,
        name: r.name,
        startDate: r.startDate,
        endDate: r.endDate,
        dueDate: r.dueDate,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  } catch (err: unknown) {
    console.error('[FeeService] getFeePeriods error:', err);
    return { success: false, periods: [], error: 'Failed to retrieve fee periods.' };
  }
}

export function createFeePeriod(
  params: {
    sessionToken?: string;
    academicSessionId: number;
    name: string;
    startDate: string;
    endDate: string;
    dueDate: string;
  },
  db?: Database.Database
): { success: boolean; period?: FeePeriodItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) return { success: false, error: 'Unauthorized.' };

  const database = db ?? getDatabase();
  const academicSessionId = Number(params.academicSessionId);
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const dueDate = (params.dueDate || '').trim();

  if (!academicSessionId || !name || !startDate || !endDate || !dueDate) {
    return { success: false, error: 'All fields (Session, Name, Start Date, End Date, Due Date) are required.' };
  }
  if (startDate > endDate) {
    return { success: false, error: 'Start date cannot be after end date.' };
  }

  // Duplicate name check in same session
  const dup = database
    .prepare('SELECT id FROM fee_periods WHERE academic_session_id = ? AND name = ? COLLATE NOCASE')
    .get(academicSessionId, name);
  if (dup) {
    return { success: false, error: `Fee period "${name}" already exists in this session.` };
  }

  try {
    const info = database
      .prepare(
        `INSERT INTO fee_periods (academic_session_id, name, start_date, end_date, due_date, status)
         VALUES (?, ?, ?, ?, ?, 'Open')`
      )
      .run(academicSessionId, name, startDate, endDate, dueDate);

    const periodsRes = getFeePeriods(academicSessionId, database);
    const created = periodsRes.periods.find((p) => p.id === Number(info.lastInsertRowid));

    return { success: true, period: created };
  } catch (err: unknown) {
    console.error('[FeeService] createFeePeriod error:', err);
    return { success: false, error: 'Database error creating fee period.' };
  }
}

export function updateFeePeriod(
  params: {
    sessionToken?: string;
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    dueDate: string;
    status?: 'Open' | 'Closed';
  },
  db?: Database.Database
): { success: boolean; period?: FeePeriodItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) return { success: false, error: 'Unauthorized.' };

  const database = db ?? getDatabase();
  const id = Number(params.id);
  const name = (params.name || '').trim();
  const startDate = (params.startDate || '').trim();
  const endDate = (params.endDate || '').trim();
  const dueDate = (params.dueDate || '').trim();
  const status = params.status || 'Open';

  if (!id || !name || !startDate || !endDate || !dueDate) {
    return { success: false, error: 'Valid parameters are required.' };
  }

  try {
    database
      .prepare(
        `UPDATE fee_periods 
         SET name = ?, start_date = ?, end_date = ?, due_date = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(name, startDate, endDate, dueDate, status, id);

    const periodsRes = getFeePeriods(undefined, database);
    return { success: true, period: periodsRes.periods.find((p) => p.id === id) };
  } catch (err: unknown) {
    console.error('[FeeService] updateFeePeriod error:', err);
    return { success: false, error: 'Database error updating fee period.' };
  }
}

// ─── SECTION 4: STUDENT SPECIFIC FEE ADJUSTMENTS ───────────────────────────────

export function getStudentFeeAdjustments(
  studentId: number,
  db?: Database.Database
): { success: boolean; adjustments: StudentFeeAdjustmentItem[]; error?: string } {
  try {
    const database = db ?? getDatabase();
    const rows = database
      .prepare(
        `SELECT 
           sfa.id,
           sfa.student_id as studentId,
           sfa.enrollment_id as enrollmentId,
           sfa.fee_type_id as feeTypeId,
           ft.name as feeTypeName,
           sfa.amount,
           sfa.frequency,
           sfa.effective_from as effectiveFrom,
           sfa.effective_to as effectiveTo,
           sfa.description,
           sfa.is_active as isActive,
           sfa.created_at as createdAt,
           sfa.updated_at as updatedAt
         FROM student_fee_adjustments sfa
         JOIN fee_types ft ON ft.id = sfa.fee_type_id
         WHERE sfa.student_id = ?
         ORDER BY sfa.id DESC`
      )
      .all(studentId) as Array<{
      id: number;
      studentId: number;
      enrollmentId: number;
      feeTypeId: number;
      feeTypeName: string;
      amount: number;
      frequency: FeeFrequency;
      effectiveFrom: string;
      effectiveTo: string;
      description: string;
      isActive: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return {
      success: true,
      adjustments: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        enrollmentId: r.enrollmentId,
        feeTypeId: r.feeTypeId,
        feeTypeName: r.feeTypeName,
        amount: r.amount,
        frequency: r.frequency,
        effectiveFrom: r.effectiveFrom || '',
        effectiveTo: r.effectiveTo || '',
        description: r.description || '',
        isActive: r.isActive === 1,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  } catch (err: unknown) {
    console.error('[FeeService] getStudentFeeAdjustments error:', err);
    return { success: false, adjustments: [], error: 'Failed to retrieve student adjustments.' };
  }
}

export function createStudentFeeAdjustment(
  params: {
    sessionToken?: string;
    studentId: number;
    enrollmentId: number;
    feeTypeId: number;
    amount: number;
    frequency?: FeeFrequency;
    effectiveFrom?: string;
    effectiveTo?: string;
    description?: string;
  },
  db?: Database.Database
): { success: boolean; adjustment?: StudentFeeAdjustmentItem; error?: string } {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) return { success: false, error: 'Unauthorized.' };

  const database = db ?? getDatabase();
  const studentId = Number(params.studentId);
  const enrollmentId = Number(params.enrollmentId);
  const feeTypeId = Number(params.feeTypeId);
  const amount = Math.round(Number(params.amount));
  const frequency = params.frequency || 'Monthly';
  const effectiveFrom = (params.effectiveFrom || '').trim();
  const effectiveTo = (params.effectiveTo || '').trim();
  const description = (params.description || '').trim();

  if (!studentId || !enrollmentId || !feeTypeId) {
    return { success: false, error: 'Student, Enrollment, and Fee Type are required.' };
  }
  if (isNaN(amount) || amount < 0) {
    return { success: false, error: 'Amount cannot be negative.' };
  }

  try {
    const info = database
      .prepare(
        `INSERT INTO student_fee_adjustments 
         (student_id, enrollment_id, fee_type_id, amount, frequency, effective_from, effective_to, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(studentId, enrollmentId, feeTypeId, amount, frequency, effectiveFrom, effectiveTo, description);

    const adjRes = getStudentFeeAdjustments(studentId, database);
    return {
      success: true,
      adjustment: adjRes.adjustments.find((a) => a.id === Number(info.lastInsertRowid)),
    };
  } catch (err: unknown) {
    console.error('[FeeService] createStudentFeeAdjustment error:', err);
    return { success: false, error: 'Database error adding student fee adjustment.' };
  }
}

// ─── SECTION 5: FEE GENERATION (CLASS-WISE / TRANSACTIONAL) ────────────────────

export function generateFeesForClass(
  params: {
    sessionToken?: string;
    academicSessionId: number;
    classId: number;
    sectionId?: number;
    feePeriodId: number;
    dueDate?: string;
  },
  db?: Database.Database
): {
  success: boolean;
  summary: {
    totalEligible: number;
    createdCount: number;
    alreadyExistedCount: number;
    failedCount: number;
  };
  error?: string;
} {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'Unauthorized.',
    };
  }

  const database = db ?? getDatabase();
  const { academicSessionId, classId, sectionId, feePeriodId } = params;

  if (!academicSessionId || !classId || !feePeriodId) {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'Academic Session, Class, and Fee Period are required.',
    };
  }

  // Fetch Fee Period for default due date
  const period = database
    .prepare('SELECT due_date, status FROM fee_periods WHERE id = ?')
    .get(feePeriodId) as { due_date: string; status: string } | undefined;
  if (!period) {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'Fee Period not found.',
    };
  }
  if (period.status === 'Closed') {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'Cannot generate fees for a Closed fee period.',
    };
  }

  const effectiveDueDate = params.dueDate?.trim() || period.due_date;

  // 1. Fetch Class Fee Structures
  let structures = database
    .prepare(
      `SELECT fee_type_id, amount 
       FROM fee_structures 
       WHERE academic_session_id = ? AND class_id = ? AND is_active = 1`
    )
    .all(academicSessionId, classId) as Array<{ fee_type_id: number; amount: number }>;

  if (structures.length === 0) {
    // Fallback 1: check if this class has a fee structure in any previous or other session
    const prevStructs = database
      .prepare(
        `SELECT fee_type_id, amount 
         FROM fee_structures 
         WHERE class_id = ? AND is_active = 1
         ORDER BY academic_session_id DESC`
      )
      .all(classId) as Array<{ fee_type_id: number; amount: number }>;

    if (prevStructs.length > 0) {
      for (const ps of prevStructs) {
        database.prepare(`
          INSERT OR IGNORE INTO fee_structures (
            academic_session_id, class_id, fee_type_id, amount, frequency, description, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Monthly', 'Class Fee Structure', 1, datetime('now'), datetime('now'))
        `).run(academicSessionId, classId, ps.fee_type_id, ps.amount);
      }
      structures = prevStructs;
    }
  }

  if (structures.length === 0) {
    // Fallback 2: check if any tuition fee structure exists in the current session (e.g. from Class 1)
    const anyClassStructs = database
      .prepare(
        `SELECT fee_type_id, amount 
         FROM fee_structures 
         WHERE academic_session_id = ? AND is_active = 1
         ORDER BY id ASC LIMIT 1`
      )
      .all(academicSessionId) as Array<{ fee_type_id: number; amount: number }>;

    if (anyClassStructs.length > 0) {
      for (const as of anyClassStructs) {
        database.prepare(`
          INSERT OR IGNORE INTO fee_structures (
            academic_session_id, class_id, fee_type_id, amount, frequency, description, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Monthly', 'Standard Class Fee', 1, datetime('now'), datetime('now'))
        `).run(academicSessionId, classId, as.fee_type_id, as.amount);
      }
      structures = anyClassStructs;
    }
  }

  if (structures.length === 0) {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'No active fee structures found for this Class. Please configure fee structures in the Fee Structures tab.',
    };
  }

  // 2. Fetch Active Enrolled Students
  let studentsSql = `
    SELECT 
      s.id as student_id,
      e.id as enrollment_id,
      e.section_id
    FROM student_enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.academic_session_id = ?
      AND e.class_id = ?
      AND e.status = 'Active'
      AND s.is_active = 1
  `;
  const studentsParams: unknown[] = [academicSessionId, classId];
  if (sectionId) {
    studentsSql += ' AND e.section_id = ?';
    studentsParams.push(sectionId);
  }

  const enrolledStudents = database.prepare(studentsSql).all(...studentsParams) as Array<{
    student_id: number;
    enrollment_id: number;
    section_id: number;
  }>;

  if (enrolledStudents.length === 0) {
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
      error: 'No active students enrolled in the selected criteria.',
    };
  }

  let createdCount = 0;
  let alreadyExistedCount = 0;
  let failedCount = 0;

  try {
    // Run all insertions in an ACID SQLite transaction
    const generateTx = database.transaction(() => {
      const checkStmt = database.prepare(`
        SELECT id FROM fee_records 
        WHERE student_id = ? AND fee_period_id = ? AND fee_type_id = ?
      `);

      const insertStmt = database.prepare(`
        INSERT INTO fee_records (
          student_id, enrollment_id, academic_session_id, class_id, section_id,
          fee_period_id, fee_type_id, original_amount, discount, fine,
          net_amount, paid_amount, remaining_balance, due_date, status, remarks
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, 0, 0,
          ?, 0, ?, ?, 'Unpaid', ''
        )
      `);

      const adjStmt = database.prepare(`
        SELECT amount FROM student_fee_adjustments
        WHERE student_id = ? AND fee_type_id = ? AND is_active = 1
        ORDER BY id DESC LIMIT 1
      `);

      for (const student of enrolledStudents) {
        for (const struct of structures) {
          const existing = checkStmt.get(student.student_id, feePeriodId, struct.fee_type_id);
          if (existing) {
            alreadyExistedCount++;
            continue;
          }

          // Check if student has a customized fee adjustment
          const customAdj = adjStmt.get(student.student_id, struct.fee_type_id) as { amount: number } | undefined;
          const origAmount = customAdj ? customAdj.amount : struct.amount;
          const netAmount = origAmount;
          const remaining = origAmount;

          insertStmt.run(
            student.student_id,
            student.enrollment_id,
            academicSessionId,
            classId,
            student.section_id,
            feePeriodId,
            struct.fee_type_id,
            origAmount,
            netAmount,
            remaining,
            effectiveDueDate
          );
          createdCount++;
        }
      }
    });

    generateTx();

    return {
      success: true,
      summary: {
        totalEligible: enrolledStudents.length * structures.length,
        createdCount,
        alreadyExistedCount,
        failedCount,
      },
    };
  } catch (err: unknown) {
    console.error('[FeeService] generateFeesForClass transaction error:', err);
    return {
      success: false,
      summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 1 },
      error: 'Transaction failed while generating fees. All changes rolled back.',
    };
  }
}

// ─── SECTION 6: FEE RECORDS & DUES QUERIES ─────────────────────────────────────

export function getFeeRecords(
  params?: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    feePeriodId?: number;
    studentId?: number;
    status?: FeeRecordStatus;
    searchQuery?: string;
    page?: number;
    limit?: number;
  },
  db?: Database.Database
): {
  success: boolean;
  records: FeeRecordItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  try {
    const database = db ?? getDatabase();
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];

    if (params?.academicSessionId) {
      whereClause += ' AND fr.academic_session_id = ?';
      queryParams.push(params.academicSessionId);
    }
    if (params?.classId) {
      whereClause += ' AND fr.class_id = ?';
      queryParams.push(params.classId);
    }
    if (params?.sectionId) {
      whereClause += ' AND fr.section_id = ?';
      queryParams.push(params.sectionId);
    }
    if (params?.feePeriodId) {
      whereClause += ' AND fr.fee_period_id = ?';
      queryParams.push(params.feePeriodId);
    }
    if (params?.studentId) {
      whereClause += ' AND fr.student_id = ?';
      queryParams.push(params.studentId);
    }
    if (params?.status) {
      whereClause += ' AND fr.status = ?';
      queryParams.push(params.status);
    }
    if (params?.searchQuery && params.searchQuery.trim()) {
      const q = `%${params.searchQuery.trim()}%`;
      whereClause += ` AND (
        s.student_id LIKE ? OR
        s.admission_number LIKE ? OR
        s.display_name LIKE ?
      )`;
      queryParams.push(q, q, q);
    }

    const countSql = `
      SELECT COUNT(*) as count 
      FROM fee_records fr
      JOIN students s ON s.id = fr.student_id
      ${whereClause}
    `;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const dataSql = `
      SELECT 
        fr.id,
        fr.student_id as studentId,
        fr.enrollment_id as enrollmentId,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as studentName,
        s.father_name as fatherName,
        fr.academic_session_id as academicSessionId,
        sess.name as academicSessionName,
        fr.class_id as classId,
        c.name as className,
        fr.section_id as sectionId,
        sec.name as sectionName,
        fr.fee_period_id as feePeriodId,
        fp.name as feePeriodName,
        fr.fee_type_id as feeTypeId,
        ft.name as feeTypeName,
        fr.original_amount as originalAmount,
        fr.discount,
        fr.fine,
        fr.net_amount as netAmount,
        fr.paid_amount as paidAmount,
        fr.remaining_balance as remainingBalance,
        fr.due_date as dueDate,
        fr.status,
        fr.remarks,
        fr.created_at as createdAt,
        fr.updated_at as updatedAt
      FROM fee_records fr
      JOIN students s ON s.id = fr.student_id
      JOIN academic_sessions sess ON sess.id = fr.academic_session_id
      JOIN classes c ON c.id = fr.class_id
      JOIN sections sec ON sec.id = fr.section_id
      JOIN fee_periods fp ON fp.id = fr.fee_period_id
      JOIN fee_types ft ON ft.id = fr.fee_type_id
      ${whereClause}
      ORDER BY fr.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as FeeRecordItem[];

    return {
      success: true,
      records: rows,
      totalCount,
      page,
      totalPages,
    };
  } catch (err: unknown) {
    console.error('[FeeService] getFeeRecords error:', err);
    return { success: false, records: [], totalCount: 0, page: 1, totalPages: 1, error: 'Database error querying fee records.' };
  }
}

export function getFeeDues(
  params?: {
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    feePeriodId?: number;
    dueStatus?: 'All' | 'Overdue' | 'Unpaid' | 'Partially Paid';
    searchQuery?: string;
    page?: number;
    limit?: number;
  },
  db?: Database.Database
): {
  success: boolean;
  records: FeeRecordItem[];
  totalOutstandingAmount: number;
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  try {
    const database = db ?? getDatabase();
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
    const offset = (page - 1) * limit;
    const todayStr = new Date().toISOString().split('T')[0];

    let whereClause = 'WHERE fr.remaining_balance > 0 AND fr.status NOT IN (\'Waived\', \'Cancelled\')';
    const queryParams: unknown[] = [];

    if (params?.academicSessionId) {
      whereClause += ' AND fr.academic_session_id = ?';
      queryParams.push(params.academicSessionId);
    }
    if (params?.classId) {
      whereClause += ' AND fr.class_id = ?';
      queryParams.push(params.classId);
    }
    if (params?.sectionId) {
      whereClause += ' AND fr.section_id = ?';
      queryParams.push(params.sectionId);
    }
    if (params?.feePeriodId) {
      whereClause += ' AND fr.fee_period_id = ?';
      queryParams.push(params.feePeriodId);
    }
    if (params?.dueStatus === 'Overdue') {
      whereClause += ' AND fr.due_date < ?';
      queryParams.push(todayStr);
    } else if (params?.dueStatus === 'Unpaid') {
      whereClause += ' AND fr.status = \'Unpaid\'';
    } else if (params?.dueStatus === 'Partially Paid') {
      whereClause += ' AND fr.status = \'Partially Paid\'';
    }
    if (params?.searchQuery && params.searchQuery.trim()) {
      const q = `%${params.searchQuery.trim()}%`;
      whereClause += ` AND (
        s.student_id LIKE ? OR
        s.admission_number LIKE ? OR
        s.display_name LIKE ?
      )`;
      queryParams.push(q, q, q);
    }

    // Outstanding total sum
    const sumSql = `
      SELECT SUM(fr.remaining_balance) as totalOutstanding, COUNT(*) as count
      FROM fee_records fr
      JOIN students s ON s.id = fr.student_id
      ${whereClause}
    `;
    const sumRow = database.prepare(sumSql).get(...queryParams) as { totalOutstanding: number | null; count: number };
    const totalCount = sumRow.count ?? 0;
    const totalOutstandingAmount = sumRow.totalOutstanding ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const dataSql = `
      SELECT 
        fr.id,
        fr.student_id as studentId,
        fr.enrollment_id as enrollmentId,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as studentName,
        s.father_name as fatherName,
        fr.academic_session_id as academicSessionId,
        sess.name as academicSessionName,
        fr.class_id as classId,
        c.name as className,
        fr.section_id as sectionId,
        sec.name as sectionName,
        fr.fee_period_id as feePeriodId,
        fp.name as feePeriodName,
        fr.fee_type_id as feeTypeId,
        ft.name as feeTypeName,
        fr.original_amount as originalAmount,
        fr.discount,
        fr.fine,
        fr.net_amount as netAmount,
        fr.paid_amount as paidAmount,
        fr.remaining_balance as remainingBalance,
        fr.due_date as dueDate,
        fr.status,
        fr.remarks,
        fr.created_at as createdAt,
        fr.updated_at as updatedAt
      FROM fee_records fr
      JOIN students s ON s.id = fr.student_id
      JOIN academic_sessions sess ON sess.id = fr.academic_session_id
      JOIN classes c ON c.id = fr.class_id
      JOIN sections sec ON sec.id = fr.section_id
      JOIN fee_periods fp ON fp.id = fr.fee_period_id
      JOIN fee_types ft ON ft.id = fr.fee_type_id
      ${whereClause}
      ORDER BY fr.due_date ASC, fr.remaining_balance DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as FeeRecordItem[];

    return {
      success: true,
      records: rows,
      totalOutstandingAmount,
      totalCount,
      page,
      totalPages,
    };
  } catch (err: unknown) {
    console.error('[FeeService] getFeeDues error:', err);
    return {
      success: false,
      records: [],
      totalOutstandingAmount: 0,
      totalCount: 0,
      page: 1,
      totalPages: 1,
      error: 'Database error querying fee dues.',
    };
  }
}

// ─── SECTION 7: TRANSACTIONAL PAYMENT RECORDING ────────────────────────────────

export function recordFeePayment(
  params: {
    sessionToken?: string;
    feeRecordId: number;
    amount: number; // Minor units (paisa)
    paymentDate: string;
    paymentMethod: PaymentMethod;
    referenceNotes?: string;
  },
  db?: Database.Database
): {
  success: boolean;
  payment?: FeePaymentItem;
  receiptNumber?: string;
  remainingBalance?: number;
  error?: string;
} {
  const sessionCheck = verifySession(params.sessionToken);
  if (!sessionCheck.isValid) {
    return { success: false, error: 'Unauthorized. Please log in as an administrator.' };
  }

  const database = db ?? getDatabase();
  const feeRecordId = Number(params.feeRecordId);
  const paymentAmount = Math.round(Number(params.amount));
  const paymentDate = (params.paymentDate || '').trim();
  const paymentMethod = params.paymentMethod;
  const referenceNotes = (params.referenceNotes || '').trim();

  // Basic validations
  if (!feeRecordId) return { success: false, error: 'Please select a valid fee record.' };
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' };
  }
  if (!paymentDate) return { success: false, error: 'Payment date is required.' };
  if (!['Cash', 'Bank Transfer', 'Cheque', 'Other'].includes(paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' };
  }

  try {
    let resultReceipt = '';
    let newRemainingBalance = 0;
    let paymentId = 0;

    // Database transaction to guarantee atomic financial state
    const paymentTx = database.transaction(() => {
      // 1. Lock and load trusted fee record from SQLite
      const record = database
        .prepare(
          `SELECT 
             fr.id, fr.student_id, fr.enrollment_id, fr.net_amount, 
             fr.paid_amount, fr.remaining_balance, fr.status
           FROM fee_records fr 
           WHERE fr.id = ?`
        )
        .get(feeRecordId) as {
        id: number;
        student_id: number;
        enrollment_id: number;
        net_amount: number;
        paid_amount: number;
        remaining_balance: number;
        status: FeeRecordStatus;
      } | undefined;

      if (!record) {
        throw new Error('Fee record not found.');
      }

      if (['Waived', 'Cancelled'].includes(record.status)) {
        throw new Error(`Cannot accept payment for a ${record.status.toLowerCase()} fee record.`);
      }

      // 2. Validate against existing actual payments
      const existingPaymentsRow = database
        .prepare('SELECT COALESCE(SUM(amount), 0) as totalPaid FROM fee_payments WHERE fee_record_id = ?')
        .get(feeRecordId) as { totalPaid: number };

      const realPaidAmount = existingPaymentsRow.totalPaid;
      const realRemaining = Math.max(0, record.net_amount - realPaidAmount);

      if (realRemaining === 0) {
        throw new Error('This fee record has already been fully paid.');
      }

      // 3. Overpayment rejection
      if (paymentAmount > realRemaining) {
        throw new Error('Payment amount cannot be greater than the remaining balance.');
      }

      // 4. Generate unique receipt number
      const targetYear = paymentDate.split('-')[0] || new Date().getFullYear().toString();
      const receiptNumber = generateNextReceiptNumber(targetYear, database);
      resultReceipt = receiptNumber;

      // 5. Insert payment row
      const receivedBy = sessionCheck.user?.id ?? null;
      const paymentInfo = database
        .prepare(
          `INSERT INTO fee_payments (
             receipt_number, student_id, enrollment_id, fee_record_id,
             payment_date, amount, payment_method, reference_notes, received_by_user_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          receiptNumber,
          record.student_id,
          record.enrollment_id,
          feeRecordId,
          paymentDate,
          paymentAmount,
          paymentMethod,
          referenceNotes,
          receivedBy
        );

      paymentId = Number(paymentInfo.lastInsertRowid);

      // 6. Recalculate totals
      const updatedTotalPaid = realPaidAmount + paymentAmount;
      newRemainingBalance = Math.max(0, record.net_amount - updatedTotalPaid);

      let newStatus: FeeRecordStatus = 'Unpaid';
      if (newRemainingBalance === 0) {
        newStatus = 'Paid';
      } else if (updatedTotalPaid > 0) {
        newStatus = 'Partially Paid';
      }

      // 7. Update fee record
      database
        .prepare(
          `UPDATE fee_records 
           SET paid_amount = ?, remaining_balance = ?, status = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(updatedTotalPaid, newRemainingBalance, newStatus, feeRecordId);
    });

    paymentTx();

    const paymentRes = getFeePaymentById(paymentId, database);

    return {
      success: true,
      payment: paymentRes.payment,
      receiptNumber: resultReceipt,
      remainingBalance: newRemainingBalance,
    };
  } catch (err: unknown) {
    console.error('[FeeService] recordFeePayment error (rolled back):', err);
    const msg = err instanceof Error ? err.message : 'Database error recording payment.';
    return { success: false, error: msg };
  }
}

// ─── SECTION 8: PAYMENTS & RECEIPT RETRIEVAL ───────────────────────────────────

export function getFeePaymentById(
  paymentId: number,
  db?: Database.Database
): { success: boolean; payment?: FeePaymentItem; error?: string } {
  try {
    const database = db ?? getDatabase();
    const row = database
      .prepare(
        `SELECT 
           fp.id,
           fp.receipt_number as receiptNumber,
           fp.student_id as studentId,
           fp.enrollment_id as enrollmentId,
           fp.fee_record_id as feeRecordId,
           fp.payment_date as paymentDate,
           fp.amount,
           fp.payment_method as paymentMethod,
           fp.reference_notes as referenceNotes,
           fp.received_by_user_id as receivedByUserId,
           u.username as receivedByUsername,
           fp.created_at as createdAt,
           s.student_id as systemStudentId,
           s.admission_number as admissionNumber,
           s.display_name as studentName,
           s.father_name as fatherName,
           c.name as className,
           sec.name as sectionName,
           sess.name as academicSessionName,
           ft.name as feeTypeName,
           period.name as feePeriodName,
           fr.original_amount as originalAmount,
           fr.discount,
           fr.fine,
           fr.net_amount as netAmount,
           fr.remaining_balance as remainingBalanceAfterPayment
         FROM fee_payments fp
         JOIN students s ON s.id = fp.student_id
         JOIN fee_records fr ON fr.id = fp.fee_record_id
         JOIN classes c ON c.id = fr.class_id
         JOIN sections sec ON sec.id = fr.section_id
         JOIN academic_sessions sess ON sess.id = fr.academic_session_id
         JOIN fee_types ft ON ft.id = fr.fee_type_id
         JOIN fee_periods period ON period.id = fr.fee_period_id
         LEFT JOIN users u ON u.id = fp.received_by_user_id
         WHERE fp.id = ?`
      )
      .get(paymentId) as FeePaymentItem | undefined;

    if (!row) return { success: false, error: 'Payment not found.' };
    return { success: true, payment: row };
  } catch (err: unknown) {
    console.error('[FeeService] getFeePaymentById error:', err);
    return { success: false, error: 'Database error loading payment.' };
  }
}

export function getReceiptByNumber(
  receiptNumber: string,
  db?: Database.Database
): { success: boolean; receipt?: FeePaymentItem; error?: string } {
  try {
    const database = db ?? getDatabase();
    const cleanNumber = (receiptNumber || '').trim();

    const row = database
      .prepare(
        `SELECT 
           fp.id,
           fp.receipt_number as receiptNumber,
           fp.student_id as studentId,
           fp.enrollment_id as enrollmentId,
           fp.fee_record_id as feeRecordId,
           fp.payment_date as paymentDate,
           fp.amount,
           fp.payment_method as paymentMethod,
           fp.reference_notes as referenceNotes,
           fp.received_by_user_id as receivedByUserId,
           u.username as receivedByUsername,
           fp.created_at as createdAt,
           s.student_id as systemStudentId,
           s.admission_number as admissionNumber,
           s.display_name as studentName,
           s.father_name as fatherName,
           c.name as className,
           sec.name as sectionName,
           sess.name as academicSessionName,
           ft.name as feeTypeName,
           period.name as feePeriodName,
           fr.original_amount as originalAmount,
           fr.discount,
           fr.fine,
           fr.net_amount as netAmount,
           fr.remaining_balance as remainingBalanceAfterPayment
         FROM fee_payments fp
         JOIN students s ON s.id = fp.student_id
         JOIN fee_records fr ON fr.id = fp.fee_record_id
         JOIN classes c ON c.id = fr.class_id
         JOIN sections sec ON sec.id = fr.section_id
         JOIN academic_sessions sess ON sess.id = fr.academic_session_id
         JOIN fee_types ft ON ft.id = fr.fee_type_id
         JOIN fee_periods period ON period.id = fr.fee_period_id
         LEFT JOIN users u ON u.id = fp.received_by_user_id
         WHERE fp.receipt_number = ? COLLATE NOCASE`
      )
      .get(cleanNumber) as FeePaymentItem | undefined;

    if (!row) return { success: false, error: 'Receipt not found.' };
    return { success: true, receipt: row };
  } catch (err: unknown) {
    console.error('[FeeService] getReceiptByNumber error:', err);
    return { success: false, error: 'Database error loading receipt.' };
  }
}

export function searchPaymentHistory(
  params?: {
    searchQuery?: string;
    academicSessionId?: number;
    classId?: number;
    sectionId?: number;
    paymentMethod?: PaymentMethod;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  },
  db?: Database.Database
): {
  success: boolean;
  payments: FeePaymentItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
} {
  try {
    const database = db ?? getDatabase();
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];

    if (params?.academicSessionId) {
      whereClause += ' AND fr.academic_session_id = ?';
      queryParams.push(params.academicSessionId);
    }
    if (params?.classId) {
      whereClause += ' AND fr.class_id = ?';
      queryParams.push(params.classId);
    }
    if (params?.sectionId) {
      whereClause += ' AND fr.section_id = ?';
      queryParams.push(params.sectionId);
    }
    if (params?.paymentMethod) {
      whereClause += ' AND fp.payment_method = ?';
      queryParams.push(params.paymentMethod);
    }
    if (params?.dateFrom) {
      whereClause += ' AND fp.payment_date >= ?';
      queryParams.push(params.dateFrom);
    }
    if (params?.dateTo) {
      whereClause += ' AND fp.payment_date <= ?';
      queryParams.push(params.dateTo);
    }
    if (params?.searchQuery && params.searchQuery.trim()) {
      const q = `%${params.searchQuery.trim()}%`;
      whereClause += ` AND (
        fp.receipt_number LIKE ? OR
        s.student_id LIKE ? OR
        s.admission_number LIKE ? OR
        s.display_name LIKE ? OR
        fp.reference_notes LIKE ?
      )`;
      queryParams.push(q, q, q, q, q);
    }

    const countSql = `
      SELECT COUNT(*) as count 
      FROM fee_payments fp
      JOIN students s ON s.id = fp.student_id
      JOIN fee_records fr ON fr.id = fp.fee_record_id
      ${whereClause}
    `;
    const totalRow = database.prepare(countSql).get(...queryParams) as { count: number };
    const totalCount = totalRow.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const dataSql = `
      SELECT 
        fp.id,
        fp.receipt_number as receiptNumber,
        fp.student_id as studentId,
        fp.enrollment_id as enrollmentId,
        fp.fee_record_id as feeRecordId,
        fp.payment_date as paymentDate,
        fp.amount,
        fp.payment_method as paymentMethod,
        fp.reference_notes as referenceNotes,
        fp.received_by_user_id as receivedByUserId,
        u.username as receivedByUsername,
        fp.created_at as createdAt,
        s.student_id as systemStudentId,
        s.admission_number as admissionNumber,
        s.display_name as studentName,
        s.father_name as fatherName,
        c.name as className,
        sec.name as sectionName,
        sess.name as academicSessionName,
        ft.name as feeTypeName,
        period.name as feePeriodName,
        fr.original_amount as originalAmount,
        fr.discount,
        fr.fine,
        fr.net_amount as netAmount,
        fr.remaining_balance as remainingBalanceAfterPayment
      FROM fee_payments fp
      JOIN students s ON s.id = fp.student_id
      JOIN fee_records fr ON fr.id = fp.fee_record_id
      JOIN classes c ON c.id = fr.class_id
      JOIN sections sec ON sec.id = fr.section_id
      JOIN academic_sessions sess ON sess.id = fr.academic_session_id
      JOIN fee_types ft ON ft.id = fr.fee_type_id
      JOIN fee_periods period ON period.id = fr.fee_period_id
      LEFT JOIN users u ON u.id = fp.received_by_user_id
      ${whereClause}
      ORDER BY fp.payment_date DESC, fp.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = database.prepare(dataSql).all(...queryParams, limit, offset) as FeePaymentItem[];

    return {
      success: true,
      payments: rows,
      totalCount,
      page,
      totalPages,
    };
  } catch (err: unknown) {
    console.error('[FeeService] searchPaymentHistory error:', err);
    return { success: false, payments: [], totalCount: 0, page: 1, totalPages: 1, error: 'Database error searching payments.' };
  }
}

// ─── SECTION 9: STUDENT FEE PROFILE & SUMMARY ──────────────────────────────────

export function getStudentFeeProfile(
  studentId: number,
  db?: Database.Database
): {
  success: boolean;
  summary: StudentFeeSummary;
  records: FeeRecordItem[];
  payments: FeePaymentItem[];
  error?: string;
} {
  try {
    const database = db ?? getDatabase();
    const cleanId = Number(studentId);

    if (!cleanId) {
      return {
        success: false,
        summary: { studentId: 0, totalBilled: 0, totalDiscount: 0, totalFine: 0, totalPaid: 0, totalOutstanding: 0 },
        records: [],
        payments: [],
        error: 'Student ID is required.',
      };
    }

    // Records
    const recordsRes = getFeeRecords({ studentId: cleanId, limit: 100 }, database);
    const records = recordsRes.records;

    // Payments
    const payments = database
      .prepare(
        `SELECT 
           fp.id,
           fp.receipt_number as receiptNumber,
           fp.student_id as studentId,
           fp.enrollment_id as enrollmentId,
           fp.fee_record_id as feeRecordId,
           fp.payment_date as paymentDate,
           fp.amount,
           fp.payment_method as paymentMethod,
           fp.reference_notes as referenceNotes,
           fp.received_by_user_id as receivedByUserId,
           u.username as receivedByUsername,
           fp.created_at as createdAt,
           ft.name as feeTypeName,
           period.name as feePeriodName
         FROM fee_payments fp
         JOIN fee_records fr ON fr.id = fp.fee_record_id
         JOIN fee_types ft ON ft.id = fr.fee_type_id
         JOIN fee_periods period ON period.id = fr.fee_period_id
         LEFT JOIN users u ON u.id = fp.received_by_user_id
         WHERE fp.student_id = ?
         ORDER BY fp.payment_date DESC, fp.id DESC`
      )
      .all(cleanId) as FeePaymentItem[];

    // Calculate aggregations
    let totalBilled = 0;
    let totalDiscount = 0;
    let totalFine = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const r of records) {
      if (r.status !== 'Waived' && r.status !== 'Cancelled') {
        totalBilled += r.originalAmount;
        totalDiscount += r.discount;
        totalFine += r.fine;
        totalPaid += r.paidAmount;
        totalOutstanding += r.remainingBalance;
      }
    }

    return {
      success: true,
      summary: {
        studentId: cleanId,
        totalBilled,
        totalDiscount,
        totalFine,
        totalPaid,
        totalOutstanding,
      },
      records,
      payments,
    };
  } catch (err: unknown) {
    console.error('[FeeService] getStudentFeeProfile error:', err);
    return {
      success: false,
      summary: { studentId: 0, totalBilled: 0, totalDiscount: 0, totalFine: 0, totalPaid: 0, totalOutstanding: 0 },
      records: [],
      payments: [],
      error: 'Database error querying student fee profile.',
    };
  }
}
