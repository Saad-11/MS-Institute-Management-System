import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GraduationCap,
  Search,
  Plus,
  Eye,
  Edit2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MoreVertical,
  X,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { TeacherItem } from '../../types/electron';
import { TeacherAdmissionWizard } from './TeacherAdmissionWizard';
import { TeacherProfileModal } from './TeacherProfileModal';
import '../../styles/teachers.css';

export const TeachersPage: React.FC = () => {
  const { sessionToken } = useAuth();
  const { showSuccess, showError } = useToast();

  // Faculty Table Data & Pagination
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Summary Metrics
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    newTeachers: number;
    inactive: number;
  }>({
    total: 0,
    active: 0,
    newTeachers: 0,
    inactive: 0,
  });

  // Filter Values
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState<string>('');
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // 'all', 'active', 'inactive'

  // Modal dialogs
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [selectedTeacherForProfile, setSelectedTeacherForProfile] = useState<TeacherItem | null>(null);

  // Status toggle confirmation
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<TeacherItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Active Dropdown Action Row ID
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  // Close actions menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refresh summary statistics
  const refreshStats = useCallback(async () => {
    try {
      if (window.electronAPI?.teachers) {
        const allRes = await window.electronAPI.teachers.getAll({ limit: 1 });
        const total = allRes.success ? allRes.totalCount : 0;

        const activeRes = await window.electronAPI.teachers.getAll({ isActive: true, limit: 1 });
        const active = activeRes.success ? activeRes.totalCount : 0;

        const inactiveRes = await window.electronAPI.teachers.getAll({ isActive: false, limit: 1 });
        const inactive = inactiveRes.success ? inactiveRes.totalCount : 0;

        const currentYear = new Date().getFullYear().toString();
        const newRes = await window.electronAPI.teachers.getAll({ searchQuery: currentYear, limit: 1 });
        const newCount = newRes.success ? newRes.totalCount : 0;

        setStats({
          total,
          active,
          newTeachers: newCount,
          inactive,
        });
      }
    } catch (err) {
      console.error('Failed to fetch faculty stats:', err);
    }
  }, []);

  // Fetch paginated faculty records
  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.teachers) {
        const filters: Record<string, any> = {
          page,
          limit: 12,
        };

        if (searchQuery.trim()) {
          filters.searchQuery = searchQuery.trim();
        }
        if (selectedEmploymentStatus) {
          filters.employmentStatus = selectedEmploymentStatus;
        }
        if (selectedDesignation) {
          filters.designation = selectedDesignation;
        }
        if (selectedSubject) {
          filters.searchQuery = selectedSubject;
        }
        if (selectedStatus === 'active') {
          filters.isActive = true;
        } else if (selectedStatus === 'inactive') {
          filters.isActive = false;
        }

        const res = await window.electronAPI.teachers.getAll(filters);
        if (res.success) {
          setTeachers(res.teachers);
          setTotalCount(res.totalCount);
          setTotalPages(res.totalPages || 1);
        } else {
          showError(res.error || 'Failed to fetch faculty records.');
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error loading faculty records.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedEmploymentStatus, selectedDesignation, selectedSubject, selectedStatus, page, showError]);

  useEffect(() => {
    fetchTeachers();
    refreshStats();
  }, [fetchTeachers, refreshStats]);

  // Action handlers
  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setIsWizardOpen(true);
  };

  const handleOpenEdit = (t: TeacherItem) => {
    setOpenActionMenuId(null);
    setEditingTeacher(t);
    setIsWizardOpen(true);
  };

  const handleOpenProfile = (t: TeacherItem) => {
    setOpenActionMenuId(null);
    setSelectedTeacherForProfile(t);
    setIsProfileModalOpen(true);
  };

  const handleToggleStatusClick = (t: TeacherItem) => {
    setOpenActionMenuId(null);
    setStatusConfirmTarget(t);
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusConfirmTarget || !sessionToken) return;

    setIsUpdatingStatus(true);
    const newStatus = !statusConfirmTarget.isActive;

    try {
      if (window.electronAPI?.teachers) {
        const res = await window.electronAPI.teachers.toggleStatus(
          sessionToken,
          statusConfirmTarget.id,
          newStatus
        );

        if (res.success) {
          showSuccess(
            `Teacher "${statusConfirmTarget.displayName}" marked as ${newStatus ? 'Active' : 'Inactive'}.`
          );
          fetchTeachers();
          refreshStats();
        } else {
          showError(res.error || 'Failed to update teacher status.');
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error updating status.');
    } finally {
      setIsUpdatingStatus(false);
      setStatusConfirmTarget(null);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedEmploymentStatus('');
    setSelectedDesignation('');
    setSelectedSubject('');
    setSelectedStatus('all');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedEmploymentStatus || selectedDesignation || selectedSubject || selectedStatus !== 'all'
  );

  return (
    <div className="teachers-page-container">
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <div className="teachers-header">
        <div className="teachers-header-left">
          <div className="teachers-header-icon">
            <GraduationCap size={22} />
          </div>
          <div className="teachers-header-title">
            <h1>Teachers</h1>
            <p>
              Manage teaching staff, profiles, qualifications and employment information.
            </p>
          </div>
        </div>

        <div className="teachers-header-actions">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn-modal-primary"
          >
            <Plus size={16} />
            <span>+ Add Teacher</span>
          </button>
        </div>
      </div>

      {/* ─── 4 Summary Statistics Cards ─────────────────────────────── */}
      <div className="teachers-stats-grid">
        {/* Total Teachers */}
        <div className="teachers-stat-card">
          <div>
            <span className="stat-label">Total Teachers</span>
            <span className="stat-value">{stats.total.toLocaleString()}</span>
            <span className="stat-subtext">All faculty on institutional record</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-blue">
            <GraduationCap size={22} />
          </div>
        </div>

        {/* Active Teachers */}
        <div className="teachers-stat-card">
          <div>
            <span className="stat-label">Active Teachers</span>
            <span className="stat-value" style={{ color: 'var(--color-success-600)' }}>
              {stats.active.toLocaleString()}
            </span>
            <span className="stat-subtext">Currently teaching & on duty</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-green">
            <UserCheck size={22} />
          </div>
        </div>

        {/* New Teachers */}
        <div className="teachers-stat-card">
          <div>
            <span className="stat-label">New Teachers</span>
            <span className="stat-value" style={{ color: 'var(--color-primary-600)' }}>
              {stats.newTeachers.toLocaleString()}
            </span>
            <span className="stat-subtext">Recent faculty appointments</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-purple">
            <Sparkles size={22} />
          </div>
        </div>

        {/* Inactive Teachers */}
        <div className="teachers-stat-card">
          <div>
            <span className="stat-label">Inactive Teachers</span>
            <span className="stat-value" style={{ color: 'var(--color-neutral-600)' }}>
              {stats.inactive.toLocaleString()}
            </span>
            <span className="stat-subtext">On leave, resigned or retired</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-gray">
            <UserX size={22} />
          </div>
        </div>
      </div>

      {/* ─── Teacher Directory Card ─────────────────────────────────── */}
      <div className="teachers-directory-card">
        {/* Directory Toolbar */}
        <div className="directory-toolbar">
          <div className="directory-toolbar-top">
            <div className="directory-toolbar-title">
              <h2>Faculty Directory</h2>
              <p>Search, filter, and inspect faculty members and teaching staff.</p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="clear-all-filters-btn"
              >
                <RotateCcw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Reset All Filters
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="teachers-toolbar-row">
            {/* Search Bar */}
            <div className="search-field-container">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by teacher name, Teacher ID or Employee ID..."
                className="search-field-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Employment Status Filter */}
            <div>
              <select
                value={selectedEmploymentStatus}
                onChange={(e) => {
                  setSelectedEmploymentStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="">All Employment Statuses</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
                <option value="Resigned">Resigned</option>
              </select>
            </div>

            {/* Designation Filter */}
            <div>
              <select
                value={selectedDesignation}
                onChange={(e) => {
                  setSelectedDesignation(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="">All Designations</option>
                <option value="Senior Teacher">Senior Teacher</option>
                <option value="Junior Teacher">Junior Teacher</option>
                <option value="Head of Department">Head of Department</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Teacher">Teacher</option>
              </select>
            </div>

            {/* System Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Accounts</option>
                <option value="inactive">Inactive Accounts</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="filter-chips-bar">
              <span className="filter-chips-label">Active Filters:</span>
              {searchQuery && (
                <span className="filter-chip">
                  <span>Search: "{searchQuery}"</span>
                  <button type="button" onClick={() => setSearchQuery('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedEmploymentStatus && (
                <span className="filter-chip">
                  <span>Employment: {selectedEmploymentStatus}</span>
                  <button type="button" onClick={() => setSelectedEmploymentStatus('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedDesignation && (
                <span className="filter-chip">
                  <span>Designation: {selectedDesignation}</span>
                  <button type="button" onClick={() => setSelectedDesignation('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="filter-chip">
                  <span style={{ textTransform: 'capitalize' }}>Status: {selectedStatus}</span>
                  <button type="button" onClick={() => setSelectedStatus('all')}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Teacher Table ────────────────────────────────────────── */}
        <div className="table-responsive">
          <table className="teachers-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>Photo</th>
                <th style={{ width: '130px' }}>Teacher ID</th>
                <th>Teacher Name</th>
                <th>Designation</th>
                <th>Subject / Specialization</th>
                <th>Qualification</th>
                <th style={{ width: '130px' }}>Contact</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{ color: 'var(--color-neutral-400)', fontSize: 'var(--font-size-xs)' }}>
                      Loading faculty records...
                    </div>
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '56px 20px' }}>
                    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={28} />
                      </div>
                      <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>
                        No Teachers Found
                      </h3>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-500)', lineHeight: '1.4' }}>
                        {hasActiveFilters
                          ? 'No faculty members match your active filters. Try resetting search parameters.'
                          : 'Teachers registered in the system will appear here. Add your first faculty member to begin.'}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="btn-modal-secondary"
                          style={{ marginTop: '8px' }}
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="btn-modal-primary"
                          style={{ marginTop: '8px' }}
                        >
                          <Plus size={14} />
                          <span>+ Add Teacher</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => {
                  const isMenuOpen = openActionMenuId === teacher.id;

                  return (
                    <tr key={teacher.id}>
                      {/* Photo */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="teacher-avatar">
                          {teacher.photoDataUrl ? (
                            <img src={teacher.photoDataUrl} alt={teacher.displayName} />
                          ) : (
                            <span>
                              {teacher.firstName[0]}
                              {teacher.lastName ? teacher.lastName[0] : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Teacher ID */}
                      <td>
                        <span className="id-badge">{teacher.teacherId}</span>
                        {teacher.employeeId && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            EMP: {teacher.employeeId}
                          </span>
                        )}
                      </td>

                      {/* Teacher Name */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(teacher)}
                          className="student-name-link"
                        >
                          {teacher.displayName}
                        </button>
                        <span className="student-meta-sub">
                          {teacher.gender} • Joined {teacher.joiningDate}
                        </span>
                      </td>

                      {/* Designation */}
                      <td>
                        <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-neutral-800)' }}>
                          {teacher.designation}
                        </span>
                      </td>

                      {/* Subject / Specialization */}
                      <td>
                        <span style={{ color: 'var(--color-neutral-700)' }}>
                          {teacher.specialization ? teacher.specialization : 'General Curriculum'}
                        </span>
                      </td>

                      {/* Qualification */}
                      <td>
                        <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-neutral-700)' }}>
                          {teacher.qualification}
                        </span>
                      </td>

                      {/* Contact */}
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-neutral-700)' }}>
                        {teacher.phone || '—'}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`status-pill ${
                            teacher.employmentStatus === 'Active'
                              ? 'status-pill-active'
                              : 'status-pill-inactive'
                          }`}
                        >
                          <span className="status-pill-dot" />
                          {teacher.employmentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell-group">
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(teacher)}
                            className="btn-table-action btn-action-view"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(teacher)}
                            className="btn-table-action btn-action-edit"
                          >
                            Edit
                          </button>

                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setOpenActionMenuId(isMenuOpen ? null : teacher.id)}
                              className="btn-action-more"
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {isMenuOpen && (
                              <div ref={actionMenuRef} className="actions-dropdown-menu">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProfile(teacher)}
                                  className="dropdown-item"
                                >
                                  <Eye size={13} />
                                  <span>Full Profile</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(teacher)}
                                  className="dropdown-item"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit Information</span>
                                </button>
                                <div style={{ height: '1px', background: 'var(--color-neutral-200)', margin: '4px 0' }} />
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatusClick(teacher)}
                                  className={`dropdown-item ${teacher.isActive ? 'dropdown-item-danger' : ''}`}
                                >
                                  {teacher.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                                  <span>{teacher.isActive ? 'Deactivate Staff' : 'Activate Staff'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="table-pagination-footer">
            <span className="pagination-text">
              Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, totalCount)} of {totalCount} teachers
            </span>

            <div className="pagination-controls">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`pagination-btn ${page === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add / Edit Teacher Wizard Modal ──────────────────────────── */}
      {isWizardOpen && (
        <TeacherAdmissionWizard
          isOpen={isWizardOpen}
          onClose={() => {
            setIsWizardOpen(false);
            setEditingTeacher(null);
          }}
          onSaved={() => {
            setIsWizardOpen(false);
            setEditingTeacher(null);
            fetchTeachers();
            refreshStats();
          }}
          teacher={editingTeacher}
          sessionToken={sessionToken || ''}
        />
      )}

      {/* ─── Teacher Profile Details Modal ────────────────────────────── */}
      {isProfileModalOpen && (
        <TeacherProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedTeacherForProfile(null);
          }}
          teacher={selectedTeacherForProfile}
          onEditTeacher={(t) => {
            setIsProfileModalOpen(false);
            handleOpenEdit(t);
          }}
        />
      )}

      {/* ─── Status Toggle Confirmation Modal ─────────────────────────── */}
      {statusConfirmTarget && (
        <div className="modal-overlay">
          <div style={{ maxWidth: '440px', background: 'white', borderRadius: 'var(--radius-xl)', padding: '24px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)', marginBottom: '8px' }}>
              Confirm Staff Status Update
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)', lineHeight: '1.5', marginBottom: '20px' }}>
              Are you sure you want to mark <strong>{statusConfirmTarget.displayName}</strong> ({statusConfirmTarget.teacherId}) as{' '}
              <strong>{statusConfirmTarget.isActive ? 'Inactive' : 'Active'}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStatusConfirmTarget(null)}
                disabled={isUpdatingStatus}
                className="btn-modal-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={isUpdatingStatus}
                className="btn-modal-primary"
                style={{
                  background: statusConfirmTarget.isActive ? 'var(--color-error-600)' : 'var(--color-success-600)',
                  borderColor: statusConfirmTarget.isActive ? 'var(--color-error-600)' : 'var(--color-success-600)',
                }}
              >
                {isUpdatingStatus ? 'Updating...' : `Confirm & Mark ${statusConfirmTarget.isActive ? 'Inactive' : 'Active'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
