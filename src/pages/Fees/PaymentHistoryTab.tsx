import React, { useState, useEffect } from 'react';
import {
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import type { FeePaymentItem, PaymentMethod, SchoolSettings } from '../../types/electron';
import { formatMoney } from '../../utils/money';
import { ReceiptModal } from './ReceiptModal';

interface PaymentHistoryTabProps {
  schoolSettings?: SchoolSettings | null;
}

export const PaymentHistoryTab: React.FC<PaymentHistoryTabProps> = ({ schoolSettings }) => {
  const [payments, setPayments] = useState<FeePaymentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  // Receipt Reprint Modal
  const [selectedPayment, setSelectedPayment] = useState<FeePaymentItem | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadPayments = async (targetPage = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const params: {
          searchQuery?: string;
          paymentMethod?: PaymentMethod;
          dateFrom?: string;
          dateTo?: string;
          page?: number;
          limit?: number;
        } = {
          page: targetPage,
          limit: 25,
        };

        if (searchQuery.trim()) params.searchQuery = searchQuery.trim();
        if (paymentMethod !== '') params.paymentMethod = paymentMethod;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const res = await window.electronAPI.fees.searchPayments(params);
        if (res.success && res.payments) {
          setPayments(res.payments);
          setTotalCount(res.totalCount);
          setPage(res.page);
          setTotalPages(res.totalPages);
        } else {
          setError(res.error || 'Failed to load payment history.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching payment records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments(1);
  }, [paymentMethod, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPaymentMethod('');
    setDateFrom('');
    setDateTo('');
  };

  const handleOpenReceipt = (payment: FeePaymentItem) => {
    setSelectedPayment(payment);
    setIsReceiptOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Search & Filter Toolbar */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Receipt size={18} />
            <span>Search Payment Receipts</span>
          </div>
          {(searchQuery || paymentMethod || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-fees-secondary"
              style={{ height: '32px', fontSize: '11px', padding: '0 10px' }}
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          )}
        </div>

        <div className="fees-card-body">
          <form onSubmit={handleSearchSubmit}>
            <div className="fees-filter-grid">
              {/* Search */}
              <div className="fees-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="fees-form-label">Search Receipt / Student</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '12px', color: 'var(--color-neutral-400)', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="Search receipt # (REC-...), student name, or admission #..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="fees-input"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="fees-form-group">
                <label className="fees-form-label">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
                  className="fees-select"
                >
                  <option value="">All Payment Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Date From */}
              <div className="fees-form-group">
                <label className="fees-form-label">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="fees-input"
                />
              </div>

              {/* Date To */}
              <div className="fees-form-group">
                <label className="fees-form-label">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="fees-input"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Payment Records Table Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
            Showing <strong>{payments.length}</strong> of <strong>{totalCount}</strong> recorded receipt(s)
          </div>
        </div>

        <div className="fees-table-container">
          <table className="fees-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Payment Date</th>
                <th>Student Details</th>
                <th>Class / Section</th>
                <th>Fee Category</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="fees-empty-state">
                      <div className="fees-empty-icon">
                        <Receipt size={26} />
                      </div>
                      <div className="fees-empty-title">No Payment Records Found</div>
                      <div className="fees-empty-subtitle">
                        No fee payments match the specified search or date range filters.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    {/* Receipt No */}
                    <td>
                      <span className="id-badge">{p.receiptNumber}</span>
                    </td>

                    {/* Date */}
                    <td>
                      <strong style={{ color: 'var(--color-neutral-900)' }}>{p.paymentDate}</strong>
                    </td>

                    {/* Student Details */}
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-neutral-900)' }}>
                        {p.studentName || `Student #${p.studentId}`}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)' }}>
                        {p.systemStudentId} {p.admissionNumber ? `• Adm: ${p.admissionNumber}` : ''}
                      </div>
                    </td>

                    {/* Class */}
                    <td>
                      <div style={{ fontWeight: '500' }}>{p.className || '—'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-500)' }}>{p.sectionName || ''}</div>
                    </td>

                    {/* Fee Category */}
                    <td>
                      <span>{p.feeTypeName || 'Fee'}</span>
                      {p.feePeriodName && (
                        <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>
                          {p.feePeriodName}
                        </div>
                      )}
                    </td>

                    {/* Payment Mode */}
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--color-neutral-700)', fontWeight: '500' }}>
                        {p.paymentMethod}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#059669' }}>
                      {formatMoney(p.amount)}
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(p)}
                        className="btn-fees-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        <Printer size={13} /> Print Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 18px', background: '#fafbfc', borderTop: '1px solid var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => loadPayments(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn-fees-secondary"
                style={{ height: '30px', padding: '0 8px' }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => loadPayments(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="btn-fees-secondary"
                style={{ height: '30px', padding: '0 8px' }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Receipt Modal ─── */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        payment={selectedPayment}
        schoolSettings={schoolSettings}
      />
    </div>
  );
};
