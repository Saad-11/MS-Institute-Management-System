import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  XCircle,
  Award,
  Layers,
  Sparkles,
  RotateCcw,
  TrendingUp,
  X,
  Filter,
  Download,
  Calendar,
  BookOpen,
  User,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  ExaminationItem,
  StudentDMCData,
} from '../../types/electron';
import { DMCReportCard } from './DMCReportCard';
import { printDMC, exportDMCPDF } from '../../utils/printDMC';

export const DMCPage: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [examinations, setExaminations] = useState<ExaminationItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Selection filters
  const [selectedSessionId, setSelectedSessionId] = useState<number>(0);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(0);

  // Generated DMCs
  const [dmcList, setDmcList] = useState<StudentDMCData[]>([]);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Print & PDF Export management
  const [activePrintScope, setActivePrintScope] = useState<'current' | 'all' | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load initial filter datasets
  useEffect(() => {
    const fetchInit = async () => {
      try {
        if (window.electronAPI) {
          const [sessRes, classRes] = await Promise.all([
            window.electronAPI.sessions.getAll(),
            window.electronAPI.classes.getAll(),
          ]);

          if (sessRes.success && sessRes.sessions) {
            setSessions(sessRes.sessions);
            const active = sessRes.sessions.find((s) => s.isActive) || sessRes.sessions[0];
            if (active) setSelectedSessionId(active.id);
          }

          if (classRes.success && classRes.classes) {
            setClasses(classRes.classes);
            if (classRes.classes.length > 0) {
              setSelectedClassId(classRes.classes[0].id);
            }
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load DMC initial data:', err);
      }
    };
    fetchInit();
  }, []);

  // When session changes, fetch exams for that session
  useEffect(() => {
    const fetchExams = async () => {
      if (!selectedSessionId || !window.electronAPI) return;
      try {
        const res = await window.electronAPI.exams.getAll({ academicSessionId: selectedSessionId });
        if (res.success && res.examinations) {
          setExaminations(res.examinations);
          if (res.examinations.length > 0) {
            setSelectedExamId(res.examinations[0].id);
          } else {
            setSelectedExamId(0);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load examinations for DMC:', err);
      }
    };
    fetchExams();
  }, [selectedSessionId]);

  // When class changes, fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedClassId || !window.electronAPI) {
        setSections([]);
        return;
      }
      try {
        const res = await window.electronAPI.sections.getByClassId(selectedClassId);
        if (res.success && res.sections) {
          setSections(res.sections);
          setSelectedSectionId(0); // All sections
        }
      } catch (err: unknown) {
        console.error('Failed to load sections for DMC:', err);
      }
    };
    fetchSections();
  }, [selectedClassId]);

  // Clear stale DMCs when selection filters change to avoid showing or printing mismatched data
  useEffect(() => {
    setDmcList([]);
    setError(null);
    setStudentSearchQuery('');
    setSelectedStudentIndex(0);
  }, [selectedSessionId, selectedExamId, selectedClassId, selectedSectionId]);

  const handleGenerateDMC = async () => {
    if (!selectedExamId || !selectedClassId) {
      setError('Please select an Examination and a Class to generate DMC certificates.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDmcList([]);
    setStudentSearchQuery('');

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.exams.generateClassDMC({
          examinationId: selectedExamId,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
        });

        if (res.success && res.dmcs) {
          setDmcList(res.dmcs);
          setSelectedStudentIndex(0);
          if (res.dmcs.length === 0) {
            setError('No student examination records found for the selected criteria.');
          }
        } else {
          setError(res.error || 'Failed to compile Detailed Marks Certificates.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating Detailed Marks Certificates.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    if (sessions.length > 0) {
      const active = sessions.find((s) => s.isActive) || sessions[0];
      setSelectedSessionId(active.id);
    }
    if (classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
    setSelectedSectionId(0);
    setDmcList([]);
    setError(null);
    setStudentSearchQuery('');
    setSelectedStudentIndex(0);
  };

  // Auto-dismiss temporary feedback messages
  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => setFeedbackMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  const handlePrint = async (scope: 'current' | 'all') => {
    if (isActionPending || dmcList.length === 0) return;
    setIsActionPending(true);
    setFeedbackMessage(null);
    const previousViewMode = viewMode;

    try {
      setActivePrintScope(scope);
      // Allow React to commit the target certificate layout to DOM
      await new Promise((resolve) => setTimeout(resolve, 60));

      await printDMC({
        onAfterPrint: () => {
          setActivePrintScope(null);
          setViewMode(previousViewMode);
          setIsActionPending(false);
        },
      });
    } catch (err: unknown) {
      console.error('Print Error:', err);
      setActivePrintScope(null);
      setViewMode(previousViewMode);
      setIsActionPending(false);
    }
  };

  const handleExportPDF = async (scope: 'current' | 'all') => {
    if (isActionPending || dmcList.length === 0) return;
    setIsActionPending(true);
    setFeedbackMessage(null);
    const previousViewMode = viewMode;

    try {
      setActivePrintScope(scope);
      // Allow React to commit the target certificate layout to DOM
      await new Promise((resolve) => setTimeout(resolve, 60));

      let defaultFileName = 'Detailed_Marks_Certificate.pdf';
      if (scope === 'current') {
        const student = dmcList[selectedStudentIndex]?.student;
        const examName = dmcList[selectedStudentIndex]?.examination.name || 'Exam';
        const raw = `DMC_${student?.displayName || 'Student'}_${student?.systemStudentId || ''}_${examName}.pdf`;
        defaultFileName = raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      } else {
        const className = selectedClass?.name || 'Class';
        const examName = selectedExam?.name || 'Exam';
        const sessionName = selectedSession?.name || 'Session';
        const raw = `DMC_Batch_${className}_${examName}_${sessionName}.pdf`;
        defaultFileName = raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      }

      const res = await exportDMCPDF({
        defaultFileName,
        onAfterExport: () => {
          setActivePrintScope(null);
          setViewMode(previousViewMode);
          setIsActionPending(false);
        },
      });

      if (res.success && res.filePath) {
        setFeedbackMessage({
          type: 'success',
          text: `PDF exported successfully to: ${res.filePath}`,
        });
      } else if (!res.canceled && res.error) {
        setFeedbackMessage({
          type: 'error',
          text: res.error || 'Failed to export PDF.',
        });
      }
    } catch (err: unknown) {
      console.error('Export PDF Error:', err);
      setActivePrintScope(null);
      setViewMode(previousViewMode);
      setIsActionPending(false);
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error exporting PDF.',
      });
    }
  };

  // Filtered students for quick search in single mode
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return dmcList;
    const q = studentSearchQuery.toLowerCase();
    return dmcList.filter(
      (d) =>
        d.student.displayName.toLowerCase().includes(q) ||
        (d.student.rollNumber && d.student.rollNumber.toLowerCase().includes(q)) ||
        d.student.systemStudentId.toLowerCase().includes(q)
    );
  }, [dmcList, studentSearchQuery]);

  // Synchronize selected student index when search query changes so preview matches search
  useEffect(() => {
    if (!studentSearchQuery.trim() || filteredStudents.length === 0) return;
    const currentStudent = dmcList[selectedStudentIndex];
    const isCurrentInMatches = currentStudent && filteredStudents.some((d) => d.student.id === currentStudent.student.id);
    if (!isCurrentInMatches) {
      const matchIndex = dmcList.findIndex((d) => d.student.id === filteredStudents[0].student.id);
      if (matchIndex !== -1) {
        setSelectedStudentIndex(matchIndex);
      }
    }
  }, [studentSearchQuery, filteredStudents, dmcList, selectedStudentIndex]);

  // Summary statistics for the loaded batch
  const stats = useMemo(() => {
    if (dmcList.length === 0) return null;
    const total = dmcList.length;
    const passed = dmcList.filter((d) => d.summary.result === 'Pass').length;
    const pending = dmcList.filter((d) => d.summary.result === 'Pending').length;
    const failed = dmcList.filter((d) => d.summary.result === 'Fail').length;
    const evaluated = total - pending;
    const passRate = evaluated > 0 ? (passed / evaluated) * 100 : (total > 0 && pending === 0 ? 0 : 0);
    const avgPercentage =
      total > 0
        ? dmcList.reduce((acc, curr) => acc + (curr.summary.percentage || 0), 0) / total
        : 0;

    return { total, passed, pending, failed, passRate, avgPercentage };
  }, [dmcList]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const selectedExam = examinations.find((e) => e.id === selectedExamId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  const activeStudent = dmcList[selectedStudentIndex];

  return (
    <div className="dmc-workspace">
      {/* ─── 1. Page Header (no-print) ─────────────────────────────────── */}
      <div className="no-print dmc-page-header">
        <div className="dmc-page-header-left">
          <div className="dmc-page-header-icon">
            <FileText size={22} />
          </div>
          <div className="dmc-page-header-title">
            <h1>Detailed Marks Certificate (DMC)</h1>
            <p>Generate, preview, and print official student result certificates.</p>
          </div>
        </div>

        <div className="dmc-page-header-actions">
          {dmcList.length > 0 ? (
            <>
              {/* View Mode Toggle */}
              <div className="dmc-view-toggle">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`dmc-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Single Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`dmc-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Certificates</span>
                  <span className="dmc-toggle-badge">{dmcList.length}</span>
                </button>
              </div>

              {/* Print & PDF Action Buttons */}
              {viewMode === 'single' ? (
                <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handlePrint('current')}
                    disabled={isActionPending}
                    className="dmc-btn dmc-btn-primary"
                    title="Print the certificate currently in preview"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Current DMC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPDF('current')}
                    disabled={isActionPending}
                    className="dmc-btn dmc-btn-dark"
                    title="Save current certificate as an offline PDF document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handlePrint('all')}
                    disabled={isActionPending}
                    className="dmc-btn dmc-btn-primary"
                    title="Print all certificates in the class with one certificate per A4 page"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print All DMCs ({dmcList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPDF('all')}
                    disabled={isActionPending}
                    className="dmc-btn dmc-btn-emerald"
                    title="Export all certificates in the class into a single A4 PDF document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export All PDF ({dmcList.length})</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="dmc-page-header-status-badge">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Official Academic Transcripts</span>
            </div>
          )}
        </div>
      </div>

      {/* Toast Feedback Notification (no-print) */}
      {feedbackMessage && (
        <div
          className={`no-print dmc-toast ${
            feedbackMessage.type === 'success' ? 'dmc-toast-success' : 'dmc-toast-error'
          }`}
        >
          <div className="dmc-toast-content">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="dmc-toast-close"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── 2. Examination Selection Card (no-print) ──────────────────── */}
      <div className="no-print dmc-filter-card">
        <div className="dmc-filter-header">
          <div className="dmc-filter-title">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Examination &amp; Class Selection</span>
          </div>
          {selectedExam && selectedClass && (
            <span className="dmc-filter-tag">
              {selectedExam.name} • {selectedClass.name} {selectedSection ? `(${selectedSection.name})` : '(All Sections)'}
            </span>
          )}
        </div>

        <div className="dmc-filter-grid">
          <div className="dmc-field-group">
            <label className="dmc-field-label">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Academic Session
            </label>
            <div className="dmc-select-wrapper">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="dmc-select"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '★ Active' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="dmc-select-icon" />
            </div>
          </div>

          <div className="dmc-field-group">
            <label className="dmc-field-label">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              Examination
            </label>
            <div className="dmc-select-wrapper">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(Number(e.target.value))}
                disabled={examinations.length === 0}
                className="dmc-select"
              >
                {examinations.length === 0 ? (
                  <option value={0}>No exams found in this session</option>
                ) : (
                  examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.status})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="dmc-select-icon" />
            </div>
          </div>

          <div className="dmc-field-group">
            <label className="dmc-field-label">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Class
            </label>
            <div className="dmc-select-wrapper">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
                className="dmc-select"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="dmc-select-icon" />
            </div>
          </div>

          <div className="dmc-field-group">
            <label className="dmc-field-label">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Section
            </label>
            <div className="dmc-select-wrapper">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                className="dmc-select"
              >
                <option value={0}>All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="dmc-select-icon" />
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="dmc-filter-footer">
          <div className="dmc-filter-summary">
            {selectedExam ? (
              <span>
                Ready to generate certificates for <strong>{selectedExam.name}</strong> •{' '}
                <strong>{selectedClass?.name || 'Class'}</strong>{' '}
                {selectedSection ? `(${selectedSection.name})` : '(All Sections)'}
              </span>
            ) : (
              <span>Please configure or select an active examination.</span>
            )}
          </div>

          <div className="dmc-filter-btns">
            <button
              type="button"
              onClick={handleResetFilters}
              className="dmc-btn dmc-btn-secondary"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Filters</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateDMC}
              disabled={isLoading || !selectedExamId || !selectedClassId}
              className="dmc-btn dmc-btn-primary"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate DMC Preview</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="dmc-toast dmc-toast-error">
            <div className="dmc-toast-content">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="dmc-toast-close"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ─── 3. Performance Overview (Summary KPI Cards, no-print) ─────── */}
      {stats && (
        <div className="no-print dmc-kpi-section">
          <div className="dmc-kpi-header">
            <div className="dmc-kpi-title">
              <Award className="w-4 h-4 text-blue-600" />
              <span>
                Performance Overview • {selectedExam?.name} ({selectedClass?.name}{' '}
                {selectedSection ? selectedSection.name : 'All Sections'})
              </span>
            </div>
            <div className="dmc-kpi-session-tag">
              Session: {selectedSession?.name}
            </div>
          </div>

          <div className={`dmc-kpi-grid ${stats.pending > 0 ? 'has-pending' : ''}`}>
            {/* Total Students */}
            <div className="dmc-kpi-card kpi-blue">
              <div className="dmc-kpi-icon">
                <Users className="w-5 h-5" />
              </div>
              <div className="dmc-kpi-info">
                <div className="dmc-kpi-label">Total Students</div>
                <div className="dmc-kpi-val">{stats.total}</div>
              </div>
            </div>

            {/* Passed */}
            <div className="dmc-kpi-card kpi-emerald">
              <div className="dmc-kpi-icon">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="dmc-kpi-info">
                <div className="dmc-kpi-label">Passed</div>
                <div className="dmc-kpi-val">{stats.passed}</div>
              </div>
            </div>

            {/* Failed */}
            <div className="dmc-kpi-card kpi-rose">
              <div className="dmc-kpi-icon">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="dmc-kpi-info">
                <div className="dmc-kpi-label">Failed</div>
                <div className="dmc-kpi-val">{stats.failed}</div>
              </div>
            </div>

            {/* Pending Marks (if any) */}
            {stats.pending > 0 && (
              <div className="dmc-kpi-card kpi-amber">
                <div className="dmc-kpi-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="dmc-kpi-info">
                  <div className="dmc-kpi-label">Pending Marks</div>
                  <div className="dmc-kpi-val">{stats.pending}</div>
                </div>
              </div>
            )}

            {/* Pass Rate */}
            <div className="dmc-kpi-card kpi-indigo">
              <div className="dmc-kpi-icon">
                <Award className="w-5 h-5" />
              </div>
              <div className="dmc-kpi-info">
                <div className="dmc-kpi-label">Pass Rate</div>
                <div className="dmc-kpi-val">{stats.passRate.toFixed(1)}%</div>
              </div>
            </div>

            {/* Class Average */}
            <div className="dmc-kpi-card kpi-violet">
              <div className="dmc-kpi-icon">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="dmc-kpi-info">
                <div className="dmc-kpi-label">Class Average</div>
                <div className="dmc-kpi-val">{stats.avgPercentage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. Student Navigation & Search Bar (Single Mode, no-print) ─── */}
      {dmcList.length > 0 && viewMode === 'single' && (() => {
        const currentFilteredPos = filteredStudents.findIndex(
          (d) => d.student.id === dmcList[selectedStudentIndex]?.student.id
        );
        const hasSearch = Boolean(studentSearchQuery.trim());
        const canGoPrev = hasSearch ? currentFilteredPos > 0 : selectedStudentIndex > 0;
        const canGoNext = hasSearch
          ? currentFilteredPos !== -1 && currentFilteredPos < filteredStudents.length - 1
          : selectedStudentIndex < dmcList.length - 1;

        const handlePrev = () => {
          if (hasSearch) {
            if (currentFilteredPos > 0) {
              const target = filteredStudents[currentFilteredPos - 1];
              const idx = dmcList.findIndex((d) => d.student.id === target.student.id);
              if (idx !== -1) setSelectedStudentIndex(idx);
            }
          } else {
            setSelectedStudentIndex((prev) => Math.max(0, prev - 1));
          }
        };

        const handleNext = () => {
          if (hasSearch) {
            if (currentFilteredPos !== -1 && currentFilteredPos < filteredStudents.length - 1) {
              const target = filteredStudents[currentFilteredPos + 1];
              const idx = dmcList.findIndex((d) => d.student.id === target.student.id);
              if (idx !== -1) setSelectedStudentIndex(idx);
            }
          } else {
            setSelectedStudentIndex((prev) => Math.min(dmcList.length - 1, prev + 1));
          }
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="no-print dmc-nav-bar">
              {/* Left: Previous / Next & Student Dropdown */}
              <div className="dmc-nav-left">
                <div className="dmc-stepper">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    className="dmc-stepper-btn"
                    title="Previous Student"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="dmc-stepper-label">
                    {hasSearch
                      ? currentFilteredPos !== -1
                        ? `Student ${currentFilteredPos + 1} of ${filteredStudents.length} (Filtered)`
                        : `${filteredStudents.length} matches`
                      : `Student ${selectedStudentIndex + 1} of ${dmcList.length}`}
                  </span>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canGoNext}
                    className="dmc-stepper-btn"
                    title="Next Student"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Jump-to-Student Dropdown */}
                <div className="dmc-select-wrapper" style={{ width: 'auto' }}>
                  <select
                    value={selectedStudentIndex}
                    onChange={(e) => setSelectedStudentIndex(Number(e.target.value))}
                    className="dmc-student-dropdown"
                  >
                    {filteredStudents.map((d) => {
                      const actualIndex = dmcList.findIndex((item) => item.student.id === d.student.id);
                      return (
                        <option key={d.student.id} value={actualIndex}>
                          #{actualIndex + 1}: {d.student.displayName}{' '}
                          {d.student.rollNumber ? `(Roll: ${d.student.rollNumber})` : ''} —{' '}
                          {d.summary.result === 'Pending'
                            ? 'Pending (Incomplete Marks)'
                            : `${d.summary.result} (${d.summary.percentage.toFixed(1)}%)`}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="dmc-select-icon" />
                </div>
              </div>

              {/* Right: Quick Search Input with Clear Button */}
              <div className="dmc-search-wrap">
                <Search className="dmc-search-icon" />
                <input
                  type="text"
                  placeholder="Search student, roll number, or ID..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="dmc-search-input"
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchQuery('')}
                    className="dmc-search-clear"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Student Quick Ribbon */}
            {activeStudent && (
              <div className="no-print dmc-student-ribbon">
                <div className="dmc-ribbon-left">
                  <div className="dmc-ribbon-item">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <strong>{activeStudent.student.displayName}</strong>
                  </div>
                  {activeStudent.student.fatherName && (
                    <>
                      <span className="dmc-ribbon-dot">•</span>
                      <div className="dmc-ribbon-item">
                        <span>S/D of:</span>
                        <strong>{activeStudent.student.fatherName}</strong>
                      </div>
                    </>
                  )}
                  {activeStudent.student.rollNumber && (
                    <>
                      <span className="dmc-ribbon-dot">•</span>
                      <div className="dmc-ribbon-item">
                        <span>Roll:</span>
                        <strong>{activeStudent.student.rollNumber}</strong>
                      </div>
                    </>
                  )}
                  <span className="dmc-ribbon-dot">•</span>
                  <div className="dmc-ribbon-item">
                    <span>Class:</span>
                    <strong>{activeStudent.student.className} {activeStudent.student.sectionName ? `(${activeStudent.student.sectionName})` : ''}</strong>
                  </div>
                </div>

                <div className="dmc-ribbon-right">
                  <span
                    className={`dmc-ribbon-pill ${
                      activeStudent.summary.result === 'Pending'
                        ? 'pill-pending'
                        : activeStudent.summary.result === 'Pass'
                        ? 'pill-pass'
                        : 'pill-fail'
                    }`}
                  >
                    {activeStudent.summary.result === 'Pending'
                      ? 'Marks Pending'
                      : `${activeStudent.summary.result} • ${activeStudent.summary.percentage.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            )}

            {hasSearch && filteredStudents.length === 0 && (
              <div className="no-print dmc-search-empty-box">
                <div className="dmc-search-empty-text">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No students found matching "{studentSearchQuery}".</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentSearchQuery('')}
                  className="dmc-search-empty-btn"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── 5. Batch Print Mode Banner (All Mode, no-print) ───────────── */}
      {dmcList.length > 0 && viewMode === 'all' && (
        <div className="no-print dmc-batch-banner">
          <div className="dmc-batch-left">
            <div className="dmc-batch-icon-box">
              <Layers className="w-5 h-5" />
            </div>
            <div className="dmc-batch-text">
              <strong>Class Batch Preview:</strong> Displaying all {dmcList.length} Detailed Marks Certificates. When printing or exporting to PDF, each student's certificate is formatted onto an individual A4 portrait page.
            </div>
          </div>
          <div className="dmc-batch-actions">
            <button
              type="button"
              onClick={() => handlePrint('all')}
              disabled={isActionPending}
              className="dmc-btn dmc-btn-primary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All ({dmcList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF('all')}
              disabled={isActionPending}
              className="dmc-btn dmc-btn-emerald"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 6. DMC Certificate Preview & Print Canvas ─────────────────── */}
      {dmcList.length > 0 ? (
        <div className="dmc-stage-card">
          <div className="dmc-stage-toolbar no-print">
            <div className="dmc-stage-badge">
              <span className="dot" />
              <span>Official Document Preview • A4 Portrait</span>
            </div>
            <div className="dmc-stage-meta" style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
              {viewMode === 'single' ? (
                <span>
                  Viewing {selectedStudentIndex + 1} of {dmcList.length} • {dmcList[selectedStudentIndex]?.student.displayName}
                </span>
              ) : (
                <span>Class Batch • {dmcList.length} Certificates</span>
              )}
            </div>
          </div>

          <div className="dmc-preview-container">
            {(activePrintScope === 'current' || (!activePrintScope && viewMode === 'single')) ? (
              dmcList[selectedStudentIndex] ? (
                <DMCReportCard key={dmcList[selectedStudentIndex].student.id} dmc={dmcList[selectedStudentIndex]} />
              ) : null
            ) : (
              dmcList.map((dmc, index) => (
                <div key={dmc.student.id || index} className="dmc-page-break">
                  <DMCReportCard key={dmc.student.id || index} dmc={dmc} />
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="no-print dmc-empty-card">
            <div className="dmc-empty-icon-wrap">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="dmc-empty-heading">
              Select Examination and Class
            </h3>
            <p className="dmc-empty-paragraph">
              Choose the Academic Session, Examination, and Class above, then click <strong>Generate DMC Preview</strong> to compile verified certificates with automated positions and institutional grading.
            </p>
            <div className="dmc-empty-steps-grid">
              <div className="dmc-step-box">
                <span className="dmc-step-num">Step 1</span>
                <span className="dmc-step-text">Select Academic Session &amp; Exam</span>
              </div>
              <div className="dmc-step-box">
                <span className="dmc-step-num">Step 2</span>
                <span className="dmc-step-text">Choose Target Class &amp; Section</span>
              </div>
              <div className="dmc-step-box">
                <span className="dmc-step-num">Step 3</span>
                <span className="dmc-step-text">Preview, Print or Export PDF</span>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
