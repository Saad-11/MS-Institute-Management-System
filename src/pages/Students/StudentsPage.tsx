import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  RotateCcw,
  MoreVertical,
  FileText,
  X,
  Sparkles,
  UserCheck,
  UserX,
  GraduationCap,
  ArrowLeft,
  Printer,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import type {
  StudentItem,
  AcademicSession,
  ClassItem,
  SectionItem,
} from '../../types/electron';
import { StudentAdmissionWizard } from './StudentAdmissionWizard';
import { StudentProfileModal } from './StudentProfileModal';
import { StudentPromotionTab } from './StudentPromotionTab';
import '../../styles/students.css';

export const StudentsPage: React.FC = () => {
  const { sessionToken, schoolSettings } = useAuth();
  const { showSuccess, showError } = useToast();

  // Navigation tab: 'directory' | 'promotion'
  const [mainTab, setMainTab] = useState<'directory' | 'promotion'>('directory');

  // Students Table Data & Pagination
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Summary Metrics
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    inactive: number;
    newAdmissions: number;
  }>({
    total: 0,
    active: 0,
    inactive: 0,
    newAdmissions: 0,
  });

  // Filter Select Options
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Filter Values
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSectionId, setSelectedSectionId] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // 'all' | 'active' | 'inactive'
  const [isMetadataLoaded, setIsMetadataLoaded] = useState<boolean>(false);

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<StudentItem | null>(null);

  // Status toggle confirmation
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<StudentItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Safe Delete Student state
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<StudentItem | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);

  // Dropdown action row ID
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

  // Load Sessions and Classes in parallel
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          window.electronAPI?.sessions ? window.electronAPI.sessions.getAll() : Promise.resolve(null),
          window.electronAPI?.classes ? window.electronAPI.classes.getAll() : Promise.resolve(null),
        ]);

        if (sRes?.success && sRes.sessions) {
          setSessions(sRes.sessions);
          const activeSession = sRes.sessions.find((s) => s.isActive);
          if (activeSession) {
            setSelectedSessionId(activeSession.id);
          }
        }
        if (cRes?.success && cRes.classes) {
          setClasses(cRes.classes);
        }
      } catch (err) {
        console.error('Failed to load sessions/classes:', err);
      } finally {
        setIsMetadataLoaded(true);
      }
    };

    loadMetadata();
  }, []);

  // Load Sections when Class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }

    const loadSections = async () => {
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(selectedClassId));
          if (res.success) {
            setSections(res.sections);
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    };

    loadSections();
  }, [selectedClassId]);

  // Refresh summary statistics with fast single query
  const refreshStats = useCallback(async () => {
    try {
      if (window.electronAPI?.students) {
        if (typeof (window.electronAPI.students as any).getStats === 'function') {
          const res = await (window.electronAPI.students as any).getStats(
            selectedSessionId ? Number(selectedSessionId) : undefined
          );
          if (res.success && res.stats) {
            setStats({
              total: res.stats.total,
              active: res.stats.active,
              inactive: res.stats.inactive,
              newAdmissions: res.stats.sessionCount,
            });
            return;
          }
        }

        // Fallback for older interface
        const [allRes, activeRes, inactiveRes] = await Promise.all([
          window.electronAPI.students.getAll({ limit: 1 }),
          window.electronAPI.students.getAll({ isActive: true, limit: 1 }),
          window.electronAPI.students.getAll({ isActive: false, limit: 1 }),
        ]);

        const total = allRes.success ? allRes.totalCount : 0;
        const active = activeRes.success ? activeRes.totalCount : 0;
        const inactive = inactiveRes.success ? inactiveRes.totalCount : 0;

        setStats({
          total,
          active,
          inactive,
          newAdmissions: active,
        });
      }
    } catch (err) {
      console.error('Failed to fetch student statistics:', err);
    }
  }, [selectedSessionId]);

  // Fetch paginated student records
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.students) {
        const filters: Record<string, any> = {
          page,
          limit: 12,
        };

        if (searchQuery.trim()) {
          filters.searchQuery = searchQuery.trim();
        }
        if (selectedSessionId) {
          filters.academicSessionId = Number(selectedSessionId);
        }
        if (selectedClassId) {
          filters.classId = Number(selectedClassId);
        }
        if (selectedSectionId) {
          filters.sectionId = Number(selectedSectionId);
        }
        if (selectedStatus === 'active') {
          filters.isActive = true;
        } else if (selectedStatus === 'inactive') {
          filters.isActive = false;
        }

        const res = await window.electronAPI.students.getAll(filters);
        if (res.success) {
          setStudents(res.students);
          setTotalCount(res.totalCount);
          setTotalPages(res.totalPages || 1);
        } else {
          showError(res.error || 'Failed to fetch student records.');
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error loading students.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedSessionId, selectedClassId, selectedSectionId, selectedStatus, page, showError]);

  useEffect(() => {
    if (!isMetadataLoaded) return;
    fetchStudents();
    refreshStats();
  }, [isMetadataLoaded, fetchStudents, refreshStats]);

  // Action handlers
  const handleOpenNewAdmission = () => {
    setEditingStudent(null);
    setIsWizardOpen(true);
  };

  const handleOpenEdit = (student: StudentItem) => {
    setOpenActionMenuId(null);
    setEditingStudent(student);
    setIsWizardOpen(true);
  };

  const handleOpenProfile = (student: StudentItem) => {
    setOpenActionMenuId(null);
    setSelectedStudentForProfile(student);
    setIsProfileModalOpen(true);
  };

  const handleToggleStatusClick = (student: StudentItem) => {
    setOpenActionMenuId(null);
    setStatusConfirmTarget(student);
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusConfirmTarget || !sessionToken) return;

    setIsUpdatingStatus(true);
    const newStatus = !statusConfirmTarget.isActive;

    try {
      if (window.electronAPI?.students) {
        const res = await window.electronAPI.students.toggleStatus(
          sessionToken,
          statusConfirmTarget.id,
          newStatus
        );

        if (res.success) {
          showSuccess(
            `Student "${statusConfirmTarget.displayName}" marked as ${newStatus ? 'Active' : 'Inactive'}.`
          );
          fetchStudents();
          refreshStats();
        } else {
          showError(res.error || 'Failed to update student status.');
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error modifying student status.');
    } finally {
      setIsUpdatingStatus(false);
      setStatusConfirmTarget(null);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deleteConfirmTarget || !sessionToken) return;

    setIsDeletingStudent(true);
    try {
      if (window.electronAPI?.students?.delete) {
        const res = await window.electronAPI.students.delete(sessionToken, deleteConfirmTarget.id);
        if (res && res.success) {
          showSuccess(
            `Student "${deleteConfirmTarget.displayName}" (${deleteConfirmTarget.studentId}) deleted successfully.`
          );
          setDeleteConfirmTarget(null);
          fetchStudents();
          refreshStats();
        } else {
          showError(res?.error || 'Failed to delete student.');
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error deleting student.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedClassId('');
    setSelectedSectionId('');
    setSelectedStatus('all');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedClassId || selectedSectionId || selectedStatus !== 'all'
  );

  // Dedicated student directory print handler
  const [printDirectoryStudents, setPrintDirectoryStudents] = useState<StudentItem[]>([]);

  const handlePrintDirectory = async () => {
    let printableList = students;
    if (totalCount > students.length && window.electronAPI?.students) {
      try {
        const filters: Record<string, any> = {
          limit: 1000,
          page: 1,
        };
        if (searchQuery.trim()) filters.searchQuery = searchQuery.trim();
        if (selectedSessionId) filters.academicSessionId = Number(selectedSessionId);
        if (selectedClassId) filters.classId = Number(selectedClassId);
        if (selectedSectionId) filters.sectionId = Number(selectedSectionId);
        if (selectedStatus === 'active') filters.isActive = true;
        else if (selectedStatus === 'inactive') filters.isActive = false;

        const res = await window.electronAPI.students.getAll(filters);
        if (res.success && res.students?.length) {
          printableList = res.students;
        }
      } catch (e) {
        console.warn('Failed to load full student list for printing, using loaded page:', e);
      }
    }

    setPrintDirectoryStudents(printableList);
    document.body.classList.add('printing-students-directory');

    const cleanup = () => {
      document.body.classList.remove('printing-students-directory');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 2000);
      }, 100);
    });
  };

  // Keyboard shortcut Ctrl+P handling on Students Directory
  useEffect(() => {
    const handleBeforePrint = () => {
      if (
        !document.body.classList.contains('printing-receipt') &&
        !document.body.classList.contains('printing-student-profile') &&
        !isProfileModalOpen &&
        !isWizardOpen
      ) {
        document.body.classList.add('printing-students-directory');
        setPrintDirectoryStudents((prev) => (prev.length > 0 ? prev : students));
      }
    };

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-students-directory');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-students-directory');
    };
  }, [isProfileModalOpen, isWizardOpen, students]);

  return (
    <div className="students-page-container">
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <div className="students-header">
        <div className="students-header-left">
          <div className="students-header-icon">
            {mainTab === 'promotion' ? <GraduationCap size={22} /> : <Users size={22} />}
          </div>
          <div className="students-header-title">
            <h1>{mainTab === 'promotion' ? 'Promote Students' : 'Students'}</h1>
            <p>
              {mainTab === 'promotion'
                ? 'Move students to their next academic session and class.'
                : 'Manage student admissions, profiles, academic information and student records.'}
            </p>
          </div>
        </div>

        <div className="students-header-actions">
          {mainTab === 'directory' ? (
            <>
              <button
                type="button"
                onClick={handlePrintDirectory}
                className="btn-modal-secondary no-print"
                title="Print Student Directory (Ctrl+P)"
              >
                <Printer size={14} />
                <span>Print Directory</span>
              </button>
              <button
                type="button"
                onClick={() => setMainTab('promotion')}
                className="btn-modal-secondary"
                title="Student Promotion"
              >
                <ArrowUpRight size={14} />
                <span>Promote Students</span>
              </button>
              <button
                type="button"
                onClick={handleOpenNewAdmission}
                className="btn-modal-primary"
              >
                <Plus size={16} />
                <span>+ Add New Student</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMainTab('directory')}
              className="btn-modal-secondary"
            >
              <ArrowLeft size={14} />
              <span>Back to Students</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Content Views ───────────────────────────────────────── */}
      {mainTab === 'promotion' ? (
        <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <StudentPromotionTab
            sessionToken={sessionToken || ''}
            onBack={() => {
              setMainTab('directory');
              fetchStudents();
              refreshStats();
            }}
            onPromoted={(promotedSessionId, promotedClassId) => {
              setSelectedSessionId(promotedSessionId);
              if (promotedClassId) {
                setSelectedClassId(promotedClassId);
              } else {
                setSelectedClassId('');
              }
              setSelectedSectionId('');
              setSelectedStatus('active');
              showSuccess('Student promotion completed successfully! Displaying destination class roster.');
              setMainTab('directory');
              fetchStudents();
              refreshStats();
            }}
          />
        </div>
      ) : (
        <>
          {/* ─── 4 Summary Statistics Cards ─────────────────────────────── */}
          <div className="students-stats-grid">
            {/* Total Students */}
            <div className="students-stat-card">
              <div>
                <span className="stat-label">Total Students</span>
                <span className="stat-value">{stats.total.toLocaleString()}</span>
                <span className="stat-subtext">Registered across all sessions</span>
              </div>
              <div className="stat-icon-wrapper stat-icon-blue">
                <Users size={22} />
              </div>
            </div>

            {/* Active Students */}
            <div className="students-stat-card">
              <div>
                <span className="stat-label">Active Students</span>
                <span className="stat-value" style={{ color: 'var(--color-success-600)' }}>
                  {stats.active.toLocaleString()}
                </span>
                <span className="stat-subtext">Currently enrolled & attending</span>
              </div>
              <div className="stat-icon-wrapper stat-icon-green">
                <UserCheck size={22} />
              </div>
            </div>

            {/* New Admissions */}
            <div className="students-stat-card">
              <div>
                <span className="stat-label">New Admissions</span>
                <span className="stat-value" style={{ color: 'var(--color-primary-600)' }}>
                  {stats.newAdmissions.toLocaleString()}
                </span>
                <span className="stat-subtext">Current session admissions</span>
              </div>
              <div className="stat-icon-wrapper stat-icon-purple">
                <Sparkles size={22} />
              </div>
            </div>

            {/* Inactive Students */}
            <div className="students-stat-card">
              <div>
                <span className="stat-label">Inactive Students</span>
                <span className="stat-value" style={{ color: 'var(--color-neutral-600)' }}>
                  {stats.inactive.toLocaleString()}
                </span>
                <span className="stat-subtext">Alumni, transferred or left</span>
              </div>
              <div className="stat-icon-wrapper stat-icon-gray">
                <UserX size={22} />
              </div>
            </div>
          </div>

          {/* ─── Student Directory Card ─────────────────────────────────── */}
          <div className="students-directory-card">
            {/* Directory Toolbar */}
            <div className="directory-toolbar">
              <div className="directory-toolbar-top">
                <div className="directory-toolbar-title">
                  <h2>Student Directory</h2>
                  <p>Browse, filter, and manage individual student profiles.</p>
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
              <div className="directory-filters-row">
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
                    placeholder="Search by Student Name, Student ID or Father Name..."
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

                {/* Session Filter */}
                <div>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => {
                      setSelectedSessionId(e.target.value ? Number(e.target.value) : '');
                      setPage(1);
                    }}
                    className="filter-select"
                  >
                    <option value="">All Academic Sessions</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isActive ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Filter */}
                <div>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value ? Number(e.target.value) : '');
                      setSelectedSectionId('');
                      setPage(1);
                    }}
                    className="filter-select"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section Filter */}
                <div>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => {
                      setSelectedSectionId(e.target.value ? Number(e.target.value) : '');
                      setPage(1);
                    }}
                    disabled={!selectedClassId}
                    className="filter-select"
                  >
                    <option value="">All Sections</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
                  {selectedClassId && (
                    <span className="filter-chip">
                      <span>Class: {classes.find((c) => c.id === Number(selectedClassId))?.name}</span>
                      <button type="button" onClick={() => setSelectedClassId('')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {selectedSectionId && (
                    <span className="filter-chip">
                      <span>Section: {sections.find((s) => s.id === Number(selectedSectionId))?.name}</span>
                      <button type="button" onClick={() => setSelectedSectionId('')}>
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

            {/* ─── Student Table ────────────────────────────────────────── */}
            <div className="table-responsive">
              <table className="students-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px', textAlign: 'center' }}>Photo</th>
                    <th style={{ width: '130px' }}>Student ID</th>
                    <th>Student Name</th>
                    <th>Father Name</th>
                    <th style={{ width: '110px' }}>Class</th>
                    <th style={{ width: '90px' }}>Section</th>
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
                          Loading student records...
                        </div>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '56px 20px' }}>
                        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={28} />
                          </div>
                          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>
                            No Students Found
                          </h3>
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-500)', lineHeight: '1.4' }}>
                            {hasActiveFilters
                              ? 'No student records match your active search filters. Try clearing or relaxing filter criteria.'
                              : 'No students have been enrolled in the institution yet. Register your first student to get started.'}
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
                              onClick={handleOpenNewAdmission}
                              className="btn-modal-primary"
                              style={{ marginTop: '8px' }}
                            >
                              <Plus size={14} />
                              <span>Register First Student</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const isMenuOpen = openActionMenuId === student.id;

                      return (
                        <tr key={student.id}>
                          {/* Photo */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="student-avatar">
                              {student.photoDataUrl ? (
                                <img
                                  src={student.photoDataUrl}
                                  alt={student.displayName}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span>
                                  {student.firstName[0]}
                                  {student.lastName ? student.lastName[0] : ''}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Student ID */}
                          <td>
                            <span className="id-badge">{student.studentId}</span>
                            {student.admissionNumber && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                Adm: {student.admissionNumber}
                              </span>
                            )}
                          </td>

                          {/* Student Name */}
                          <td>
                            <button
                              type="button"
                              onClick={() => handleOpenProfile(student)}
                              className="student-name-link"
                            >
                              {student.displayName}
                            </button>
                            <span className="student-meta-sub">
                              {student.gender} • {student.city || 'Local'}
                            </span>
                          </td>

                          {/* Father Name */}
                          <td>
                            <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-neutral-800)' }}>
                              {student.fatherName || student.guardianName || '—'}
                            </span>
                            <span className="student-meta-sub">
                              {student.fatherName ? 'Father' : student.guardianRelationship || 'Guardian'}
                            </span>
                          </td>

                          {/* Class */}
                          <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                            {student.currentEnrollment?.className || '—'}
                          </td>

                          {/* Section */}
                          <td style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-neutral-600)' }}>
                            {student.currentEnrollment?.sectionName || '—'}
                          </td>

                          {/* Contact */}
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-neutral-700)' }}>
                            {student.phone || '—'}
                          </td>

                          {/* Status */}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-pill ${student.isActive ? 'status-pill-active' : 'status-pill-inactive'}`}>
                              <span className="status-pill-dot" />
                              {student.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <div className="actions-cell-group">
                              <button
                                type="button"
                                onClick={() => handleOpenProfile(student)}
                                className="btn-table-action btn-action-view"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(student)}
                                className="btn-table-action btn-action-edit"
                              >
                                Edit
                              </button>

                              <div style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={() => setOpenActionMenuId(isMenuOpen ? null : student.id)}
                                  className="btn-action-more"
                                  title="More actions"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {isMenuOpen && (
                                  <div ref={actionMenuRef} className="actions-dropdown-menu">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProfile(student)}
                                      className="dropdown-item"
                                    >
                                      <Eye size={13} />
                                      <span>Full Profile</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(student)}
                                      className="dropdown-item"
                                    >
                                      <Edit2 size={13} />
                                      <span>Edit Record</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setSelectedStudentForProfile(student);
                                        setIsProfileModalOpen(true);
                                      }}
                                      className="dropdown-item"
                                    >
                                      <FileText size={13} />
                                      <span>Official Documents</span>
                                    </button>
                                    <div style={{ height: '1px', background: 'var(--color-neutral-200)', margin: '4px 0' }} />
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatusClick(student)}
                                      className={`dropdown-item ${student.isActive ? 'dropdown-item-danger' : ''}`}
                                    >
                                      {student.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                                      <span>{student.isActive ? 'Mark Inactive' : 'Mark Active'}</span>
                                    </button>
                                    <div style={{ height: '1px', background: 'var(--color-neutral-200)', margin: '4px 0' }} />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteConfirmTarget(student);
                                      }}
                                      className="dropdown-item dropdown-item-danger"
                                    >
                                      <Trash2 size={13} color="var(--color-error-600, #dc2626)" />
                                      <span>Delete Student</span>
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
                  Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, totalCount)} of {totalCount} students
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
        </>
      )}

      {/* ─── Add / Edit Student Wizard Modal ──────────────────────────── */}
      {isWizardOpen && (
        <StudentAdmissionWizard
          isOpen={isWizardOpen}
          onClose={() => {
            setIsWizardOpen(false);
            setEditingStudent(null);
          }}
          onSaved={(savedStudent) => {
            setIsWizardOpen(false);
            setEditingStudent(null);
            if (savedStudent.currentEnrollment) {
              if (savedStudent.currentEnrollment.academicSessionId) {
                setSelectedSessionId(savedStudent.currentEnrollment.academicSessionId);
              }
              if (savedStudent.currentEnrollment.classId) {
                setSelectedClassId(savedStudent.currentEnrollment.classId);
              }
              if (savedStudent.currentEnrollment.sectionId) {
                setSelectedSectionId(savedStudent.currentEnrollment.sectionId);
              }
            }
            fetchStudents();
            refreshStats();
            if (selectedStudentForProfile && selectedStudentForProfile.id === savedStudent.id) {
              setSelectedStudentForProfile(savedStudent);
            }
          }}
          student={editingStudent}
          sessions={sessions}
          classes={classes}
          sessionToken={sessionToken || ''}
        />
      )}

      {/* ─── Student Profile Details Modal ────────────────────────────── */}
      {isProfileModalOpen && (
        <StudentProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedStudentForProfile(null);
          }}
          student={selectedStudentForProfile}
          sessions={sessions}
          classes={classes}
          sessionToken={sessionToken || ''}
          onEditStudent={(std) => {
            setIsProfileModalOpen(false);
            handleOpenEdit(std);
          }}
          onPromoteClick={() => {
            setIsProfileModalOpen(false);
            setMainTab('promotion');
          }}
          onEnrollmentAdded={() => {
            fetchStudents();
            refreshStats();
          }}
        />
      )}

      {/* ─── Status Change Confirmation Modal ─────────────────────────── */}
      {statusConfirmTarget && (
        <div className="modal-overlay">
          <div style={{ maxWidth: '440px', background: 'white', borderRadius: 'var(--radius-xl)', padding: '24px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)', marginBottom: '8px' }}>
              Confirm Status Update
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)', lineHeight: '1.5', marginBottom: '20px' }}>
              Are you sure you want to mark <strong>{statusConfirmTarget.displayName}</strong> ({statusConfirmTarget.studentId}) as{' '}
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

      {/* ─── Delete Student Confirmation Modal ─────────────────────────── */}
      {deleteConfirmTarget && (
        <div className="modal-overlay">
          <div style={{ maxWidth: '440px', background: 'white', borderRadius: 'var(--radius-xl)', padding: '24px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={18} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)', margin: 0 }}>
                Delete Student
              </h3>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)', lineHeight: '1.5', marginBottom: '14px' }}>
              Are you sure you want to delete student <strong>{deleteConfirmTarget.displayName}</strong> (Student ID: <strong>{deleteConfirmTarget.studentId}</strong>)?
            </p>
            <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', lineHeight: '1.4', marginBottom: '20px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              This action will remove the student from the student directory and operational rosters. Existing historical fee payments and examination records are safely preserved for institutional audit records.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeletingStudent}
                className="btn-modal-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={isDeletingStudent}
                className="btn-modal-primary"
                style={{
                  background: 'var(--color-error-600, #dc2626)',
                  borderColor: 'var(--color-error-600, #dc2626)',
                  color: '#ffffff',
                }}
              >
                {isDeletingStudent ? 'Deleting...' : 'Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dedicated Print Sheet for Student Directory / List ─── */}
      <div className="students-directory-print-sheet" aria-hidden="true">
        {/* 1. Official Header */}
        <div className="sprint-header">
          <div className="sprint-header-left">
            <InstitutionLogo
              size={64}
              src={
                schoolSettings?.logoDataUrl ||
                (typeof localStorage !== 'undefined'
                  ? localStorage.getItem('sms_school_logo_data_url')
                  : null)
              }
              schoolName={schoolSettings?.schoolName || 'MS Institute Management System'}
              framed
            />
          </div>
          <div className="sprint-header-center">
            <h1 className="sprint-school-name">
              {schoolSettings?.schoolName || 'MS Institute Management System'}
            </h1>
            <p className="sprint-school-address">
              {[schoolSettings?.address, schoolSettings?.city, schoolSettings?.province]
                .filter(Boolean)
                .join(', ')}
            </p>
            <div className="sprint-school-contacts">
              {schoolSettings?.phone && <span>Tel: {schoolSettings.phone}</span>}
              {schoolSettings?.phone && (schoolSettings?.email || schoolSettings?.schoolCode) && (
                <span>•</span>
              )}
              {schoolSettings?.email && <span>Email: {schoolSettings.email}</span>}
              {schoolSettings?.email && schoolSettings?.schoolCode && <span>•</span>}
              {schoolSettings?.schoolCode && <span>Code: {schoolSettings.schoolCode}</span>}
            </div>
            <div className="sprint-doc-badge">
              <span>Official Student Enrollment Directory</span>
            </div>
          </div>
          <div className="sprint-header-right" style={{ textAlign: 'right', fontSize: '9.5px' }}>
            <div><strong>Print Date:</strong> {new Date().toLocaleDateString('en-US')}</div>
            <div><strong>Total Enrolled:</strong> {(printDirectoryStudents.length > 0 ? printDirectoryStudents : students).length} Students</div>
          </div>
        </div>

        {/* 2. Active Parameters Strip */}
        <div className="sprint-dir-filter-strip">
          <span>
            <strong>Academic Session:</strong>{' '}
            {sessions.find((s) => s.id === Number(selectedSessionId))?.name || 'All Sessions'}
          </span>
          <span>
            <strong>Class:</strong>{' '}
            {classes.find((c) => c.id === Number(selectedClassId))?.name || 'All Classes'}
          </span>
          {selectedSectionId && (
            <span>
              <strong>Section:</strong>{' '}
              {sections.find((sec) => sec.id === Number(selectedSectionId))?.name || 'All'}
            </span>
          )}
          <span>
            <strong>Status:</strong>{' '}
            {selectedStatus === 'active' ? 'Active Only' : selectedStatus === 'inactive' ? 'Inactive Only' : 'All Students'}
          </span>
          {searchQuery.trim() && <span><strong>Search Query:</strong> "{searchQuery.trim()}"</span>}
        </div>

        {/* 3. High-Contrast Official Student List Table */}
        <table className="sprint-dir-table">
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center' }}>#</th>
              <th style={{ width: '90px' }}>Student ID</th>
              <th style={{ width: '85px' }}>Adm No</th>
              <th>Student Full Name</th>
              <th>Father / Guardian Name</th>
              <th style={{ width: '60px' }}>Gender</th>
              <th style={{ width: '105px' }}>Class & Section</th>
              <th style={{ width: '100px' }}>Contact</th>
              <th style={{ width: '65px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(printDirectoryStudents.length > 0 ? printDirectoryStudents : students).map((st, idx) => (
              <tr key={st.id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td className="sprint-mono" style={{ fontWeight: 700 }}>{st.studentId}</td>
                <td className="sprint-mono">{st.admissionNumber || '—'}</td>
                <td style={{ fontWeight: 700 }}>{st.displayName}</td>
                <td>{st.fatherName || st.guardianName || '—'}</td>
                <td>{st.gender}</td>
                <td>
                  {st.currentEnrollment?.className || '—'}
                  {st.currentEnrollment?.sectionName ? ` (${st.currentEnrollment.sectionName})` : ''}
                </td>
                <td className="sprint-mono">{st.phone || st.alternativePhone || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`sprint-status-tag ${st.isActive ? 'active' : 'inactive'}`}>
                    {st.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 4. Official Signatures */}
        <div className="sprint-dir-signatures">
          <div className="sprint-dir-sig-col">
            <div className="sprint-sig-line">Prepared By</div>
            <div className="sprint-sig-caption">Incharge / Data Entry</div>
          </div>
          <div className="sprint-seal-box">
            Official<br />Seal
          </div>
          <div className="sprint-dir-sig-col">
            <div className="sprint-sig-line">Principal / Headmaster</div>
            <div className="sprint-sig-caption">Authorized Signature</div>
          </div>
        </div>

        {/* 5. Footer */}
        <div className="sprint-footer-row">
          <span>This is an official computer-generated student directory from MS Institute Management System. Valid without manual signature unless required.</span>
          <span className="sprint-mono">Generated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
