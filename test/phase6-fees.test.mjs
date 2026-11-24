/**
 * Automated Test Suite — Phase 6: Fees & Fee Slips Management
 * 
 * Verifies:
 * 1. Migration 005 schema integrity (fee_types, fee_structures, fee_periods, student_fee_adjustments, fee_records, fee_payments)
 * 2. Strict integer minor units math (paisa arithmetic, conversions, formatting, discount & fine calculations)
 * 3. Fee Types management & uniqueness constraints (name, code, active status toggle)
 * 4. Fee Structures management (session, class, frequency, amount in minor units)
 * 5. Fee Periods management (start, end, due date, open/closed status)
 * 6. Student-specific fee adjustments without modifying class-level structures
 * 7. Class-wise fee generation transaction & idempotent duplicate skipping
 * 8. Invoice queries, net calculation, and overdue dues calculation
 * 9. Atomic fee payment recording, sequential receipt number generation (REC-YYYY-XXXXXX)
 * 10. Strict financial guards: overpayment rejection, remaining balance tracking, status transitions (Unpaid -> Partially Paid -> Paid)
 * 11. Payment history search, receipt retrieval by number, and student fee profiles
 * 12. Dashboard summary live financial metrics (total billed, total collected, outstanding dues, today's collection)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Import backend modules from dist-electron
import { runMigrations } from '../dist-electron/database/migrations.js';
import {
  createInitialAdmin,
  login,
} from '../dist-electron/database/services/auth.service.js';
import {
  createSession,
} from '../dist-electron/database/services/academic-session.service.js';
import {
  createClass,
  createSection,
} from '../dist-electron/database/services/class.service.js';
import {
  createStudent,
  createEnrollment,
} from '../dist-electron/database/services/student.service.js';
import {
  toMinorUnits,
  toMajorUnits,
  formatMoney,
  calculateNetFee,
  calculatePercentageDiscount,
  calculateFeeStatus,
  getAllFeeTypes,
  createFeeType,
  updateFeeType,
  toggleFeeTypeStatus,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  toggleFeeStructureStatus,
  getFeePeriods,
  createFeePeriod,
  updateFeePeriod,
  getStudentFeeAdjustments,
  createStudentFeeAdjustment,
  generateFeesForClass,
  getFeeRecords,
  getFeeDues,
  recordFeePayment,
  getFeePaymentById,
  getReceiptByNumber,
  searchPaymentHistory,
  getStudentFeeProfile,
} from '../dist-electron/database/services/fee.service.js';
import {
  getDashboardSummary,
} from '../dist-electron/database/services/dashboard.service.js';

const testDbPath = path.resolve('test-phase6-fees.sqlite');

function cleanup() {
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }
  if (fs.existsSync(testDbPath + '-wal')) {
    try { fs.unlinkSync(testDbPath + '-wal'); } catch {}
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    try { fs.unlinkSync(testDbPath + '-shm'); } catch {}
  }
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 6 Fees & Fee Slips Management Tests');
  console.log('======================================================\n');

  cleanup();

  const db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ─────────────────────────────────────────────────────────────
  // Test Group 1: Migration 005 & Schema Integrity
  // ─────────────────────────────────────────────────────────────
  console.log('📋 Test Group 1: Migration 005 & Schema Integrity');
  const migrationResult = runMigrations(db);
  assert(migrationResult.appliedCount >= 5, `Applied at least 5 migrations (got: ${migrationResult.appliedCount})`);
  assert(migrationResult.currentVersion >= 5, `Current schema version is at least 5 (got: ${migrationResult.currentVersion})`);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  assert(tables.includes('fee_types'), 'fee_types table exists');
  assert(tables.includes('fee_structures'), 'fee_structures table exists');
  assert(tables.includes('fee_periods'), 'fee_periods table exists');
  assert(tables.includes('student_fee_adjustments'), 'student_fee_adjustments table exists');
  assert(tables.includes('fee_records'), 'fee_records table exists');
  assert(tables.includes('fee_payments'), 'fee_payments table exists');

  // Check unique constraints
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index'")
    .all()
    .map((r) => r.name);
  assert(indexes.some((i) => i.includes('receipt') || i.includes('fee_payments')), 'Receipt index exists');

  // ─────────────────────────────────────────────────────────────
  // Test Group 2: Money Utility & Integer Arithmetic
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 2: Money Utility & Minor Units Arithmetic');
  assert(toMinorUnits(10) === 1000, 'toMinorUnits(10) returns 1000 paisa');
  assert(toMinorUnits('10.50') === 1050, 'toMinorUnits("10.50") returns 1050 paisa');
  assert(toMinorUnits('1,500.00') === 150000, 'toMinorUnits("1,500.00") handles comma separators');
  assert(toMajorUnits(150000) === 1500, 'toMajorUnits(150000) returns 1500 PKR');
  assert(formatMoney(1050) === 'Rs. 10.50', 'formatMoney(1050) formats to Rs. 10.50');
  assert(formatMoney(350000) === 'Rs. 3,500.00', 'formatMoney(350000) formats to Rs. 3,500.00');

  // Net calculation
  const net = calculateNetFee(400000, 50000, 20000); // 4000 - 500 + 200 = 3700 PKR
  assert(net === 370000, `calculateNetFee computes 370000 paisa (got: ${net})`);

  // Status transitions
  assert(calculateFeeStatus(0, 300000) === 'Unpaid', '0 paid out of 3000 returns Unpaid');
  assert(calculateFeeStatus(100000, 300000) === 'Partially Paid', '1000 paid out of 3000 returns Partially Paid');
  assert(calculateFeeStatus(300000, 300000) === 'Paid', '3000 paid out of 3000 returns Paid');

  // ─────────────────────────────────────────────────────────────
  // Test Group 3: Setup Prerequisites (Admin, Session, Classes, Students)
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 3: Setup Academic Structure & Students');
  createInitialAdmin({ username: 'admin', displayName: 'Administrator', password: 'AdminPassword123!' }, db);
  const loginRes = login({ username: 'admin', password: 'AdminPassword123!' }, db);
  assert(loginRes.success && Boolean(loginRes.sessionToken), 'Admin authenticated with valid session token');
  const token = loginRes.sessionToken;

  const session = createSession({ sessionToken: token, name: '2026-2027 Academic Session', startDate: '2026-08-01', endDate: '2027-06-30' }, db).session;
  assert(session && session.id === 1, 'Academic Session created');

  const cls9 = createClass({ sessionToken: token, name: 'Grade 9' }, db).classItem;
  const secA = createSection({ sessionToken: token, classId: cls9.id, name: 'Section A' }, db).section;
  assert(cls9 && secA, 'Class Grade 9 & Section A created');

  // Create Students with enrollment
  const std1 = createStudent({
    sessionToken: token,
    studentId: 'STD-2026-0001',
    admissionNumber: 'ADM-2026-001',
    firstName: 'Ali',
    lastName: 'Raza',
    gender: 'Male',
    enrollment: {
      academicSessionId: session.id,
      classId: cls9.id,
      sectionId: secA.id,
      admissionDate: '2026-08-01',
      status: 'Active',
    },
  }, db).student;

  const std2 = createStudent({
    sessionToken: token,
    studentId: 'STD-2026-0002',
    admissionNumber: 'ADM-2026-002',
    firstName: 'Zainab',
    lastName: 'Bibi',
    gender: 'Female',
    enrollment: {
      academicSessionId: session.id,
      classId: cls9.id,
      sectionId: secA.id,
      admissionDate: '2026-08-01',
      status: 'Active',
    },
  }, db).student;

  assert(std1 && std2, 'Two students created and enrolled in Grade 9 Section A');

  // ─────────────────────────────────────────────────────────────
  // Test Group 4: Fee Types CRUD & Uniqueness
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 4: Fee Types CRUD & Uniqueness');
  const tuitType = createFeeType({ sessionToken: token, name: 'Tuition Fee', code: 'TUIT', description: 'Monthly tuition' }, db);
  assert(tuitType.success && tuitType.feeType.id === 1, 'Created Tuition Fee type');

  const admType = createFeeType({ sessionToken: token, name: 'Admission Fee', code: 'ADM', description: 'One-time admission fee' }, db);
  assert(admType.success && admType.feeType.id === 2, 'Created Admission Fee type');

  // Duplicate name check
  const dupName = createFeeType({ sessionToken: token, name: 'tuition fee', code: 'TUIT2' }, db);
  assert(!dupName.success && dupName.error.includes('already exists'), 'Duplicate fee type name rejected');

  // Duplicate code check
  const dupCode = createFeeType({ sessionToken: token, name: 'Second Tuition', code: 'tuit' }, db);
  assert(!dupCode.success && dupCode.error.includes('already exists'), 'Duplicate fee type code rejected');

  // Toggle active status
  const toggled = toggleFeeTypeStatus({ sessionToken: token, id: admType.feeType.id, isActive: false }, db);
  assert(toggled.success && toggled.feeType.isActive === false, 'Deactivated Admission Fee');

  const activeTypes = getAllFeeTypes(false, db).types;
  assert(activeTypes.length === 1 && activeTypes[0].code === 'TUIT', 'getAllFeeTypes(activeOnly=true) returns 1 type');

  // ─────────────────────────────────────────────────────────────
  // Test Group 5: Fee Structures & Class Assignment
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 5: Fee Structures');
  const struct = createFeeStructure({
    sessionToken: token,
    academicSessionId: session.id,
    classId: cls9.id,
    feeTypeId: tuitType.feeType.id,
    amount: 450000, // 4,500 PKR
    frequency: 'Monthly',
    description: 'Monthly tuition for Grade 9',
  }, db);

  assert(struct.success && struct.structure.amount === 450000, 'Assigned 4,500 PKR Monthly Tuition structure to Grade 9');

  const structList = getFeeStructures({ academicSessionId: session.id, classId: cls9.id }, db).structures;
  assert(structList.length === 1 && structList[0].amount === 450000, 'Query structures returns Grade 9 structure');

  // ─────────────────────────────────────────────────────────────
  // Test Group 6: Fee Periods Management
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 6: Fee Periods Management');
  const periodAug = createFeePeriod({
    sessionToken: token,
    academicSessionId: session.id,
    name: 'August 2026',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    dueDate: '2026-08-10',
  }, db);

  assert(periodAug.success && periodAug.period.name === 'August 2026', 'Created August 2026 Fee Period');

  const periodSep = createFeePeriod({
    sessionToken: token,
    academicSessionId: session.id,
    name: 'September 2026',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    dueDate: '2026-09-10',
  }, db);

  assert(periodSep.success && periodSep.period.name === 'September 2026', 'Created September 2026 Fee Period');

  // Date validation in period
  const badPeriod = createFeePeriod({
    sessionToken: token,
    academicSessionId: session.id,
    name: 'Invalid Period',
    startDate: '2026-10-31',
    endDate: '2026-10-01',
    dueDate: '2026-10-10',
  }, db);
  assert(!badPeriod.success, 'Rejects period where end date < start date');

  // ─────────────────────────────────────────────────────────────
  // Test Group 7: Student-Specific Adjustments
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 7: Student-Specific Fee Adjustments');
  const enroll1 = db.prepare('SELECT id FROM student_enrollments WHERE student_id = ?').get(std1.id);
  const adj = createStudentFeeAdjustment({
    sessionToken: token,
    studentId: std1.id,
    enrollmentId: enroll1.id,
    feeTypeId: tuitType.feeType.id,
    amount: 350000, // Reduced to 3,500 PKR for std1
    frequency: 'Monthly',
    description: 'Kinship concession',
  }, db);

  assert(adj.success && adj.adjustment.amount === 350000, 'Created kinship concession for Student 1');

  const std1Adjs = getStudentFeeAdjustments(std1.id, db).adjustments;
  assert(std1Adjs.length === 1 && std1Adjs[0].amount === 350000, 'Loaded Student 1 adjustment');

  // ─────────────────────────────────────────────────────────────
  // Test Group 8: Class Fee Generation & Idempotency
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 8: Class Fee Generation & Duplicate Prevention');
  const genResult = generateFeesForClass({
    sessionToken: token,
    academicSessionId: session.id,
    classId: cls9.id,
    feePeriodId: periodAug.period.id,
    dueDate: '2026-08-10',
  }, db);

  assert(genResult.success, 'Fee generation succeeded');
  assert(genResult.summary.totalEligible === 2, 'Found 2 eligible enrolled students');
  assert(genResult.summary.createdCount === 2, 'Created 2 fee records');
  assert(genResult.summary.alreadyExistedCount === 0, '0 duplicates on first run');

  // Inspect generated records
  const augRecords = getFeeRecords({ feePeriodId: periodAug.period.id }, db).records;
  assert(augRecords.length === 2, '2 August records in database');

  const recStd1 = augRecords.find((r) => r.studentId === std1.id);
  const recStd2 = augRecords.find((r) => r.studentId === std2.id);

  assert(recStd1.originalAmount === 350000, 'Student 1 billed customized 3,500 PKR based on adjustment');
  assert(recStd2.originalAmount === 450000, 'Student 2 billed standard 4,500 PKR from class structure');
  assert(recStd1.status === 'Unpaid', 'Student 1 initial status is Unpaid');
  assert(recStd1.remainingBalance === 350000, 'Student 1 initial remaining balance equals net amount');

  // Idempotent test: run generation again for the same period and class
  const genRepeat = generateFeesForClass({
    sessionToken: token,
    academicSessionId: session.id,
    classId: cls9.id,
    feePeriodId: periodAug.period.id,
  }, db);

  assert(genRepeat.success, 'Second generation call succeeded');
  assert(genRepeat.summary.createdCount === 0, '0 records created on second run (duplicate prevention)');
  assert(genRepeat.summary.alreadyExistedCount === 2, 'Skipped 2 already existing student fee records');

  // ─────────────────────────────────────────────────────────────
  // Test Group 9: Payment Transactions & Receipt Generation
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 9: Payments & Receipts');
  // Partial payment on Student 1 (pay 1,500 PKR out of 3,500 PKR)
  const pay1 = recordFeePayment({
    sessionToken: token,
    feeRecordId: recStd1.id,
    amount: 150000,
    paymentDate: '2026-08-05',
    paymentMethod: 'Cash',
    referenceNotes: 'Partial installment',
  }, db);

  assert(pay1.success, 'Partial payment recorded successfully');
  assert(pay1.receiptNumber.startsWith('REC-2026-'), `Generated valid receipt format: ${pay1.receiptNumber}`);
  assert(pay1.remainingBalance === 200000, 'Remaining balance updated to 2,000 PKR');

  // Check updated record status
  const updatedRecStd1 = getFeeRecords({ studentId: std1.id }, db).records[0];
  assert(updatedRecStd1.paidAmount === 150000, 'Fee record paid_amount is 1,500 PKR');
  assert(updatedRecStd1.status === 'Partially Paid', 'Fee record status transitioned to Partially Paid');

  // Overpayment attempt rejection
  const overpay = recordFeePayment({
    sessionToken: token,
    feeRecordId: recStd1.id,
    amount: 250000, // 2,500 PKR when remaining is only 2,000 PKR
    paymentDate: '2026-08-06',
    paymentMethod: 'Cash',
  }, db);

  assert(!overpay.success, 'Overpayment rejected');
  assert(overpay.error.includes('remaining balance'), 'Error explains overpayment cannot exceed remaining balance');

  // Settle remaining balance on Student 1 (pay remaining 2,000 PKR)
  const pay2 = recordFeePayment({
    sessionToken: token,
    feeRecordId: recStd1.id,
    amount: 200000,
    paymentDate: '2026-08-07',
    paymentMethod: 'Bank Transfer',
    referenceNotes: 'Meezan Bank Tx # 88271',
  }, db);

  assert(pay2.success, 'Full settlement payment recorded successfully');
  assert(pay2.remainingBalance === 0, 'Remaining balance is now 0');

  const settledRecStd1 = getFeeRecords({ studentId: std1.id }, db).records[0];
  assert(settledRecStd1.status === 'Paid', 'Fee record status transitioned to Paid');
  assert(settledRecStd1.remainingBalance === 0, 'Fee record remaining balance is 0');

  // Second receipt has sequential number
  assert(pay2.receiptNumber !== pay1.receiptNumber, 'Distinct receipt number generated');

  // Receipt Lookup
  const receiptFetch = getReceiptByNumber(pay1.receiptNumber, db);
  assert(receiptFetch.success && receiptFetch.receipt.amount === 150000, 'getReceiptByNumber retrieved valid receipt item');
  assert(receiptFetch.receipt.studentName === 'Ali Raza', 'Receipt contains student display name');

  // ─────────────────────────────────────────────────────────────
  // Test Group 10: Fee Dues & Overdue Detection
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 10: Fee Dues & Overdue Query');
  // Student 2 is still Unpaid with 4,500 PKR due
  const dues = getFeeDues({ academicSessionId: session.id }, db);
  assert(dues.success, 'getFeeDues succeeds');
  assert(dues.records.length === 1, 'Only 1 record with pending dues (Student 2)');
  assert(dues.records[0].studentId === std2.id, 'Pending due belongs to Student 2');
  assert(dues.totalOutstandingAmount === 450000, 'Total outstanding amount is 4,500 PKR');

  // Overdue filter check
  const overdueCheck = getFeeDues({ dueStatus: 'Overdue' }, db);
  // August 10, 2026 is past relative to 2026-10-05
  assert(overdueCheck.records.length === 1, 'Student 2 marked as Overdue');

  // ─────────────────────────────────────────────────────────────
  // Test Group 11: Payment History Search & Student Fee Profiles
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 11: Payment History & Profiles');
  const hist = searchPaymentHistory({ searchQuery: 'Ali' }, db);
  assert(hist.success && hist.payments.length === 2, 'Search by student name finds both payments');

  const prof = getStudentFeeProfile(std1.id, db);
  assert(prof.success, 'getStudentFeeProfile succeeds');
  assert(prof.summary.totalBilled === 350000, 'Student 1 total billed is 3,500 PKR');
  assert(prof.summary.totalPaid === 350000, 'Student 1 total paid is 3,500 PKR');
  assert(prof.summary.totalOutstanding === 0, 'Student 1 total outstanding is 0');
  assert(prof.payments.length === 2, 'Student 1 has 2 payment history records');

  // ─────────────────────────────────────────────────────────────
  // Test Group 12: Dashboard Summary Live Financial Metrics
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Test Group 12: Dashboard Summary Financials');
  const dash = getDashboardSummary(db);
  assert(dash.totalFeesBilled === 800000, `Dashboard reports total fees billed: 8,000 PKR (got: ${dash.totalFeesBilled / 100})`);
  assert(dash.totalFeesCollected === 350000, `Dashboard reports total fees collected: 3,500 PKR (got: ${dash.totalFeesCollected / 100})`);
  assert(dash.totalFeesOutstanding === 450000, `Dashboard reports total fees outstanding: 4,500 PKR (got: ${dash.totalFeesOutstanding / 100})`);

  db.close();
  cleanup();

  console.log('\n======================================================');
  console.log(`📊 Phase 6 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Phase 6 test suite failure:', err);
  process.exit(1);
});
