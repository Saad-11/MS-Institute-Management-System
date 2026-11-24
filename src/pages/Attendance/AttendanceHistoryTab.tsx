import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import type {
  AttendanceRecordItem,
  AttendanceHistoryParams,
  AcademicSession,
  ClassItem,
  SectionItem,
  AttendanceStatus,
} from '../../types/electron';

interface AttendanceHistoryTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
}

export const AttendanceHistoryTab: React.FC<AttendanceHistoryTabProps> = ({ sessions, classes }) => {
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSectionId, setSelectedSectionId] = useState<number | ''>('');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortBy] = useState<'date' | 'studentName' | 'status'>('date');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Load sections when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }

    const loadSections = async () => {
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(selectedClassId));
          if (res.success && res.sections) {
            setSections(res.sections);
          }
        }
      } catch (err) {
        console.error('Failed to load sections for history filter:', err);
      }
    };

    loadSections();
  }, [selectedClassId]);

  // Fetch history records
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI?.attendance) {
        const params: AttendanceHistoryParams = {
          academicSessionId: selectedSessionId ? Number(selectedSessionId) : undefined,
          classId: selectedClassId ? Number(selectedClassId) : undefined,
          sectionId: selectedSectionId ? Number(selectedSectionId) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          status: (selectedStatus as AttendanceStatus) || undefined,
          searchQuery: searchQuery.trim() || undefined,
          sortBy,
          sortOrder,
          page,
          limit: 25,
        };

        const res = await window.electronAPI.attendance.getHistory(params);
        if (res.success && res.records) {
          setRecords(res.records);
          setTotalCount(res.totalCount);
          setTotalPages(res.totalPages);
        } else {
          setError(res.error || 'Failed to load attendance history.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching attendance records.');
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedSessionId,
    selectedClassId,
    selectedSectionId,
    dateFrom,
    dateTo,
    selectedStatus,
    searchQuery,
    sortBy,
    sortOrder,
    page,
  ]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const clearFilters = () => {
    setSelectedSessionId('');
    setSelectedClassId('');
    setSelectedSectionId('');
    setDateFrom('');
    setDateTo('');
    setSelectedStatus('');
    setSearchQuery('');
    setPage(1);
  };

  const renderStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return (
          <span className="badge-attendance present">
            <CheckCircle size={12} /> Present
          </span>
        );
      case 'Absent':
        return (
          <span className="badge-attendance absent">
            <XCircle size={12} /> Absent
          </span>
        );
      case 'Late':
        return (
          <span className="badge-attendance late">
            <Clock size={12} /> Late
          </span>
        );
      case 'Leave':
        return (
          <span className="badge-attendance leave">
            <AlertTriangle size={12} /> Leave
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Filter Toolbar Card */}
      <div className="attendance-control-card">
        <div className="attendance-control-header">
          <div className="attendance-control-title">
            <Calendar size={18} />
            <span>Search & Filter Attendance Records</span>
          </div>
          {(selectedSessionId || selectedClassId || selectedSectionId || dateFrom || dateTo || selectedStatus || searchQuery) && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-attendance-secondary"
              style={{ height: '32px', fontSize: '11px', padding: '0 10px' }}
            >
              <RotateCcw size={13} /> Clear Filters
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          {/* Search Box */}
          <div className="attendance-form-group" style={{ gridColumn: 'span 2' }}>
            <label className="attendance-form-label">Search Student</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: '12px', color: 'var(--color-neutral-400)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search by student name, ID, admission #..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="attendance-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Academic Session */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => {
                setSelectedSessionId(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="attendance-select"
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
          <div className="attendance-form-group">
            <label className="attendance-form-label">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="attendance-select"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => {
                setSelectedSectionId(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              disabled={!selectedClassId}
              className="attendance-select"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="attendance-select"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Leave">Leave</option>
            </select>
          </div>

          {/* Date From */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="attendance-input"
            />
          </div>

          {/* Date To */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="attendance-input"
            />
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="attendance-alert error">
          <AlertCircle size={16} className="attendance-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* Attendance Records Table Card */}
      <div className="attendance-sheet-card">
        <div className="attendance-sheet-toolbar">
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
            Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> attendance record(s)
          </div>
        </div>

        <div className="attendance-table-container">
          <table className="attendance-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Date</th>
                <th>Student Details</th>
                <th style={{ width: '130px' }}>Class / Section</th>
                <th style={{ width: '120px' }}>Academic Session</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '220px' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="attendance-empty-state">
                      <div className="attendance-empty-icon">
                        <Calendar size={26} />
                      </div>
                      <div className="attendance-empty-title">No Attendance Records Found</div>
                      <div className="attendance-empty-subtitle">
                        No records match the current filter criteria. Try adjusting dates or filters above.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    {/* Date */}
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--color-neutral-900)' }}>
                        {r.attendanceDate}
                      </span>
                    </td>

                    {/* Student Details */}
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-neutral-900)' }}>
                        {r.studentName}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)' }}>
                        {r.systemStudentId} {r.admissionNumber ? `• Adm: ${r.admissionNumber}` : ''}
                      </div>
                    </td>

                    {/* Class & Section */}
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--color-neutral-800)' }}>{r.className}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-neutral-500)' }}>{r.sectionName}</div>
                    </td>

                    {/* Session */}
                    <td>
                      <span style={{ color: 'var(--color-neutral-600)', fontSize: '11px' }}>
                        {r.academicSessionName}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      {renderStatusBadge(r.status)}
                    </td>

                    {/* Remarks */}
                    <td>
                      <span style={{ color: 'var(--color-neutral-500)', fontStyle: r.remarks ? 'normal' : 'italic' }}>
                        {r.remarks || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="attendance-sheet-footer">
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-attendance-secondary"
                style={{ height: '30px', padding: '0 8px' }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-attendance-secondary"
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
