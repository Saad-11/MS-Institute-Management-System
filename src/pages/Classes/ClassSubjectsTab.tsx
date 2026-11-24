/**
 * Class-Subject Assignments Tab
 * 
 * Maps academic curriculum subjects to specific classes with sequence/ordering.
 * For example: Class 9 has [English, Mathematics, Physics, Chemistry, Computer Science].
 * 100% offline compatible, modern, and user-friendly for administrative personnel.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  BookOpen,
  Trash2,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  ArrowUpDown,
  BookCheck,
  Search,
  X,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ListChecks,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ClassItem, SubjectItem, ClassSubjectItem } from '../../types/electron';
import '../../styles/class-subjects.css';

interface RemoveConfirmState {
  isOpen: boolean;
  subjectId: number | null;
  subjectName: string;
  isProcessing: boolean;
}

export const ClassSubjectsTab: React.FC = () => {
  const { sessionToken } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Assign Subject Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'single' | 'bulk'>('single');
  const [assignSubjectId, setAssignSubjectId] = useState<number | ''>('');
  const [selectedBulkSubjectIds, setSelectedBulkSubjectIds] = useState<number[]>([]);
  const [assignDisplayOrder, setAssignDisplayOrder] = useState<number>(1);
  const [assignModalError, setAssignModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Removal Confirmation Modal
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>({
    isOpen: false,
    subjectId: null,
    subjectName: '',
    isProcessing: false,
  });

  // Fetch all classes
  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.classes) {
        const res = await window.electronAPI.classes.getAll();
        if (res.success && res.classes) {
          setClasses(res.classes);
          // Auto-select first class if none selected yet
          if (res.classes.length > 0 && selectedClassId === null) {
            setSelectedClassId(res.classes[0].id);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load institutional classes.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Fetch available master subjects for assignment dropdown & stats
  const fetchAllSubjects = useCallback(async () => {
    try {
      if (window.electronAPI?.subjects) {
        const res = await window.electronAPI.subjects.getAll();
        if (res.success && res.subjects) {
          setAvailableSubjects(res.subjects);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAllSubjects();
  }, [fetchAllSubjects]);

  // Fetch class-subject assignments whenever selected class changes
  const fetchClassSubjects = useCallback(async (classId: number) => {
    setIsLoadingSubjects(true);
    try {
      if (window.electronAPI?.classSubjects) {
        const res = await window.electronAPI.classSubjects.getByClassId(classId);
        if (res.success && res.classSubjects) {
          setClassSubjects(res.classSubjects);
        } else {
          setClassSubjects([]);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load assigned subjects for the selected class.');
    } finally {
      setIsLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassSubjects(selectedClassId);
    } else {
      setClassSubjects([]);
    }
  }, [selectedClassId, fetchClassSubjects]);

  // Filter out subjects that are already assigned to the selected class
  const unassignedSubjects = useMemo(() => {
    return availableSubjects.filter(
      (subj) => !classSubjects.some((cs) => cs.subjectId === subj.id) && subj.isActive
    );
  }, [availableSubjects, classSubjects]);

  // Filtered assigned subjects based on table search
  const filteredClassSubjects = useMemo(() => {
    if (!searchFilter.trim()) return classSubjects;
    const q = searchFilter.toLowerCase().trim();
    return classSubjects.filter(
      (cs) =>
        cs.subjectName.toLowerCase().includes(q) ||
        (cs.subjectCode && cs.subjectCode.toLowerCase().includes(q))
    );
  }, [classSubjects, searchFilter]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Modal Handlers
  const handleOpenAssignModal = async () => {
    if (!selectedClassId) return;
    await fetchAllSubjects();

    // Suggest next display order
    const nextOrder =
      classSubjects.length > 0
        ? Math.max(...classSubjects.map((cs) => cs.displayOrder)) + 1
        : 1;

    setAssignDisplayOrder(nextOrder);
    setAssignSubjectId('');
    setSelectedBulkSubjectIds([]);
    setAssignMode('single');
    setAssignModalError(null);
    setIsAssignModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    setIsAssignModalOpen(false);
    setAssignSubjectId('');
    setSelectedBulkSubjectIds([]);
    setAssignModalError(null);
  };

  // Toggle multi-select checkbox
  const handleToggleBulkSubject = (subjId: number) => {
    setSelectedBulkSubjectIds((prev) =>
      prev.includes(subjId) ? prev.filter((id) => id !== subjId) : [...prev, subjId]
    );
  };

  const handleSelectAllBulk = () => {
    if (selectedBulkSubjectIds.length === unassignedSubjects.length) {
      setSelectedBulkSubjectIds([]);
    } else {
      setSelectedBulkSubjectIds(unassignedSubjects.map((s) => s.id));
    }
  };

  // Assign Submit (Handles both Single and Batch)
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignModalError(null);

    if (!selectedClassId) {
      setAssignModalError('Please select a class first.');
      return;
    }

    if (!sessionToken) {
      setAssignModalError('Session expired. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (assignMode === 'single') {
        if (!assignSubjectId) {
          setAssignModalError('Please choose a subject to assign.');
          setIsSubmitting(false);
          return;
        }

        const res = await window.electronAPI?.classSubjects.assign({
          sessionToken,
          classId: selectedClassId,
          subjectId: Number(assignSubjectId),
          displayOrder: assignDisplayOrder,
        });

        if (res?.success) {
          setSuccessMessage(
            `Subject successfully assigned to ${selectedClass ? selectedClass.name : 'class'}.`
          );
          handleCloseAssignModal();
          fetchClassSubjects(selectedClassId);
          fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setAssignModalError(res?.error || 'Failed to assign subject.');
        }
      } else {
        // Bulk Mode
        if (selectedBulkSubjectIds.length === 0) {
          setAssignModalError('Please select at least one subject from the list.');
          setIsSubmitting(false);
          return;
        }

        let currentOrder = assignDisplayOrder;
        let successCount = 0;
        let lastError = '';

        for (const subjId of selectedBulkSubjectIds) {
          const res = await window.electronAPI?.classSubjects.assign({
            sessionToken,
            classId: selectedClassId,
            subjectId: subjId,
            displayOrder: currentOrder++,
          });
          if (res?.success) {
            successCount++;
          } else if (res?.error) {
            lastError = res.error;
          }
        }

        if (successCount > 0) {
          setSuccessMessage(
            `Successfully assigned ${successCount} subject(s) to ${selectedClass ? selectedClass.name : 'class'}.`
          );
          handleCloseAssignModal();
          fetchClassSubjects(selectedClassId);
          fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setAssignModalError(lastError || 'Failed to assign selected subjects.');
        }
      }
    } catch (err) {
      console.error(err);
      setAssignModalError('An unexpected error occurred while assigning subject(s).');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Removal Confirmation Dialog
  const handlePromptRemove = (subjectId: number, subjectName: string) => {
    setRemoveConfirm({
      isOpen: true,
      subjectId,
      subjectName,
      isProcessing: false,
    });
  };

  const handleCloseRemoveConfirm = () => {
    setRemoveConfirm({
      isOpen: false,
      subjectId: null,
      subjectName: '',
      isProcessing: false,
    });
  };

  // Execute Removal
  const handleExecuteRemove = async () => {
    const { subjectId, subjectName } = removeConfirm;
    if (!selectedClassId || !sessionToken || !subjectId) return;

    setRemoveConfirm((prev) => ({ ...prev, isProcessing: true }));
    const className = selectedClass ? selectedClass.name : 'this class';

    try {
      const res = await window.electronAPI?.classSubjects.remove(
        sessionToken,
        selectedClassId,
        subjectId
      );

      if (res?.success) {
        setSuccessMessage(`Removed "${subjectName}" from ${className}.`);
        handleCloseRemoveConfirm();
        fetchClassSubjects(selectedClassId);
        fetchClasses();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res?.error || 'Failed to remove subject from class.');
        setRemoveConfirm((prev) => ({ ...prev, isProcessing: false }));
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to remove subject from class.');
      setRemoveConfirm((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="class-subjects-container">
      {/* ─── 1. Header Card ──────────────────────────────────────────────── */}
      <div className="class-subjects-header-card">
        <div className="class-subjects-header-left">
          <div className="class-subjects-header-icon-box">
            <BookCheck size={22} />
          </div>
          <div className="class-subjects-header-title-group">
            <h1 className="class-subjects-header-title">Class-Subject Curriculum Mapping</h1>
            <p className="class-subjects-header-subtitle">
              Assign institutional curriculum subjects to each class level and establish sequence for examinations, report cards, and mark entries.
            </p>
          </div>
        </div>

        <div className="class-subjects-header-actions">
          <button
            type="button"
            className="class-selector-btn-add"
            onClick={handleOpenAssignModal}
            disabled={!selectedClassId || classes.length === 0}
          >
            <Plus size={16} />
            <span>Assign Subject(s)</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Class Selection & Curriculum Overview Card ───────────────── */}
      <div className="class-selector-card">
        <div className="class-selector-top-row">
          <div className="class-picker-group">
            <label htmlFor="class-select-dropdown" className="class-picker-label">
              <div className="class-picker-icon-badge">
                <GraduationCap size={16} />
              </div>
              <span>Target Class:</span>
            </label>
            <div className="class-dropdown-wrapper">
              <select
                id="class-select-dropdown"
                className="class-dropdown-select"
                value={selectedClassId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedClassId(val);
                  setSearchFilter('');
                }}
                disabled={isLoading || classes.length === 0}
              >
                {classes.length === 0 ? (
                  <option value="">No classes available</option>
                ) : (
                  classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.code ? `(${cls.code})` : ''} {!cls.isActive ? '[Inactive]' : ''}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown size={18} className="class-dropdown-arrow" />
            </div>
          </div>

          <button
            type="button"
            className="class-selector-btn-add"
            onClick={handleOpenAssignModal}
            disabled={!selectedClassId || classes.length === 0}
          >
            <Plus size={16} />
            <span>Assign Subject to Class</span>
          </button>
        </div>

        {/* Real-time Curriculum Stats */}
        {selectedClass && (
          <div className="class-subjects-metrics-grid">
            <div className="class-subjects-metric-card">
              <div className="class-subjects-metric-icon blue">
                <BookOpen size={18} />
              </div>
              <div className="class-subjects-metric-details">
                <span className="class-subjects-metric-val">{classSubjects.length}</span>
                <span className="class-subjects-metric-lbl">Assigned Subjects</span>
              </div>
            </div>

            <div className="class-subjects-metric-card">
              <div className="class-subjects-metric-icon green">
                <CheckCircle2 size={18} />
              </div>
              <div className="class-subjects-metric-details">
                <span className="class-subjects-metric-val">
                  {classSubjects.filter((cs) => cs.isActive).length}
                </span>
                <span className="class-subjects-metric-lbl">Active in Curriculum</span>
              </div>
            </div>

            <div className="class-subjects-metric-card">
              <div className="class-subjects-metric-icon amber">
                <Layers size={18} />
              </div>
              <div className="class-subjects-metric-details">
                <span className="class-subjects-metric-val">{unassignedSubjects.length}</span>
                <span className="class-subjects-metric-lbl">Available to Add</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. Toast / Feedback Alerts ──────────────────────────────────── */}
      {successMessage && (
        <div className="class-subjects-alert success" role="alert">
          <div className="class-subjects-alert-content">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="class-subjects-alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="class-subjects-alert error" role="alert">
          <div className="class-subjects-alert-content">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="class-subjects-alert-close"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── 4. Assigned Subjects Table Card ─────────────────────────────── */}
      <div className="class-subjects-table-card">
        {selectedClass && (
          <div className="class-subjects-table-header-bar">
            <div className="class-subjects-table-header-left">
              <span>
                Curriculum for <strong>{selectedClass.name}</strong>
              </span>
              <span className="class-subjects-badge-count">
                <BookCheck size={12} />
                <span>
                  {filteredClassSubjects.length} / {classSubjects.length} Assigned
                </span>
              </span>
            </div>

            {classSubjects.length > 0 && (
              <div className="class-subjects-table-search-wrap">
                <Search size={15} className="class-subjects-table-search-icon" />
                <input
                  type="text"
                  className="class-subjects-table-search-input"
                  placeholder="Filter subjects by name or code..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                {searchFilter && (
                  <button
                    type="button"
                    className="class-subjects-table-search-clear"
                    onClick={() => setSearchFilter('')}
                    title="Clear filter"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="class-subjects-loading-state">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <span>Loading institutional classes...</span>
          </div>
        ) : classes.length === 0 ? (
          <div className="class-subjects-empty-state">
            <div className="class-subjects-empty-icon">
              <GraduationCap size={28} />
            </div>
            <h4 className="class-subjects-empty-title">No Classes Configured</h4>
            <p className="class-subjects-empty-desc">
              You must create at least one grade level or class in the "Classes & Sections" tab before assigning curriculum subjects.
            </p>
          </div>
        ) : isLoadingSubjects ? (
          <div className="class-subjects-loading-state">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <span>Loading assigned subjects for {selectedClass?.name}...</span>
          </div>
        ) : classSubjects.length === 0 ? (
          <div className="class-subjects-empty-state">
            <div className="class-subjects-empty-icon">
              <BookOpen size={28} />
            </div>
            <h4 className="class-subjects-empty-title">
              No subjects assigned to {selectedClass?.name}
            </h4>
            <p className="class-subjects-empty-desc">
              Associate curriculum subjects (e.g. Mathematics, English, General Science) with this class so teachers and students can be organized around them.
            </p>
            <button
              type="button"
              className="class-subjects-btn-empty-action"
              onClick={handleOpenAssignModal}
            >
              <Plus size={16} />
              <span>Assign First Subject to {selectedClass?.name}</span>
            </button>
          </div>
        ) : filteredClassSubjects.length === 0 ? (
          <div className="class-subjects-empty-state">
            <div className="class-subjects-empty-icon">
              <Search size={26} />
            </div>
            <h4 className="class-subjects-empty-title">
              No subjects match "{searchFilter}"
            </h4>
            <p className="class-subjects-empty-desc">
              No subjects assigned to {selectedClass?.name} match your search filter.
            </p>
            <button
              type="button"
              className="class-subjects-btn-cancel"
              onClick={() => setSearchFilter('')}
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          <div className="class-subjects-table-wrap">
            <table className="class-subjects-table">
              <thead>
                <tr>
                  <th style={{ width: '12%', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ArrowUpDown size={13} />
                      <span>Sequence</span>
                    </div>
                  </th>
                  <th style={{ width: '40%' }}>Subject Name</th>
                  <th style={{ width: '20%' }}>Subject Code</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClassSubjects.map((cs) => (
                  <tr key={cs.id}>
                    {/* Sequence Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span className="class-subjects-order-badge">#{cs.displayOrder}</span>
                    </td>

                    {/* Subject Name with avatar */}
                    <td>
                      <div className="class-subjects-item-cell">
                        <div className="class-subjects-avatar">
                          <BookOpen size={17} />
                        </div>
                        <div className="class-subjects-info-group">
                          <span className="class-subjects-name">{cs.subjectName}</span>
                          <span className="class-subjects-desc">
                            Assigned to {selectedClass?.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Subject Code */}
                    <td>
                      {cs.subjectCode ? (
                        <span className="class-subjects-code-badge">{cs.subjectCode}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`class-subjects-status-pill ${
                          cs.isActive ? 'active' : 'inactive'
                        }`}
                      >
                        <span
                          className={`class-subjects-status-dot ${
                            cs.isActive ? 'active' : 'inactive'
                          }`}
                        />
                        <span>{cs.isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="class-subjects-btn-remove"
                        title="Remove Subject from Class"
                        onClick={() => handlePromptRemove(cs.subjectId, cs.subjectName)}
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. Assign Subject Modal (Single & Multi-Select) ─────────────── */}
      {isAssignModalOpen && (
        <div className="class-subjects-modal-backdrop" onClick={handleCloseAssignModal}>
          <div
            className="class-subjects-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="class-subjects-modal-header">
              <div className="class-subjects-modal-title-group">
                <div className="class-subjects-modal-icon-wrap">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="class-subjects-modal-title">
                    Assign Subject to {selectedClass?.name}
                  </h3>
                  <p className="class-subjects-modal-subtitle">
                    Select curriculum subjects to teach and evaluate in this class
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="class-subjects-modal-close-btn"
                onClick={handleCloseAssignModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAssignSubmit}>
              <div className="class-subjects-modal-body">
                {assignModalError && (
                  <div className="class-subjects-alert error" role="alert">
                    <div className="class-subjects-alert-content">
                      <AlertCircle size={16} />
                      <span>{assignModalError}</span>
                    </div>
                  </div>
                )}

                {unassignedSubjects.length === 0 ? (
                  <div className="class-subjects-alert success">
                    <div className="class-subjects-alert-content">
                      <BookCheck size={18} />
                      <span>
                        All active curriculum subjects are already assigned to{' '}
                        <strong>{selectedClass?.name}</strong>. If you need to add more subjects, please create them first in the "Subjects" tab.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mode Switcher */}
                    <div className="class-subjects-assign-mode-tabs">
                      <button
                        type="button"
                        className={`class-subjects-assign-mode-btn ${
                          assignMode === 'single' ? 'active' : ''
                        }`}
                        onClick={() => setAssignMode('single')}
                      >
                        Single Subject
                      </button>
                      <button
                        type="button"
                        className={`class-subjects-assign-mode-btn ${
                          assignMode === 'bulk' ? 'active' : ''
                        }`}
                        onClick={() => setAssignMode('bulk')}
                      >
                        Batch / Multi-Select ({unassignedSubjects.length} Available)
                      </button>
                    </div>

                    {assignMode === 'single' ? (
                      <>
                        <div className="class-subjects-form-group">
                          <label className="class-subjects-form-label" htmlFor="assign-single-select">
                            Select Subject <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <select
                            id="assign-single-select"
                            required
                            className="class-subjects-form-select"
                            value={assignSubjectId}
                            onChange={(e) => setAssignSubjectId(Number(e.target.value))}
                            autoFocus
                          >
                            <option value="">-- Choose Subject to Assign --</option>
                            {unassignedSubjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.code ? `(${s.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="class-subjects-form-group">
                          <label className="class-subjects-form-label" htmlFor="assign-display-seq">
                            Display Sequence / Order
                          </label>
                          <input
                            id="assign-display-seq"
                            type="number"
                            min="1"
                            className="class-subjects-form-input"
                            value={assignDisplayOrder}
                            onChange={(e) =>
                              setAssignDisplayOrder(parseInt(e.target.value, 10) || 1)
                            }
                          />
                          <span className="class-subjects-form-hint">
                            Controls the order in which this subject appears on mark sheets and student report cards.
                          </span>
                        </div>
                      </>
                    ) : (
                      /* Multi-Select Mode */
                      <div className="class-subjects-multiselect-container">
                        <div className="class-subjects-multiselect-header">
                          <span>
                            Selected: <strong>{selectedBulkSubjectIds.length}</strong> of{' '}
                            <strong>{unassignedSubjects.length}</strong> available subjects
                          </span>
                          <button
                            type="button"
                            className="class-subjects-multiselect-toggle-all"
                            onClick={handleSelectAllBulk}
                          >
                            {selectedBulkSubjectIds.length === unassignedSubjects.length
                              ? 'Deselect All'
                              : 'Select All'}
                          </button>
                        </div>

                        <div className="class-subjects-multiselect-list">
                          {unassignedSubjects.map((s) => {
                            const isChecked = selectedBulkSubjectIds.includes(s.id);
                            return (
                              <div
                                key={s.id}
                                className={`class-subjects-multiselect-item ${
                                  isChecked ? 'selected' : ''
                                }`}
                                onClick={() => handleToggleBulkSubject(s.id)}
                              >
                                <div className="class-subjects-multiselect-left">
                                  <input
                                    type="checkbox"
                                    className="class-subjects-multiselect-checkbox"
                                    checked={isChecked}
                                    onChange={() => {}} // handled by row click
                                  />
                                  <span className="class-subjects-multiselect-name">{s.name}</span>
                                </div>
                                {s.code && (
                                  <span className="class-subjects-code-badge">{s.code}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <span className="class-subjects-form-hint">
                          Selected subjects will be automatically sequenced starting from #{assignDisplayOrder}.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="class-subjects-modal-footer">
                <button
                  type="button"
                  className="class-subjects-btn-cancel"
                  onClick={handleCloseAssignModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="class-subjects-btn-submit"
                  disabled={isSubmitting || unassignedSubjects.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : assignMode === 'bulk' ? (
                    <>
                      <ListChecks size={15} />
                      <span>
                        Assign {selectedBulkSubjectIds.length > 0 ? selectedBulkSubjectIds.length : ''} Subject(s)
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Assign Subject</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Removal Confirmation Modal ───────────────────────────────── */}
      {removeConfirm.isOpen && (
        <div className="class-subjects-modal-backdrop" onClick={handleCloseRemoveConfirm}>
          <div
            className="class-subjects-modal-card"
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="class-subjects-modal-header">
              <div className="class-subjects-modal-title-group">
                <div className="class-subjects-modal-icon-wrap danger">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="class-subjects-modal-title">Remove Subject?</h3>
                  <p className="class-subjects-modal-subtitle">
                    {removeConfirm.subjectName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="class-subjects-modal-close-btn"
                onClick={handleCloseRemoveConfirm}
                disabled={removeConfirm.isProcessing}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="class-subjects-modal-body">
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>{removeConfirm.subjectName}</strong> from{' '}
                <strong>{selectedClass?.name}</strong>?
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                This subject will only be removed from {selectedClass?.name}'s curriculum mapping. The subject itself will remain safe in your institutional subjects catalog and can be re-assigned at any time.
              </p>
            </div>

            <div className="class-subjects-modal-footer">
              <button
                type="button"
                className="class-subjects-btn-cancel"
                onClick={handleCloseRemoveConfirm}
                disabled={removeConfirm.isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="class-subjects-btn-danger-confirm"
                onClick={handleExecuteRemove}
                disabled={removeConfirm.isProcessing}
              >
                {removeConfirm.isProcessing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Confirm & Remove</span>
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
