import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Search,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type { AcademicSession, ClassItem, FeePeriodItem, FeeRecordItem } from '../../types/electron';
import { formatMoney } from '../../utils/money';

interface FeeDuesTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
  periods: FeePeriodItem[];
  onPayRecord: (record: FeeRecordItem) => void;
}

export const FeeDuesTab: React.FC<FeeDuesTabProps> = ({
  sessions,
  classes,
  periods,
  onPayRecord,
}) => {
  const [records, setRecords] = useState<FeeRecordItem[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | ''>('');
  const [dueStatus, setDueStatus] = useState<'All' | 'Overdue' | 'Unpaid' | 'Partially Paid'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDues = async (targetPage = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const params: {
          academicSessionId?: number;
          classId?: number;
          feePeriodId?: number;
          dueStatus?: 'All' | 'Overdue' | 'Unpaid' | 'Partially Paid';
          searchQuery?: string;
          page?: number;
          limit?: number;
        } = {
          page: targetPage,
          limit: 25,
        };

        if (selectedSessionId !== '') params.academicSessionId = Number(selectedSessionId);
        if (selectedClassId !== '') params.classId = Number(selectedClassId);
        if (selectedPeriodId !== '') params.feePeriodId = Number(selectedPeriodId);
        if (dueStatus !== 'All') params.dueStatus = dueStatus;
        if (searchQuery.trim()) params.searchQuery = searchQuery.trim();

        const res = await window.electronAPI.fees.getDues(params);
        if (res.success && res.records) {
          setRecords(res.records);
          setTotalOutstanding(res.totalOutstandingAmount);
          setTotalCount(res.totalCount);
          setPage(res.page);
          setTotalPages(res.totalPages);
        } else {
          setError(res.error || 'Failed to load outstanding fee dues.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching fee dues.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDues(1);
  }, [selectedSessionId, selectedClassId, selectedPeriodId, dueStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDues(1);
  };

  const clearFilters = () => {
    setSelectedSessionId('');
    setSelectedClassId('');
    setSelectedPeriodId('');
    setDueStatus('All');
    setSearchQuery('');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getStatusBadge = (rec: FeeRecordItem) => {
    const isOverdue = rec.status !== 'Paid' && rec.dueDate < todayStr;
    if (isOverdue) return <span className="badge-fee overdue">Overdue</span>;
    if (rec.status === 'Partially Paid') return <span className="badge-fee partial">Partial</span>;
    if (rec.status === 'Unpaid') return <span className="badge-fee unpaid">Unpaid</span>;
    return <span className="badge-fee paid">Paid</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Overview Stat Card */}
      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-xl)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Filtered Outstanding Dues
          </span>
          <div style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#b45309', marginTop: '2px' }}>
            {formatMoney(totalOutstanding)}
          </div>
          <p style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
            Across {totalCount} unpaid or partially paid student fee records
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(selectedSessionId || selectedClassId || selectedPeriodId || dueStatus !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-fees-secondary"
              style={{ height: '34px', fontSize: '11px' }}
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <AlertCircle size={18} />
            <span>Search &amp; Filter Outstanding Invoices</span>
          </div>
        </div>

        <div className="fees-card-body">
          <form onSubmit={handleSearchSubmit}>
            <div className="fees-filter-grid">
              {/* Search */}
              <div className="fees-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="fees-form-label">Search Student</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '12px', color: 'var(--color-neutral-400)', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="Search by student name, admission #, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="fees-input"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>

              {/* Session */}
              <div className="fees-form-group">
                <label className="fees-form-label">Academic Session</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : '')}
                  className="fees-select"
                >
                  <option value="">All Sessions</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div className="fees-form-group">
                <label className="fees-form-label">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                  className="fees-select"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period */}
              <div className="fees-form-group">
                <label className="fees-form-label">Billing Period</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : '')}
                  className="fees-select"
                >
                  <option value="">All Billing Periods</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="fees-form-group">
                <label className="fees-form-label">Due Status</label>
                <select
                  value={dueStatus}
                  onChange={(e) => setDueStatus(e.target.value as 'All' | 'Overdue' | 'Unpaid' | 'Partially Paid')}
                  className="fees-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="Overdue">Overdue Only</option>
                  <option value="Unpaid">Unpaid Only</option>
                  <option value="Partially Paid">Partially Paid</option>
                </select>
              </div>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Dues Table Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
            Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> pending fee invoice(s)
          </div>
        </div>

        <div className="fees-table-container">
          <table className="fees-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class / Section</th>
                <th>Billing Period</th>
                <th>Fee Type</th>
                <th style={{ textAlign: 'right' }}>Total Fee</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading outstanding dues...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="fees-empty-state">
                      <div className="fees-empty-icon">
                        <CreditCard size={26} />
                      </div>
                      <div className="fees-empty-title">No Pending Fees Found</div>
                      <div className="fees-empty-subtitle">
                        There are currently no outstanding fee dues matching the selected filter criteria.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    {/* Student */}
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-neutral-900)' }}>{r.studentName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)' }}>
                        {r.systemStudentId} {r.admissionNumber ? `• Adm: ${r.admissionNumber}` : ''}
                      </div>
                    </td>

                    {/* Class */}
                    <td>
                      <div style={{ fontWeight: '500' }}>{r.className}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-500)' }}>{r.sectionName}</div>
                    </td>

                    {/* Period */}
                    <td>
                      <strong style={{ color: 'var(--color-neutral-800)' }}>{r.feePeriodName}</strong>
                    </td>

                    {/* Fee Type */}
                    <td>{r.feeTypeName}</td>

                    {/* Total Net */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {formatMoney(r.netAmount)}
                    </td>

                    {/* Paid */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#059669' }}>
                      {formatMoney(r.paidAmount)}
                    </td>

                    {/* Remaining */}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#d97706', fontWeight: 'bold' }}>
                      {formatMoney(r.remainingBalance)}
                    </td>

                    {/* Due Date */}
                    <td>
                      <span style={{ fontSize: '11px', color: r.dueDate < todayStr ? '#dc2626' : 'var(--color-neutral-600)' }}>
                        {r.dueDate}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>{getStatusBadge(r)}</td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onPayRecord(r)}
                        className="btn-fees-primary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        Collect
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
                onClick={() => loadDues(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn-fees-secondary"
                style={{ height: '30px', padding: '0 8px' }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => loadDues(Math.min(totalPages, page + 1))}
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
    </div>
  );
};
