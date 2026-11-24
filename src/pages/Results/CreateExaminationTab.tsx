import React, { useState, useEffect } from 'react';
import {
  Calendar,
  AlertCircle,
  Plus,
  GraduationCap,
  X,
  FileText,
  Clock,
  Sparkles,
  Save,
  Check,
} from 'lucide-react';
import type { AcademicSession, ClassItem, ExamTypeItem, ExaminationItem } from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

interface CreateExaminationTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
  examTypes: ExamTypeItem[];
  selectedSessionId: number;
  editingExam?: ExaminationItem | null;
  onSaveExam: (data: {
    id?: number;
    academicSessionId: number;
    examTypeId: number;
    name: string;
    startDate: string;
    endDate: string;
    description: string;
    selectedClassIds: number[];
  }) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  onNavigateToMarks: (examId?: number) => void;
  onReloadExamTypes?: () => Promise<void>;
  isModal?: boolean;
}

export const CreateExaminationTab: React.FC<CreateExaminationTabProps> = ({
  sessions,
  classes,
  examTypes,
  selectedSessionId,
  editingExam,
  onSaveExam,
  onCancel,
  onReloadExamTypes,
}) => {
  const { sessionToken } = useAuth();
  const isEditing = Boolean(editingExam && editingExam.id);

  // Exam Types state (synced with parent + quick add)
  const [localExamTypes, setLocalExamTypes] = useState<ExamTypeItem[]>(examTypes);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeError, setNewTypeError] = useState<string | null>(null);
  const [isAddingType, setIsAddingType] = useState(false);

  // Form Fields State
  const [academicSessionId, setAcademicSessionId] = useState<number>(() => {
    if (editingExam) return editingExam.academicSessionId;
    return selectedSessionId || (sessions.find((s) => s.isActive)?.id ?? sessions[0]?.id ?? 1);
  });
  const [examTypeId, setExamTypeId] = useState<number>(() => editingExam?.examTypeId || examTypes[0]?.id || 1);
  const [name, setName] = useState<string>(() => editingExam?.name || '');
  const [startDate, setStartDate] = useState<string>(
    () => editingExam?.startDate || new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    () => editingExam?.endDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  const activeClasses = classes.filter((c) => c.isActive !== false);

  const [selectedClassIds, setSelectedClassIds] = useState<number[]>(() => {
    if (editingExam && editingExam.participatingClasses && editingExam.participatingClasses.length > 0) {
      return activeClasses
        .filter((c) => editingExam.participatingClasses!.includes(c.name))
        .map((c) => c.id);
    }
    return activeClasses.map((c) => c.id);
  });

  const [description, setDescription] = useState<string>(() => editingExam?.description || '');

  // Validation & Submission States
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    dates?: string;
    classes?: string;
    session?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If in edit mode, fetch existing subject linkages to pre-check classes accurately
  useEffect(() => {
    if (editingExam?.id && window.electronAPI) {
      window.electronAPI.exams.getSubjects({ examinationId: editingExam.id })
        .then((res) => {
          if (res.success && res.subjects && res.subjects.length > 0) {
            const classIds = Array.from(new Set(res.subjects.map((s) => s.classId)));
            if (classIds.length > 0) {
              setSelectedClassIds(classIds);
            }
          }
        })
        .catch(() => {});
    }
  }, [editingExam]);

  useEffect(() => {
    setLocalExamTypes(examTypes);
  }, [examTypes]);

  // Ensure examTypeId is always valid based on localExamTypes
  useEffect(() => {
    if (localExamTypes.length > 0) {
      if (!examTypeId || !localExamTypes.some((t) => t.id === examTypeId)) {
        if (editingExam?.examTypeId && localExamTypes.some((t) => t.id === editingExam.examTypeId)) {
          setExamTypeId(editingExam.examTypeId);
        } else {
          setExamTypeId(localExamTypes[0].id);
        }
      }
    }
  }, [localExamTypes, examTypeId, editingExam]);

  const handleCreateExamType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      setNewTypeError('Exam type name is required.');
      return;
    }
    const code = newTypeCode.trim() || newTypeName.trim().substring(0, 4).toUpperCase();
    setIsAddingType(true);
    setNewTypeError(null);

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.exams.createType({
          sessionToken: sessionToken || '',
          name: newTypeName.trim(),
          code: code.toUpperCase(),
          description: newTypeDescription.trim(),
        });
        if (res.success && res.examType) {
          const created = res.examType;
          setLocalExamTypes((prev) => [...prev, created]);
          setExamTypeId(created.id);
          setIsAddTypeModalOpen(false);
          setNewTypeName('');
          setNewTypeCode('');
          setNewTypeDescription('');
          if (onReloadExamTypes) {
            onReloadExamTypes().catch(() => {});
          }
        } else {
          setNewTypeError(res.error || 'Failed to create exam type.');
        }
      }
    } catch (err: unknown) {
      setNewTypeError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setIsAddingType(false);
    }
  };

  // Quick Preset Examination Titles
  const quickPresets = [
    '1st Term Assessment',
    'Mid Term Examination',
    '2nd Term Assessment',
    'Final Term Examination',
    'Annual Examination',
  ];

  const handleSelectPreset = (preset: string) => {
    setName(preset);
    setFieldErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleSelectAllClasses = () => {
    setSelectedClassIds(activeClasses.map((c) => c.id));
    setFieldErrors((prev) => ({ ...prev, classes: undefined }));
  };

  const handleDeselectAllClasses = () => {
    setSelectedClassIds([]);
  };

  const handleToggleClass = (classId: number) => {
    setSelectedClassIds((prev) => {
      const updated = prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId];
      if (updated.length > 0) {
        setFieldErrors((e) => ({ ...e, classes: undefined }));
      }
      return updated;
    });
  };

  const validate = (): boolean => {
    const errors: { name?: string; dates?: string; classes?: string; session?: string } = {};

    if (!name.trim()) {
      errors.name = 'Examination Name is required. Please enter an exam title.';
    }

    if (!academicSessionId) {
      errors.session = 'Please select a valid Academic Session.';
    }

    if (!startDate || !endDate) {
      errors.dates = 'Both Start Date and End Date are required.';
    } else if (startDate > endDate) {
      errors.dates = 'End date must be on or after the start date.';
    }

    if (selectedClassIds.length === 0) {
      errors.classes = 'Please select at least one participating class.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSaveExam({
        id: editingExam?.id,
        academicSessionId,
        examTypeId,
        name: name.trim(),
        startDate,
        endDate,
        description: description.trim(),
        selectedClassIds,
      });

      if (!res.success) {
        setGeneralError(res.error || 'Failed to save examination. Please try again.');
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Unexpected error saving examination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="exam-modal-inner">
      {/* ─── Modal Header ─── */}
      <div className="exam-modal-header">
        <div className="exam-form-header-left">
          <div className="exam-form-header-icon">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="exam-modal-title">
              {isEditing ? 'Edit Examination' : 'Create New Examination'}
            </h2>
            <p className="exam-modal-subtitle">
              {isEditing
                ? 'Update examination details, schedule, and participating classes.'
                : 'Set up an examination, select participating classes, and configure the examination schedule.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close dialog"
          className="exam-modal-close-btn"
        >
          <X size={18} />
        </button>
      </div>

      {/* ─── Form Container (Scrollable Body + Fixed Footer) ─── */}
      <form onSubmit={handleSubmit} className="exam-modal-form">
        {/* ─── Scrollable Body with Easy-to-Use Scrollbar ─── */}
        <div className="exam-modal-body">
          {/* General Error Banner */}
          {generalError && (
            <div className="exam-alert-banner" style={{ marginBottom: 18 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{generalError}</span>
            </div>
          )}

          {/* ══════ SECTION A: EXAMINATION INFORMATION ══════ */}
          <div className="exam-form-section">
            <div className="exam-section-title">
              <Sparkles size={15} color="#2563eb" />
              <span>A. Examination Information</span>
            </div>
            <p className="exam-section-desc">
              Select the academic session, examination type, and enter the examination name.
            </p>

            <div className="exam-form-grid-2" style={{ marginBottom: 16 }}>
              {/* Field 1: Academic Session */}
              <div className="exam-form-field">
                <label className="exam-label" htmlFor="academicSessionId">
                  Academic Session <span className="exam-required">*</span>
                </label>
                <select
                  id="academicSessionId"
                  value={academicSessionId}
                  onChange={(e) => {
                    setAcademicSessionId(Number(e.target.value));
                    setFieldErrors((prev) => ({ ...prev, session: undefined }));
                  }}
                  className="exam-select"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isActive ? '(Current Session)' : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.session && (
                  <div className="exam-field-error">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.session}</span>
                  </div>
                )}
              </div>

              {/* Field 2: Examination Type */}
              <div className="exam-form-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="exam-label" htmlFor="examTypeId" style={{ margin: 0 }}>
                    Examination Type <span className="exam-required">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTypeError(null);
                      setIsAddTypeModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#2563eb',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 6,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Add Type
                  </button>
                </div>
                <select
                  id="examTypeId"
                  value={examTypeId}
                  onChange={(e) => setExamTypeId(Number(e.target.value))}
                  className="exam-select"
                >
                  {localExamTypes.length === 0 ? (
                    <option value="" disabled>No exam types available (Click Add Type)</option>
                  ) : (
                    localExamTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Field 3: Examination Name */}
            <div className="exam-form-field">
              <label className="exam-label" htmlFor="examinationName">
                Examination Name <span className="exam-required">*</span>
              </label>
              <input
                id="examinationName"
                type="text"
                required
                value={name}
                placeholder="e.g. Mid Term Examination 2026-2027"
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className="exam-input"
                style={fieldErrors.name ? { borderColor: '#f43f5e', background: '#fff1f2' } : undefined}
              />
              {fieldErrors.name && (
                <div className="exam-field-error">
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{fieldErrors.name}</span>
                </div>
              )}

              {/* Quick Template Chips */}
              <div style={{ marginTop: 10 }}>
                <span className="exam-quick-label">
                  Quick Suggestions:
                </span>
                <div className="exam-pill-container">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="exam-pill-btn"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ══════ SECTION B: EXAMINATION SCHEDULE ══════ */}
          <div className="exam-form-section">
            <div className="exam-section-title">
              <Clock size={15} color="#2563eb" />
              <span>B. Examination Schedule</span>
            </div>
            <p className="exam-section-desc">
              Choose the start and end dates for this examination.
            </p>

            <div className="exam-form-grid-2">
              <div className="exam-form-field">
                <label className="exam-label" htmlFor="startDate">
                  Start Date <span className="exam-required">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, dates: undefined }));
                  }}
                  className="exam-input"
                  style={fieldErrors.dates ? { borderColor: '#f43f5e', background: '#fff1f2' } : undefined}
                />
              </div>

              <div className="exam-form-field">
                <label className="exam-label" htmlFor="endDate">
                  End Date <span className="exam-required">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, dates: undefined }));
                  }}
                  className="exam-input"
                  style={fieldErrors.dates ? { borderColor: '#f43f5e', background: '#fff1f2' } : undefined}
                />
              </div>
            </div>

            {fieldErrors.dates && (
              <div className="exam-field-error">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{fieldErrors.dates}</span>
              </div>
            )}
          </div>

          {/* ══════ SECTION C: PARTICIPATING CLASSES ══════ */}
          <div className="exam-form-section">
            <div className="exam-classes-header">
              <div className="exam-section-title" style={{ margin: 0 }}>
                <GraduationCap size={16} color="#2563eb" />
                <span>C. Participating Classes</span>
                <span className="exam-required">*</span>
              </div>

              {/* Action Controls: Count Badge + Select All / Deselect All */}
              <div className="exam-classes-actions">
                <span className="exam-classes-counter">
                  {selectedClassIds.length} of {activeClasses.length} classes selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="exam-btn-select-all"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllClasses}
                  className="exam-btn-deselect-all"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <p className="exam-section-desc">
              Select the classes that will take part in this examination. Subjects will be loaded automatically from each selected class.
            </p>

            {fieldErrors.classes && (
              <div className="exam-field-error" style={{ marginBottom: 10 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{fieldErrors.classes}</span>
              </div>
            )}

            {/* Selectable Class Cards Grid */}
            {activeClasses.length > 0 ? (
              <div className="exam-class-grid">
                {activeClasses.map((cls) => {
                  const isSelected = selectedClassIds.includes(cls.id);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => handleToggleClass(cls.id)}
                      className={`exam-class-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="exam-class-checkbox-box">
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <GraduationCap
                        size={15}
                        className="exam-class-icon"
                      />
                      <span className="exam-class-name" title={cls.name}>
                        {cls.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="exam-empty-classes">
                No active classes found in the system. Please configure classes in the Classes &amp; Subjects module first.
              </div>
            )}
          </div>

          {/* ══════ SECTION D: DESCRIPTION OR REMARKS ══════ */}
          <div className="exam-form-section">
            <div className="exam-section-title">
              <FileText size={15} color="#2563eb" />
              <span>D. Description or Remarks (Optional)</span>
            </div>
            <p className="exam-section-desc">
              Enter examination details, syllabus coverage, or additional instructions.
            </p>
            <textarea
              rows={3}
              value={description}
              placeholder="Enter examination details, syllabus coverage, or additional instructions..."
              onChange={(e) => setDescription(e.target.value)}
              className="exam-textarea"
            />
          </div>
        </div>

        {/* ─── Fixed Footer ─── */}
        <div className="exam-modal-footer">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-exam-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-exam-submit"
          >
            {isSubmitting ? (
              <>
                <span className="exam-spinner" />
                <span>{isEditing ? 'Saving Changes...' : 'Creating Examination...'}</span>
              </>
            ) : (
              <>
                {isEditing ? <Save size={15} /> : <Plus size={15} />}
                <span>{isEditing ? 'Save Changes' : 'Create Examination'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ─── Add Exam Type Modal ─── */}
      {isAddTypeModalOpen && (
        <div
          className="exam-modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddTypeModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Create Examination Type
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTypeModalOpen(false)}
                className="exam-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            {newTypeError && (
              <div className="exam-alert-banner" style={{ marginBottom: 14 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{newTypeError}</span>
              </div>
            )}

            <form onSubmit={handleCreateExamType}>
              <div style={{ marginBottom: 12 }}>
                <label className="exam-label">Type Name <span className="exam-required">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid Term Examination"
                  value={newTypeName}
                  onChange={(e) => {
                    setNewTypeName(e.target.value);
                    if (!newTypeCode) {
                      setNewTypeCode(e.target.value.substring(0, 4).toUpperCase());
                    }
                  }}
                  className="exam-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="exam-label">Short Code <span className="exam-required">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MID, FINAL, MNT"
                  value={newTypeCode}
                  onChange={(e) => setNewTypeCode(e.target.value.toUpperCase())}
                  className="exam-input"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="exam-label">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Mid-academic session evaluations"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  className="exam-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsAddTypeModalOpen(false)}
                  className="exam-btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingType || !newTypeName.trim()}
                  className="exam-btn-primary"
                  style={{ padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isAddingType ? 'Creating...' : <><Check size={16} /> Save Type</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
