import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  PlayCircle,
  Eye,
  FileText,
  BarChart2,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  GraduationCap,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { AcademicSession, ExaminationItem, ExamStatus, ClassItem } from '../../types/electron';

interface ResultDashboardTabProps {
  sessions: AcademicSession[];
  selectedSessionId: number;
  onSelectSessionId: (id: number) => void;
  examinations: ExaminationItem[];
  classes?: ClassItem[];
  onOpenNewExamModal: () => void;
  onNavigateToTab: (
    tabKey: 'dashboard' | 'create_exam' | 'enter_marks' | 'view_results' | 'reports' | 'settings',
    examId?: number
  ) => void;
  onUpdateExamStatus: (examId: number, status: ExamStatus) => Promise<void>;
}

export const ResultDashboardTab: React.FC<ResultDashboardTabProps> = ({
  sessions,
  selectedSessionId,
  onSelectSessionId,
  examinations,
  classes = [],
  onOpenNewExamModal,
  onNavigateToTab,
  onUpdateExamStatus,
}) => {
  const [showWorkflowGuide, setShowWorkflowGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem('results_guide_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissGuide = () => {
    setShowWorkflowGuide(false);
    try {
      localStorage.setItem('results_guide_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // Filter examinations by selected session
  const filteredExams = examinations.filter(
    (e) => !selectedSessionId || e.academicSessionId === selectedSessionId
  );

  // Summary Metrics calculated dynamically from real database records
  const totalExams = filteredExams.length;
  const openExams = filteredExams.filter((e) => e.status === 'Open').length;
  const completedExams = filteredExams.filter((e) => e.status === 'Closed').length;
  const draftExams = filteredExams.filter((e) => e.status === 'Draft').length;

  // Percentage calculations for progress meters
  const openPct = totalExams > 0 ? Math.round((openExams / totalExams) * 100) : 0;
  const completedPct = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0;
  const draftPct = totalExams > 0 ? Math.round((draftExams / totalExams) * 100) : 0;

  // Unique participating classes calculation
  const participatingClassSet = new Set<string>();
  filteredExams.forEach((e) => {
    if (e.participatingClasses && e.participatingClasses.length > 0) {
      e.participatingClasses.forEach((c) => participatingClassSet.add(c));
    }
  });
  const totalParticipatingClasses =
    participatingClassSet.size > 0 ? participatingClassSet.size : classes.length;

  // Active session object & name
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];
  const sessionName = selectedSession ? selectedSession.name : 'All Sessions';

  // Sort examinations so active ones (Open) come first, then upcoming (Draft), then finalized (Closed)
  const prioritizedExams = [...filteredExams].sort((a, b) => {
    const statusPriority: Record<ExamStatus, number> = {
      Open: 1,
      Draft: 2,
      Closed: 3,
    };
    const diff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    if (diff !== 0) return diff;
    return b.id - a.id;
  });

  const renderStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
              }}
            />
            Marks Entry Open
          </span>
        );
      case 'Draft':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock style={{ width: '11px', height: '11px', color: '#d97706' }} />
            Upcoming Exam
          </span>
        );
      case 'Closed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              whiteSpace: 'nowrap',
            }}
          >
            <Lock style={{ width: '11px', height: '11px', color: '#64748b' }} />
            Results Published
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#475569',
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Top Control Strip (Session Selector & Quick Actions) ─── */}
      <div className="results-control-card">
        <div className="results-control-left">
          <div className="results-stat-icon-wrap results-stat-icon-blue">
            <Calendar size={20} />
          </div>
          <div className="results-session-select-wrap">
            <label className="results-session-label">Academic Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => onSelectSessionId(Number(e.target.value))}
              aria-label="Academic Session"
              className="results-session-select"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Current Session)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="results-quick-actions">
          <button
            type="button"
            onClick={onOpenNewExamModal}
            className="btn-results-primary"
            title="Create a new examination"
          >
            <Plus size={15} />
            <span>+ Create Examination</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('create_exam')}
            className="btn-results-secondary"
            title="Manage all examinations in detail"
          >
            <Calendar size={15} color="#2563eb" />
            <span>Examinations Manager</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('reports')}
            className="btn-results-secondary"
            title="View result reports & gazette"
          >
            <BarChart2 size={15} color="#7c3aed" />
            <span>Result Reports</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Key KPI Metric Cards ─── */}
      <div className="results-stats-grid">
        {/* Total Examinations */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Total Examinations</span>
            <div className="results-stat-value">{totalExams}</div>
            <span className="results-stat-sub">In selected session</span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-blue">
            <Calendar size={20} />
          </div>
        </div>

        {/* Marks Entry Active */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Marks Entry Open</span>
            <div className="results-stat-value" style={{ color: '#047857' }}>
              {openExams}
            </div>
            <span className="results-stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              Active for marks entry
            </span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-green">
            <PlayCircle size={20} />
          </div>
        </div>

        {/* Results Published */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Results Published</span>
            <div className="results-stat-value">{completedExams}</div>
            <span className="results-stat-sub">Exams finalized &amp; closed</span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-slate">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Upcoming / Draft */}
        <div className="results-stat-card">
          <div className="results-stat-info">
            <span className="results-stat-label">Draft / Upcoming</span>
            <div className="results-stat-value" style={{ color: '#b45309' }}>
              {draftExams}
            </div>
            <span className="results-stat-sub" style={{ color: '#d97706', fontWeight: 600 }}>
              Scheduled examinations
            </span>
          </div>
          <div className="results-stat-icon-wrap results-stat-icon-amber">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* ─── 3. Overview Dashboard Layout (2 Columns) ─── */}
      <div className="results-overview-grid">
        {/* ─── Left Main Column (60%): Recent & Active Examinations ─── */}
        <div className="overview-main-col">
          <div className="overview-panel-card">
            <div className="overview-panel-header">
              <div className="overview-panel-title-wrap">
                <h2>
                  <span>Active &amp; Recent Examinations</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {filteredExams.length} {filteredExams.length === 1 ? 'Exam' : 'Exams'}
                  </span>
                </h2>
                <p>Status, participating classes, and direct actions for exams in this session.</p>
              </div>

              {filteredExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('create_exam')}
                  className="overview-panel-link-btn"
                  title="Switch to detailed Examinations tab"
                >
                  <span>Manage in Examinations Tab</span>
                  <ChevronRight size={13} />
                </button>
              )}
            </div>

            <div className="overview-panel-body">
              {prioritizedExams.length > 0 ? (
                <div className="overview-exam-cards-list">
                  {prioritizedExams.map((exam) => {
                    const classList =
                      exam.participatingClasses && exam.participatingClasses.length > 0
                        ? exam.participatingClasses
                        : classes.length > 0
                        ? classes.map((c) => c.name)
                        : [];

                    const isOpen = exam.status === 'Open';
                    const isDraft = exam.status === 'Draft';
                    const isClosed = exam.status === 'Closed';

                    return (
                      <div key={exam.id} className="overview-exam-item-card">
                        {/* Top: Icon + Title + Status Pill */}
                        <div className="overview-exam-top-row">
                          <div className="overview-exam-title-group">
                            <div
                              className={`overview-exam-icon-box ${
                                isOpen
                                  ? 'overview-exam-icon-open'
                                  : isDraft
                                  ? 'overview-exam-icon-draft'
                                  : 'overview-exam-icon-closed'
                              }`}
                            >
                              {isOpen ? (
                                <PlayCircle size={18} />
                              ) : isDraft ? (
                                <Clock size={18} />
                              ) : (
                                <Lock size={18} />
                              )}
                            </div>
                            <div>
                              <div className="overview-exam-name">{exam.name}</div>
                              {exam.description && (
                                <div className="overview-exam-desc">{exam.description}</div>
                              )}
                            </div>
                          </div>

                          <div>{renderStatusBadge(exam.status)}</div>
                        </div>

                        {/* Middle: Details Strip (Dates, Classes, Session) */}
                        <div className="overview-exam-meta-row">
                          <div className="overview-meta-pill">
                            <Calendar size={12} color="#64748b" />
                            <span>
                              {exam.startDate} – {exam.endDate}
                            </span>
                          </div>

                          <div className="overview-meta-pill">
                            <GraduationCap size={13} color="#64748b" />
                            <div className="overview-meta-classes">
                              {classList.length > 0 ? (
                                classList.map((cName) => (
                                  <span key={cName} className="overview-class-chip">
                                    {cName}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                                  All Classes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom: Context-aware Action Buttons */}
                        <div className="overview-exam-actions-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isOpen && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('enter_marks', exam.id)}
                                className="overview-action-btn-primary overview-action-btn-green"
                                title="Open marks entry for this exam"
                              >
                                <PlayCircle size={14} />
                                <span>Enter Marks</span>
                              </button>
                            )}

                            {isDraft && (
                              <button
                                type="button"
                                onClick={() => onUpdateExamStatus(exam.id, 'Open')}
                                className="overview-action-btn-primary"
                                title="Activate this examination for marks entry"
                              >
                                <Unlock size={14} />
                                <span>Open Marks Entry</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onNavigateToTab('view_results', exam.id)}
                              className="overview-action-btn-secondary"
                              title="View results, merit positions and report cards"
                            >
                              <Eye size={13} />
                              <span>View Results</span>
                            </button>

                            {isClosed && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('view_results', exam.id)}
                                className="overview-action-btn-secondary"
                                title="Print student Detailed Marks Certificates"
                              >
                                <FileText size={13} />
                                <span>Print DMCs</span>
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isOpen ? (
                              <button
                                type="button"
                                onClick={() => onUpdateExamStatus(exam.id, 'Closed')}
                                className="overview-action-btn-secondary"
                                style={{ fontSize: '10.5px', color: '#475569' }}
                                title="Finalize and mark results published"
                              >
                                <Lock size={12} />
                                <span>Close / Finalize</span>
                              </button>
                            ) : isClosed ? (
                              <button
                                type="button"
                                onClick={() => onUpdateExamStatus(exam.id, 'Open')}
                                className="overview-action-btn-secondary"
                                style={{ fontSize: '10.5px', color: '#047857' }}
                                title="Re-open marks entry for revisions"
                              >
                                <Unlock size={12} />
                                <span>Re-open</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overview-empty-state">
                  <div className="overview-empty-icon-wrap">
                    <Calendar size={28} />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 'bold',
                        color: 'var(--color-neutral-800)',
                      }}
                    >
                      No Examinations Scheduled Yet
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-neutral-500)',
                        maxWidth: '360px',
                        marginTop: '4px',
                        lineHeight: 1.45,
                      }}
                    >
                      There are no examinations recorded in the current academic session. Create
                      your first exam to start recording marks and generating report cards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenNewExamModal}
                    className="btn-results-primary"
                    style={{ marginTop: '8px' }}
                  >
                    <Plus size={15} />
                    <span>Create First Examination</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Right Sidebar Column (40%): Analytics, Shortcuts & Guide ─── */}
        <div className="overview-side-col">
          {/* 1. Status Breakdown & Progress Meter */}
          <div className="overview-panel-card">
            <div className="overview-panel-header">
              <div className="overview-panel-title-wrap">
                <h2>
                  <BarChart2 size={16} color="#2563eb" />
                  <span>Exam Lifecycle &amp; Status</span>
                </h2>
                <p>Session completion and publishing status.</p>
              </div>
            </div>

            <div className="overview-panel-body">
              <div className="overview-breakdown-list">
                {/* Marks Entry Active */}
                <div className="overview-breakdown-item">
                  <div className="overview-breakdown-header">
                    <span className="overview-breakdown-title">
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#10b981',
                        }}
                      />
                      <span>Marks Entry Active</span>
                    </span>
                    <span className="overview-breakdown-count">
                      {openExams} / {totalExams} ({openPct}%)
                    </span>
                  </div>
                  <div className="overview-progress-track">
                    <div
                      className="overview-progress-bar-fill"
                      style={{ width: `${openPct}%`, background: '#10b981' }}
                    />
                  </div>
                </div>

                {/* Results Published */}
                <div className="overview-breakdown-item">
                  <div className="overview-breakdown-header">
                    <span className="overview-breakdown-title">
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#2563eb',
                        }}
                      />
                      <span>Results Published</span>
                    </span>
                    <span className="overview-breakdown-count">
                      {completedExams} / {totalExams} ({completedPct}%)
                    </span>
                  </div>
                  <div className="overview-progress-track">
                    <div
                      className="overview-progress-bar-fill"
                      style={{ width: `${completedPct}%`, background: '#2563eb' }}
                    />
                  </div>
                </div>

                {/* Draft / Upcoming */}
                <div className="overview-breakdown-item">
                  <div className="overview-breakdown-header">
                    <span className="overview-breakdown-title">
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#f59e0b',
                        }}
                      />
                      <span>Upcoming / Draft</span>
                    </span>
                    <span className="overview-breakdown-count">
                      {draftExams} / {totalExams} ({draftPct}%)
                    </span>
                  </div>
                  <div className="overview-progress-track">
                    <div
                      className="overview-progress-bar-fill"
                      style={{ width: `${draftPct}%`, background: '#f59e0b' }}
                    />
                  </div>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="overview-summary-strip">
                <div className="overview-summary-strip-item">
                  <span className="overview-summary-strip-label">Participating Classes</span>
                  <span className="overview-summary-strip-val">{totalParticipatingClasses}</span>
                </div>
                <div className="overview-summary-strip-item" style={{ textAlign: 'right' }}>
                  <span className="overview-summary-strip-label">Current Session</span>
                  <span className="overview-summary-strip-val">{sessionName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Quick Navigation Shortcuts */}
          <div className="overview-panel-card">
            <div className="overview-panel-header">
              <div className="overview-panel-title-wrap">
                <h2>
                  <Sparkles size={16} color="#7c3aed" />
                  <span>Quick Navigation Tools</span>
                </h2>
                <p>Jump directly to examination operations.</p>
              </div>
            </div>

            <div className="overview-panel-body" style={{ padding: '12px 16px' }}>
              <div className="overview-fast-track-grid">
                {/* Enter Subject Marks */}
                <div
                  className="overview-fast-track-item"
                  onClick={() => onNavigateToTab('enter_marks')}
                  title="Record student marks by subject"
                >
                  <div className="overview-fast-track-left">
                    <div
                      className="overview-fast-track-icon"
                      style={{ background: '#ecfdf5', color: '#059669' }}
                    >
                      <PlayCircle size={17} />
                    </div>
                    <div className="overview-fast-track-text">
                      <h4>Enter Subject Marks</h4>
                      <p>Record marks class-by-class with auto-grade preview</p>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#94a3b8" />
                </div>

                {/* View Results & Position Ranks */}
                <div
                  className="overview-fast-track-item"
                  onClick={() => onNavigateToTab('view_results')}
                  title="Inspect class positions, grade distributions and DMC print"
                >
                  <div className="overview-fast-track-left">
                    <div
                      className="overview-fast-track-icon"
                      style={{ background: '#eff6ff', color: '#2563eb' }}
                    >
                      <Eye size={17} />
                    </div>
                    <div className="overview-fast-track-text">
                      <h4>View Results &amp; Merit Lists</h4>
                      <p>Check student ranks, percentage, and print DMCs</p>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#94a3b8" />
                </div>

                {/* Result Reports & Gazette */}
                <div
                  className="overview-fast-track-item"
                  onClick={() => onNavigateToTab('reports')}
                  title="Generate official result gazette and summary reports"
                >
                  <div className="overview-fast-track-left">
                    <div
                      className="overview-fast-track-icon"
                      style={{ background: '#f5f3ff', color: '#7c3aed' }}
                    >
                      <BarChart2 size={17} />
                    </div>
                    <div className="overview-fast-track-text">
                      <h4>Result Reports &amp; Gazette</h4>
                      <p>Export comprehensive result sheets &amp; analytics</p>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#94a3b8" />
                </div>

                {/* Examinations Manager */}
                <div
                  className="overview-fast-track-item"
                  onClick={() => onNavigateToTab('create_exam')}
                  title="Full examination catalog with search, edit & filters"
                >
                  <div className="overview-fast-track-left">
                    <div
                      className="overview-fast-track-icon"
                      style={{ background: '#f8fafc', color: '#475569' }}
                    >
                      <Layers size={17} />
                    </div>
                    <div className="overview-fast-track-text">
                      <h4>Examinations Manager</h4>
                      <p>Manage, schedule, edit, or delete examinations</p>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#94a3b8" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Examination Workflow Guide (Collapsible) */}
          {showWorkflowGuide ? (
            <div className="results-workflow-container" style={{ margin: 0 }}>
              <div className="results-workflow-header" style={{ marginBottom: '10px' }}>
                <h3 className="results-workflow-title">
                  <CheckCircle2 size={15} color="#2563eb" />
                  <span>Standard Results Workflow</span>
                </h3>
                <button
                  type="button"
                  onClick={handleDismissGuide}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  Hide
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px',
                    color: '#334155',
                  }}
                >
                  <span className="results-workflow-number" style={{ width: '18px', height: '18px', fontSize: '10px' }}>
                    1
                  </span>
                  <span>
                    <strong>Create Exam</strong> with session &amp; class selection.
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px',
                    color: '#334155',
                  }}
                >
                  <span className="results-workflow-number" style={{ width: '18px', height: '18px', fontSize: '10px' }}>
                    2
                  </span>
                  <span>
                    <strong>Curriculum auto-loads</strong> max and passing marks.
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px',
                    color: '#334155',
                  }}
                >
                  <span className="results-workflow-number" style={{ width: '18px', height: '18px', fontSize: '10px' }}>
                    3
                  </span>
                  <span>
                    <strong>Enter Marks</strong> via numeric inputs with quick validation.
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px',
                    color: '#334155',
                  }}
                >
                  <span className="results-workflow-number" style={{ width: '18px', height: '18px', fontSize: '10px' }}>
                    4
                  </span>
                  <span>
                    <strong>Publish &amp; Print DMCs</strong> with ranks and official grades.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowWorkflowGuide(true);
                  try {
                    localStorage.removeItem('results_guide_dismissed');
                  } catch {}
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                <span>Show Workflow Guide</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
