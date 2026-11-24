/**
 * Classes & Sections Tab
 * 
 * Manages institutional classes (Grade 1..10, First Year) and their sections (A, B, Blue).
 * Supports ordering, search, status toggles, and section management.
 * 100% offline, responsive, modern, and user-friendly for school administration.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit2,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  Eye,
  EyeOff,
  GraduationCap,
  X,
  RefreshCw,
  ShieldAlert,
  Layers,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ClassItem, SectionItem, ClassSectionInput } from '../../types/electron';
import '../../styles/classes.css';

const DEFAULT_SECTION_PRESETS = ['Section A', 'Section B', 'Section C', 'Section D'];

interface StatusConfirmState {
  isOpen: boolean;
  type: 'class' | 'section';
  item: ClassItem | SectionItem | null;
  targetStatus: boolean;
  isProcessing: boolean;
}

export const ClassesTab: React.FC = () => {
  const { sessionToken } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add / Edit Class Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classFormData, setClassFormData] = useState({
    name: '',
    code: '',
    displayOrder: 1,
    isActive: true,
  });
  const [classModalError, setClassModalError] = useState<string | null>(null);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // Sections management inside Add / Edit Class Modal
  const [sectionTags, setSectionTags] = useState<ClassSectionInput[]>([]);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [sectionInputError, setSectionInputError] = useState<string | null>(null);

  // Sections Drawer / Modal for a selected class
  const [selectedClassForSections, setSelectedClassForSections] = useState<ClassItem | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState('');

  // Add / Edit Section Modal
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionItem | null>(null);
  const [sectionFormData, setSectionFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [sectionModalError, setSectionModalError] = useState<string | null>(null);
  const [isSubmittingSection, setIsSubmittingSection] = useState(false);

  // In-App Status Confirmation Modal
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>({
    isOpen: false,
    type: 'class',
    item: null,
    targetStatus: false,
    isProcessing: false,
  });

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.classes) {
        const res = await window.electronAPI.classes.getAll(searchQuery);
        if (res.success && res.classes) {
          setClasses(res.classes);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load institutional classes.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Fetch sections for selected class
  const fetchSections = useCallback(async (classId: number) => {
    setIsLoadingSections(true);
    try {
      if (window.electronAPI?.sections) {
        const res = await window.electronAPI.sections.getByClassId(classId, sectionSearchQuery);
        if (res.success && res.sections) {
          setSections(res.sections);
        } else {
          setSections([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSections(false);
    }
  }, [sectionSearchQuery]);

  useEffect(() => {
    if (selectedClassForSections) {
      fetchSections(selectedClassForSections.id);
    }
  }, [selectedClassForSections, fetchSections]);

  // Real-time Summary Metrics
  const metrics = useMemo(() => {
    const totalClasses = classes.length;
    const activeClasses = classes.filter((c) => c.isActive).length;
    const inactiveClasses = totalClasses - activeClasses;
    const totalSections = classes.reduce((sum, c) => sum + (c.sectionCount || 0), 0);
    const totalSubjects = classes.reduce((sum, c) => sum + (c.subjectCount || 0), 0);
    return { totalClasses, activeClasses, inactiveClasses, totalSections, totalSubjects };
  }, [classes]);

  // Filtered Classes based on Status
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (statusFilter === 'active' && !cls.isActive) return false;
      if (statusFilter === 'inactive' && cls.isActive) return false;
      return true;
    });
  }, [classes, statusFilter]);

  // Filtered sections inside Section Modal
  const filteredSections = useMemo(() => {
    if (!sectionSearchQuery.trim()) return sections;
    const q = sectionSearchQuery.toLowerCase().trim();
    return sections.filter(
      (sec) =>
        sec.name.toLowerCase().includes(q) ||
        (sec.description && sec.description.toLowerCase().includes(q))
    );
  }, [sections, sectionSearchQuery]);

  // Open Add Class
  const handleOpenAddClass = () => {
    setEditingClass(null);
    setClassFormData({
      name: '',
      code: '',
      displayOrder: classes.length > 0 ? Math.max(...classes.map((c) => c.displayOrder)) + 1 : 1,
      isActive: true,
    });
    setSectionTags([]);
    setNewSectionInput('');
    setSectionInputError(null);
    setClassModalError(null);
    setIsClassModalOpen(true);
  };

  // Open Edit Class
  const handleOpenEditClass = async (cls: ClassItem) => {
    setEditingClass(cls);
    setClassFormData({
      name: cls.name,
      code: cls.code || '',
      displayOrder: cls.displayOrder,
      isActive: cls.isActive,
    });
    setSectionTags([]);
    setNewSectionInput('');
    setSectionInputError(null);
    setClassModalError(null);
    setIsClassModalOpen(true);

    try {
      if (window.electronAPI?.sections) {
        const res = await window.electronAPI.sections.getByClassId(cls.id);
        if (res.success && res.sections) {
          setSectionTags(
            res.sections.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description || '',
              isActive: s.isActive,
              studentCount: s.studentCount ?? 0,
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch sections for edit class:', err);
    }
  };

  // Add a section tag (from input or preset)
  const handleAddSectionTag = (customName?: string) => {
    const raw = customName !== undefined ? customName : newSectionInput;
    const trimmed = raw.trim();
    setSectionInputError(null);

    if (!trimmed) {
      setSectionInputError('Please enter a section name.');
      return;
    }

    const lower = trimmed.toLowerCase();
    const isDuplicate = sectionTags.some((s) => s.name.toLowerCase() === lower);
    if (isDuplicate) {
      setSectionInputError(`Section "${trimmed}" is already added.`);
      return;
    }

    setSectionTags((prev) => [
      ...prev,
      {
        name: trimmed,
        description: '',
        isActive: true,
      },
    ]);

    if (customName === undefined) {
      setNewSectionInput('');
    }
  };

  // Remove a section tag
  const handleRemoveSectionTag = (indexToRemove: number) => {
    const target = sectionTags[indexToRemove];
    if (target && target.studentCount && target.studentCount > 0) {
      const confirmRemove = window.confirm(
        `Section "${target.name}" currently has ${target.studentCount} active student enrollment(s).\n\nRemoving it will safely deactivate the section upon saving, keeping all existing students and academic records safe.\n\nAre you sure you want to remove it?`
      );
      if (!confirmRemove) return;
    }

    setSectionTags((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setSectionInputError(null);
  };

  // Save Class (Create / Update)
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setClassModalError(null);
    const { name, code, displayOrder, isActive } = classFormData;

    if (!name.trim()) {
      setClassModalError('Class name is required (e.g. Class 1, Grade 9).');
      return;
    }

    setIsSubmittingClass(true);
    try {
      if (editingClass) {
        const res = await window.electronAPI?.classes.update({
          sessionToken,
          id: editingClass.id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          displayOrder: Number(displayOrder) || 0,
          isActive,
          sections: sectionTags,
        });

        if (res?.success) {
          setIsClassModalOpen(false);
          setSuccessMessage(`Class "${name.trim()}" updated successfully.`);
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setClassModalError(res?.error || 'Failed to update class.');
        }
      } else {
        const res = await window.electronAPI?.classes.create({
          sessionToken,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          displayOrder: Number(displayOrder) || 0,
          isActive,
          sections: sectionTags,
        });

        if (res?.success) {
          setIsClassModalOpen(false);
          const secNotice = sectionTags.length > 0 ? ` with ${sectionTags.length} section(s)` : '';
          setSuccessMessage(`Class "${name.trim()}" created successfully${secNotice}.`);
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setClassModalError(res?.error || 'Failed to create class.');
        }
      }
    } catch (err) {
      console.error(err);
      setClassModalError('An unexpected error occurred while saving class.');
    } finally {
      setIsSubmittingClass(false);
    }
  };

  // Prompt Toggle Status
  const handlePromptToggleClass = (cls: ClassItem) => {
    setStatusConfirm({
      isOpen: true,
      type: 'class',
      item: cls,
      targetStatus: !cls.isActive,
      isProcessing: false,
    });
  };

  const handlePromptToggleSection = (sec: SectionItem) => {
    setStatusConfirm({
      isOpen: true,
      type: 'section',
      item: sec,
      targetStatus: !sec.isActive,
      isProcessing: false,
    });
  };

  const handleCloseStatusConfirm = () => {
    setStatusConfirm({
      isOpen: false,
      type: 'class',
      item: null,
      targetStatus: false,
      isProcessing: false,
    });
  };

  // Execute Status Toggle
  const handleExecuteStatusToggle = async () => {
    if (!sessionToken || !statusConfirm.item) return;
    setStatusConfirm((prev) => ({ ...prev, isProcessing: true }));

    const { type, item, targetStatus } = statusConfirm;
    const actionLabel = targetStatus ? 'activated' : 'deactivated';

    try {
      if (type === 'class') {
        const res = await window.electronAPI?.classes.toggleStatus(
          sessionToken,
          item.id,
          targetStatus
        );
        if (res?.success) {
          setSuccessMessage(`Class "${item.name}" has been ${actionLabel}.`);
          handleCloseStatusConfirm();
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setErrorMessage(res?.error || `Failed to update class status.`);
          setStatusConfirm((prev) => ({ ...prev, isProcessing: false }));
          setTimeout(() => setErrorMessage(null), 4000);
        }
      } else {
        // Section toggle
        const res = await window.electronAPI?.sections.toggleStatus(
          sessionToken,
          item.id,
          targetStatus
        );
        if (res?.success) {
          setSuccessMessage(`Section "${item.name}" has been ${actionLabel}.`);
          handleCloseStatusConfirm();
          if (selectedClassForSections) {
            await fetchSections(selectedClassForSections.id);
          }
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setErrorMessage(res?.error || `Failed to update section status.`);
          setStatusConfirm((prev) => ({ ...prev, isProcessing: false }));
          setTimeout(() => setErrorMessage(null), 4000);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(`Failed to update status.`);
      setStatusConfirm((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // Manage Sections for a Class
  const handleOpenManageSections = (cls: ClassItem) => {
    setSelectedClassForSections(cls);
    setSectionSearchQuery('');
  };

  const handleOpenAddSection = () => {
    setEditingSection(null);
    setSectionFormData({
      name: '',
      description: '',
      isActive: true,
    });
    setSectionModalError(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (sec: SectionItem) => {
    setEditingSection(sec);
    setSectionFormData({
      name: sec.name,
      description: sec.description || '',
      isActive: sec.isActive,
    });
    setSectionModalError(null);
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !selectedClassForSections) return;

    setSectionModalError(null);
    const { name, description, isActive } = sectionFormData;

    if (!name.trim()) {
      setSectionModalError('Section name is required (e.g. A, B, Blue, Morning).');
      return;
    }

    setIsSubmittingSection(true);
    try {
      if (editingSection) {
        const res = await window.electronAPI?.sections.update({
          sessionToken,
          id: editingSection.id,
          name: name.trim(),
          description: description.trim(),
          isActive,
        });

        if (res?.success) {
          setIsSectionModalOpen(false);
          setSuccessMessage(`Section "${name.trim()}" updated successfully.`);
          await fetchSections(selectedClassForSections.id);
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setSectionModalError(res?.error || 'Failed to update section.');
        }
      } else {
        const res = await window.electronAPI?.sections.create({
          sessionToken,
          classId: selectedClassForSections.id,
          name: name.trim(),
          description: description.trim(),
          isActive,
        });

        if (res?.success) {
          setIsSectionModalOpen(false);
          setSuccessMessage(`Section "${name.trim()}" created successfully.`);
          await fetchSections(selectedClassForSections.id);
          await fetchClasses();
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setSectionModalError(res?.error || 'Failed to create section.');
        }
      }
    } catch (err) {
      console.error(err);
      setSectionModalError('An unexpected error occurred while saving section.');
    } finally {
      setIsSubmittingSection(false);
    }
  };

  return (
    <div className="classes-container">
      {/* ─── 1. Header Card ──────────────────────────────────────────────── */}
      <div className="classes-header-card">
        <div className="classes-header-left">
          <div className="classes-header-icon-box">
            <Layers size={22} />
          </div>
          <div className="classes-header-title-group">
            <h1 className="classes-header-title">Classes & Sections</h1>
            <p className="classes-header-subtitle">
              Configure institutional grade levels, classroom sections, display sort orders, and academic status.
            </p>
          </div>
        </div>

        <div className="classes-header-actions">
          <button type="button" className="classes-btn-add" onClick={handleOpenAddClass}>
            <Plus size={16} />
            <span>Add New Class</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Metric Summary Statistics ────────────────────────────────── */}
      <div className="classes-metrics-grid">
        <div className="classes-metric-card">
          <div className="classes-metric-icon blue">
            <Layers size={20} />
          </div>
          <div className="classes-metric-details">
            <span className="classes-metric-val">{metrics.totalClasses}</span>
            <span className="classes-metric-lbl">Total Classes</span>
          </div>
        </div>

        <div className="classes-metric-card">
          <div className="classes-metric-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="classes-metric-details">
            <span className="classes-metric-val">{metrics.activeClasses}</span>
            <span className="classes-metric-lbl">Active Classes</span>
          </div>
        </div>

        <div className="classes-metric-card">
          <div className="classes-metric-icon purple">
            <FolderTree size={20} />
          </div>
          <div className="classes-metric-details">
            <span className="classes-metric-val">{metrics.totalSections}</span>
            <span className="classes-metric-lbl">Total Sections</span>
          </div>
        </div>

        <div className="classes-metric-card">
          <div className="classes-metric-icon amber">
            <BookOpen size={20} />
          </div>
          <div className="classes-metric-details">
            <span className="classes-metric-val">{metrics.totalSubjects}</span>
            <span className="classes-metric-lbl">Subject Mappings</span>
          </div>
        </div>
      </div>

      {/* ─── 3. Toast / Feedback Alerts ──────────────────────────────────── */}
      {successMessage && (
        <div className="classes-alert success" role="alert">
          <div className="classes-alert-content">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="classes-alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="classes-alert error" role="alert">
          <div className="classes-alert-content">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="classes-alert-close"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── 4. Action Toolbar: Search & Filters ─────────────────────────── */}
      <div className="classes-toolbar-card">
        <div className="classes-toolbar-left">
          {/* Search Box */}
          <div className="classes-search-wrapper">
            <Search size={16} className="classes-search-icon" />
            <input
              type="text"
              className="classes-search-input"
              placeholder="Search classes by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="classes-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Segmented Filter */}
          <div className="classes-filter-group">
            <button
              type="button"
              className={`classes-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({metrics.totalClasses})
            </button>
            <button
              type="button"
              className={`classes-filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active ({metrics.activeClasses})
            </button>
            <button
              type="button"
              className={`classes-filter-pill ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive ({metrics.inactiveClasses})
            </button>
          </div>
        </div>

        <button type="button" className="classes-btn-add" onClick={handleOpenAddClass}>
          <Plus size={16} />
          <span>Add New Class</span>
        </button>
      </div>

      {/* ─── 5. Classes Data Table Card ──────────────────────────────────── */}
      <div className="classes-table-card">
        <div className="classes-table-header-bar">
          <div>
            Showing <span className="classes-table-count">{filteredClasses.length}</span> of{' '}
            <span className="classes-table-count">{classes.length}</span> grade level
            {classes.length === 1 ? '' : 's'}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </div>
          {statusFilter !== 'all' && (
            <span>
              Filtered by:{' '}
              <strong>{statusFilter === 'active' ? 'Active Only' : 'Inactive Only'}</strong>
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="classes-loading-state">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <span>Loading institutional grade levels...</span>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="classes-empty-state">
            <div className="classes-empty-icon">
              {searchQuery ? <Search size={26} /> : <GraduationCap size={26} />}
            </div>
            <h4 className="classes-empty-title">
              {searchQuery
                ? `No classes match "${searchQuery}"`
                : statusFilter !== 'all'
                ? `No ${statusFilter} classes found`
                : 'No classes configured yet'}
            </h4>
            <p className="classes-empty-desc">
              {searchQuery
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Get started by creating your school grade levels (e.g. Playgroup, Grade 1, Class 9, First Year).'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                className="classes-btn-cancel"
                onClick={() => setSearchQuery('')}
              >
                Clear Search Filter
              </button>
            ) : (
              <button type="button" className="classes-btn-add" onClick={handleOpenAddClass}>
                <Plus size={16} />
                <span>Add First Class</span>
              </button>
            )}
          </div>
        ) : (
          <div className="classes-table-wrap">
            <table className="classes-table">
              <thead>
                <tr>
                  <th style={{ width: '8%', textAlign: 'center' }}>Order</th>
                  <th style={{ width: '28%' }}>Class Name</th>
                  <th style={{ width: '14%' }}>Code</th>
                  <th style={{ width: '18%' }}>Sections</th>
                  <th style={{ width: '14%' }}>Assigned Subjects</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((cls) => (
                  <tr key={cls.id} className={!cls.isActive ? 'row-inactive' : ''}>
                    {/* Order */}
                    <td style={{ textAlign: 'center' }}>
                      <span className="classes-order-badge">#{cls.displayOrder}</span>
                    </td>

                    {/* Class Name */}
                    <td>
                      <div className="classes-item-cell">
                        <div className={`classes-avatar ${!cls.isActive ? 'inactive' : ''}`}>
                          <Layers size={18} />
                        </div>
                        <div className="classes-info-group">
                          <span className="classes-name-text">{cls.name}</span>
                          <span className="classes-meta-text">Grade / Standard</span>
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td>
                      {cls.code ? (
                        <span className="classes-code-badge">{cls.code}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Sections (Interactive Button) */}
                    <td>
                      <button
                        type="button"
                        className={`classes-sections-btn ${cls.sectionCount === 0 ? 'none' : ''}`}
                        onClick={() => handleOpenManageSections(cls)}
                        title={`Manage sections for ${cls.name}`}
                      >
                        <FolderTree size={14} />
                        <span>
                          {cls.sectionCount} {cls.sectionCount === 1 ? 'Section' : 'Sections'}
                        </span>
                        <ChevronRight size={13} style={{ opacity: 0.6 }} />
                      </button>
                    </td>

                    {/* Assigned Subjects */}
                    <td>
                      <span
                        className={`classes-subjects-pill ${
                          cls.subjectCount > 0 ? 'has-subjects' : ''
                        }`}
                      >
                        <BookOpen size={13} />
                        <span>
                          {cls.subjectCount} {cls.subjectCount === 1 ? 'Subject' : 'Subjects'}
                        </span>
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`classes-status-pill ${cls.isActive ? 'active' : 'inactive'}`}>
                        <span
                          className={`classes-status-dot ${
                            cls.isActive ? 'active' : 'inactive'
                          }`}
                        />
                        <span>{cls.isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="classes-actions-group">
                        <button
                          type="button"
                          className="classes-btn-action btn-edit"
                          onClick={() => handleOpenEditClass(cls)}
                          title="Edit Class Details"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className={`classes-btn-action ${
                            cls.isActive ? 'btn-deactivate' : 'btn-activate'
                          }`}
                          onClick={() => handlePromptToggleClass(cls)}
                          title={cls.isActive ? 'Deactivate Class' : 'Activate Class'}
                        >
                          {cls.isActive ? (
                            <>
                              <EyeOff size={13} />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <Eye size={13} />
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 6. Add / Edit Class Modal ───────────────────────────────────── */}
      {isClassModalOpen && (
        <div className="classes-modal-backdrop" onClick={() => setIsClassModalOpen(false)}>
          <div
            className="classes-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="classes-modal-header">
              <div className="classes-modal-title-group">
                <div className="classes-modal-icon-wrap">
                  {editingClass ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="classes-modal-title">
                    {editingClass ? 'Edit Class' : 'Create New Class'}
                  </h3>
                  <p className="classes-modal-subtitle">
                    {editingClass
                      ? 'Update grade level name, code, sequence order, or status'
                      : 'Define an institutional grade level or class group'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="classes-modal-close-btn"
                onClick={() => setIsClassModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveClass}>
              <div className="classes-modal-body">
                {classModalError && (
                  <div className="classes-alert error" role="alert">
                    <div className="classes-alert-content">
                      <AlertCircle size={16} />
                      <span>{classModalError}</span>
                    </div>
                  </div>
                )}

                <div className="classes-form-group">
                  <label className="classes-form-label" htmlFor="classNameInput">
                    Class Name <span className="classes-req">*</span>
                  </label>
                  <input
                    id="classNameInput"
                    type="text"
                    className="classes-form-input"
                    placeholder="e.g. Playgroup, Grade 1, Class 9, First Year (XI)"
                    value={classFormData.name}
                    onChange={(e) =>
                      setClassFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                    autoFocus
                  />
                  <span className="classes-form-hint">
                    Official grade level name shown on student profiles and report cards.
                  </span>
                </div>

                <div className="classes-form-grid-2">
                  <div className="classes-form-group">
                    <label className="classes-form-label" htmlFor="classCodeInput">
                      Class Code <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      id="classCodeInput"
                      type="text"
                      className="classes-form-input"
                      placeholder="e.g. G8, C-09, 11"
                      value={classFormData.code}
                      onChange={(e) =>
                        setClassFormData((p) => ({
                          ...p,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                    <span className="classes-form-hint">Short institutional code.</span>
                  </div>

                  <div className="classes-form-group">
                    <label className="classes-form-label" htmlFor="classOrderInput">
                      Display Sequence Order
                    </label>
                    <input
                      id="classOrderInput"
                      type="number"
                      min="1"
                      className="classes-form-input"
                      value={classFormData.displayOrder}
                      onChange={(e) =>
                        setClassFormData((p) => ({
                          ...p,
                          displayOrder: Number(e.target.value) || 1,
                        }))
                      }
                    />
                    <span className="classes-form-hint">Sorting order in menus and lists.</span>
                  </div>
                </div>

                {/* ─── Dedicated Sections Field in Class Form ─── */}
                <div className="classes-form-group classes-sections-form-group">
                  <div className="classes-sections-field-header">
                    <label className="classes-form-label" style={{ marginBottom: 0 }}>
                      Sections <span className="classes-optional-tag">(Optional)</span>
                    </label>
                    <span className="classes-section-count-indicator">
                      {sectionTags.length} {sectionTags.length === 1 ? 'section' : 'sections'}
                    </span>
                  </div>
                  <span className="classes-form-hint" style={{ marginTop: '2px', marginBottom: '8px', display: 'block' }}>
                    Add sections for this class (e.g. Section A, Section B, Section C). If this class has no sections, leave this empty.
                  </span>

                  {/* Quick Add Preset Buttons */}
                  <div className="classes-section-presets-bar">
                    <span className="classes-section-presets-label">Quick Add:</span>
                    <div className="classes-section-presets-list">
                      {DEFAULT_SECTION_PRESETS.map((preset) => {
                        const isAdded = sectionTags.some(
                          (s) => s.name.toLowerCase() === preset.toLowerCase()
                        );
                        return (
                          <button
                            key={preset}
                            type="button"
                            disabled={isAdded}
                            className={`classes-preset-btn ${isAdded ? 'added' : ''}`}
                            onClick={() => handleAddSectionTag(preset)}
                            title={isAdded ? `${preset} is already added` : `Add ${preset}`}
                          >
                            {isAdded ? `✓ ${preset}` : `+ ${preset}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section Input Bar */}
                  <div className="classes-section-input-bar">
                    <input
                      type="text"
                      className="classes-form-input classes-section-text-input"
                      placeholder="Type section name (e.g. Section A, Section B, Morning)..."
                      value={newSectionInput}
                      onChange={(e) => {
                        setNewSectionInput(e.target.value);
                        if (sectionInputError) setSectionInputError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddSectionTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="classes-btn-add-section-tag"
                      onClick={() => handleAddSectionTag()}
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Inline Section Error */}
                  {sectionInputError && (
                    <div className="classes-section-inline-error">
                      <AlertCircle size={13} />
                      <span>{sectionInputError}</span>
                    </div>
                  )}

                  {/* Section Badges / Chips List */}
                  <div className="classes-section-tags-container">
                    {sectionTags.length === 0 ? (
                      <div className="classes-section-empty-hint">
                        <GitBranch size={15} className="classes-section-empty-icon" />
                        <span>No sections added. (Optional — you can add or remove sections anytime)</span>
                      </div>
                    ) : (
                      sectionTags.map((sec, idx) => (
                        <div
                          key={sec.id ? `sec-${sec.id}` : `idx-${idx}-${sec.name}`}
                          className="classes-section-tag-badge"
                        >
                          <GitBranch size={13} className="classes-section-tag-icon" />
                          <span className="classes-section-tag-name">{sec.name}</span>
                          {sec.studentCount !== undefined && sec.studentCount > 0 && (
                            <span
                              className="classes-section-tag-student-count"
                              title={`${sec.studentCount} active students enrolled in this section`}
                            >
                              {sec.studentCount} {sec.studentCount === 1 ? 'student' : 'students'}
                            </span>
                          )}
                          <button
                            type="button"
                            className="classes-section-tag-remove-btn"
                            title={`Remove ${sec.name}`}
                            onClick={() => handleRemoveSectionTag(idx)}
                            aria-label={`Remove section ${sec.name}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Active in Curriculum Toggle Card */}
                <label className="classes-status-card">
                  <input
                    type="checkbox"
                    className="classes-status-checkbox"
                    checked={classFormData.isActive}
                    onChange={(e) =>
                      setClassFormData((p) => ({ ...p, isActive: e.target.checked }))
                    }
                  />
                  <div className="classes-status-card-text">
                    <span className="classes-status-card-title">Active Class Level</span>
                    <span className="classes-status-card-desc">
                      Available for new student admissions, promotions, and subject curriculum assignments.
                    </span>
                  </div>
                </label>
              </div>

              <div className="classes-modal-footer">
                <button
                  type="button"
                  className="classes-btn-cancel"
                  onClick={() => setIsClassModalOpen(false)}
                  disabled={isSubmittingClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="classes-btn-submit"
                  disabled={isSubmittingClass}
                >
                  {isSubmittingClass ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving Class...</span>
                    </>
                  ) : editingClass ? (
                    <span>Save Changes</span>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Class</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7. Manage Sections Sub-Modal ─────────────────────────────────── */}
      {selectedClassForSections && (
        <div
          className="classes-modal-backdrop"
          onClick={() => setSelectedClassForSections(null)}
        >
          <div
            className="classes-modal-card"
            style={{ maxWidth: '680px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="classes-modal-header">
              <div className="classes-modal-title-group">
                <div className="classes-modal-icon-wrap">
                  <FolderTree size={18} />
                </div>
                <div>
                  <h3 className="classes-modal-title">
                    Sections for {selectedClassForSections.name}
                  </h3>
                  <p className="classes-modal-subtitle">
                    Manage classroom sections, shifts, and rooms for this grade level
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="classes-modal-close-btn"
                onClick={() => setSelectedClassForSections(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="classes-modal-body">
              {/* Inner Toolbar */}
              <div className="sections-modal-toolbar">
                <div className="classes-search-wrapper" style={{ minWidth: '220px', maxWidth: '320px' }}>
                  <Search size={14} className="classes-search-icon" />
                  <input
                    type="text"
                    className="classes-search-input"
                    style={{ height: '34px', fontSize: '0.8rem' }}
                    placeholder="Search sections..."
                    value={sectionSearchQuery}
                    onChange={(e) => setSectionSearchQuery(e.target.value)}
                  />
                  {sectionSearchQuery && (
                    <button
                      type="button"
                      className="classes-search-clear"
                      onClick={() => setSectionSearchQuery('')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="classes-btn-add"
                  style={{ padding: '0.45rem 0.875rem', fontSize: '0.8rem' }}
                  onClick={handleOpenAddSection}
                >
                  <Plus size={14} />
                  <span>Add Section</span>
                </button>
              </div>

              {/* Sections Table or Empty State */}
              {isLoadingSections ? (
                <div className="classes-loading-state" style={{ padding: '2rem 1rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#2563eb' }} />
                  <span>Loading sections...</span>
                </div>
              ) : filteredSections.length === 0 ? (
                <div className="classes-empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="classes-empty-icon" style={{ width: '44px', height: '44px' }}>
                    <FolderTree size={22} />
                  </div>
                  <h4 className="classes-empty-title" style={{ fontSize: '0.95rem' }}>
                    {sectionSearchQuery
                      ? `No sections match "${sectionSearchQuery}"`
                      : 'No sections configured in this class'}
                  </h4>
                  <p className="classes-empty-desc" style={{ fontSize: '0.78rem' }}>
                    {sectionSearchQuery
                      ? 'Try clearing the search query to view all sections.'
                      : 'Add classroom sections such as Section A, Section B, Blue, or Morning Shift.'}
                  </p>
                  {!sectionSearchQuery && (
                    <button
                      type="button"
                      className="classes-btn-add"
                      style={{ padding: '0.45rem 0.875rem', fontSize: '0.8rem' }}
                      onClick={handleOpenAddSection}
                    >
                      <Plus size={14} />
                      <span>Add First Section</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="sections-modal-table-wrap">
                  <table className="sections-modal-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>Section Name</th>
                        <th style={{ width: '38%' }}>Description / Room</th>
                        <th style={{ width: '16%', textAlign: 'center' }}>Status</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSections.map((sec) => (
                        <tr key={sec.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {sec.name.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                Section {sec.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: sec.description ? '#475569' : '#94a3b8' }}>
                              {sec.description || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`classes-status-pill ${
                                sec.isActive ? 'active' : 'inactive'
                              }`}
                            >
                              <span
                                className={`classes-status-dot ${
                                  sec.isActive ? 'active' : 'inactive'
                                }`}
                              />
                              <span>{sec.isActive ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="classes-btn-action btn-edit"
                                onClick={() => handleOpenEditSection(sec)}
                                title="Edit Section"
                              >
                                <Edit2 size={12} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className={`classes-btn-action ${
                                  sec.isActive ? 'btn-deactivate' : 'btn-activate'
                                }`}
                                onClick={() => handlePromptToggleSection(sec)}
                                title={sec.isActive ? 'Deactivate Section' : 'Activate Section'}
                              >
                                {sec.isActive ? (
                                  <>
                                    <EyeOff size={12} />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye size={12} />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="classes-modal-footer">
              <button
                type="button"
                className="classes-btn-cancel"
                onClick={() => setSelectedClassForSections(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 8. Add / Edit Section Modal ──────────────────────────────────── */}
      {isSectionModalOpen && (
        <div
          className="classes-modal-backdrop"
          style={{ zIndex: 1100 }}
          onClick={() => setIsSectionModalOpen(false)}
        >
          <div
            className="classes-modal-card"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="classes-modal-header">
              <div className="classes-modal-title-group">
                <div className="classes-modal-icon-wrap">
                  <GitBranch size={18} />
                </div>
                <div>
                  <h3 className="classes-modal-title">
                    {editingSection
                      ? 'Edit Section'
                      : `Add Section to ${selectedClassForSections?.name}`}
                  </h3>
                  <p className="classes-modal-subtitle">
                    Configure classroom section group and room details
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="classes-modal-close-btn"
                onClick={() => setIsSectionModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveSection}>
              <div className="classes-modal-body">
                {sectionModalError && (
                  <div className="classes-alert error" role="alert">
                    <div className="classes-alert-content">
                      <AlertCircle size={16} />
                      <span>{sectionModalError}</span>
                    </div>
                  </div>
                )}

                <div className="classes-form-group">
                  <label className="classes-form-label" htmlFor="secNameInput">
                    Section Name <span className="classes-req">*</span>
                  </label>
                  <input
                    id="secNameInput"
                    type="text"
                    className="classes-form-input"
                    placeholder="e.g. A, B, Blue, Morning"
                    value={sectionFormData.name}
                    onChange={(e) =>
                      setSectionFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                    autoFocus
                  />
                  <span className="classes-form-hint">
                    Unique section identifier for this class level.
                  </span>
                </div>

                <div className="classes-form-group">
                  <label className="classes-form-label" htmlFor="secDescInput">
                    Description / Room Identifier <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    id="secDescInput"
                    type="text"
                    className="classes-form-input"
                    placeholder="e.g. Room 102 / Morning Shift"
                    value={sectionFormData.description}
                    onChange={(e) =>
                      setSectionFormData((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>

                <label className="classes-status-card">
                  <input
                    type="checkbox"
                    className="classes-status-checkbox"
                    checked={sectionFormData.isActive}
                    onChange={(e) =>
                      setSectionFormData((p) => ({ ...p, isActive: e.target.checked }))
                    }
                  />
                  <div className="classes-status-card-text">
                    <span className="classes-status-card-title">Active Section</span>
                    <span className="classes-status-card-desc">
                      Available for student enrollment and attendance recording.
                    </span>
                  </div>
                </label>
              </div>

              <div className="classes-modal-footer">
                <button
                  type="button"
                  className="classes-btn-cancel"
                  onClick={() => setIsSectionModalOpen(false)}
                  disabled={isSubmittingSection}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="classes-btn-submit"
                  disabled={isSubmittingSection}
                >
                  {isSubmittingSection ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving Section...</span>
                    </>
                  ) : editingSection ? (
                    <span>Save Changes</span>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Section</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 9. Status Confirmation Modal ─────────────────────────────────── */}
      {statusConfirm.isOpen && statusConfirm.item && (
        <div className="classes-modal-backdrop" onClick={handleCloseStatusConfirm} style={{ zIndex: 1200 }}>
          <div
            className="classes-modal-card"
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="classes-modal-header">
              <div className="classes-modal-title-group">
                <div className={`classes-modal-icon-wrap ${!statusConfirm.targetStatus ? 'danger' : ''}`}>
                  {statusConfirm.targetStatus ? <Eye size={18} /> : <ShieldAlert size={18} />}
                </div>
                <div>
                  <h3 className="classes-modal-title">
                    {statusConfirm.targetStatus
                      ? `Activate ${statusConfirm.type === 'class' ? 'Class' : 'Section'}?`
                      : `Deactivate ${statusConfirm.type === 'class' ? 'Class' : 'Section'}?`}
                  </h3>
                  <p className="classes-modal-subtitle">{statusConfirm.item.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="classes-modal-close-btn"
                onClick={handleCloseStatusConfirm}
                disabled={statusConfirm.isProcessing}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="classes-modal-body">
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                {statusConfirm.type === 'class' ? (
                  statusConfirm.targetStatus ? (
                    <>
                      Are you sure you want to activate class <strong>{statusConfirm.item.name}</strong>?
                      It will become available for new student enrollments, promotions, and curriculum assignments.
                    </>
                  ) : (
                    <>
                      Are you sure you want to deactivate class <strong>{statusConfirm.item.name}</strong>?
                      Deactivated classes cannot receive new student enrollments. All existing student records, examination marks, and section mappings remain completely safe and intact.
                    </>
                  )
                ) : (
                  statusConfirm.targetStatus ? (
                    <>
                      Are you sure you want to activate section <strong>{statusConfirm.item.name}</strong>?
                      It will become available for student enrollment.
                    </>
                  ) : (
                    <>
                      Are you sure you want to deactivate section <strong>{statusConfirm.item.name}</strong>?
                      It will be hidden from new student enrollments. Existing enrolled students remain completely safe.
                    </>
                  )
                )}
              </p>
            </div>

            <div className="classes-modal-footer">
              <button
                type="button"
                className="classes-btn-cancel"
                onClick={handleCloseStatusConfirm}
                disabled={statusConfirm.isProcessing}
              >
                Cancel
              </button>
              {statusConfirm.targetStatus ? (
                <button
                  type="button"
                  className="classes-btn-submit"
                  onClick={handleExecuteStatusToggle}
                  disabled={statusConfirm.isProcessing}
                >
                  {statusConfirm.isProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <span>Confirm & Activate</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="classes-btn-danger-confirm"
                  onClick={handleExecuteStatusToggle}
                  disabled={statusConfirm.isProcessing}
                >
                  {statusConfirm.isProcessing ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Deactivating...</span>
                    </>
                  ) : (
                    <span>Confirm & Deactivate</span>
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
