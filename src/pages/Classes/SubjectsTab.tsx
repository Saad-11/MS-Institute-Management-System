/**
 * Subjects Tab
 * 
 * Manages institutional curriculum subjects (Mathematics, English, Physics, etc.).
 * Provides search, status filtering, creation, editing, and status toggle capabilities
 * with complete offline compatibility and a polished administrative UI/UX.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  X,
  RefreshCw,
  Check,
  BookMarked,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { SubjectItem } from '../../types/electron';
import '../../styles/subjects.css';

interface StatusConfirmModalState {
  isOpen: boolean;
  subject: SubjectItem | null;
  targetStatus: boolean;
  isProcessing: boolean;
}

export const SubjectsTab: React.FC = () => {
  const { sessionToken } = useAuth();

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add / Edit Subject Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change Confirmation Modal state
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmModalState>({
    isOpen: false,
    subject: null,
    targetStatus: false,
    isProcessing: false,
  });

  // Fetch subjects from database
  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.subjects) {
        const res = await window.electronAPI.subjects.getAll(searchQuery);
        if (res.success) {
          setSubjects(res.subjects);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load subjects from database.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = subjects.length;
    const active = subjects.filter((s) => s.isActive).length;
    const inactive = total - active;
    const totalAssignments = subjects.reduce((sum, s) => sum + (s.assignedClassesCount || 0), 0);
    return { total, active, inactive, totalAssignments };
  }, [subjects]);

  // Filtered Subjects (based on Status Tab)
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      return true;
    });
  }, [subjects, statusFilter]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingSubject(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      isActive: true,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (subject: SubjectItem) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code || '',
      description: subject.description || '',
      isActive: subject.isActive,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSubject(null);
    setModalError(null);
  };

  // Submit Add / Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const name = formData.name.trim();
    if (!name) {
      setModalError('Subject name is required.');
      return;
    }

    if (!sessionToken) {
      setModalError('Session expired. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSubject) {
        // Update subject
        const res = await window.electronAPI?.subjects.update({
          sessionToken,
          id: editingSubject.id,
          name,
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim(),
          isActive: formData.isActive,
        });

        if (res?.success) {
          setSuccessMessage(`Subject "${name}" updated successfully.`);
          handleCloseModal();
          fetchSubjects();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setModalError(res?.error || 'Failed to update subject.');
        }
      } else {
        // Create subject
        const res = await window.electronAPI?.subjects.create({
          sessionToken,
          name,
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim(),
          isActive: formData.isActive,
        });

        if (res?.success) {
          setSuccessMessage(`Subject "${name}" created successfully.`);
          handleCloseModal();
          fetchSubjects();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setModalError(res?.error || 'Failed to create subject.');
        }
      }
    } catch (err) {
      console.error(err);
      setModalError('An unexpected error occurred while saving the subject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Status Confirmation Modal
  const handlePromptToggleStatus = (subject: SubjectItem) => {
    setStatusConfirm({
      isOpen: true,
      subject,
      targetStatus: !subject.isActive,
      isProcessing: false,
    });
  };

  const handleCloseStatusConfirm = () => {
    setStatusConfirm({
      isOpen: false,
      subject: null,
      targetStatus: false,
      isProcessing: false,
    });
  };

  // Execute Status Toggle
  const handleExecuteStatusToggle = async () => {
    const { subject, targetStatus } = statusConfirm;
    if (!subject || !sessionToken) return;

    setStatusConfirm((prev) => ({ ...prev, isProcessing: true }));
    const actionLabel = targetStatus ? 'activate' : 'deactivate';

    try {
      const res = await window.electronAPI?.subjects.toggleStatus(
        sessionToken,
        subject.id,
        targetStatus
      );

      if (res?.success) {
        setSuccessMessage(
          `Subject "${subject.name}" has been ${targetStatus ? 'activated' : 'deactivated'}.`
        );
        handleCloseStatusConfirm();
        fetchSubjects();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res?.error || `Failed to ${actionLabel} subject.`);
        setStatusConfirm((prev) => ({ ...prev, isProcessing: false }));
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(`Failed to ${actionLabel} subject.`);
      setStatusConfirm((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="subjects-container">
      {/* ─── 1. Section Header Card ──────────────────────────────────────── */}
      <div className="subjects-header-card">
        <div className="subjects-header-left">
          <div className="subjects-header-icon-box">
            <BookOpen size={22} />
          </div>
          <div className="subjects-header-title-group">
            <h1 className="subjects-header-title">Curriculum Subjects</h1>
            <p className="subjects-header-subtitle">
              Manage school subjects, course codes, syllabus notes, and active availability for class assignments and examinations.
            </p>
          </div>
        </div>

        <div className="subjects-header-actions">
          <button
            type="button"
            className="subjects-btn-add"
            onClick={handleOpenAddModal}
          >
            <Plus size={16} />
            <span>Add New Subject</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Metric Summary Statistics ────────────────────────────────── */}
      <div className="subjects-metrics-grid">
        <div className="subjects-metric-card">
          <div className="subjects-metric-icon icon-blue">
            <BookMarked size={20} />
          </div>
          <div className="subjects-metric-details">
            <span className="subjects-metric-val">{metrics.total}</span>
            <span className="subjects-metric-lbl">Total Subjects</span>
          </div>
        </div>

        <div className="subjects-metric-card">
          <div className="subjects-metric-icon icon-green">
            <CheckCircle2 size={20} />
          </div>
          <div className="subjects-metric-details">
            <span className="subjects-metric-val">{metrics.active}</span>
            <span className="subjects-metric-lbl">Active in Curriculum</span>
          </div>
        </div>

        <div className="subjects-metric-card">
          <div className="subjects-metric-icon icon-amber">
            <EyeOff size={20} />
          </div>
          <div className="subjects-metric-details">
            <span className="subjects-metric-val">{metrics.inactive}</span>
            <span className="subjects-metric-lbl">Inactive / Archived</span>
          </div>
        </div>

        <div className="subjects-metric-card">
          <div className="subjects-metric-icon icon-purple">
            <GraduationCap size={20} />
          </div>
          <div className="subjects-metric-details">
            <span className="subjects-metric-val">{metrics.totalAssignments}</span>
            <span className="subjects-metric-lbl">Class Assignments</span>
          </div>
        </div>
      </div>

      {/* ─── 3. Toast / Feedback Alerts ──────────────────────────────────── */}
      {successMessage && (
        <div className="subjects-alert subjects-alert-success" role="alert">
          <div className="subjects-alert-content">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="subjects-alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="subjects-alert subjects-alert-error" role="alert">
          <div className="subjects-alert-content">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="subjects-alert-close"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── 4. Action Toolbar: Search & Filters ─────────────────────────── */}
      <div className="subjects-toolbar-card">
        <div className="subjects-toolbar-left">
          {/* Search Box */}
          <div className="subjects-search-wrapper">
            <Search size={16} className="subjects-search-icon" />
            <input
              type="text"
              className="subjects-search-input"
              placeholder="Search subjects by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="subjects-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Segmented Filter */}
          <div className="subjects-filter-group">
            <button
              type="button"
              className={`subjects-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({metrics.total})
            </button>
            <button
              type="button"
              className={`subjects-filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active ({metrics.active})
            </button>
            <button
              type="button"
              className={`subjects-filter-pill ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive ({metrics.inactive})
            </button>
          </div>
        </div>

        <button
          type="button"
          className="subjects-btn-add"
          onClick={handleOpenAddModal}
        >
          <Plus size={16} />
          <span>Add New Subject</span>
        </button>
      </div>

      {/* ─── 5. Subjects Data Table Card ─────────────────────────────────── */}
      <div className="subjects-table-card">
        <div className="subjects-table-header-bar">
          <div>
            Showing <span className="subjects-table-count">{filteredSubjects.length}</span> of{' '}
            <span className="subjects-table-count">{subjects.length}</span> subject
            {subjects.length === 1 ? '' : 's'}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </div>
          {statusFilter !== 'all' && (
            <span>Filtered by: <strong>{statusFilter === 'active' ? 'Active Only' : 'Inactive Only'}</strong></span>
          )}
        </div>

        {isLoading ? (
          <div className="subjects-loading-state">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <span>Loading curriculum subjects...</span>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="subjects-empty-state">
            <div className="subjects-empty-icon">
              {searchQuery ? <Search size={26} /> : <BookOpen size={26} />}
            </div>
            <h4 className="subjects-empty-title">
              {searchQuery
                ? `No subjects match "${searchQuery}"`
                : statusFilter !== 'all'
                ? `No ${statusFilter} subjects found`
                : 'No subjects created yet'}
            </h4>
            <p className="subjects-empty-desc">
              {searchQuery
                ? 'Try searching with a different subject name, keyword, or course code.'
                : statusFilter !== 'all'
                ? `There are currently no subjects marked as ${statusFilter}.`
                : 'Get started by creating your school curriculum subjects such as Mathematics, English, General Science, etc.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                className="subjects-btn-cancel"
                onClick={() => setSearchQuery('')}
              >
                Clear Search Filter
              </button>
            ) : (
              <button
                type="button"
                className="subjects-btn-add"
                onClick={handleOpenAddModal}
              >
                <Plus size={16} />
                <span>Add First Subject</span>
              </button>
            )}
          </div>
        ) : (
          <div className="subjects-table-wrap">
            <table className="subjects-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Subject Name</th>
                  <th style={{ width: '15%' }}>Code</th>
                  <th style={{ width: '27%' }}>Description</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Assigned Classes</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((subject) => {
                  const isAssigned = subject.assignedClassesCount > 0;

                  return (
                    <tr
                      key={subject.id}
                      className={!subject.isActive ? 'row-inactive' : ''}
                    >
                      {/* Subject Name with avatar */}
                      <td>
                        <div className="subjects-item-cell">
                          <div className={`subjects-avatar ${!subject.isActive ? 'inactive' : ''}`}>
                            <BookOpen size={18} />
                          </div>
                          <div className="subjects-info-group">
                            <span className="subjects-name-text">{subject.name}</span>
                            <span className="subjects-meta-text">
                              Added {subject.createdAt ? new Date(subject.createdAt).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Subject Code */}
                      <td>
                        {subject.code ? (
                          <span className="subjects-code-badge">{subject.code}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Description */}
                      <td>
                        <span style={{ color: subject.description ? '#475569' : '#94a3b8' }}>
                          {subject.description || '—'}
                        </span>
                      </td>

                      {/* Assigned Classes */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`subjects-classes-pill ${
                            isAssigned ? 'assigned' : 'unassigned'
                          }`}
                        >
                          <GraduationCap size={13} />
                          <span>
                            {subject.assignedClassesCount}{' '}
                            {subject.assignedClassesCount === 1 ? 'class' : 'classes'}
                          </span>
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`subjects-status-pill ${
                            subject.isActive ? 'active' : 'inactive'
                          }`}
                        >
                          <span
                            className={`subjects-status-dot ${
                              subject.isActive ? 'dot-active' : 'dot-inactive'
                            }`}
                          />
                          <span>{subject.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="subjects-actions-group">
                          <button
                            type="button"
                            className="subjects-btn-action btn-edit"
                            title="Edit Subject"
                            onClick={() => handleOpenEditModal(subject)}
                          >
                            <Edit2 size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className={`subjects-btn-action ${
                              subject.isActive ? 'btn-deactivate' : 'btn-activate'
                            }`}
                            title={
                              subject.isActive
                                ? 'Deactivate this subject'
                                : 'Activate this subject'
                            }
                            onClick={() => handlePromptToggleStatus(subject)}
                          >
                            {subject.isActive ? (
                              <>
                                <EyeOff size={14} />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <Eye size={14} />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 6. Add / Edit Subject Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="subjects-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="subjects-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="subjects-modal-header">
              <div className="subjects-modal-title-group">
                <div className="subjects-modal-icon-wrap">
                  {editingSubject ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="subjects-modal-title">
                    {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                  </h3>
                  <p className="subjects-modal-subtitle">
                    {editingSubject
                      ? 'Update curriculum details, subject code, or status'
                      : 'Define a new curriculum subject for class assignments'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="subjects-modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="subjects-modal-body">
                {modalError && (
                  <div className="subjects-alert subjects-alert-error" role="alert">
                    <div className="subjects-alert-content">
                      <AlertCircle size={16} />
                      <span>{modalError}</span>
                    </div>
                  </div>
                )}

                {/* Subject Name */}
                <div className="subjects-form-group">
                  <label className="subjects-form-label" htmlFor="subj-name">
                    Subject Name <span className="subjects-req">*</span>
                  </label>
                  <input
                    id="subj-name"
                    type="text"
                    required
                    className="subjects-form-input"
                    placeholder="e.g., Mathematics, English Literature, Chemistry"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                  <span className="subjects-form-hint">
                    Official name as it should appear on report cards and DMC.
                  </span>
                </div>

                {/* Subject Code */}
                <div className="subjects-form-group">
                  <label className="subjects-form-label" htmlFor="subj-code">
                    Subject Code <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    id="subj-code"
                    type="text"
                    className="subjects-form-input"
                    placeholder="e.g., MATH-101, ENG-01, CHM-101"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                  />
                  <span className="subjects-form-hint">
                    Standardized curriculum or board course code.
                  </span>
                </div>

                {/* Description */}
                <div className="subjects-form-group">
                  <label className="subjects-form-label" htmlFor="subj-desc">
                    Description / Outline Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <textarea
                    id="subj-desc"
                    rows={3}
                    className="subjects-form-textarea"
                    placeholder="Brief course outline, topics covered, or syllabus notes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Active in Curriculum Toggle Card */}
                <label className="subjects-status-card">
                  <input
                    type="checkbox"
                    className="subjects-status-checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <div className="subjects-status-card-text">
                    <span className="subjects-status-card-title">Active in School Curriculum</span>
                    <span className="subjects-status-card-desc">
                      When enabled, this subject can be assigned to classes and included in examination papers.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="subjects-modal-footer">
                <button
                  type="button"
                  className="subjects-btn-cancel"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="subjects-btn-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving Subject...</span>
                    </>
                  ) : editingSubject ? (
                    <>
                      <Check size={15} />
                      <span>Update Subject</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Subject</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7. Status Change Confirmation Modal ─────────────────────────── */}
      {statusConfirm.isOpen && statusConfirm.subject && (
        <div className="subjects-modal-backdrop" onClick={handleCloseStatusConfirm}>
          <div
            className="subjects-modal-card"
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="subjects-modal-header">
              <div className="subjects-modal-title-group">
                <div
                  className={`subjects-modal-icon-wrap ${
                    !statusConfirm.targetStatus ? 'danger' : ''
                  }`}
                >
                  {statusConfirm.targetStatus ? (
                    <Eye size={18} />
                  ) : (
                    <ShieldAlert size={18} />
                  )}
                </div>
                <div>
                  <h3 className="subjects-modal-title">
                    {statusConfirm.targetStatus
                      ? 'Activate Subject?'
                      : 'Deactivate Subject?'}
                  </h3>
                  <p className="subjects-modal-subtitle">
                    {statusConfirm.subject.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="subjects-modal-close-btn"
                onClick={handleCloseStatusConfirm}
                disabled={statusConfirm.isProcessing}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="subjects-modal-body">
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                {statusConfirm.targetStatus ? (
                  <>
                    Are you sure you want to activate <strong>{statusConfirm.subject.name}</strong>?
                    This subject will become immediately available for assignment to classes and examinations.
                  </>
                ) : (
                  <>
                    Are you sure you want to deactivate <strong>{statusConfirm.subject.name}</strong>?
                    Inactive subjects cannot be newly assigned to classes. Existing class assignments and marks records will remain completely safe and intact.
                  </>
                )}
              </p>
            </div>

            <div className="subjects-modal-footer">
              <button
                type="button"
                className="subjects-btn-cancel"
                onClick={handleCloseStatusConfirm}
                disabled={statusConfirm.isProcessing}
              >
                Cancel
              </button>
              {statusConfirm.targetStatus ? (
                <button
                  type="button"
                  className="subjects-btn-submit"
                  onClick={handleExecuteStatusToggle}
                  disabled={statusConfirm.isProcessing}
                >
                  {statusConfirm.isProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Confirm & Activate</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="subjects-btn-danger-confirm"
                  onClick={handleExecuteStatusToggle}
                  disabled={statusConfirm.isProcessing}
                >
                  {statusConfirm.isProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Deactivating...</span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={15} />
                      <span>Confirm & Deactivate</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
