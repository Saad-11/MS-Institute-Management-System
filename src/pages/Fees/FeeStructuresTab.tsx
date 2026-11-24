import React, { useState, useEffect } from 'react';
import { Layers, Edit2, CheckCircle, AlertCircle, X } from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  FeeTypeItem,
  FeeStructureItem,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, toMinorUnits, toMajorUnits } from '../../utils/money';

interface FeeStructuresTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
  feeTypes: FeeTypeItem[];
}

export const FeeStructuresTab: React.FC<FeeStructuresTabProps> = ({
  sessions,
  classes,
  feeTypes,
}) => {
  const { sessionToken } = useAuth();
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Friendly Class Fee Structure Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState<number>(0);
  const [tuitionFeeStr, setTuitionFeeStr] = useState('');
  const [admissionFeeStr, setAdmissionFeeStr] = useState('');
  const [annualFeeStr, setAnnualFeeStr] = useState('');
  const [examFeeStr, setExamFeeStr] = useState('');
  const [transportFeeStr, setTransportFeeStr] = useState('');
  const [otherFeeStr, setOtherFeeStr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected session
  useEffect(() => {
    if (sessions.length > 0 && selectedSessionId === '') {
      const active = sessions.find((s) => s.isActive);
      if (active) setSelectedSessionId(active.id);
      else setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const loadStructures = async () => {
    if (selectedSessionId === '') return;
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.getStructures({
          academicSessionId: Number(selectedSessionId),
        });
        if (res.success && res.structures) {
          setStructures(res.structures);
        } else {
          setError(res.error || 'Failed to load class fee structures.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching fee structures.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStructures();
  }, [selectedSessionId]);

  // Aggregate structures by class for friendly display
  const classRows = classes.map((cls) => {
    const classStructures = structures.filter((s) => s.classId === cls.id);

    const tuition = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('tuition') || s.feeTypeName?.toLowerCase().includes('monthly')
    );
    const admission = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('admission')
    );
    const annual = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('annual')
    );
    const exam = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('exam')
    );
    const transport = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('transport')
    );

    return {
      classItem: cls,
      tuitionAmount: tuition ? tuition.amount : null,
      admissionAmount: admission ? admission.amount : null,
      annualAmount: annual ? annual.amount : null,
      examAmount: exam ? exam.amount : null,
      transportAmount: transport ? transport.amount : null,
      allStructures: classStructures,
    };
  });

  const handleOpenConfigure = (cls: ClassItem) => {
    setTargetClassId(cls.id);
    const classStructures = structures.filter((s) => s.classId === cls.id);

    const tuition = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('tuition') || s.feeTypeName?.toLowerCase().includes('monthly')
    );
    const admission = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('admission')
    );
    const annual = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('annual')
    );
    const exam = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('exam')
    );
    const transport = classStructures.find(
      (s) => s.feeTypeName?.toLowerCase().includes('transport')
    );
    const other = classStructures.find(
      (s) =>
        s !== tuition &&
        s !== admission &&
        s !== annual &&
        s !== exam &&
        s !== transport
    );

    setTuitionFeeStr(tuition ? toMajorUnits(tuition.amount).toString() : '');
    setAdmissionFeeStr(admission ? toMajorUnits(admission.amount).toString() : '');
    setAnnualFeeStr(annual ? toMajorUnits(annual.amount).toString() : '');
    setExamFeeStr(exam ? toMajorUnits(exam.amount).toString() : '');
    setTransportFeeStr(transport ? toMajorUnits(transport.amount).toString() : '');
    setOtherFeeStr(other ? toMajorUnits(other.amount).toString() : '');

    setFormError(null);
    setIsModalOpen(true);
  };

  // Helper to find or match a feeType ID by common name
  const findTypeId = (keyword: string): number => {
    const match = feeTypes.find((ft) => ft.name.toLowerCase().includes(keyword.toLowerCase()));
    if (match) return match.id;
    return feeTypes[0]?.id || 1;
  };

  const handleSaveClassStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassId || selectedSessionId === '') return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (window.electronAPI) {
        const classStructures = structures.filter((s) => s.classId === targetClassId);

        // Helper to update or create fee structure
        const syncFee = async (
          keyword: string,
          valStr: string,
          defaultFrequency: 'Monthly' | 'One-Time' | 'Yearly'
        ) => {
          const minor = toMinorUnits(valStr);
          const typeId = findTypeId(keyword);
          const existing = classStructures.find(
            (s) => s.feeTypeId === typeId || s.feeTypeName?.toLowerCase().includes(keyword.toLowerCase())
          );

          if (minor > 0) {
            if (existing) {
              await window.electronAPI!.fees.updateStructure({
                sessionToken: sessionToken || '',
                id: existing.id,
                amount: minor,
                frequency: existing.frequency,
                description: `${keyword} Fee`,
                isActive: true,
              });
            } else {
              await window.electronAPI!.fees.createStructure({
                sessionToken: sessionToken || '',
                academicSessionId: Number(selectedSessionId),
                classId: targetClassId,
                feeTypeId: typeId,
                amount: minor,
                frequency: defaultFrequency,
                description: `${keyword} Fee`,
              });
            }
          }
        };

        // Sync each fee type
        await syncFee('tuition', tuitionFeeStr, 'Monthly');
        await syncFee('admission', admissionFeeStr, 'One-Time');
        await syncFee('annual', annualFeeStr, 'Yearly');
        await syncFee('exam', examFeeStr, 'One-Time');
        await syncFee('transport', transportFeeStr, 'Monthly');
        if (otherFeeStr) await syncFee('other', otherFeeStr, 'Monthly');

        setIsModalOpen(false);
        await loadStructures();
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save class fee structure.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTargetClassName = classes.find((c) => c.id === targetClassId)?.name || 'Class';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Session Filter Bar */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Layers size={18} />
            <span>Class Fee Structures</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            Decide the tuition, admission, and exam charges for each class
          </span>
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

      {/* Class-by-Class Fee Table */}
      <div className="fees-card">
        <div className="fees-table-container">
          <table className="fees-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Class</th>
                <th style={{ textAlign: 'right' }}>Monthly Tuition Fee</th>
                <th style={{ textAlign: 'right' }}>Admission Fee</th>
                <th style={{ textAlign: 'right' }}>Annual Fee</th>
                <th style={{ textAlign: 'right' }}>Exam Fee</th>
                <th style={{ textAlign: 'right' }}>Transport Fee</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading class fee structures...
                  </td>
                </tr>
              ) : classRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="fees-empty-state">
                      <div className="fees-empty-icon">
                        <Layers size={26} />
                      </div>
                      <div className="fees-empty-title">No Classes Available</div>
                      <div className="fees-empty-subtitle">
                        Please configure classes in the Classes &amp; Sections module first.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                classRows.map((row) => {
                  const isConfigured = row.allStructures.length > 0;
                  return (
                    <tr key={row.classItem.id}>
                      <td>
                        <strong style={{ fontSize: '13px', color: 'var(--color-neutral-900)' }}>
                          {row.classItem.name}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {row.tuitionAmount !== null ? formatMoney(row.tuitionAmount) : <span style={{ color: 'var(--color-neutral-400)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.admissionAmount !== null ? formatMoney(row.admissionAmount) : <span style={{ color: 'var(--color-neutral-400)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.annualAmount !== null ? formatMoney(row.annualAmount) : <span style={{ color: 'var(--color-neutral-400)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.examAmount !== null ? formatMoney(row.examAmount) : <span style={{ color: 'var(--color-neutral-400)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.transportAmount !== null ? formatMoney(row.transportAmount) : <span style={{ color: 'var(--color-neutral-400)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-fee ${isConfigured ? 'paid' : 'waived'}`}>
                          {isConfigured ? 'Configured' : 'Not Set'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenConfigure(row.classItem)}
                          className="btn-fees-primary"
                          style={{ height: '28px', padding: '0 12px', fontSize: '11px' }}
                        >
                          <Edit2 size={12} /> Set Fees
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

      {/* Friendly Class Fee Structure Modal */}
      {isModalOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '520px' }}>
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  Set Fee Structure: {selectedTargetClassName}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                  Enter the standard fee amounts for students in this class.
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

            <form onSubmit={handleSaveClassStructure}>
              <div className="fees-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="fees-form-group">
                    <label className="fees-form-label">Monthly Tuition Fee (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 3500"
                      value={tuitionFeeStr}
                      onChange={(e) => setTuitionFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Admission Fee (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 5000"
                      value={admissionFeeStr}
                      onChange={(e) => setAdmissionFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Annual Fee (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 2000"
                      value={annualFeeStr}
                      onChange={(e) => setAnnualFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Exam Fee (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 500"
                      value={examFeeStr}
                      onChange={(e) => setExamFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Transport Fee (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 1500"
                      value={transportFeeStr}
                      onChange={(e) => setTransportFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>

                  <div className="fees-form-group">
                    <label className="fees-form-label">Other Charges (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 0"
                      value={otherFeeStr}
                      onChange={(e) => setOtherFeeStr(e.target.value)}
                      className="fees-input"
                    />
                  </div>
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
                  {isSubmitting ? 'Saving...' : 'Save Fee Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
