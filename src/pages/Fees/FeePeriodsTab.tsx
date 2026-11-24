import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, AlertCircle, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { AcademicSession, FeePeriodItem } from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

interface FeePeriodsTabProps {
  sessions: AcademicSession[];
  onRefreshPeriods?: () => void;
}

export const FeePeriodsTab: React.FC<FeePeriodsTabProps> = ({ sessions, onRefreshPeriods }) => {
  const { sessionToken } = useAuth();
  const [periods, setPeriods] = useState<FeePeriodItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced Manual Settings Drawer/Modal
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMonthName, setNewMonthName] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessions.length > 0 && selectedSessionId === '') {
      const active = sessions.find((s) => s.isActive);
      if (active) setSelectedSessionId(active.id);
      else setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const loadPeriods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const sid = selectedSessionId !== '' ? Number(selectedSessionId) : undefined;
        const res = await window.electronAPI.fees.getPeriods(sid);
        if (res.success && res.periods) {
          setPeriods(res.periods);
        } else {
          setError(res.error || 'Failed to load billing periods.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching billing periods.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, [selectedSessionId]);

  // Handle Quick Add Month
  const handleCreateMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthName.trim() || selectedSessionId === '') return;

    setIsSubmitting(true);
    setFormError(null);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.createPeriod({
          sessionToken: sessionToken || '',
          academicSessionId: Number(selectedSessionId),
          name: newMonthName.trim(),
          startDate: `${curYear}-${curMonth}-01`,
          endDate: `${curYear}-${curMonth}-28`,
          dueDate: dueDateStr || `${curYear}-${curMonth}-10`,
        });

        if (res.success) {
          setIsModalOpen(false);
          setNewMonthName('');
          setDueDateStr('');
          await loadPeriods();
          onRefreshPeriods?.();
        } else {
          setFormError(res.error || 'Failed to add billing month.');
        }
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error creating billing month.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (period: FeePeriodItem) => {
    try {
      if (window.electronAPI) {
        const newStatus = period.status === 'Open' ? 'Closed' : 'Open';
        await window.electronAPI.fees.updatePeriod({
          sessionToken: sessionToken || '',
          id: period.id,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          dueDate: period.dueDate,
          status: newStatus,
        });
        await loadPeriods();
        onRefreshPeriods?.();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Session Selection Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Calendar size={18} />
            <span>Billing Months</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
                setNewMonthName(monthName);
                const curYear = now.getFullYear();
                const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                setDueDateStr(`${curYear}-${curMonth}-10`);
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="btn-fees-primary"
              style={{ height: '34px', fontSize: '11px', padding: '0 14px' }}
            >
              <Plus size={14} /> Add Billing Month
            </button>
          </div>
        </div>

        <div className="fees-card-body" style={{ paddingBottom: '14px' }}>
          <div style={{ maxWidth: '320px' }}>
            <label className="fees-form-label">Academic Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : '')}
              className="fees-select"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Current Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Clean Billing Months List */}
      <div className="fees-card">
        <div className="fees-table-container">
          <table className="fees-table">
            <thead>
              <tr>
                <th style={{ width: '280px' }}>Billing Month</th>
                <th>Standard Due Date</th>
                <th style={{ width: '160px', textAlign: 'center' }}>Billing Status</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading billing months...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="fees-empty-state">
                      <div className="fees-empty-icon">
                        <Calendar size={26} />
                      </div>
                      <div className="fees-empty-title">No Billing Months Found</div>
                      <div className="fees-empty-subtitle">
                        Click <strong>"+ Add Billing Month"</strong> above to register a month (e.g. "October 2026") for fee generation.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                periods.map((p) => {
                  const isClosed = p.status === 'Closed';
                  const isUpcoming = p.dueDate > todayStr && !isClosed;

                  return (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ fontSize: '13px', color: 'var(--color-neutral-900)' }}>{p.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-700)' }}>
                          {p.dueDate || '10th of Month'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-fee ${isClosed ? 'waived' : isUpcoming ? 'paid' : 'partial'}`}>
                          {isClosed ? 'Closed' : isUpcoming ? 'Open / Current' : 'Open'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className="btn-fees-secondary"
                          style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                        >
                          {p.status === 'Open' ? 'Close Month' : 'Reopen Month'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <div style={{ textAlign: 'center', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-500)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showAdvanced ? 'Hide Advanced Information' : 'Show Advanced Billing Information'}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '10px', padding: '12px 16px', background: '#f8fafc', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-lg)', textAlign: 'left', maxWidth: '600px', margin: '10px auto 0', fontSize: '11px', color: 'var(--color-neutral-600)', lineHeight: '1.5' }}>
            <p>
              <strong>Automatic Billing Note:</strong> The system associates generated monthly fee invoices with these billing months.
              Closing a billing month prevents accidental re-generation for past periods while keeping all student records, receipts, and outstanding dues intact.
            </p>
          </div>
        )}
      </div>

      {/* Simple Add Month Modal */}
      {isModalOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '440px' }}>
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Add Billing Month
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                  Register a month to generate student fee slips.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMonth}>
              <div className="fees-modal-body">
                <div className="fees-form-group">
                  <label className="fees-form-label">Month Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October 2026, November 2026..."
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="fees-input"
                    autoFocus
                  />
                </div>

                <div className="fees-form-group">
                  <label className="fees-form-label">Standard Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDateStr}
                    onChange={(e) => setDueDateStr(e.target.value)}
                    className="fees-input"
                  />
                </div>

                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
                    {formError}
                  </div>
                )}
              </div>

              <div className="fees-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-fees-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-fees-primary"
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Saving...' : 'Save Month'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
