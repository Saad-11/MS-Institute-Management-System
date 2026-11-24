import React, { useState, useEffect } from 'react';
import { PlayCircle, AlertCircle, CheckCircle, RefreshCw, X, Users, Plus, Calendar } from 'lucide-react';
import type { AcademicSession, ClassItem, SectionItem, FeePeriodItem } from '../../types/electron';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../utils/money';

interface FeeGenerationTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
  periods: FeePeriodItem[];
  onFeeGenerated?: () => void;
  onRefreshPeriods?: () => void;
}

export const FeeGenerationTab: React.FC<FeeGenerationTabProps> = ({
  sessions,
  classes,
  periods,
  onFeeGenerated,
  onRefreshPeriods,
}) => {
  const { sessionToken } = useAuth();

  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSectionId, setSelectedSectionId] = useState<number | ''>('');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [dueDate, setDueDate] = useState<string>('');

  // Local reactive periods synchronized with session selection
  const [localPeriods, setLocalPeriods] = useState<FeePeriodItem[]>(periods);

  // Class enrolled students & fee structure preview
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [classFeeAmount, setClassFeeAmount] = useState<number | null>(null);
  const [classFeeName, setClassFeeName] = useState<string>('Standard Monthly Class Fee');

  // Modal & Generation States
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Inline Add Month Modal State
  const [isAddMonthModalOpen, setIsAddMonthModalOpen] = useState(false);
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthDueDate, setNewMonthDueDate] = useState('');
  const [isAddingMonth, setIsAddingMonth] = useState(false);
  const [addMonthError, setAddMonthError] = useState<string | null>(null);

  // Initialize session
  useEffect(() => {
    if (sessions.length > 0 && selectedSessionId === '') {
      const active = sessions.find((s) => s.isActive);
      if (active) setSelectedSessionId(active.id);
      else setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Load periods whenever selected session changes
  const loadSessionPeriods = async (sessionId: number) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.getPeriods(sessionId);
        if (res.success && res.periods) {
          setLocalPeriods(res.periods);
          return res.periods;
        }
      }
    } catch (err) {
      console.error('Error fetching periods for session:', err);
    }
    return [];
  };

  useEffect(() => {
    if (selectedSessionId !== '') {
      loadSessionPeriods(Number(selectedSessionId)).then((loaded) => {
        if (loaded && loaded.length > 0) {
          // Auto-select current month or first open month
          const now = new Date();
          const curMonth = now.toLocaleString('default', { month: 'long' });
          const curYear = now.getFullYear().toString();

          const match = loaded.find((p) => p.name.includes(curMonth) && p.name.includes(curYear));
          const openP = loaded.find((p) => p.status === 'Open');
          const chosen = match || openP || loaded[0];

          if (chosen) {
            setSelectedPeriodId(chosen.id);
            setDueDate(chosen.dueDate);
          }
        } else {
          setSelectedPeriodId('');
          setDueDate('');
        }
      });
    }
  }, [selectedSessionId]);

  // Load sections and class fee / student details when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      setEnrolledCount(null);
      setClassFeeAmount(null);
      setClassFeeName('Standard Monthly Class Fee');
      return;
    }

    const loadClassDetails = async () => {
      try {
        if (window.electronAPI) {
          const [secRes, stRes, fsRes] = await Promise.all([
            window.electronAPI.sections.getByClassId(Number(selectedClassId)),
            selectedSessionId !== ''
              ? window.electronAPI.students.getAll({
                  academicSessionId: Number(selectedSessionId),
                  classId: Number(selectedClassId),
                  isActive: true,
                })
              : Promise.resolve(null),
            selectedSessionId !== ''
              ? window.electronAPI.fees.getStructures({
                  academicSessionId: Number(selectedSessionId),
                  classId: Number(selectedClassId),
                })
              : Promise.resolve(null),
          ]);

          if (secRes?.success && secRes.sections) {
            setSections(secRes.sections.filter((s: SectionItem) => s.isActive));
          }

          if (stRes?.success && stRes.students) {
            setEnrolledCount(stRes.students.length);
          } else {
            setEnrolledCount(0);
          }

          if (fsRes?.success && fsRes.structures && fsRes.structures.length > 0) {
            const tuition =
              fsRes.structures.find(
                (s: any) =>
                  s.feeTypeName?.toLowerCase().includes('tuition') ||
                  s.feeTypeName?.toLowerCase().includes('monthly')
              ) || fsRes.structures[0];
            setClassFeeAmount(tuition.amount);
            setClassFeeName(tuition.feeTypeName || 'Monthly Tuition Fee');
          } else {
            setClassFeeAmount(null);
            setClassFeeName('Standard Monthly Class Fee');
          }
        }
      } catch (err) {
        console.error('Error fetching class details:', err);
      }
    };

    loadClassDetails();
  }, [selectedClassId, selectedSessionId]);

  const handlePeriodChange = (pid: number) => {
    setSelectedPeriodId(pid);
    const p = localPeriods.find((item) => item.id === pid);
    if (p) setDueDate(p.dueDate);
  };

  const handleAutoGeneratePeriods = async () => {
    if (selectedSessionId === '') return;
    setIsGenerating(true);
    try {
      const loaded = await loadSessionPeriods(Number(selectedSessionId));
      if (loaded.length > 0) {
        setSelectedPeriodId(loaded[0].id);
        setDueDate(loaded[0].dueDate);
        if (onRefreshPeriods) onRefreshPeriods();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAddMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthName.trim() || selectedSessionId === '') return;

    setIsAddingMonth(true);
    setAddMonthError(null);

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
          dueDate: newMonthDueDate || `${curYear}-${curMonth}-10`,
        });

        if (res.success && res.period) {
          const newP = res.period;
          setLocalPeriods((prev) => [newP, ...prev]);
          setSelectedPeriodId(newP.id);
          setDueDate(newP.dueDate);
          setIsAddMonthModalOpen(false);
          setNewMonthName('');
          setNewMonthDueDate('');
          if (onRefreshPeriods) onRefreshPeriods();
        } else {
          setAddMonthError(res.error || 'Failed to add billing month.');
        }
      }
    } catch (err: unknown) {
      setAddMonthError(err instanceof Error ? err.message : 'Error creating billing month.');
    } finally {
      setIsAddingMonth(false);
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !selectedClassId || !selectedPeriodId) {
      setError('Please select an Academic Session, Month, and Class.');
      return;
    }
    setError(null);
    setSuccessNotice(null);
    setIsConfirmOpen(true);
  };

  const handleExecuteGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessNotice(null);

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.generateFees({
          sessionToken: sessionToken || '',
          academicSessionId: Number(selectedSessionId),
          classId: Number(selectedClassId),
          sectionId: selectedSectionId !== '' ? Number(selectedSectionId) : undefined,
          feePeriodId: Number(selectedPeriodId),
          dueDate: dueDate || undefined,
        });

        setIsConfirmOpen(false);

        if (res.success && res.summary) {
          const { createdCount, alreadyExistedCount } = res.summary;
          if (createdCount > 0 && alreadyExistedCount > 0) {
            setSuccessNotice(
              `Fees generated successfully for ${createdCount} student(s). (${alreadyExistedCount} student(s) already had fees generated for this month).`
            );
          } else if (createdCount > 0) {
            setSuccessNotice(`Fees generated successfully for ${createdCount} student(s).`);
          } else if (alreadyExistedCount > 0) {
            setSuccessNotice(`All students in this class already have fee invoices generated for this month.`);
          } else {
            setSuccessNotice(`No active enrolled students found in this class to generate fees.`);
          }

          if (onFeeGenerated) onFeeGenerated();
          if (onRefreshPeriods) onRefreshPeriods();
        } else {
          setError(res.error || 'Fee generation failed.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating fees.');
    } finally {
      setIsGenerating(false);
    }
  };

  const targetClassName = classes.find((c) => c.id === Number(selectedClassId))?.name || 'Class';
  const targetSectionName = sections.find((s) => s.id === Number(selectedSectionId))?.name;
  const targetPeriodName = localPeriods.find((p) => p.id === Number(selectedPeriodId))?.name || 'Month';

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Clean Generation Card */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <PlayCircle size={18} />
            <span>Generate Monthly Fees</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            1-Click class fee invoicing
          </span>
        </div>

        <form onSubmit={handleOpenConfirm}>
          <div className="fees-card-body">
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successNotice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)', color: '#065f46', fontSize: '13px' }}>
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{successNotice}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Academic Session */}
              <div className="fees-form-group">
                <label className="fees-form-label">Academic Session *</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : '')}
                  className="fees-select"
                  required
                >
                  <option value="">Select Session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isActive ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="fees-form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="fees-form-label" style={{ margin: 0 }}>Month *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
                      setNewMonthName(monthName);
                      const curYear = now.getFullYear();
                      const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                      setNewMonthDueDate(`${curYear}-${curMonth}-10`);
                      setAddMonthError(null);
                      setIsAddMonthModalOpen(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '1px 4px',
                    }}
                  >
                    <Plus size={12} /> Add Month
                  </button>
                </div>
                <select
                  value={selectedPeriodId}
                  onChange={(e) =>
                    e.target.value ? handlePeriodChange(Number(e.target.value)) : setSelectedPeriodId('')
                  }
                  className="fees-select"
                  required
                >
                  <option value="">Select Month</option>
                  {localPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status === 'Closed' ? '(Closed)' : ''}
                    </option>
                  ))}
                </select>
                {localPeriods.length === 0 && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>No billing months found.</span>
                    <button
                      type="button"
                      onClick={handleAutoGeneratePeriods}
                      style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Generate 12 Months
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Class */}
              <div className="fees-form-group">
                <label className="fees-form-label">Class *</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                  className="fees-select"
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedClassId !== '' && enrolledCount !== null && (
                  <div style={{ fontSize: '11px', marginTop: '4px', color: enrolledCount > 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                    {enrolledCount > 0
                      ? `✓ ${enrolledCount} active student(s) enrolled`
                      : '⚠️ No active students in this class'}
                  </div>
                )}
              </div>

              {/* Section */}
              <div className="fees-form-group">
                <label className="fees-form-label">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedClassId}
                  className="fees-select"
                >
                  <option value="">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Due Date */}
              <div className="fees-form-group">
                <label className="fees-form-label">Payment Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="fees-input"
                  required
                />
              </div>

              {/* Fee Category */}
              <div className="fees-form-group">
                <label className="fees-form-label">Fee Type</label>
                <input
                  type="text"
                  value={
                    classFeeAmount !== null
                      ? `${classFeeName} (${formatMoney(classFeeAmount)} / month)`
                      : classFeeName
                  }
                  disabled
                  className="fees-input"
                  style={{ background: '#f8fafc', color: 'var(--color-neutral-600)', fontWeight: 500 }}
                />
              </div>
            </div>

            <div style={{ paddingTop: '8px' }}>
              <button
                type="submit"
                disabled={isGenerating || !selectedClassId || !selectedPeriodId}
                className="btn-fees-primary"
                style={{ width: '100%', height: '44px', fontSize: '13px' }}
              >
                <PlayCircle size={16} />
                Generate Fees
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Beginner-Friendly Confirmation Dialog */}
      {isConfirmOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '440px' }}>
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Confirm Fee Generation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="fees-modal-body">
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Users size={24} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--color-neutral-800)', fontWeight: '600' }}>
                  Generate fees for {targetClassName}{targetSectionName ? ` (${targetSectionName})` : ''} for {targetPeriodName}?
                </p>
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Active Students:</span>
                    <strong style={{ color: '#0f172a' }}>{enrolledCount ?? 'Eligible students'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Fee Rate:</span>
                    <strong style={{ color: '#0f172a' }}>{classFeeAmount !== null ? `${formatMoney(classFeeAmount)} / month` : 'Standard Rate'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>
                    <span style={{ color: '#64748b' }}>Due Date:</span>
                    <strong style={{ color: '#2563eb' }}>{dueDate || 'Standard due date'}</strong>
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '8px' }}>
                  Students who already have fee records for this month will be skipped safely without duplicate billing.
                </p>
              </div>
            </div>

            <div className="fees-modal-footer">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="btn-fees-secondary"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteGeneration}
                disabled={isGenerating}
                className="btn-fees-primary"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Month Modal */}
      {isAddMonthModalOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '420px' }}>
            <div className="fees-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#2563eb" />
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Add Billing Month
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMonthModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            {addMonthError && (
              <div style={{ margin: '14px 18px 0', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{addMonthError}</span>
              </div>
            )}

            <form onSubmit={handleQuickAddMonth}>
              <div className="fees-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="fees-form-group">
                  <label className="fees-form-label">Month Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. November 2026"
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    className="fees-input"
                    autoFocus
                  />
                </div>

                <div className="fees-form-group">
                  <label className="fees-form-label">Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newMonthDueDate}
                    onChange={(e) => setNewMonthDueDate(e.target.value)}
                    className="fees-input"
                  />
                </div>
              </div>

              <div className="fees-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddMonthModalOpen(false)}
                  className="btn-fees-secondary"
                  disabled={isAddingMonth}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingMonth || !newMonthName.trim()}
                  className="btn-fees-primary"
                >
                  {isAddingMonth ? 'Adding...' : 'Add Month'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple Beginner-Friendly Confirmation Dialog */}
      {isConfirmOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '440px' }}>
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Confirm Fee Generation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="fees-modal-body">
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Users size={24} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--color-neutral-800)', fontWeight: '600' }}>
                  Generate fees for {targetClassName}{targetSectionName ? ` (${targetSectionName})` : ''} for {targetPeriodName}?
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '6px' }}>
                  Fee invoices will be created for all students in this class based on their fee structure.
                  Students who already have fees for this month will be skipped safely.
                </p>
              </div>
            </div>

            <div className="fees-modal-footer">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="btn-fees-secondary"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteGeneration}
                disabled={isGenerating}
                className="btn-fees-primary"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
