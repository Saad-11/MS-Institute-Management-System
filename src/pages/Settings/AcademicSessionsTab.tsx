/**
 * Academic Sessions Management Tab
 * 
 * Manages academic calendar years (e.g. 2026-2027), active session switching,
 * date validations, and searches.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Edit2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { AcademicSession } from '../../types/electron';

export const AcademicSessionsTab: React.FC = () => {
  const { sessionToken, refreshSchoolSettings } = useAuth();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [modalFormData, setModalFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Activation Confirmation Modal
  const [sessionToActivate, setSessionToActivate] = useState<AcademicSession | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.sessions) {
        const res = await window.electronAPI.sessions.getAll(searchQuery);
        if (res.success) {
          setSessions(res.sessions);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setErrorMessage('Failed to load academic sessions.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleOpenAddModal = () => {
    setEditingSession(null);
    setModalFormData({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      isActive: false,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (session: AcademicSession) => {
    setEditingSession(session);
    setModalFormData({
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      isActive: session.isActive,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setModalError(null);
    const { name, startDate, endDate, isActive } = modalFormData;

    if (!name.trim()) {
      setModalError('Session name is required (e.g. 2026-2027).');
      return;
    }

    if (!startDate || !endDate) {
      setModalError('Both start date and end date are required.');
      return;
    }

    if (startDate > endDate) {
      setModalError('End date cannot be earlier than start date.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingSession) {
        const res = await window.electronAPI?.sessions.update({
          sessionToken,
          id: editingSession.id,
          name: name.trim(),
          startDate,
          endDate,
          isActive,
        });

        if (res?.success) {
          setIsModalOpen(false);
          setSuccessMessage(`Academic session "${name.trim()}" updated successfully.`);
          await fetchSessions();
          await refreshSchoolSettings();
        } else {
          setModalError(res?.error || 'Failed to update academic session.');
        }
      } else {
        const res = await window.electronAPI?.sessions.create({
          sessionToken,
          name: name.trim(),
          startDate,
          endDate,
          isActive,
        });

        if (res?.success) {
          setIsModalOpen(false);
          setSuccessMessage(`Academic session "${name.trim()}" created successfully.`);
          await fetchSessions();
          await refreshSchoolSettings();
        } else {
          setModalError(res?.error || 'Failed to create academic session.');
        }
      }
    } catch (err) {
      console.error(err);
      setModalError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmActivate = async () => {
    if (!sessionToken || !sessionToActivate) return;

    try {
      const res = await window.electronAPI?.sessions.activate(sessionToken, sessionToActivate.id);
      if (res?.success) {
        setSuccessMessage(`Academic session "${sessionToActivate.name}" is now the active session.`);
        setSessionToActivate(null);
        await fetchSessions();
        await refreshSchoolSettings();
      } else {
        setErrorMessage(res?.error || 'Failed to activate session.');
        setSessionToActivate(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to activate session.');
      setSessionToActivate(null);
    }
  };

  const handleDeactivate = async (session: AcademicSession) => {
    if (!sessionToken) return;

    try {
      const res = await window.electronAPI?.sessions.deactivate(sessionToken, session.id);
      if (res?.success) {
        setSuccessMessage(`Academic session "${session.name}" deactivated.`);
        await fetchSessions();
        await refreshSchoolSettings();
      } else {
        setErrorMessage(res?.error || 'Failed to deactivate session.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to deactivate session.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* ─── Feedback Alerts ──────────────────────────────────────────────── */}
      {successMessage && (
        <div className="alert-box alert-success" role="alert">
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert-box alert-error" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ─── Action Bar ───────────────────────────────────────────────────── */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search academic sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={16} />
          Add Academic Session
        </button>
      </div>

      {/* ─── Sessions Table ───────────────────────────────────────────────── */}
      <div className="data-table-card">
        {isLoading ? (
          <div className="empty-state">
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <Calendar size={36} />
            <h4>No Academic Sessions Found</h4>
            <p>Create your first academic year session (e.g. 2026-2027) to begin scheduling classes.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenAddModal} style={{ marginTop: '8px' }}>
              <Plus size={14} />
              Add First Session
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Session Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => (
                <tr key={sess.id}>
                  <td style={{ fontWeight: 600 }}>
                    {sess.name}
                    {sess.isActive && (
                      <span className="status-badge badge-primary" style={{ marginLeft: '8px' }}>
                        Current Active
                      </span>
                    )}
                  </td>
                  <td>{sess.startDate}</td>
                  <td>{sess.endDate}</td>
                  <td>
                    {sess.isActive ? (
                      <span className="status-badge badge-active">Active</span>
                    ) : (
                      <span className="status-badge badge-inactive">Inactive</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      {!sess.isActive ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSessionToActivate(sess)}
                          title="Set as Current Active Session"
                        >
                          <CheckCircle size={14} color="var(--color-success-600)" />
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeactivate(sess)}
                          title="Deactivate Session"
                        >
                          <XCircle size={14} color="var(--color-warning-600)" />
                          Deactivate
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEditModal(sess)}
                        title="Edit Session Details"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{editingSession ? 'Edit Academic Session' : 'Create Academic Session'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-box alert-error" role="alert">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="sessName">
                    Session Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="sessName"
                    type="text"
                    className="form-control"
                    placeholder="e.g. 2026-2027"
                    value={modalFormData.name}
                    onChange={(e) => setModalFormData((p) => ({ ...p, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sessStart">
                      Start Date <span className="required-star">*</span>
                    </label>
                    <input
                      id="sessStart"
                      type="date"
                      className="form-control"
                      value={modalFormData.startDate}
                      onChange={(e) => setModalFormData((p) => ({ ...p, startDate: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="sessEnd">
                      End Date <span className="required-star">*</span>
                    </label>
                    <input
                      id="sessEnd"
                      type="date"
                      className="form-control"
                      value={modalFormData.endDate}
                      onChange={(e) => setModalFormData((p) => ({ ...p, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={modalFormData.isActive}
                      onChange={(e) => setModalFormData((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    <span>Set as Currently Active Session</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingSession ? 'Save Changes' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Activate Confirmation Modal ──────────────────────────────────── */}
      {sessionToActivate && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Activate Session: {sessionToActivate.name}</h3>
            </div>
            <div className="modal-body">
              <p>
                Activating <strong>{sessionToActivate.name}</strong> will set it as the school's primary
                active session and deactivate all other sessions.
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                All new enrolments, fee slips, and attendance records will default to this session.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSessionToActivate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmActivate}
              >
                Yes, Set as Active Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
