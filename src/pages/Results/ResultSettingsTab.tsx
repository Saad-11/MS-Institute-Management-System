import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  Award,
  BookOpen,
  RotateCcw,
  X,
  Check,
  Save,
  HelpCircle,
  FileCheck,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import type { GradingRuleItem } from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

interface ResultSettingsTabProps {
  gradingRules: GradingRuleItem[];
  onReloadRules: () => Promise<void>;
}

export interface DMCDisplayPreferences {
  showGradeSymbol: boolean;
  showGradePoint: boolean;
  showPercentage: boolean;
  showPosition: boolean;
  showRemarks: boolean;
}

export interface ResultEvaluationRules {
  minPassingPercentage: number;
  subjectPassRequirement: 'every_subject' | 'aggregate_only';
  absentPolicy: 'fail_zero_marks';
  missingMarksPolicy: 'flag_pending';
  publicationRule: 'closed_only';
}

const DEFAULT_DMC_PREFERENCES: DMCDisplayPreferences = {
  showGradeSymbol: true,
  showGradePoint: true,
  showPercentage: true,
  showPosition: true,
  showRemarks: true,
};

const DEFAULT_RESULT_RULES: ResultEvaluationRules = {
  minPassingPercentage: 33,
  subjectPassRequirement: 'every_subject',
  absentPolicy: 'fail_zero_marks',
  missingMarksPolicy: 'flag_pending',
  publicationRule: 'closed_only',
};

// Standard 7-Tier Grading Scale (A+ through F)
const STANDARD_GRADING_RULES = [
  { name: 'A+ (Outstanding)', minPercentage: 90, maxPercentage: 100, grade: 'A+', gradePoint: 4.0, remarks: 'Outstanding Performance', displayOrder: 1 },
  { name: 'A (Excellent)', minPercentage: 80, maxPercentage: 89.99, grade: 'A', gradePoint: 3.7, remarks: 'Excellent Performance', displayOrder: 2 },
  { name: 'B (Very Good)', minPercentage: 70, maxPercentage: 79.99, grade: 'B', gradePoint: 3.0, remarks: 'Very Good Performance', displayOrder: 3 },
  { name: 'C (Good)', minPercentage: 60, maxPercentage: 69.99, grade: 'C', gradePoint: 2.5, remarks: 'Good Performance', displayOrder: 4 },
  { name: 'D (Satisfactory)', minPercentage: 50, maxPercentage: 59.99, grade: 'D', gradePoint: 2.0, remarks: 'Satisfactory Performance', displayOrder: 5 },
  { name: 'E (Pass)', minPercentage: 33, maxPercentage: 49.99, grade: 'E', gradePoint: 1.0, remarks: 'Pass', displayOrder: 6 },
  { name: 'F (Fail)', minPercentage: 0, maxPercentage: 32.99, grade: 'F', gradePoint: 0.0, remarks: 'Failed', displayOrder: 7 },
];

export const ResultSettingsTab: React.FC<ResultSettingsTabProps> = ({
  gradingRules,
  onReloadRules,
}) => {
  const { sessionToken } = useAuth();

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Auto-dismiss notification after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ADD GRADE MODAL STATE & FORM
  // ──────────────────────────────────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    name: '',
    minPercentage: '',
    maxPercentage: '',
    grade: '',
    gradePoint: '',
    remarks: '',
    displayOrder: '',
  });
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  const resetAddForm = () => {
    setAddFormData({
      name: '',
      minPercentage: '',
      maxPercentage: '',
      grade: '',
      gradePoint: '3.0',
      remarks: '',
      displayOrder: String(gradingRules.length + 1),
    });
    setAddFormErrors({});
  };

  const handleOpenAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 2. EDIT GRADE MODAL STATE & FORM
  // ──────────────────────────────────────────────────────────────────────────
  const [editingRule, setEditingRule] = useState<GradingRuleItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    minPercentage: '',
    maxPercentage: '',
    grade: '',
    gradePoint: '',
    remarks: '',
    displayOrder: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditModal = (rule: GradingRuleItem) => {
    setEditingRule(rule);
    setEditFormData({
      name: rule.name,
      minPercentage: String(rule.minPercentage),
      maxPercentage: String(rule.maxPercentage),
      grade: rule.grade,
      gradePoint: String(rule.gradePoint),
      remarks: rule.remarks,
      displayOrder: String(rule.displayOrder || 1),
    });
    setEditFormErrors({});
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DELETE CONFIRMATION MODAL STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [deletingRule, setDeletingRule] = useState<GradingRuleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. RESTORE DEFAULTS MODAL STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PASS MARKS & RESULT RULES STATE (Persisted in localStorage)
  // ──────────────────────────────────────────────────────────────────────────
  const [resultRules, setResultRules] = useState<ResultEvaluationRules>(() => {
    try {
      const saved = localStorage.getItem('school_result_evaluation_rules');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_RESULT_RULES;
  });
  const [isSavingResultRules, setIsSavingResultRules] = useState(false);

  const handleSaveResultRules = () => {
    setIsSavingResultRules(true);
    try {
      localStorage.setItem('school_result_evaluation_rules', JSON.stringify(resultRules));
      setNotification({
        type: 'success',
        message: 'Pass marks and institutional result policies updated successfully.',
      });
    } catch {
      setNotification({
        type: 'error',
        message: 'Failed to persist result evaluation settings.',
      });
    } finally {
      setIsSavingResultRules(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. DMC DISPLAY PREFERENCES STATE (Persisted in localStorage for DMCReportCard)
  // ──────────────────────────────────────────────────────────────────────────
  const [dmcPrefs, setDmcPrefs] = useState<DMCDisplayPreferences>(() => {
    try {
      const saved = localStorage.getItem('dmc_display_preferences');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_DMC_PREFERENCES;
  });
  const [isSavingDmcPrefs, setIsSavingDmcPrefs] = useState(false);

  const handleToggleDmcPref = (key: keyof DMCDisplayPreferences) => {
    const updated = { ...dmcPrefs, [key]: !dmcPrefs[key] };
    setDmcPrefs(updated);
    try {
      localStorage.setItem('dmc_display_preferences', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save DMC preference:', e);
    }
  };

  const handleSaveAllDmcPrefs = () => {
    setIsSavingDmcPrefs(true);
    try {
      localStorage.setItem('dmc_display_preferences', JSON.stringify(dmcPrefs));
      setNotification({
        type: 'success',
        message: 'DMC display settings saved. All future DMC certificates and print previews will respect these preferences.',
      });
    } catch {
      setNotification({
        type: 'error',
        message: 'Failed to persist DMC display preferences.',
      });
    } finally {
      setIsSavingDmcPrefs(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // VALIDATION HELPER: Duplicate & Overlap Check
  // ──────────────────────────────────────────────────────────────────────────
  const validateGradeData = (
    data: {
      name: string;
      minPercentage: string;
      maxPercentage: string;
      grade: string;
      gradePoint: string;
      remarks: string;
    },
    currentRuleId?: number
  ): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    const name = data.name.trim();
    const grade = data.grade.trim().toUpperCase();
    const minPct = parseFloat(data.minPercentage);
    const maxPct = parseFloat(data.maxPercentage);
    const gp = parseFloat(data.gradePoint);

    if (!name) {
      errors.name = 'Grade / Scale Name is required.';
    }

    if (!grade) {
      errors.grade = 'Grade symbol is required (e.g. A+, A, B).';
    }

    if (isNaN(minPct) || minPct < 0 || minPct > 100) {
      errors.minPercentage = 'Minimum percentage must be between 0 and 100.';
    }

    if (isNaN(maxPct) || maxPct < 0 || maxPct > 100) {
      errors.maxPercentage = 'Maximum percentage must be between 0 and 100.';
    }

    if (!errors.minPercentage && !errors.maxPercentage) {
      if (minPct > maxPct) {
        errors.minPercentage = 'Minimum percentage cannot exceed maximum percentage.';
      }
    }

    if (isNaN(gp) || gp < 0 || gp > 5.0) {
      errors.gradePoint = 'Grade point must be a valid number between 0.0 and 5.0.';
    }

    // 1. Check duplicate Grade Symbol (excluding the rule being edited)
    const duplicateSymbol = gradingRules.find(
      (r) => r.id !== currentRuleId && r.grade.trim().toUpperCase() === grade
    );
    if (duplicateSymbol) {
      errors.grade = `Grade symbol "${grade}" is already used by "${duplicateSymbol.name}".`;
    }

    // 2. Check Overlapping Percentage Range (excluding the rule being edited)
    if (!errors.minPercentage && !errors.maxPercentage && minPct <= maxPct) {
      for (const other of gradingRules) {
        if (other.id === currentRuleId) continue;
        // Two intervals [minA, maxA] and [minB, maxB] strictly overlap if:
        // max(minA, minB) < min(maxA, maxB)
        const overlapStart = Math.max(minPct, other.minPercentage);
        const overlapEnd = Math.min(maxPct, other.maxPercentage);
        if (overlapStart < overlapEnd) {
          errors.minPercentage = `Range (${minPct}%–${maxPct}%) overlaps with "${other.name}" (${other.minPercentage}%–${other.maxPercentage}%).`;
          break;
        }
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Save New Grade
  // ──────────────────────────────────────────────────────────────────────────
  const handleSaveNewGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electronAPI) return;

    const { isValid, errors } = validateGradeData(addFormData);
    if (!isValid) {
      setAddFormErrors(errors);
      return;
    }

    setIsSavingAdd(true);
    try {
      const res = await window.electronAPI.exams.saveGradingRule({
        sessionToken: sessionToken || '',
        name: addFormData.name.trim(),
        minPercentage: parseFloat(addFormData.minPercentage),
        maxPercentage: parseFloat(addFormData.maxPercentage),
        grade: addFormData.grade.trim().toUpperCase(),
        gradePoint: parseFloat(addFormData.gradePoint) || 0,
        remarks: addFormData.remarks.trim(),
        displayOrder: parseInt(addFormData.displayOrder, 10) || gradingRules.length + 1,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Grading rule for Grade "${addFormData.grade.toUpperCase()}" added successfully.`,
        });
        setIsAddModalOpen(false);
        resetAddForm();
        await onReloadRules();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to save new grading rule.',
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error occurred while saving grading rule.',
      });
    } finally {
      setIsSavingAdd(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Update Existing Grade
  // ──────────────────────────────────────────────────────────────────────────
  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electronAPI || !editingRule) return;

    const { isValid, errors } = validateGradeData(editFormData, editingRule.id);
    if (!isValid) {
      setEditFormErrors(errors);
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await window.electronAPI.exams.saveGradingRule({
        sessionToken: sessionToken || '',
        id: editingRule.id,
        name: editFormData.name.trim(),
        minPercentage: parseFloat(editFormData.minPercentage),
        maxPercentage: parseFloat(editFormData.maxPercentage),
        grade: editFormData.grade.trim().toUpperCase(),
        gradePoint: parseFloat(editFormData.gradePoint) || 0,
        remarks: editFormData.remarks.trim(),
        displayOrder: parseInt(editFormData.displayOrder, 10) || editingRule.displayOrder || 1,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Grading rule for "${editFormData.grade.toUpperCase()}" updated successfully.`,
        });
        setEditingRule(null);
        await onReloadRules();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to update grading rule.',
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error updating grading rule.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Delete Grade
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!window.electronAPI || !deletingRule) return;

    // Safety check: Prevent deleting if this is the only rule remaining
    if (gradingRules.length <= 1) {
      setNotification({
        type: 'error',
        message: 'Cannot delete the only remaining grading rule. The application requires at least one active grade level for calculation.',
      });
      setDeletingRule(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await window.electronAPI.exams.deleteGradingRule(
        sessionToken || '',
        deletingRule.id
      );

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Grading rule "${deletingRule.grade}" deleted successfully.`,
        });
        setDeletingRule(null);
        await onReloadRules();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to delete grading rule.',
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error deleting grading rule.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Restore Oxford Standard Grading Scale
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmResetDefaults = async () => {
    if (!window.electronAPI) return;
    setIsResetting(true);

    try {
      // 1. Remove existing rules safely
      for (const rule of gradingRules) {
        await window.electronAPI.exams.deleteGradingRule(sessionToken || '', rule.id);
      }

      // 2. Seed Standard Grading Rules
      for (const std of STANDARD_GRADING_RULES) {
        await window.electronAPI.exams.saveGradingRule({
          sessionToken: sessionToken || '',
          name: std.name,
          minPercentage: std.minPercentage,
          maxPercentage: std.maxPercentage,
          grade: std.grade,
          gradePoint: std.gradePoint,
          remarks: std.remarks,
          displayOrder: std.displayOrder,
        });
      }

      setNotification({
        type: 'success',
        message: 'Standard 7-tier grading scale (A+ through F) restored successfully.',
      });
      setIsResetModalOpen(false);
      await onReloadRules();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to restore standard grading scale.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Helper for Grade Badge styling
  const getGradeBadgeClass = (grade: string) => {
    const g = grade.trim().toUpperCase();
    if (g === 'A+' || g === 'A*') return 'grade-pill-a-plus';
    if (g === 'A') return 'grade-pill-a';
    if (g === 'B') return 'grade-pill-b';
    if (g === 'C') return 'grade-pill-c';
    if (g === 'D') return 'grade-pill-d';
    if (g === 'E') return 'grade-pill-e';
    return 'grade-pill-f';
  };

  // Sorted grading rules (descending percentage for display)
  const sortedRules = useMemo(() => {
    return [...gradingRules].sort((a, b) => b.minPercentage - a.minPercentage);
  }, [gradingRules]);

  return (
    <div className="settings-workspace">
      {/* ─── 1. PAGE HEADER ────────────────────────────────────────────────── */}
      <div className="settings-header-card">
        <div className="settings-header-info">
          <div className="settings-header-icon-box">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="settings-header-title">Result & Grading Settings</h1>
            <p className="settings-header-subtitle">
              Configure grading scales, percentage ranges, grade points, and remarks used in examination results and DMCs.
            </p>
          </div>
        </div>

        <div className="settings-header-actions">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-200"
            title="Reset grading rules to Oxford Model High School standard scale"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Standard Scale
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Add Grade Scale
          </button>
        </div>
      </div>

      {/* ─── Notification Alert Banner ─────────────────────────────────────── */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            )}
            {notification.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            {notification.type === 'info' && (
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
            )}
            <span className="font-semibold text-xs md:text-sm">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold p-1 rounded hover:bg-black/5 cursor-pointer ml-3"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 2. SECTION 1: CURRENT GRADING SCALE ───────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 className="settings-card-title">
              <Award className="w-4 h-4 text-blue-600" />
              Current Grading Scale
            </h2>
            <p className="settings-card-desc">
              These grading rules are applied when examination results are calculated and DMCs are generated.
            </p>
          </div>

          <span className="settings-card-badge">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            {gradingRules.length} {gradingRules.length === 1 ? 'Grade Level' : 'Grade Levels'}
          </span>

        </div>

        {/* Polished Grading Scale Table */}
        <div className="settings-table-wrapper">
          <table className="settings-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '160px' }}>Grade Name</th>
                <th style={{ minWidth: '150px', textAlign: 'center' }}>Percentage Range</th>
                <th style={{ minWidth: '90px', textAlign: 'center' }}>Grade Symbol</th>
                <th style={{ minWidth: '100px', textAlign: 'center' }}>Grade Point</th>
                <th style={{ minWidth: '180px' }}>Remarks</th>
                <th style={{ minWidth: '160px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No grading rules found.</p>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                      Add a new grade level or restore the standard 7-tier scale.
                    </p>
                    <button
                      onClick={() => setIsResetModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      Restore Standard Scale
                    </button>
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule, idx) => (
                  <tr key={rule.id}>
                    <td style={{ textAlign: 'center' }} className="font-mono text-xs text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td>
                      <span className="font-bold text-slate-900 block">{rule.name}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md font-mono text-xs font-bold border border-slate-200">
                        {rule.minPercentage.toFixed(2)}% – {rule.maxPercentage.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`grade-pill ${getGradeBadgeClass(rule.grade)}`}>
                        {rule.grade}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="font-mono font-bold text-slate-700">
                      {rule.gradePoint.toFixed(1)}
                    </td>
                    <td className="text-slate-600 font-medium">
                      {rule.remarks || '—'}
                    </td>
                    <td>
                      <div className="settings-actions-cell">
                        <button
                          onClick={() => handleOpenEditModal(rule)}
                          className="btn-grade-edit"
                          title={`Edit ${rule.grade}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingRule(rule)}
                          className="btn-grade-delete"
                          title={`Delete ${rule.grade}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 3. SECTION 2: PASS MARKS & RESULT RULES ───────────────────────── */}
      <div className="settings-card pass-marks-settings-card">
        {/* Card Header */}
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 className="settings-card-title">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Pass Marks &amp; Result Rules
            </h2>
            <p className="settings-card-desc">
              Configure the passing criteria and rules used to calculate examination results.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="policy-badge policy-badge-success">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Rules Active
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="settings-card-body pass-marks-card-body">
          {/* Subsection A: Configurable Settings (2-column grid) */}
          <div className="pass-rules-config-grid">
            {/* Setting 1: Minimum Passing Percentage */}
            <div className="pass-rule-block">
              <div className="pass-rule-header">
                <div className="pass-rule-title-wrap">
                  <span className="pass-rule-title">Minimum Passing Percentage</span>
                  <span className="pass-rule-subtitle">
                    Set the minimum overall percentage required to pass.
                  </span>
                </div>
                <div className="pass-value-badge" aria-label={`Current threshold: ${resultRules.minPassingPercentage}%`}>
                  {resultRules.minPassingPercentage}%
                </div>
              </div>

              {/* Slider track with filled progress and thumb */}
              <div className="pass-slider-container">
                <div className="pass-slider-track-wrap">
                  <input
                    type="range"
                    min="30"
                    max="50"
                    step="1"
                    value={resultRules.minPassingPercentage}
                    onChange={(e) =>
                      setResultRules({ ...resultRules, minPassingPercentage: Number(e.target.value) })
                    }
                    className="pass-range-slider"
                    aria-label="Minimum Passing Percentage"
                    aria-valuemin={30}
                    aria-valuemax={50}
                    aria-valuenow={resultRules.minPassingPercentage}
                    style={{
                      background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                        ((resultRules.minPassingPercentage - 30) / (50 - 30)) * 100
                      }%, #e2e8f0 ${
                        ((resultRules.minPassingPercentage - 30) / (50 - 30)) * 100
                      }%, #e2e8f0 100%)`,
                    }}
                  />
                </div>
                <div className="pass-slider-scale">
                  <span>30%</span>
                  <span className="font-semibold text-slate-700">Minimum passing threshold: {resultRules.minPassingPercentage}%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            {/* Setting 2: Subject-Level Passing Requirement */}
            <div className="pass-rule-block">
              <div className="pass-rule-header">
                <div className="pass-rule-title-wrap">
                  <label htmlFor="subject-pass-requirement-select" className="pass-rule-title cursor-pointer">
                    Subject-Level Passing Requirement
                  </label>
                  <span className="pass-rule-subtitle">
                    Choose how individual subject results affect the student's overall examination result.
                  </span>
                </div>
                <div className="pass-rule-type-badge">
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  Subject Rule
                </div>
              </div>

              <div className="pass-dropdown-wrap">
                <select
                  id="subject-pass-requirement-select"
                  value={resultRules.subjectPassRequirement}
                  onChange={(e) =>
                    setResultRules({
                      ...resultRules,
                      subjectPassRequirement: e.target.value as 'every_subject' | 'aggregate_only',
                    })
                  }
                  className="pass-select-control"
                >
                  <option value="every_subject">
                    Must Pass Every Subject (Strict School Standard)
                  </option>
                  <option value="aggregate_only">
                    Pass on Overall Aggregate Percentage Only
                  </option>
                </select>
                <p className="pass-dropdown-hint">
                  {resultRules.subjectPassRequirement === 'every_subject'
                    ? 'A student failing in even a single registered paper will be marked as Failed on their result card.'
                    : 'A student qualifies if their combined aggregate score satisfies the minimum passing percentage.'}
                </p>
              </div>
            </div>
          </div>

          {/* Subsection B: Informational Policy Panels (2-column grid) */}
          <div className="pass-policies-grid">
            {/* Panel 1: Absent Student Policy */}
            <div className="pass-policy-panel pass-policy-panel-amber">
              <div className="pass-policy-panel-header">
                <div className="pass-policy-icon-box pass-policy-icon-amber">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                </div>
                <div className="pass-policy-header-text">
                  <h3 className="pass-policy-heading">Absent Student Policy</h3>
                  <span className="pass-policy-tag pass-policy-tag-amber">Institutional Rule</span>
                </div>
              </div>
              <p className="pass-policy-description">
                Students marked as absent receive 0 marks for the affected paper and are treated according to the application's existing absence rules.
              </p>
              <div className="pass-policy-rule-badge pass-policy-rule-amber">
                <span className="font-semibold">Enforced Rule:</span> Status = Absent | Marks = 0 | Result = FAIL
              </div>
            </div>

            {/* Panel 2: Treatment of Missing Marks */}
            <div className="pass-policy-panel pass-policy-panel-blue">
              <div className="pass-policy-panel-header">
                <div className="pass-policy-icon-box pass-policy-icon-blue">
                  <Clock className="w-4 h-4 text-blue-700" />
                </div>
                <div className="pass-policy-header-text">
                  <h3 className="pass-policy-heading">Treatment of Missing Marks</h3>
                  <span className="pass-policy-tag pass-policy-tag-blue">Status Guard</span>
                </div>
              </div>
              <p className="pass-policy-description">
                Marks that have not yet been entered remain pending until the required marks-entry process is completed.
              </p>
              <div className="pass-policy-rule-badge pass-policy-rule-blue">
                <span className="font-semibold">Enforced Rule:</span> Marks Status = Pending / Incomplete
              </div>
            </div>
          </div>

          {/* Subsection C: Save Action Footer Area */}
          <div className="pass-rules-action-footer">
            <div className="pass-footer-info">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                Changes take effect for all subsequent marks calculations and report cards.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveResultRules}
              disabled={isSavingResultRules}
              className="pass-save-btn"
              aria-label="Save Result Rules"
            >
              {isSavingResultRules ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Result Rules</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4. SECTION 3: GRADE CALCULATION RULES ─────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 className="settings-card-title">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Grade Calculation Rules & Logic
            </h2>
            <p className="settings-card-desc">
              Standardized mathematical and logical rules applied when compiling student examination results and generating DMC certificates.
            </p>
          </div>

          <span className="policy-badge policy-badge-info">
            <HelpCircle className="w-3.5 h-3.5" />
            Evaluation Reference
          </span>
        </div>

        <div className="settings-card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Step 1 — Percentage Formula */}
            <div className="calc-rule-card calc-rule-indigo">
              <div className="calc-rule-heading">
                <span className="calc-step-num calc-step-num-indigo">01</span>
                <span className="calc-rule-label">Percentage Formula</span>
              </div>
              <code className="calc-rule-formula calc-formula-indigo">
                (Σ Obtained Marks ÷ Σ Maximum Marks) × 100
              </code>
              <p className="calc-rule-desc">
                The aggregate percentage is computed by dividing the total marks obtained across all subjects by the total available marks. The result is rounded to two decimal places.
              </p>
            </div>

            {/* Step 2 — Grade Interval Matching */}
            <div className="calc-rule-card calc-rule-blue">
              <div className="calc-rule-heading">
                <span className="calc-step-num calc-step-num-blue">02</span>
                <span className="calc-rule-label">Grade Interval Matching</span>
              </div>
              <code className="calc-rule-formula calc-formula-blue">
                Min% ≤ Student Score% ≤ Max%
              </code>
              <p className="calc-rule-desc">
                The computed percentage is compared against all percentage ranges in the Current Grading Scale table. The first matching interval (checked from highest to lowest) determines the student's grade symbol and qualitative remarks.
              </p>
            </div>

            {/* Step 3 — GPA & Grade Points */}
            <div className="calc-rule-card calc-rule-emerald">
              <div className="calc-rule-heading">
                <span className="calc-step-num calc-step-num-emerald">03</span>
                <span className="calc-rule-label">GPA &amp; Grade Points</span>
              </div>
              <code className="calc-rule-formula calc-formula-emerald">
                GPA = Grade Point of matched interval (0.0 – 4.0)
              </code>
              <p className="calc-rule-desc">
                The Grade Point value configured for the matched percentage interval is recorded on the student's academic transcript and printed on the DMC. No averaging is applied; only the matched interval's configured value is used.
              </p>
            </div>

            {/* Step 4 — Merit & Rank Position */}
            <div className="calc-rule-card calc-rule-purple">
              <div className="calc-rule-heading">
                <span className="calc-step-num calc-step-num-purple">04</span>
                <span className="calc-rule-label">Merit &amp; Rank Position</span>
              </div>
              <code className="calc-rule-formula calc-formula-purple">
                Rank by % (desc) → Tie-break by Total Obtained Marks
              </code>
              <p className="calc-rule-desc">
                Students are ranked within their class in descending order of aggregate percentage. When two students share the same percentage, the one with the higher total obtained marks is ranked higher.
              </p>
            </div>
          </div>


          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              All grading settings are synchronized identically across <strong>Enter Marks</strong>, <strong>View Results</strong>, <strong>Merit Lists</strong>, and <strong>DMC Generation</strong>.
            </span>
          </div>
        </div>
      </div>

      {/* ─── 5. SECTION 4: DMC DISPLAY SETTINGS ────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 className="settings-card-title">
              <Award className="w-4 h-4 text-blue-600" />
              DMC Display Settings
            </h2>
            <p className="settings-card-desc">
              Configure which evaluation metrics appear on generated Detailed Marks Certificates and printable transcripts.
            </p>
          </div>

          <button
            onClick={handleSaveAllDmcPrefs}
            disabled={isSavingDmcPrefs}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingDmcPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        <div className="settings-card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Toggle 1: Grade Symbol */}
            <div className={`toggle-switch-wrapper ${dmcPrefs.showGradeSymbol ? 'active' : ''}`}>
              <div className="toggle-info">
                <span className="toggle-title">Display Grade Symbol</span>
                <span className="toggle-desc">
                  Show letter grade (A+, A, B...) in subject rows & summary.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDmcPref('showGradeSymbol')}
                className={`switch-pill ${dmcPrefs.showGradeSymbol ? 'switch-on' : ''}`}
                aria-pressed={dmcPrefs.showGradeSymbol}
              >
                <span className="switch-circle" />
              </button>
            </div>

            {/* Toggle 2: Grade Point (GPA) */}
            <div className={`toggle-switch-wrapper ${dmcPrefs.showGradePoint ? 'active' : ''}`}>
              <div className="toggle-info">
                <span className="toggle-title">Display Grade Point (GPA)</span>
                <span className="toggle-desc">
                  Show numerical GPA (e.g. 4.0, 3.7) on certificate cards.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDmcPref('showGradePoint')}
                className={`switch-pill ${dmcPrefs.showGradePoint ? 'switch-on' : ''}`}
                aria-pressed={dmcPrefs.showGradePoint}
              >
                <span className="switch-circle" />
              </button>
            </div>

            {/* Toggle 3: Percentage */}
            <div className={`toggle-switch-wrapper ${dmcPrefs.showPercentage ? 'active' : ''}`}>
              <div className="toggle-info">
                <span className="toggle-title">Display Percentage</span>
                <span className="toggle-desc">
                  Show overall percentage and subject-wise percentages.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDmcPref('showPercentage')}
                className={`switch-pill ${dmcPrefs.showPercentage ? 'switch-on' : ''}`}
                aria-pressed={dmcPrefs.showPercentage}
              >
                <span className="switch-circle" />
              </button>
            </div>

            {/* Toggle 4: Student Position */}
            <div className={`toggle-switch-wrapper ${dmcPrefs.showPosition ? 'active' : ''}`}>
              <div className="toggle-info">
                <span className="toggle-title">Display Class Position</span>
                <span className="toggle-desc">
                  Show student rank in class (e.g. "1st of 32").
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDmcPref('showPosition')}
                className={`switch-pill ${dmcPrefs.showPosition ? 'switch-on' : ''}`}
                aria-pressed={dmcPrefs.showPosition}
              >
                <span className="switch-circle" />
              </button>
            </div>

            {/* Toggle 5: Result Remarks */}
            <div className={`toggle-switch-wrapper ${dmcPrefs.showRemarks ? 'active' : ''}`}>
              <div className="toggle-info">
                <span className="toggle-title">Display Remarks</span>
                <span className="toggle-desc">
                  Show qualitative remarks (e.g. "Outstanding Performance").
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleDmcPref('showRemarks')}
                className={`switch-pill ${dmcPrefs.showRemarks ? 'switch-on' : ''}`}
                aria-pressed={dmcPrefs.showRemarks}
              >
                <span className="switch-circle" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900 font-medium">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                Preferences are saved in real-time and applied dynamically to DMC Report Cards and print previews.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: ADD NEW GRADE SCALE ──────────────────────────────────── */}
      {isAddModalOpen && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="settings-modal-container">
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">Add New Grade</h3>
                <p className="settings-modal-subtitle">
                  Define a new percentage boundary, grade symbol, and remark for examination results.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="settings-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewGrade}>
              <div className="settings-modal-body space-y-4">
                <div className="settings-form-grid settings-form-grid-2">
                  <div>
                    <label className="settings-label">
                      Grade / Scale Name <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Outstanding (A+)"
                      value={addFormData.name}
                      onChange={(e) => {
                        setAddFormData({ ...addFormData, name: e.target.value });
                        if (addFormErrors.name) setAddFormErrors({ ...addFormErrors, name: '' });
                      }}
                      className={`settings-input ${addFormErrors.name ? 'settings-input-error' : ''}`}
                    />
                    {addFormErrors.name && (
                      <p className="settings-field-error">{addFormErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Grade Symbol <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. A+"
                      value={addFormData.grade}
                      onChange={(e) => {
                        setAddFormData({ ...addFormData, grade: e.target.value.toUpperCase() });
                        if (addFormErrors.grade) setAddFormErrors({ ...addFormErrors, grade: '' });
                      }}
                      className={`settings-input font-black uppercase ${
                        addFormErrors.grade ? 'settings-input-error' : ''
                      }`}
                    />
                    {addFormErrors.grade && (
                      <p className="settings-field-error">{addFormErrors.grade}</p>
                    )}
                  </div>
                </div>

                <div className="settings-form-grid settings-form-grid-3">
                  <div>
                    <label className="settings-label">
                      Min Percentage (%) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      placeholder="e.g. 90.00"
                      value={addFormData.minPercentage}
                      onChange={(e) => {
                        setAddFormData({ ...addFormData, minPercentage: e.target.value });
                        if (addFormErrors.minPercentage)
                          setAddFormErrors({ ...addFormErrors, minPercentage: '' });
                      }}
                      className={`settings-input font-mono ${
                        addFormErrors.minPercentage ? 'settings-input-error' : ''
                      }`}
                    />
                    {addFormErrors.minPercentage && (
                      <p className="settings-field-error">{addFormErrors.minPercentage}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Max Percentage (%) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      placeholder="e.g. 100.00"
                      value={addFormData.maxPercentage}
                      onChange={(e) => {
                        setAddFormData({ ...addFormData, maxPercentage: e.target.value });
                        if (addFormErrors.maxPercentage)
                          setAddFormErrors({ ...addFormErrors, maxPercentage: '' });
                      }}
                      className={`settings-input font-mono ${
                        addFormErrors.maxPercentage ? 'settings-input-error' : ''
                      }`}
                    />
                    {addFormErrors.maxPercentage && (
                      <p className="settings-field-error">{addFormErrors.maxPercentage}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Grade Point (GPA) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      required
                      placeholder="e.g. 4.0"
                      value={addFormData.gradePoint}
                      onChange={(e) => {
                        setAddFormData({ ...addFormData, gradePoint: e.target.value });
                        if (addFormErrors.gradePoint)
                          setAddFormErrors({ ...addFormErrors, gradePoint: '' });
                      }}
                      className={`settings-input font-mono ${
                        addFormErrors.gradePoint ? 'settings-input-error' : ''
                      }`}
                    />
                    {addFormErrors.gradePoint && (
                      <p className="settings-field-error">{addFormErrors.gradePoint}</p>
                    )}
                  </div>
                </div>

                <div className="settings-form-grid settings-form-grid-2">
                  <div>
                    <label className="settings-label">Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Outstanding Performance"
                      value={addFormData.remarks}
                      onChange={(e) => setAddFormData({ ...addFormData, remarks: e.target.value })}
                      className="settings-input"
                    />
                  </div>

                  <div>
                    <label className="settings-label">Display Order</label>
                    <input
                      type="number"
                      min="1"
                      value={addFormData.displayOrder}
                      onChange={(e) =>
                        setAddFormData({ ...addFormData, displayOrder: e.target.value })
                      }
                      className="settings-input font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdd}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingAdd ? 'Saving Grade...' : 'Save Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: EDIT GRADE SCALE ─────────────────────────────────────── */}
      {editingRule && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingRule(null);
          }}
        >
          <div className="settings-modal-container">
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">Edit Grading Rule</h3>
                <p className="settings-modal-subtitle">
                  Modify boundaries, symbols, or remarks for Grade "{editingRule.grade}".
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="settings-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGrade}>
              <div className="settings-modal-body space-y-4">
                <div className="settings-form-grid settings-form-grid-2">
                  <div>
                    <label className="settings-label">
                      Grade / Scale Name <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, name: e.target.value });
                        if (editFormErrors.name) setEditFormErrors({ ...editFormErrors, name: '' });
                      }}
                      className={`settings-input ${editFormErrors.name ? 'settings-input-error' : ''}`}
                    />
                    {editFormErrors.name && (
                      <p className="settings-field-error">{editFormErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Grade Symbol <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.grade}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, grade: e.target.value.toUpperCase() });
                        if (editFormErrors.grade)
                          setEditFormErrors({ ...editFormErrors, grade: '' });
                      }}
                      className={`settings-input font-black uppercase ${
                        editFormErrors.grade ? 'settings-input-error' : ''
                      }`}
                    />
                    {editFormErrors.grade && (
                      <p className="settings-field-error">{editFormErrors.grade}</p>
                    )}
                  </div>
                </div>

                <div className="settings-form-grid settings-form-grid-3">
                  <div>
                    <label className="settings-label">
                      Min Percentage (%) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={editFormData.minPercentage}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, minPercentage: e.target.value });
                        if (editFormErrors.minPercentage)
                          setEditFormErrors({ ...editFormErrors, minPercentage: '' });
                      }}
                      className={`settings-input font-mono ${
                        editFormErrors.minPercentage ? 'settings-input-error' : ''
                      }`}
                    />
                    {editFormErrors.minPercentage && (
                      <p className="settings-field-error">{editFormErrors.minPercentage}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Max Percentage (%) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={editFormData.maxPercentage}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, maxPercentage: e.target.value });
                        if (editFormErrors.maxPercentage)
                          setEditFormErrors({ ...editFormErrors, maxPercentage: '' });
                      }}
                      className={`settings-input font-mono ${
                        editFormErrors.maxPercentage ? 'settings-input-error' : ''
                      }`}
                    />
                    {editFormErrors.maxPercentage && (
                      <p className="settings-field-error">{editFormErrors.maxPercentage}</p>
                    )}
                  </div>

                  <div>
                    <label className="settings-label">
                      Grade Point (GPA) <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      required
                      value={editFormData.gradePoint}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, gradePoint: e.target.value });
                        if (editFormErrors.gradePoint)
                          setEditFormErrors({ ...editFormErrors, gradePoint: '' });
                      }}
                      className={`settings-input font-mono ${
                        editFormErrors.gradePoint ? 'settings-input-error' : ''
                      }`}
                    />
                    {editFormErrors.gradePoint && (
                      <p className="settings-field-error">{editFormErrors.gradePoint}</p>
                    )}
                  </div>
                </div>

                <div className="settings-form-grid settings-form-grid-2">
                  <div>
                    <label className="settings-label">Remarks</label>
                    <input
                      type="text"
                      value={editFormData.remarks}
                      onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                      className="settings-input"
                    />
                  </div>

                  <div>
                    <label className="settings-label">Display Order</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.displayOrder}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, displayOrder: e.target.value })
                      }
                      className="settings-input font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: DELETE CONFIRMATION ──────────────────────────────────── */}
      {deletingRule && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRule(null);
          }}
        >
          <div className="settings-modal-container max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2.5 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Grading Rule?
                </h3>
              </div>

              <div className="space-y-2 text-xs text-slate-600 leading-relaxed mb-6">
                <p>
                  Are you sure you want to delete the grading rule for{' '}
                  <strong className="text-slate-900 font-bold">
                    Grade "{deletingRule.grade}" ({deletingRule.name})
                  </strong>
                  ?
                </p>
                <p className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900 font-medium">
                  <strong>Important Notice:</strong> Changing or deleting grading rules affects how future examination results, merit lists, and DMCs are evaluated.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingRule(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: RESET TO STANDARD SCALE ──────────────────────────────── */}
      {isResetModalOpen && (
        <div
          className="settings-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsResetModalOpen(false);
          }}
        >
          <div className="settings-modal-container max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 text-blue-600 mb-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <RotateCcw className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Restore Standard Grading Scale?
                </h3>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed mb-6">
                <p>
                  This action will replace the current scale with the official Standard 7-tier scale:
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
                  <div>A+ : 90.00% – 100.00% (GPA 4.0)</div>
                  <div>A&nbsp; : 80.00% – 89.99% (GPA 3.7)</div>
                  <div>B&nbsp; : 70.00% – 79.99% (GPA 3.0)</div>
                  <div>C&nbsp; : 60.00% – 69.99% (GPA 2.5)</div>
                  <div>D&nbsp; : 50.00% – 59.99% (GPA 2.0)</div>
                  <div>E&nbsp; : 33.00% – 49.99% (GPA 1.0)</div>
                  <div>F&nbsp; : 0.00% – 32.99% (GPA 0.0)</div>
                </div>
                <p className="text-amber-800 font-medium">
                  Existing historical examination marks will remain intact.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetDefaults}
                  disabled={isResetting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isResetting ? 'Restoring...' : 'Restore Standard Scale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
