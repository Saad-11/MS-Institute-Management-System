import React, { useState } from 'react';
import {
  Search,
  CreditCard,
  PlusCircle,
  X,
  Printer,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
} from 'lucide-react';
import type {
  FeeRecordItem,
  FeePaymentItem,
  PaymentMethod,
  SchoolSettings,
  StudentFeeSummary,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, toMinorUnits, toMajorUnits } from '../../utils/money';
import { ReceiptModal } from './ReceiptModal';

interface FeeCollectTabProps {
  schoolSettings?: SchoolSettings | null;
}

export const FeeCollectTab: React.FC<FeeCollectTabProps> = ({ schoolSettings }) => {
  const { sessionToken } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Loaded Student Fee Profile
  const [selectedStudentRecords, setSelectedStudentRecords] = useState<FeeRecordItem[]>([]);
  const [studentSummary, setStudentSummary] = useState<StudentFeeSummary | null>(null);
  const [studentPayments, setStudentPayments] = useState<FeePaymentItem[]>([]);
  const [activeStudentMeta, setActiveStudentMeta] = useState<{
    displayName: string;
    studentId: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
    fatherName?: string;
  } | null>(null);

  // Active record to pay (Modal state)
  const [payingRecord, setPayingRecord] = useState<FeeRecordItem | null>(null);
  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNotes, setReferenceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Receipt Slip Popup
  const [createdReceipt, setCreatedReceipt] = useState<FeePaymentItem | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Search by Student Name / ID / Admission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setPayingRecord(null);

    try {
      if (window.electronAPI) {
        // First search dues/records to locate the student
        const duesRes = await window.electronAPI.fees.getDues({
          searchQuery: searchQuery.trim(),
          dueStatus: 'All',
          limit: 100,
        });

        if (duesRes.success && duesRes.records && duesRes.records.length > 0) {
          const firstRecord = duesRes.records[0];
          setActiveStudentMeta({
            displayName: firstRecord.studentName,
            studentId: firstRecord.systemStudentId,
            admissionNumber: firstRecord.admissionNumber,
            className: firstRecord.className,
            sectionName: firstRecord.sectionName,
          });

          // Fetch full student fee profile & summary
          const profRes = await window.electronAPI.fees.getStudentFeeSummary(firstRecord.studentId);
          if (profRes.success) {
            setStudentSummary(profRes.summary);
            setSelectedStudentRecords(profRes.records);
            setStudentPayments(profRes.payments);
          } else {
            setSelectedStudentRecords(duesRes.records);
          }
        } else {
          // If no dues found, try finding payments by receipt or student name
          const payRes = await window.electronAPI.fees.searchPayments({
            searchQuery: searchQuery.trim(),
            limit: 50,
          });

          if (payRes.success && payRes.payments && payRes.payments.length > 0) {
            const firstPay = payRes.payments[0];
            setActiveStudentMeta({
              displayName: firstPay.studentName || 'Student',
              studentId: firstPay.systemStudentId || '',
              admissionNumber: firstPay.admissionNumber || '',
              className: firstPay.className || '',
              sectionName: firstPay.sectionName || '',
            });

            const profRes = await window.electronAPI.fees.getStudentFeeSummary(firstPay.studentId);
            if (profRes.success) {
              setStudentSummary(profRes.summary);
              setSelectedStudentRecords(profRes.records);
              setStudentPayments(profRes.payments);
            }
          } else {
            setActiveStudentMeta(null);
            setSelectedStudentRecords([]);
            setStudentSummary(null);
            setStudentPayments([]);
          }
        }
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Error searching student fees.');
    } finally {
      setIsSearching(false);
    }
  };

  // Open Payment Modal for a specific fee record
  const handleOpenPayModal = (record: FeeRecordItem) => {
    setPayingRecord(record);
    setPaymentAmountStr(toMajorUnits(record.remainingBalance).toString());
    setPaymentDate(todayStr);
    setPaymentMethod('Cash');
    setReferenceNotes('');
    setSubmitError(null);
  };

  // Submit Payment
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingRecord) return;

    const amountInPaisa = toMinorUnits(paymentAmountStr);
    if (amountInPaisa <= 0) {
      setSubmitError('Payment amount must be greater than zero.');
      return;
    }

    if (amountInPaisa > payingRecord.remainingBalance) {
      setSubmitError(
        `Overpayment not allowed: Payment (${formatMoney(amountInPaisa)}) cannot exceed remaining dues (${formatMoney(payingRecord.remainingBalance)}).`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.recordPayment({
          sessionToken: sessionToken || '',
          feeRecordId: payingRecord.id,
          amount: amountInPaisa,
          paymentDate,
          paymentMethod,
          referenceNotes: referenceNotes.trim() || undefined,
        });

        if (res.success && res.payment) {
          setCreatedReceipt({
            ...res.payment,
            fatherName: res.payment.fatherName || activeStudentMeta?.fatherName,
          });
          setIsReceiptOpen(true);
          setPayingRecord(null);

          // Refresh student fee summary
          const profRes = await window.electronAPI.fees.getStudentFeeSummary(payingRecord.studentId);
          if (profRes.success) {
            setStudentSummary(profRes.summary);
            setSelectedStudentRecords(profRes.records);
            setStudentPayments(profRes.payments);
          }
        } else {
          setSubmitError(res.error || 'Failed to record payment.');
        }
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error processing payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <span className="badge-fee paid">Paid</span>;
      case 'Partially Paid':
        return <span className="badge-fee partial">Partial</span>;
      case 'Unpaid':
        return <span className="badge-fee unpaid">Unpaid</span>;
      default:
        return <span className="badge-fee waived">{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Prominent Student Search Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Search size={18} />
            <span>Search Student Fee Profile</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            Search by Student Name, Admission #, or Student ID
          </span>
        </div>

        <div className="fees-card-body">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', color: 'var(--color-neutral-400)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Enter Student Name (e.g. 'Ahmad'), Admission No (e.g. 'ADM-101'), or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="fees-input"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="btn-fees-primary"
              style={{ height: '42px', padding: '0 24px' }}
            >
              {isSearching ? 'Searching...' : 'Search Fee Profile'}
            </button>
          </form>

          {searchError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
              <AlertCircle size={15} />
              <span>{searchError}</span>
            </div>
          )}
        </div>
      </div>

      {/* When no search made yet */}
      {!hasSearched && (
        <div className="fees-card">
          <div className="fees-empty-state">
            <div className="fees-empty-icon">
              <CreditCard size={26} />
            </div>
            <div className="fees-empty-title">Ready to Record Payments</div>
            <div className="fees-empty-subtitle">
              Search for any student above using their name or admission number to inspect outstanding dues,
              record fee payments, and generate official printable fee receipts.
            </div>
          </div>
        </div>
      )}

      {/* When search returned 0 results */}
      {hasSearched && !activeStudentMeta && !isSearching && (
        <div className="fees-card">
          <div className="fees-empty-state">
            <div className="fees-empty-icon">
              <Search size={26} />
            </div>
            <div className="fees-empty-title">No Student Fee Record Found</div>
            <div className="fees-empty-subtitle">
              No matching fee invoices found for "<strong>{searchQuery}</strong>". Please verify the student name or admission number.
            </div>
          </div>
        </div>
      )}

      {/* Active Student Fee Profile Display */}
      {activeStudentMeta && (
        <>
          {/* Student Profile Header Card */}
          <div className="student-fee-profile-card">
            <div className="student-fee-profile-left">
              <div className="student-fee-avatar">
                <User size={26} />
              </div>
              <div className="student-fee-details">
                <h3>{activeStudentMeta.displayName}</h3>
                <div className="student-fee-meta">
                  <span className="id-badge">{activeStudentMeta.admissionNumber || activeStudentMeta.studentId}</span>
                  <span>•</span>
                  <span>Class: <strong>{activeStudentMeta.className}</strong> ({activeStudentMeta.sectionName})</span>
                </div>
              </div>
            </div>

            {/* Student Aggregate Financials */}
            {studentSummary && (
              <div className="student-fee-financials">
                <div className="student-fee-metric">
                  <span className="student-fee-metric-label">Total Invoiced</span>
                  <span className="student-fee-metric-val" style={{ color: 'var(--color-neutral-800)' }}>
                    {formatMoney(studentSummary.totalBilled)}
                  </span>
                </div>
                <div className="student-fee-metric">
                  <span className="student-fee-metric-label" style={{ color: '#059669' }}>Total Paid</span>
                  <span className="student-fee-metric-val" style={{ color: '#059669' }}>
                    {formatMoney(studentSummary.totalPaid)}
                  </span>
                </div>
                <div className="student-fee-metric">
                  <span className="student-fee-metric-label" style={{ color: '#d97706' }}>Remaining Due</span>
                  <span className="student-fee-metric-val" style={{ color: '#d97706' }}>
                    {formatMoney(studentSummary.totalOutstanding)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Outstanding Fee Invoices Table */}
          <div className="fees-card">
            <div className="fees-card-header">
              <div className="fees-card-title">
                <FileText size={17} />
                <span>Fee Invoices &amp; Periods</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>
                {selectedStudentRecords.length} record(s) found
              </span>
            </div>

            <div className="fees-table-container">
              <table className="fees-table">
                <thead>
                  <tr>
                    <th>Billing Period</th>
                    <th>Fee Type</th>
                    <th style={{ textAlign: 'right' }}>Original Fee</th>
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right' }}>Fine</th>
                    <th style={{ textAlign: 'right' }}>Total Payable</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudentRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td>
                        <strong style={{ color: 'var(--color-neutral-900)' }}>{rec.feePeriodName}</strong>
                        <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>Due: {rec.dueDate}</div>
                      </td>
                      <td>{rec.feeTypeName}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatMoney(rec.originalAmount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: rec.discount > 0 ? '#059669' : 'inherit' }}>
                        {rec.discount > 0 ? `-${formatMoney(rec.discount)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: rec.fine > 0 ? '#dc2626' : 'inherit' }}>
                        {rec.fine > 0 ? `+${formatMoney(rec.fine)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {formatMoney(rec.netAmount)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 'bold' }}>
                        {formatMoney(rec.paidAmount)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: rec.remainingBalance > 0 ? '#d97706' : '#059669', fontWeight: 'bold' }}>
                        {formatMoney(rec.remainingBalance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{getStatusBadge(rec.status)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {rec.remainingBalance > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(rec)}
                            className="btn-fees-success"
                            style={{ height: '30px', padding: '0 12px', fontSize: '11px' }}
                          >
                            <PlusCircle size={13} />
                            Pay Now
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                            ✓ Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Payment History */}
          {studentPayments.length > 0 && (
            <div className="fees-card">
              <div className="fees-card-header">
                <div className="fees-card-title">
                  <CreditCard size={17} />
                  <span>Student Payment Receipts</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-neutral-500)' }}>
                  {studentPayments.length} payment(s) recorded
                </span>
              </div>

              <div className="fees-table-container">
                <table className="fees-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Fee Category</th>
                      <th>Payment Method</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ textAlign: 'center', width: '120px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPayments.map((pay) => (
                      <tr key={pay.id}>
                        <td>
                          <span className="id-badge">{pay.receiptNumber}</span>
                        </td>
                        <td>{pay.paymentDate}</td>
                        <td>{pay.feeTypeName || 'Fee'}</td>
                        <td>{pay.paymentMethod}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#059669' }}>
                          {formatMoney(pay.amount)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCreatedReceipt(pay);
                              setIsReceiptOpen(true);
                            }}
                            className="btn-fees-secondary"
                            style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                          >
                            <Printer size={13} /> Print Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Record Payment Modal ─── */}
      {payingRecord && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card">
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Record Fee Payment
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                  {payingRecord.studentName} • {payingRecord.feePeriodName} ({payingRecord.feeTypeName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingRecord(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProcessPayment}>
              <div className="fees-modal-body">
                {/* Financial Summary Card */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-neutral-500)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      Total Net Fee
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
                      {formatMoney(payingRecord.netAmount)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-neutral-500)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      Already Paid
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#059669', marginTop: '3px' }}>
                      {formatMoney(payingRecord.paidAmount)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--color-neutral-500)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      Remaining Balance
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#d97706', marginTop: '3px' }}>
                      {formatMoney(payingRecord.remainingBalance)}
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="fees-form-group">
                    <label className="fees-form-label">Payment Amount (Rs.) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      max={toMajorUnits(payingRecord.remainingBalance)}
                      required
                      value={paymentAmountStr}
                      onChange={(e) => setPaymentAmountStr(e.target.value)}
                      className="fees-input"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="fees-input"
                    />
                  </div>
                </div>

                <div className="fees-form-group">
                  <label className="fees-form-label">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="fees-select"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="fees-form-group">
                  <label className="fees-form-label">Remarks / Note (Optional)</label>
                  <input
                    type="text"
                    value={referenceNotes}
                    onChange={(e) => setReferenceNotes(e.target.value)}
                    className="fees-input"
                    placeholder="e.g. Paid in full by father, bank reference #..."
                    maxLength={200}
                  />
                </div>

                {submitError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
                    {submitError}
                  </div>
                )}
              </div>

              <div className="fees-modal-footer">
                <button
                  type="button"
                  onClick={() => setPayingRecord(null)}
                  className="btn-fees-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-fees-success"
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Recording...' : 'Confirm & Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Receipt Modal ─── */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        payment={createdReceipt}
        schoolSettings={schoolSettings}
      />
    </div>
  );
};
