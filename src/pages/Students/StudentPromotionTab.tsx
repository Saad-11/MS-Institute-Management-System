import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  History,
  Search,
  RotateCcw,
  UserMinus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  PromotionAction,
  PromotionCandidate,
  PromotionLogItem,
} from '../../types/electron';
import '../../styles/promotion.css';

export interface StudentPromotionTabProps {
  sessionToken: string;
  onBack?: () => void;
  onPromoted?: (targetSessionId: number, targetClassId?: number) => void;
}

interface SelectedCandidateAction {
  action: PromotionAction;
  selected: boolean;
  remarks?: string;
}

export const StudentPromotionTab: React.FC<StudentPromotionTabProps> = ({ sessionToken, onBack, onPromoted }) => {
  const [activeTab, setActiveTab] = useState<'promote' | 'history'>('promote');

  // Common State
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Promote Tab State - Source
  const [sourceSessionId, setSourceSessionId] = useState<number | ''>('');
  const [sourceClassId, setSourceClassId] = useState<number | ''>('');
  const [sourceSectionId, setSourceSectionId] = useState<number | ''>('');
  const [sourceSections, setSourceSections] = useState<SectionItem[]>([]);

  // Promote Tab State - Destination
  const [destSessionId, setDestSessionId] = useState<number | ''>('');
  const [destClassId, setDestClassId] = useState<number | ''>('');
  const [destSectionId, setDestSectionId] = useState<number | ''>('');
  const [destSections, setDestSections] = useState<SectionItem[]>([]);

  // Candidates & Selection
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateActions, setCandidateActions] = useState<Record<number, SelectedCandidateAction>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Execution & Notifications
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // History Tab State
  const [logs, setLogs] = useState<PromotionLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  // Fetch initial data (Sessions & Classes)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (window.electronAPI?.sessions) {
          const sessionsRes = await window.electronAPI.sessions.getAll();
          if (sessionsRes.success && sessionsRes.sessions) {
            setSessions(sessionsRes.sessions);
            const activeSession = sessionsRes.sessions.find((s: AcademicSession) => s.isActive);
            const activeIdx = activeSession
              ? sessionsRes.sessions.findIndex((s: AcademicSession) => s.id === activeSession.id)
              : -1;

            if (activeIdx > 0) {
              // Active session is a subsequent session (e.g. 2026-2027), so source is the prior session (2025-2026) and destination is the active session
              setSourceSessionId(sessionsRes.sessions[activeIdx - 1].id);
              setDestSessionId(activeSession!.id);
            } else if (activeSession) {
              setSourceSessionId(activeSession.id);
              if (sessionsRes.sessions.length > 1) {
                setDestSessionId(sessionsRes.sessions[1].id);
              } else {
                setDestSessionId(activeSession.id);
              }
            } else if (sessionsRes.sessions.length > 0) {
              setSourceSessionId(sessionsRes.sessions[0].id);
              setDestSessionId(sessionsRes.sessions[sessionsRes.sessions.length > 1 ? 1 : 0].id);
            }
          }
        }

        if (window.electronAPI?.classes) {
          const classesRes = await window.electronAPI.classes.getAll();
          if (classesRes.success && classesRes.classes) {
            setClasses(classesRes.classes);
            if (classesRes.classes.length > 0) {
              const firstClass = classesRes.classes[0];
              setSourceClassId(firstClass.id);
              if (classesRes.classes.length > 1) {
                setDestClassId(classesRes.classes[1].id);
              } else {
                setDestClassId(firstClass.id);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial metadata:', err);
      }
    };
    fetchInitialData();
  }, [sessionToken]);

  // Fetch sections when source class changes
  useEffect(() => {
    const fetchSourceSections = async () => {
      if (!sourceClassId) {
        setSourceSections([]);
        setSourceSectionId('');
        return;
      }
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(sourceClassId));
          if (res.success && res.sections) {
            setSourceSections(res.sections);
          }
        }
      } catch (err) {
        console.error('Failed to load source sections:', err);
      }
    };
    fetchSourceSections();
  }, [sourceClassId]);

  // Fetch sections when dest class changes
  useEffect(() => {
    const fetchDestSections = async () => {
      if (!destClassId) {
        setDestSections([]);
        setDestSectionId('');
        return;
      }
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(destClassId));
          if (res.success && res.sections) {
            setDestSections(res.sections);
            if (res.sections.length > 0 && (!destSectionId || !res.sections.some((s: SectionItem) => s.id === Number(destSectionId)))) {
              setDestSectionId(res.sections[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load destination sections:', err);
      }
    };
    fetchDestSections();
  }, [destClassId]);

  // Handler for source session selection with auto-suggesting next destination session
  const handleSourceSessionChange = (newSessionId: number | '') => {
    setSourceSessionId(newSessionId);
    if (newSessionId && sessions.length > 0) {
      const idx = sessions.findIndex((s) => s.id === Number(newSessionId));
      if (idx !== -1 && idx + 1 < sessions.length) {
        setDestSessionId(sessions[idx + 1].id);
      } else if (sessions.length > 1 && idx === sessions.length - 1) {
        setDestSessionId(sessions[idx].id);
      }
    }
  };

  // Handler for source class selection with auto-suggesting next destination class
  const handleSourceClassChange = (newClassId: number | '') => {
    setSourceClassId(newClassId);
    if (newClassId && classes.length > 0) {
      const idx = classes.findIndex((c) => c.id === Number(newClassId));
      if (idx !== -1 && idx + 1 < classes.length) {
        setDestClassId(classes[idx + 1].id);
      }
    }
  };

  // Load Candidates core logic
  const loadCandidates = useCallback(async (isManualTrigger = false) => {
    if (!sourceSessionId || !sourceClassId) {
      if (isManualTrigger) {
        setNotification({ type: 'error', message: 'Please select Source Academic Session and Class.' });
      }
      return;
    }

    setIsLoadingCandidates(true);
    setNotification(null);
    setCandidates([]);
    setCandidateActions({});
    setSearchFilter('');
    setHasAttemptedLoad(true);

    try {
      if (window.electronAPI?.promotions) {
        const res = await window.electronAPI.promotions.getCandidates({
          fromSessionId: Number(sourceSessionId),
          fromClassId: Number(sourceClassId),
          fromSectionId: sourceSectionId ? Number(sourceSectionId) : undefined,
          toSessionId: destSessionId ? Number(destSessionId) : undefined,
        });

        if (res.success && res.candidates) {
          setCandidates(res.candidates);

          // Initialize actions
          const initialActions: Record<number, SelectedCandidateAction> = {};
          res.candidates.forEach((c: PromotionCandidate) => {
            initialActions[c.studentId] = {
              action: c.recommendedAction || 'Promote',
              selected: !c.alreadyEnrolledInDestination,
            };
          });
          setCandidateActions(initialActions);
        } else {
          setNotification({ type: 'error', message: res.error || 'Failed to load candidates.' });
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'An unexpected error occurred while loading candidates.' });
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [sourceSessionId, sourceClassId, sourceSectionId, destSessionId]);

  // Automatically fetch candidates when source session, class, section, or dest session change
  useEffect(() => {
    if (sourceSessionId && sourceClassId) {
      loadCandidates(false);
    }
  }, [loadCandidates]);

  // Filtered Candidates based on local search
  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const query = searchFilter.toLowerCase().trim();
    return candidates.filter((c) => {
      const name = (c.displayName || '').toLowerCase();
      const sysId = (c.systemStudentId || '').toLowerCase();
      const admNo = (c.admissionNumber || '').toLowerCase();
      const roll = (c.currentRollNumber || '').toLowerCase();
      const father = (c.fatherName || '').toLowerCase();
      return (
        name.includes(query) ||
        sysId.includes(query) ||
        admNo.includes(query) ||
        roll.includes(query) ||
        father.includes(query)
      );
    });
  }, [candidates, searchFilter]);

  // Select all / Deselect all
  const handleSelectAll = (checked: boolean) => {
    const newActions = { ...candidateActions };
    filteredCandidates.forEach((c) => {
      if (newActions[c.studentId]) {
        newActions[c.studentId].selected = checked;
      }
    });
    setCandidateActions(newActions);
  };

  const isAllSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => candidateActions[c.studentId]?.selected);
  const isSomeSelected =
    filteredCandidates.some((c) => candidateActions[c.studentId]?.selected) && !isAllSelected;

  const handleActionChange = (
    studentId: number,
    field: keyof SelectedCandidateAction,
    value: any
  ) => {
    setCandidateActions((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(candidateActions).filter((a) => a.selected).length;
  }, [candidateActions]);

  const actionCounts = useMemo(() => {
    const counts = { Promote: 0, Retain: 0, Graduate: 0, Transfer: 0, Left: 0 };
    Object.values(candidateActions).forEach((a) => {
      if (a.selected && a.action) {
        counts[a.action] = (counts[a.action] || 0) + 1;
      }
    });
    return counts;
  }, [candidateActions]);

  // Names for summary
  const sourceSessionName = sessions.find((s) => s.id === Number(sourceSessionId))?.name || 'Current Session';
  const sourceClassName = classes.find((c) => c.id === Number(sourceClassId))?.name || 'Selected Class';
  const destSessionName = sessions.find((s) => s.id === Number(destSessionId))?.name || 'Next Session';
  const destClassName = destClassId
    ? classes.find((c) => c.id === Number(destClassId))?.name || 'Selected Class'
    : 'Auto / Same Class';

  // Execute Promotion
  const handleExecutePromotion = async () => {
    if (!destSessionId) {
      setNotification({ type: 'error', message: 'Please select a destination academic session.' });
      return;
    }

    const studentsToProcess = candidates
      .filter((c) => candidateActions[c.studentId]?.selected)
      .map((c) => {
        const action = candidateActions[c.studentId].action;
        return {
          studentId: c.studentId,
          action,
          toClassId: action === 'Promote' && destClassId ? Number(destClassId) : undefined,
          toSectionId: action === 'Promote' && destSectionId ? Number(destSectionId) : undefined,
          remarks: candidateActions[c.studentId].remarks || '',
        };
      });

    if (studentsToProcess.length === 0) {
      setNotification({ type: 'error', message: 'No students selected for promotion.' });
      setShowConfirmModal(false);
      return;
    }

    setIsExecuting(true);
    setNotification(null);
    setShowConfirmModal(false);

    try {
      if (window.electronAPI?.promotions) {
        const res = await window.electronAPI.promotions.execute({
          sessionToken,
          fromSessionId: Number(sourceSessionId),
          toSessionId: Number(destSessionId),
          fromClassId: Number(sourceClassId),
          toClassId: destClassId ? Number(destClassId) : undefined,
          fromSectionId: sourceSectionId ? Number(sourceSectionId) : undefined,
          toSectionId: destSectionId ? Number(destSectionId) : undefined,
          promotions: studentsToProcess,
        });

        if (res.success) {
          const count = res.processedCount;
          setNotification({
            type: 'success',
            message: `Successfully processed ${count} student(s) into ${destSessionName} (${destClassName}).`,
          });
          if (onPromoted) {
            onPromoted(Number(destSessionId), destClassId ? Number(destClassId) : undefined);
          }
          loadCandidates(false);
        } else {
          setNotification({ type: 'error', message: res.error || 'Failed to execute promotion.' });
        }
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'An unexpected error occurred during promotion execution.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirmClick = () => {
    if (!destSessionId) {
      setNotification({
        type: 'error',
        message: 'Please select Destination Academic Session before confirming promotion.',
      });
      return;
    }
    setShowConfirmModal(true);
  };

  // Load History
  const loadHistory = async (page: number) => {
    setIsLoadingLogs(true);
    try {
      if (window.electronAPI?.promotions) {
        const res = await window.electronAPI.promotions.getLogs({ page, limit: 15 });
        if (res.success && res.logs) {
          setLogs(res.logs);
          setLogsPage(res.page || 1);
          setLogsTotalPages(res.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory(1);
    }
  }, [activeTab]);

  return (
    <div className="promo-container">
      {/* ─── 1. Header Card ──────────────────────────────────────────────── */}
      <div className="promo-header-card">
        <div className="promo-header-left">
          <div className="promo-header-icon-box">
            <GraduationCap size={24} />
          </div>
          <div className="promo-header-title-group">
            <h1 className="promo-header-title">Promote Students</h1>
            <p className="promo-header-subtitle">
              Move students to their next academic session and class with academic history tracking.
            </p>
          </div>
        </div>

        <div className="promo-header-actions">
          {onBack && (
            <button type="button" onClick={onBack} className="promo-btn-back">
              <ArrowLeft size={14} />
              <span>Back to Students</span>
            </button>
          )}

          <div className="promo-tab-toggle">
            <button
              type="button"
              onClick={() => setActiveTab('promote')}
              className={`promo-tab-btn ${activeTab === 'promote' ? 'active' : ''}`}
            >
              <ArrowUpRight size={14} />
              <span>Promote Students</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`promo-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            >
              <History size={14} />
              <span>Promotion History</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Alert Notification ───────────────────────────────────────── */}
      {notification && (
        <div className={`promo-alert promo-alert-${notification.type}`}>
          <div className="promo-alert-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{notification.message}</span>
            {notification.type === 'success' && onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  marginLeft: 'auto',
                  marginRight: '8px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>View in Students Directory</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="promo-alert-close"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── 3. Promote Students Tab ─────────────────────────────────────── */}
      {activeTab === 'promote' && (
        <>
          {/* Two-step configuration workflow */}
          <div className="promo-steps-wrapper">
            {/* Step 1: Source */}
            <div className="promo-step-card">
              <div className="promo-step-header">
                <span className="promo-step-badge step-1">1</span>
                <div className="promo-step-title-group">
                  <h3 className="promo-step-title">Source Configuration</h3>
                  <p className="promo-step-subtitle">Select current session, class and section</p>
                </div>
              </div>

              <div className="promo-form-grid">
                <div className="promo-form-group">
                  <label className="promo-label">
                    From Session <span className="req">*</span>
                  </label>
                  <select
                    className="promo-select"
                    value={sourceSessionId}
                    onChange={(e) => handleSourceSessionChange(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select Session...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isActive ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Current session</span>
                </div>

                <div className="promo-form-group">
                  <label className="promo-label">
                    From Class <span className="req">*</span>
                  </label>
                  <select
                    className="promo-select"
                    value={sourceClassId}
                    onChange={(e) => handleSourceClassChange(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Class to promote from</span>
                </div>

                <div className="promo-form-group">
                  <label className="promo-label">From Section</label>
                  <select
                    className="promo-select"
                    value={sourceSectionId}
                    onChange={(e) => setSourceSectionId(e.target.value ? Number(e.target.value) : '')}
                    disabled={!sourceClassId}
                  >
                    <option value="">All Sections</option>
                    {sourceSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Optional filter</span>
                </div>
              </div>
            </div>

            {/* Direction Bridge */}
            <div className="promo-arrow-bridge">
              <div className="promo-arrow-circle">
                <ArrowRight size={20} />
              </div>
              <span className="promo-arrow-label">Direction</span>
            </div>

            {/* Step 2: Destination */}
            <div className="promo-step-card">
              <div className="promo-step-header">
                <span className="promo-step-badge step-2">2</span>
                <div className="promo-step-title-group">
                  <h3 className="promo-step-title">Destination Configuration</h3>
                  <p className="promo-step-subtitle">Target session, class and section</p>
                </div>
              </div>

              <div className="promo-form-grid">
                <div className="promo-form-group">
                  <label className="promo-label">
                    To Session <span className="req">*</span>
                  </label>
                  <select
                    className="promo-select"
                    value={destSessionId}
                    onChange={(e) => setDestSessionId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select Session...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Next academic session</span>
                </div>

                <div className="promo-form-group">
                  <label className="promo-label">To Class</label>
                  <select
                    className="promo-select"
                    value={destClassId}
                    onChange={(e) => setDestClassId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Auto / Same Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Target class</span>
                </div>

                <div className="promo-form-group">
                  <label className="promo-label">To Section</label>
                  <select
                    className="promo-select"
                    value={destSectionId}
                    onChange={(e) => setDestSectionId(e.target.value ? Number(e.target.value) : '')}
                    disabled={!destClassId}
                  >
                    <option value="">Auto / Same Section...</option>
                    {destSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                  <span className="promo-helper-text">Target section</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar & Candidate Summary Cards */}
          <div className="promo-action-card">
            <div className="promo-action-top-row">
              <div className="promo-action-left">
                <button
                  type="button"
                  onClick={() => loadCandidates(true)}
                  disabled={isLoadingCandidates || !sourceSessionId || !sourceClassId}
                  className="promo-btn-load"
                >
                  {isLoadingCandidates ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Loading Candidates...</span>
                    </>
                  ) : (
                    <>
                      <Users size={16} />
                      <span>Load Students</span>
                    </>
                  )}
                </button>

                {candidates.length > 0 && (
                  <span className="promo-count-pill">
                    {candidates.length} student{candidates.length === 1 ? '' : 's'} available
                  </span>
                )}
              </div>

              {candidates.length > 0 && (
                <div className="promo-search-wrap">
                  <Search size={15} className="promo-search-icon" />
                  <input
                    type="search"
                    placeholder="Search by name, ID, adm no..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="promo-search-input"
                  />
                </div>
              )}
            </div>

            {/* Summary Stat Cards */}
            {candidates.length > 0 && (
              <div className="promo-stats-grid">
                <div className="promo-stat-card stat-promote">
                  <div className="promo-stat-icon">
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="promo-stat-details">
                    <span className="promo-stat-val">{actionCounts.Promote || 0}</span>
                    <span className="promo-stat-lbl">To Be Promoted</span>
                  </div>
                </div>

                <div className="promo-stat-card stat-retain">
                  <div className="promo-stat-icon">
                    <RotateCcw size={18} />
                  </div>
                  <div className="promo-stat-details">
                    <span className="promo-stat-val">{actionCounts.Retain || 0}</span>
                    <span className="promo-stat-lbl">To Be Retained</span>
                  </div>
                </div>

                <div className="promo-stat-card stat-graduate">
                  <div className="promo-stat-icon">
                    <GraduationCap size={18} />
                  </div>
                  <div className="promo-stat-details">
                    <span className="promo-stat-val">{actionCounts.Graduate || 0}</span>
                    <span className="promo-stat-lbl">Graduating</span>
                  </div>
                </div>

                <div className="promo-stat-card stat-other">
                  <div className="promo-stat-icon">
                    <UserMinus size={18} />
                  </div>
                  <div className="promo-stat-details">
                    <span className="promo-stat-val">
                      {(actionCounts.Transfer || 0) + (actionCounts.Left || 0)}
                    </span>
                    <span className="promo-stat-lbl">Transfer / Left</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table Card */}
          <div className="promo-table-card">
            <div className="promo-table-header-bar">
              <label className="promo-select-all-wrap">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => input && (input.indeterminate = isSomeSelected)}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  disabled={candidates.length === 0}
                  className="promo-checkbox"
                />
                <span className="promo-select-all-label">
                  Select All ({selectedCount} of {candidates.length} students selected)
                </span>
              </label>

              {searchFilter && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Showing {filteredCandidates.length} of {candidates.length} students
                </span>
              )}
            </div>

            <div className="promo-table-wrap">
              <table className="promo-table">
                <thead>
                  <tr>
                    <th style={{ width: '44px', textAlign: 'center' }}>#</th>
                    <th>Student Details</th>
                    <th>Current Class & Roll</th>
                    <th style={{ textAlign: 'center' }}>Attendance</th>
                    <th style={{ textAlign: 'center' }}>Exam Result</th>
                    <th style={{ width: '180px' }}>Promotion Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="promo-empty-state">
                          {isLoadingCandidates ? (
                            <>
                              <RefreshCw size={32} className="animate-spin" style={{ color: '#2563eb' }} />
                              <h4 className="promo-empty-title">Loading student records...</h4>
                              <p className="promo-empty-desc">Fetching academic history, exam results, and attendance records.</p>
                            </>
                          ) : searchFilter ? (
                            <>
                              <div className="promo-empty-icon">
                                <Search size={28} />
                              </div>
                              <h4 className="promo-empty-title">No students match "{searchFilter}"</h4>
                              <p className="promo-empty-desc">Try clearing or adjusting your search term.</p>
                            </>
                          ) : hasAttemptedLoad ? (
                            <>
                              <div className="promo-empty-icon">
                                <Users size={28} />
                              </div>
                              <h4 className="promo-empty-title">No active students found</h4>
                              <p className="promo-empty-desc">
                                There are currently no actively enrolled students in <strong>{sourceSessionName}</strong> for <strong>{sourceClassName}</strong>{sourceSectionId ? ` (${sourceSections.find(s => s.id === Number(sourceSectionId))?.name ? 'Section ' + sourceSections.find(s => s.id === Number(sourceSectionId))?.name : 'Section ' + sourceSectionId})` : ''}.
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="promo-empty-icon">
                                <Users size={28} />
                              </div>
                              <h4 className="promo-empty-title">No candidates loaded yet</h4>
                              <p className="promo-empty-desc">
                                Select source session and class above to view eligible students for promotion.
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate) => {
                      const actionData = candidateActions[candidate.studentId];
                      const isEnrolled = candidate.alreadyEnrolledInDestination;
                      const isSelected = actionData?.selected || false;

                      let attBadgeClass = 'badge-att-low';
                      if (candidate.attendancePercentage !== null) {
                        if (candidate.attendancePercentage >= 90) attBadgeClass = 'badge-att-high';
                        else if (candidate.attendancePercentage >= 75) attBadgeClass = 'badge-att-mid';
                      }

                      return (
                        <tr
                          key={candidate.studentId}
                          className={`${isSelected ? 'row-selected' : ''} ${isEnrolled ? 'row-enrolled' : ''}`}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleActionChange(candidate.studentId, 'selected', e.target.checked)}
                              className="promo-checkbox"
                            />
                          </td>
                          <td>
                            <div className="promo-student-info">
                              <span className="promo-student-name">{candidate.displayName}</span>
                              <div className="promo-student-meta">
                                <span>ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{candidate.systemStudentId}</strong></span>
                                <span>•</span>
                                <span>Adm: {candidate.admissionNumber}</span>
                                <span>•</span>
                                <span>S/D of {candidate.fatherName}</span>
                              </div>
                              {isEnrolled && (
                                <span className="promo-badge-enrolled">
                                  <AlertTriangle size={11} />
                                  <span>Already Enrolled in Destination</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong style={{ color: '#1e293b' }}>
                                {candidate.currentClassName} - {candidate.currentSectionName}
                              </strong>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                                Roll No: <strong style={{ color: '#0f172a' }}>{candidate.currentRollNumber || 'N/A'}</strong>
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {candidate.attendancePercentage !== null ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span className={`promo-badge ${attBadgeClass}`}>
                                  {candidate.attendancePercentage.toFixed(1)}%
                                </span>
                                <span style={{ fontSize: '0.675rem', color: '#64748b' }}>
                                  {candidate.attendancePresentDays} / {candidate.attendanceTotalDays} days
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              {candidate.examResultStatus === 'Pass' && (
                                <span className="promo-badge badge-pass">Pass</span>
                              )}
                              {candidate.examResultStatus === 'Fail' && (
                                <span className="promo-badge badge-fail">Fail</span>
                              )}
                              {candidate.examResultStatus === 'N/A' && (
                                <span className="promo-badge badge-na">N/A</span>
                              )}
                              {candidate.examPercentage !== null && (
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {candidate.examPercentage.toFixed(1)}% {candidate.examGrade ? `(${candidate.examGrade})` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <select
                              className="promo-action-select"
                              value={actionData?.action || 'Promote'}
                              onChange={(e) =>
                                handleActionChange(candidate.studentId, 'action', e.target.value as PromotionAction)
                              }
                            >
                              <option value="Promote">Promote</option>
                              <option value="Retain">Retain</option>
                              <option value="Graduate">Graduate</option>
                              <option value="Transfer">Transfer</option>
                              <option value="Left">Left</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Confirmation Footer Bar */}
            <div className="promo-footer-bar">
              <div className="promo-summary-chips">
                <span>Summary:</span>
                <span className="promo-chip">{sourceSessionName} ({sourceClassName})</span>
                <ArrowRight size={14} style={{ color: '#2563eb' }} />
                <span className="promo-chip">{destSessionName} ({destClassName})</span>
                <span>•</span>
                <span className="promo-count-chip">{selectedCount} student(s) selected</span>
              </div>

              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={selectedCount === 0 || isExecuting}
                className="promo-btn-confirm"
              >
                <span>Confirm Promotion</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── 4. Promotion History Tab ────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="promo-history-card">
          <div className="promo-history-header">
            <div className="promo-history-title-group">
              <h2>Promotion Audit History</h2>
              <p>Log of all executed student promotion and transition events</p>
            </div>
            <button
              type="button"
              onClick={() => loadHistory(logsPage)}
              className="promo-btn-refresh"
            >
              <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="promo-table-wrap">
            <table className="promo-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student Name & ID</th>
                  <th>Transition Pathway</th>
                  <th style={{ textAlign: 'center' }}>Action Taken</th>
                  <th>Performed By</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="promo-empty-state">
                        {isLoadingLogs ? (
                          <>
                            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
                            <h4 className="promo-empty-title">Loading history logs...</h4>
                          </>
                        ) : (
                          <>
                            <div className="promo-empty-icon">
                              <History size={26} />
                            </div>
                            <h4 className="promo-empty-title">No promotion logs found</h4>
                            <p className="promo-empty-desc">Past promotions will appear here once executed.</p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    let chipClass = 'chip-promote';
                    if (log.action === 'Retain') chipClass = 'chip-retain';
                    else if (log.action === 'Graduate') chipClass = 'chip-graduate';
                    else if (log.action === 'Transfer' || log.action === 'Left') chipClass = 'chip-other';

                    return (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600, color: '#475569' }}>
                          {new Date(log.promotionDate).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: '#0f172a' }}>{log.studentName}</strong>
                            <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                              {log.studentSystemId}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                            <strong style={{ color: '#1e293b' }}>{log.fromSessionName}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              ({log.fromClassName} {log.fromSectionName})
                            </span>
                            <ArrowRight size={13} style={{ color: '#2563eb' }} />
                            <strong style={{ color: '#1e293b' }}>{log.toSessionName || 'N/A'}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              ({log.toClassName || '-'} {log.toSectionName || '-'})
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`promo-modal-chip ${chipClass}`}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ color: '#475569' }}>
                          {log.performedByUserName || 'System Administrator'}
                        </td>
                        <td style={{ color: '#64748b', fontStyle: 'italic' }}>
                          {log.remarks || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {logsTotalPages > 1 && (
            <div className="promo-pagination-bar">
              <button
                type="button"
                disabled={logsPage <= 1}
                onClick={() => loadHistory(logsPage - 1)}
                className="promo-btn-page"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span>
                Page <strong>{logsPage}</strong> of <strong>{logsTotalPages}</strong>
              </span>
              <button
                type="button"
                disabled={logsPage >= logsTotalPages}
                onClick={() => loadHistory(logsPage + 1)}
                className="promo-btn-page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── 5. Confirmation Modal ───────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="promo-modal-backdrop">
          <div className="promo-modal-card">
            <div className="promo-modal-header">
              <div className="promo-modal-title-group">
                <div className="promo-modal-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="promo-modal-title">Confirm Student Promotion</h3>
                  <p className="promo-modal-subtitle">Review selected students and their corresponding transition actions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="promo-modal-body">
              <div className="promo-modal-notice">
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  You are about to execute the promotion workflow for <strong>{selectedCount}</strong> students. New
                  academic enrollments will be created in <strong>{destSessionName}</strong>.
                </span>
              </div>

              <div className="promo-modal-chips-row">
                {actionCounts.Promote > 0 && (
                  <span className="promo-modal-chip chip-promote">
                    Promote: {actionCounts.Promote}
                  </span>
                )}
                {actionCounts.Retain > 0 && (
                  <span className="promo-modal-chip chip-retain">
                    Retain: {actionCounts.Retain}
                  </span>
                )}
                {actionCounts.Graduate > 0 && (
                  <span className="promo-modal-chip chip-graduate">
                    Graduate: {actionCounts.Graduate}
                  </span>
                )}
                {(actionCounts.Transfer > 0 || actionCounts.Left > 0) && (
                  <span className="promo-modal-chip chip-other">
                    Transfer/Left: {(actionCounts.Transfer || 0) + (actionCounts.Left || 0)}
                  </span>
                )}
              </div>

              <div className="promo-modal-table-wrap">
                <table className="promo-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Assigned Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates
                      .filter((c) => candidateActions[c.studentId]?.selected)
                      .slice(0, 50)
                      .map((c) => (
                        <tr key={c.studentId}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.displayName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#64748b' }}>{c.systemStudentId}</td>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>
                            {candidateActions[c.studentId].action}
                          </td>
                        </tr>
                      ))}
                    {selectedCount > 50 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                          ...and {selectedCount - 50} more selected student(s)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="promo-modal-footer">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="promo-btn-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isExecuting}
                className="promo-btn-confirm"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Executing Promotion...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Confirm & Execute</span>
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
