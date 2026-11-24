import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  PlayCircle,
  Eye,
  FileText,
  Clock,
  MoreVertical,
  Lock,
  Unlock,
  Edit,
  Trash2,
  Search,
  RotateCcw,
  AlertTriangle,
  X,
  CheckCircle2,
  Layers,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import type {
  AcademicSession,
  ExaminationItem,
  ExamStatus,
  ExamTypeItem,
  ClassItem,
} from '../../types/electron';

interface ExaminationsTabProps {
  sessions: AcademicSession[];
  examTypes: ExamTypeItem[];
  classes: ClassItem[];
  examinations: ExaminationItem[];
  selectedSessionId: number;
  onSelectSessionId: (id: number) => void;
  onOpenCreateExamModal: () => void;
  onOpenEditExamModal: (exam: ExaminationItem) => void;
  onNavigateToTab: (
    tabKey: 'dashboard' | 'create_exam' | 'enter_marks' | 'view_results' | 'reports' | 'settings',
    examId?: number
  ) => void;
  onUpdateExamStatus: (examId: number, status: ExamStatus) => Promise<void>;
  onDeleteExam: (examId: number) => Promise<void>;
}

export const ExaminationsTab: React.FC<ExaminationsTabProps> = ({
  sessions,
  examTypes,
  classes,
  examinations,
  selectedSessionId,
  onSelectSessionId,
  onOpenCreateExamModal,
  onOpenEditExamModal,
  onNavigateToTab,
  onUpdateExamStatus,
  onDeleteExam,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [actionMenuExamId, setActionMenuExamId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExaminationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state for handling large sets of records smoothly
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Summary Metrics calculated from examinations in current session scope
  const sessionScopedExams = selectedSessionId
    ? examinations.filter((e) => e.academicSessionId === selectedSessionId)
    : examinations;
  const totalExamsCount = sessionScopedExams.length;
  const upcomingCount = sessionScopedExams.filter((e) => e.status === 'Draft').length;
  const ongoingCount = sessionScopedExams.filter((e) => e.status === 'Open').length;
  const completedCount = sessionScopedExams.filter((e) => e.status === 'Closed').length;

  // Filter examinations based on user inputs
  const filteredExams = examinations.filter((exam) => {
    if (selectedSessionId && exam.academicSessionId !== selectedSessionId) {
      return false;
    }
    if (selectedTypeId && exam.examTypeId !== selectedTypeId) {
      return false;
    }
    if (selectedStatus !== 'All' && exam.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = exam.name.toLowerCase().includes(q);
      const matchDesc = exam.description && exam.description.toLowerCase().includes(q);
      const matchSession =
        exam.academicSessionName && exam.academicSessionName.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchSession) return false;
    }
    return true;
  });

  const isFiltered =
    Boolean(searchQuery.trim()) ||
    selectedTypeId !== 0 ||
    selectedStatus !== 'All' ||
    selectedSessionId !== 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTypeId(0);
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredExams.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedExams =
    pageSize === 0
      ? filteredExams
      : filteredExams.slice((activePage - 1) * pageSize, activePage * pageSize);

  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span className="results-status-badge results-status-open">
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span>Marks Entry Open</span>
          </span>
        );
      case 'Draft':
        return (
          <span className="results-status-badge results-status-draft">
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span>Draft / Upcoming</span>
          </span>
        );
      case 'Closed':
        return (
          <span className="results-status-badge results-status-closed">
            <Lock size={12} color="#64748b" style={{ flexShrink: 0 }} />
            <span>Results Published</span>
          </span>
        );
      default:
        return (
          <span className="results-status-badge results-status-closed">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="exam-tab-container">
      {/* ─── 1. Header with Title & Create Exam Action ─── */}
      <div className="exam-header-card">
        <div className="exam-header-left">
          <div className="exam-header-icon-badge">
            <Calendar size={22} />
          </div>
          <div>
            <h1 className="exam-header-title">Examinations Management</h1>
            <p className="exam-header-desc">
              Create, schedule, edit, and manage school examinations across academic sessions.
            </p>
          </div>
        </div>

        <div className="exam-header-actions">
          <button
            type="button"
            onClick={onOpenCreateExamModal}
            className="btn-exam-primary"
          >
            <Plus size={16} />
            <span>Create New Examination</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI Summary Cards ─── */}
      <div className="results-stats-grid">
        {/* Total Examinations */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Total Examinations</span>
            <div className="results-stat-value">{totalExamsCount}</div>
            <span className="results-stat-sub">All registered exams</span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-blue">
            <Calendar size={20} />
          </div>
        </div>

        {/* Upcoming / Draft */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Upcoming / Draft</span>
            <div className="results-stat-value" style={{ color: '#b45309' }}>
              {upcomingCount}
            </div>
            <span className="results-stat-sub" style={{ color: '#d97706' }}>
              Scheduled / Draft
            </span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-amber">
            <Clock size={20} />
          </div>
        </div>

        {/* Ongoing / Marks Entry Open */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Ongoing / Open</span>
            <div className="results-stat-value" style={{ color: '#047857' }}>
              {ongoingCount}
            </div>
            <span className="results-stat-sub" style={{ color: '#059669' }}>
              Marks entry active
            </span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-green">
            <PlayCircle size={20} />
          </div>
        </div>

        {/* Completed / Results Published */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Completed / Results</span>
            <div className="results-stat-value">{completedCount}</div>
            <span className="results-stat-sub">Results published</span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-slate">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* ─── 3. Search & Filter Toolbar ─── */}
      <div className="exam-filter-card">
        <div className="exam-filter-grid">
          {/* Academic Session Filter */}
          <div className="exam-filter-field">
            <label className="exam-filter-label" htmlFor="filter-session">
              <Calendar size={13} color="#2563eb" />
              <span>Academic Session</span>
            </label>
            <select
              id="filter-session"
              value={selectedSessionId}
              onChange={(e) => {
                onSelectSessionId(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="exam-filter-control"
            >
              <option value={0}>All Academic Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Current Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search by Examination Name */}
          <div className="exam-filter-field">
            <label className="exam-filter-label" htmlFor="filter-search">
              <Search size={13} color="#2563eb" />
              <span>Search Examination</span>
            </label>
            <div className="exam-filter-input-wrap">
              <Search size={14} className="exam-filter-input-icon" />
              <input
                id="filter-search"
                type="text"
                placeholder="Search by examination name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="exam-filter-control with-icon"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  title="Clear search"
                  className="exam-filter-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Examination Type Filter */}
          <div className="exam-filter-field">
            <label className="exam-filter-label" htmlFor="filter-type">
              <Layers size={13} color="#2563eb" />
              <span>Examination Type</span>
            </label>
            <select
              id="filter-type"
              value={selectedTypeId}
              onChange={(e) => {
                setSelectedTypeId(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="exam-filter-control"
            >
              <option value={0}>All Examination Types</option>
              {examTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Examination Status Filter */}
          <div className="exam-filter-field">
            <label className="exam-filter-label" htmlFor="filter-status">
              <Filter size={13} color="#2563eb" />
              <span>Status</span>
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="exam-filter-control"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Ongoing / Marks Entry Open</option>
              <option value="Draft">Upcoming / Draft</option>
              <option value="Closed">Completed / Results Published</option>
            </select>
          </div>
        </div>

        {/* Filter Stats & Reset Action */}
        <div className="exam-filter-footer">
          <span className="exam-filter-count">
            Showing <strong>{filteredExams.length}</strong> of{' '}
            <strong>{examinations.length}</strong> examinations
          </span>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="exam-filter-reset-btn"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 4. Examination Records Table Card (Dual-axis Scroll & Sticky Header) ─── */}
      <div className="exam-table-card">
        {/* Card Header with count and quick actions */}
        <div className="results-card-header">
          <div className="results-card-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2>Examination Records</h2>
              <span className="exam-counter-pill">
                {filteredExams.length} {filteredExams.length === 1 ? 'Exam' : 'Exams'}
              </span>
            </div>
            <p>
              Detailed list of examinations, schedules, participating classes, and status.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onOpenCreateExamModal}
              className="btn-results-secondary"
              style={{ cursor: 'pointer' }}
            >
              <Plus size={14} color="#2563eb" />
              <span>+ Create Exam</span>
            </button>
          </div>
        </div>

        {filteredExams.length > 0 ? (
          <>
            {/* Scrollable Container with Smooth Horizontal/Vertical Scrolling and Sticky Header */}
            <div className="exam-table-scroll-wrap">
              <table
                className="results-table"
                style={{
                  minWidth: '1140px',
                  width: '100%',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  {/* 1. Examination Name & Description */}
                  <col style={{ width: '23%', minWidth: '240px' }} />
                  {/* 2. Type */}
                  <col style={{ width: '11%', minWidth: '120px' }} />
                  {/* 3. Academic Session */}
                  <col style={{ width: '12%', minWidth: '130px' }} />
                  {/* 4. Schedule Dates */}
                  <col style={{ width: '13%', minWidth: '140px' }} />
                  {/* 5. Participating Classes */}
                  <col style={{ width: '13%', minWidth: '140px' }} />
                  {/* 6. Status (14% / min 165px: Zero clipping for "Marks Entry Open") */}
                  <col style={{ width: '14%', minWidth: '165px' }} />
                  {/* 7. Actions (14% / min 200px: Zero squishing for 4 action buttons) */}
                  <col style={{ width: '14%', minWidth: '200px' }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Examination</th>
                    <th>Type</th>
                    <th>Session</th>
                    <th>Schedule Dates</th>
                    <th>Participating Classes</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedExams.map((exam, idx) => {
                    const classList =
                      exam.participatingClasses && exam.participatingClasses.length > 0
                        ? exam.participatingClasses
                        : classes.length > 0
                        ? classes.map((c) => c.name)
                        : [];

                    const isCurrentSession = sessions.some(
                      (s) => s.id === exam.academicSessionId && s.isActive
                    );

                    // Check if row is near bottom to orient dropdown upwards
                    const isNearBottom = idx >= paginatedExams.length - 2 && paginatedExams.length > 2;

                    return (
                      <tr key={exam.id}>
                        {/* ── Col 1: Examination Name + Description ── */}
                        <td>
                          <div
                            style={{
                              fontWeight: 700,
                              color: '#0f172a',
                              fontSize: '13px',
                              lineHeight: '1.35',
                              wordBreak: 'break-word',
                            }}
                          >
                            {exam.name}
                          </div>
                          {exam.description && (
                            <div
                              style={{
                                marginTop: '3px',
                                fontSize: '11px',
                                color: '#64748b',
                                lineHeight: '1.4',
                                wordBreak: 'break-word',
                              }}
                            >
                              {exam.description}
                            </div>
                          )}
                        </td>

                        {/* ── Col 2: Exam Type ── */}
                        <td>
                          <span className="exam-type-pill">
                            {exam.examTypeName || 'General Exam'}
                          </span>
                        </td>

                        {/* ── Col 3: Academic Session ── */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#1e293b',
                              }}
                            >
                              {exam.academicSessionName || 'Current Session'}
                            </span>
                            {isCurrentSession && (
                              <span className="exam-session-tag">Current</span>
                            )}
                          </div>
                        </td>

                        {/* ── Col 4: Schedule Dates ── */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#0f172a',
                              }}
                            >
                              <Calendar size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                              <span>{exam.startDate}</span>
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#64748b',
                                paddingLeft: '18px',
                              }}
                            >
                              to {exam.endDate}
                            </div>
                          </div>
                        </td>

                        {/* ── Col 5: Participating Classes ── */}
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            {classList.length > 0 ? (
                              <>
                                {classList.slice(0, 2).map((cName) => (
                                  <span
                                    key={cName}
                                    className="exam-class-badge"
                                    style={{ margin: 0 }}
                                  >
                                    {cName}
                                  </span>
                                ))}
                                {classList.length > 2 && (
                                  <span
                                    className="exam-class-badge"
                                    style={{
                                      margin: 0,
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                    }}
                                    title={`Participating classes: ${classList.join(', ')}`}
                                  >
                                    +{classList.length - 2} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                All Classes
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ── Col 6: Status Badge (Un-truncated, Plenty of Space) ── */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            {getStatusBadge(exam.status)}
                          </div>
                        </td>

                        {/* ── Col 7: Action Buttons (Spacious, Fully Aligned) ── */}
                        <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '5px',
                              flexWrap: 'nowrap',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {/* Primary Action: Enter Marks */}
                            <button
                              type="button"
                              onClick={() => onNavigateToTab('enter_marks', exam.id)}
                              title="Enter Marks for this examination"
                              className={`exam-action-btn-marks ${
                                exam.status === 'Open' ? 'open' : 'other'
                              }`}
                            >
                              <PlayCircle size={13} />
                              <span>Marks</span>
                            </button>

                            {/* View Results */}
                            <button
                              type="button"
                              onClick={() => onNavigateToTab('view_results', exam.id)}
                              title="View Results & DMCs"
                              className="exam-action-btn-icon"
                            >
                              <Eye size={14} />
                            </button>

                            {/* Edit Examination */}
                            <button
                              type="button"
                              onClick={() => onOpenEditExamModal(exam)}
                              title="Edit Examination details"
                              className="exam-action-btn-icon edit"
                            >
                              <Edit size={13} />
                            </button>

                            {/* Three-dot More Actions Popover */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setActionMenuExamId(
                                    actionMenuExamId === exam.id ? null : exam.id
                                  )
                                }
                                aria-label="More Actions"
                                className="exam-action-btn-icon"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {actionMenuExamId === exam.id && (
                                <>
                                  <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                    onClick={() => setActionMenuExamId(null)}
                                  />
                                  <div
                                    className="exam-action-dropdown"
                                    style={
                                      isNearBottom
                                        ? { bottom: '100%', top: 'auto', marginBottom: '6px' }
                                        : { top: '100%', bottom: 'auto', marginTop: '6px' }
                                    }
                                  >
                                    {exam.status !== 'Open' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateExamStatus(exam.id, 'Open');
                                          setActionMenuExamId(null);
                                        }}
                                        className="exam-dropdown-item"
                                      >
                                        <Unlock size={14} color="#059669" style={{ flexShrink: 0 }} />
                                        <span>Open Marks Entry</span>
                                      </button>
                                    )}
                                    {exam.status !== 'Closed' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateExamStatus(exam.id, 'Closed');
                                          setActionMenuExamId(null);
                                        }}
                                        className="exam-dropdown-item"
                                      >
                                        <Lock size={14} color="#64748b" style={{ flexShrink: 0 }} />
                                        <span>Close Examination</span>
                                      </button>
                                    )}
                                    {exam.status === 'Closed' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateExamStatus(exam.id, 'Draft');
                                          setActionMenuExamId(null);
                                        }}
                                        className="exam-dropdown-item"
                                      >
                                        <Clock size={14} color="#d97706" style={{ flexShrink: 0 }} />
                                        <span>Set to Draft</span>
                                      </button>
                                    )}
                                    <div className="exam-dropdown-divider" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onNavigateToTab('enter_marks', exam.id);
                                        setActionMenuExamId(null);
                                      }}
                                      className="exam-dropdown-item"
                                    >
                                      <Sliders size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                                      <span>Configure Subject Marks</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onNavigateToTab('view_results', exam.id);
                                        setActionMenuExamId(null);
                                      }}
                                      className="exam-dropdown-item"
                                      style={{ color: '#2563eb', fontWeight: 600 }}
                                    >
                                      <FileText size={14} style={{ flexShrink: 0 }} />
                                      <span>Generate DMCs</span>
                                    </button>
                                    <div className="exam-dropdown-divider" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuExamId(null);
                                        setDeleteTarget(exam);
                                      }}
                                      className="exam-dropdown-item danger"
                                    >
                                      <Trash2 size={14} style={{ flexShrink: 0 }} />
                                      <span>Delete Examination</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Navigation & Pagination */}
            <div className="exam-table-footer">
              <div className="exam-table-footer-left">
                Showing{' '}
                <strong>
                  {filteredExams.length === 0
                    ? 0
                    : (activePage - 1) * (pageSize === 0 ? filteredExams.length : pageSize) + 1}
                </strong>{' '}
                to{' '}
                <strong>
                  {pageSize === 0
                    ? filteredExams.length
                    : Math.min(activePage * pageSize, filteredExams.length)}
                </strong>{' '}
                of <strong>{filteredExams.length}</strong> examination records
              </div>

              <div className="exam-table-pagination">
                <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="exam-per-page-select"
                  aria-label="Records per page"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={0}>All</option>
                </select>

                {totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={activePage <= 1}
                      className="exam-pagination-btn"
                      title="Previous page"
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>

                    <span className="exam-pagination-info">
                      {activePage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage >= totalPages}
                      className="exam-pagination-btn"
                      title="Next page"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="exam-empty-card">
            <div className="exam-empty-icon-wrap">
              <Calendar size={26} />
            </div>
            <h3 className="exam-empty-title">
              {isFiltered
                ? 'No examinations match your search or filters'
                : 'No examinations found'}
            </h3>
            <p className="exam-empty-desc">
              {isFiltered
                ? 'Try adjusting your search query, session, or status filters to view more records.'
                : 'Create your first examination to configure subjects, set schedules, and record marks.'}
            </p>
            {isFiltered ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-results-secondary"
                style={{ margin: '0 auto' }}
              >
                <RotateCcw size={14} />
                <span>Reset All Filters</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenCreateExamModal}
                className="btn-exam-primary"
                style={{ margin: '0 auto' }}
              >
                <Plus size={16} />
                <span>Create Examination</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── 5. Rich Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div
          className="exam-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '24px 24px 16px', display: 'flex', gap: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: '0 0 6px',
                  }}
                >
                  Delete Examination
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Are you sure you want to permanently delete{' '}
                  <strong>{deleteTarget.name}</strong>?
                </p>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#9f1239',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Warning:</strong> Deleting this examination will permanently remove its
                  scheduled subject configuration and any mark entries recorded for it. This
                  operation cannot be reversed.
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: '12px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="btn-exam-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteExam(deleteTarget.id);
                    setDeleteTarget(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isDeleting ? (
                  <>
                    <span className="exam-spinner" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
