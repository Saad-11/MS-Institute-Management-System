import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  FileText,
  Search,
  Eye,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  X,
  Filter,
  GraduationCap,
  Layers,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  Download,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  ExaminationItem,
  ClassExamResults,
  StudentExamResult,
  StudentDMCData,
  SchoolSettings,
} from '../../types/electron';
import { DMCReportCard } from '../DMC/DMCReportCard';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import { printDMC, exportDMCPDF } from '../../utils/printDMC';

interface ViewResultsTabProps {
  sessions: AcademicSession[];
  examinations: ExaminationItem[];
  classes: ClassItem[];
  initialExamId?: number;
  initialClassId?: number;
  initialSectionId?: number;
  onNavigateToEnterMarks?: (examId: number, classId: number, sectionId?: number) => void;
}

export const ViewResultsTab: React.FC<ViewResultsTabProps> = ({
  sessions,
  examinations,
  classes,
  initialExamId,
  initialClassId,
  initialSectionId,
  onNavigateToEnterMarks,
}) => {
  // Determine initial selected session based on initialExam or default active session
  const defaultSessionId = useMemo(() => {
    if (initialExamId) {
      const match = examinations.find((e) => e.id === initialExamId);
      if (match) return match.academicSessionId;
    }
    const active = sessions.find((s) => s.isActive);
    if (active) return active.id;
    return sessions[0]?.id || 0;
  }, [sessions, examinations, initialExamId]);

  const [selectedSessionId, setSelectedSessionId] = useState<number>(defaultSessionId);

  // Available examinations for the currently selected session
  const availableExaminations = useMemo(() => {
    if (!selectedSessionId) return examinations;
    return examinations.filter((e) => e.academicSessionId === selectedSessionId);
  }, [examinations, selectedSessionId]);

  const [selectedExamId, setSelectedExamId] = useState<number>(() => {
    if (initialExamId && examinations.some((e) => e.id === initialExamId)) {
      return initialExamId;
    }
    const inSession = examinations.filter((e) => e.academicSessionId === defaultSessionId);
    return inSession[0]?.id || examinations[0]?.id || 0;
  });

  const [selectedClassId, setSelectedClassId] = useState<number>(
    initialClassId || classes[0]?.id || 0
  );
  const [selectedSectionId, setSelectedSectionId] = useState<number>(
    initialSectionId || 0
  );

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classResults, setClassResults] = useState<ClassExamResults | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  // School settings & logo for print layout
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  // Modals state
  const [selectedStudentResult, setSelectedStudentResult] = useState<StudentExamResult | null>(null);
  const [dmcList, setDmcList] = useState<StudentDMCData[]>([]);
  const [activeDmcIndex, setActiveDmcIndex] = useState<number>(0);
  const [showDmcModal, setShowDmcModal] = useState<boolean>(false);
  const [isGeneratingDMC, setIsGeneratingDMC] = useState<boolean>(false);
  const [dmcModalViewMode, setDmcModalViewMode] = useState<'single' | 'all'>('single');

  // Fetch school settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!window.electronAPI) return;
      try {
        const res = await window.electronAPI.school.getSettings();
        if (res.success && res.settings) {
          setSchoolSettings(res.settings);
        }
        const logoRes = await window.electronAPI.school.getLogoDataUrl();
        if (logoRes.success && logoRes.dataUrl) {
          setSchoolLogo(logoRes.dataUrl);
        }
      } catch (err) {
        console.warn('Failed to load school settings for results view:', err);
      }
    };
    fetchSettings();
  }, []);

  // When selectedSessionId changes, verify selectedExamId belongs to this session
  useEffect(() => {
    if (!selectedSessionId) return;
    const examsInSession = examinations.filter((e) => e.academicSessionId === selectedSessionId);
    if (examsInSession.length > 0 && !examsInSession.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(examsInSession[0].id);
    } else if (examsInSession.length === 0) {
      setSelectedExamId(0);
    }
  }, [selectedSessionId, examinations]);

  // When selectedExamId changes, auto-align session if mismatched
  const handleSelectExam = (examId: number) => {
    setSelectedExamId(examId);
    const exam = examinations.find((e) => e.id === examId);
    if (exam && exam.academicSessionId !== selectedSessionId) {
      setSelectedSessionId(exam.academicSessionId);
    }
  };

  // When selectedClassId changes, fetch sections and reset selectedSectionId if invalid
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedClassId || !window.electronAPI) {
        setSections([]);
        setSelectedSectionId(0);
        return;
      }
      try {
        const res = await window.electronAPI.sections.getByClassId(selectedClassId);
        if (res.success && res.sections) {
          setSections(res.sections);
          // If selectedSectionId doesn't belong to new sections, reset to 0
          if (selectedSectionId && !res.sections.some((s) => s.id === selectedSectionId)) {
            setSelectedSectionId(0);
          }
        } else {
          setSections([]);
          setSelectedSectionId(0);
        }
      } catch (err: unknown) {
        console.error('Failed to load sections:', err);
        setSections([]);
        setSelectedSectionId(0);
      }
    };
    fetchSections();
  }, [selectedClassId]);

  // Fetch Class Examination Results
  const loadClassResults = async () => {
    if (!selectedExamId || !selectedClassId || !window.electronAPI) {
      setClassResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await window.electronAPI.exams.getClassResults({
        examinationId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });

      if (res.success && res.results) {
        setClassResults(res.results);
      } else {
        setClassResults(null);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch class results:', err);
      setClassResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClassResults();
  }, [selectedExamId, selectedClassId, selectedSectionId]);

  // Generate single student DMC
  const handleGenerateStudentDMC = async (studentId: number) => {
    if (!selectedExamId || !window.electronAPI) return;
    setIsGeneratingDMC(true);
    try {
      const res = await window.electronAPI.exams.generateStudentDMC(
        selectedExamId,
        studentId,
        selectedClassId || undefined
      );
      if (res.success && res.dmc) {
        setDmcList([res.dmc]);
        setActiveDmcIndex(0);
        setDmcModalViewMode('single');
        setShowDmcModal(true);
      } else {
        alert(res.error || 'Failed to generate student DMC.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error generating student DMC.');
    } finally {
      setIsGeneratingDMC(false);
    }
  };

  // Generate bulk Class DMCs
  const handleGenerateClassDMC = async () => {
    if (!selectedExamId || !selectedClassId || !window.electronAPI) return;
    setIsGeneratingDMC(true);
    try {
      const res = await window.electronAPI.exams.generateClassDMC({
        examinationId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });

      if (res.success && res.dmcs && res.dmcs.length > 0) {
        setDmcList(res.dmcs);
        setActiveDmcIndex(0);
        setDmcModalViewMode('single');
        setShowDmcModal(true);
      } else {
        alert(res.error || 'No student DMCs could be generated for this class.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error generating class DMCs.');
    } finally {
      setIsGeneratingDMC(false);
    }
  };

  // Dedicated Print Result Sheet handler with body state isolation
  const handlePrintResultSheet = () => {
    document.body.classList.add('printing-result-sheet');
    const cleanup = () => {
      document.body.classList.remove('printing-result-sheet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2500);
    }, 120);
  };

  const handlePrintDMC = async (scope: 'current' | 'all') => {
    const previousMode = dmcModalViewMode;
    try {
      if (scope === 'all') {
        setDmcModalViewMode('all');
      } else {
        setDmcModalViewMode('single');
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
      await printDMC({
        onAfterPrint: () => {
          setDmcModalViewMode(previousMode);
        },
      });
    } catch (err) {
      console.error('Print DMC Error:', err);
      setDmcModalViewMode(previousMode);
    }
  };

  const handleExportDMCPDF = async (scope: 'current' | 'all') => {
    const previousMode = dmcModalViewMode;
    try {
      if (scope === 'all') {
        setDmcModalViewMode('all');
      } else {
        setDmcModalViewMode('single');
      }
      await new Promise((resolve) => setTimeout(resolve, 60));

      let defaultFileName = 'Detailed_Marks_Certificate.pdf';
      if (scope === 'current') {
        const student = dmcList[activeDmcIndex]?.student;
        const examName = dmcList[activeDmcIndex]?.examination.name || 'Exam';
        const raw = `DMC_${student?.displayName || 'Student'}_${student?.systemStudentId || ''}_${examName}.pdf`;
        defaultFileName = raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      } else {
        const raw = `DMC_Batch_${classResults?.className || 'Class'}_${classResults?.examinationName || 'Exam'}.pdf`;
        defaultFileName = raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      }

      await exportDMCPDF({
        defaultFileName,
        onAfterExport: () => {
          setDmcModalViewMode(previousMode);
        },
      });
    } catch (err) {
      console.error('Export DMC PDF Error:', err);
      setDmcModalViewMode(previousMode);
    }
  };

  // Filter students by name, ID, admission number, or father's name
  const filteredStudentResults = useMemo(() => {
    if (!classResults || !classResults.studentResults) return [];
    if (!searchQuery.trim()) return classResults.studentResults;
    const q = searchQuery.toLowerCase().trim();
    return classResults.studentResults.filter((s) => {
      const nameMatch = s.displayName?.toLowerCase().includes(q);
      const idMatch = s.systemStudentId?.toLowerCase().includes(q);
      const admMatch = s.admissionNumber?.toLowerCase().includes(q);
      const fatherMatch = s.fatherName?.toLowerCase().includes(q);
      return nameMatch || idMatch || admMatch || fatherMatch;
    });
  }, [classResults, searchQuery]);

  // Derived metrics for the 8 Summary Cards
  const stats = useMemo(() => {
    if (!classResults || classResults.totalStudents === 0) {
      return null;
    }

    const { totalStudents, studentResults, passedStudents, failedStudents, passPercentage, highestPercentage, averagePercentage } = classResults;

    // Check if any marks have been entered for this examination
    const hasAnyMarks = studentResults.some((sr) =>
      sr.subjects.some((sub) => sub.obtainedMarks !== null || sub.status === 'Absent')
    );

    // Count appeared students (who have at least one subject with recorded marks or marked absent)
    const appearedCount = studentResults.filter((sr) =>
      sr.subjects.some((sub) => sub.obtainedMarks !== null || sub.status === 'Absent')
    ).length;

    const topStudent = hasAnyMarks && studentResults.length > 0 ? studentResults[0] : null;

    // Overall class performance evaluation
    let performanceRating = '—';
    let performanceColorClass = 'card-theme-slate';
    if (hasAnyMarks) {
      if (averagePercentage >= 80) {
        performanceRating = 'A+ Outstanding';
        performanceColorClass = 'card-theme-emerald';
      } else if (averagePercentage >= 70) {
        performanceRating = 'A Excellent';
        performanceColorClass = 'card-theme-teal';
      } else if (averagePercentage >= 60) {
        performanceRating = 'B Good';
        performanceColorClass = 'card-theme-blue';
      } else if (averagePercentage >= 50) {
        performanceRating = 'C Satisfactory';
        performanceColorClass = 'card-theme-amber';
      } else if (averagePercentage >= 40) {
        performanceRating = 'D Marginal';
        performanceColorClass = 'card-theme-amber';
      } else {
        performanceRating = 'F Needs Attention';
        performanceColorClass = 'card-theme-rose';
      }
    }

    return {
      hasAnyMarks,
      totalStudents,
      appearedCount,
      passedStudents: hasAnyMarks ? passedStudents : 0,
      failedStudents: hasAnyMarks ? failedStudents : 0,
      passPercentage: hasAnyMarks ? `${passPercentage.toFixed(1)}%` : '—',
      highestPercentage: hasAnyMarks ? `${highestPercentage.toFixed(1)}%` : '—',
      topStudentName: topStudent ? topStudent.displayName : '—',
      averagePercentage: hasAnyMarks ? `${averagePercentage.toFixed(1)}%` : '—',
      performanceRating,
      performanceColorClass,
    };
  }, [classResults]);

  const selectedExam = examinations.find((e) => e.id === selectedExamId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="view-results-workspace">
      {/* ─── 1. Page Header ─── */}
      <div className="view-results-header">
        <div className="view-results-header-info">
          <div className="view-results-header-icon">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="view-results-header-text">
            <h2>View Examination Results</h2>
            <p>
              Review automated positions, overall grades, class merit list, and generate official DMCs.
            </p>
          </div>
        </div>

        <div className="view-results-header-actions">
          <button
            onClick={handleGenerateClassDMC}
            disabled={!classResults || classResults.totalStudents === 0 || isGeneratingDMC}
            className="btn-generate-dmc"
            title="Generate detailed marks certificates for all students in this class"
          >
            <FileText className="w-4 h-4" />
            {isGeneratingDMC
              ? 'Generating...'
              : `Generate Class DMCs ${classResults && classResults.totalStudents > 0 ? `(${classResults.totalStudents})` : ''}`}
          </button>

          <button
            onClick={handlePrintResultSheet}
            disabled={!classResults || classResults.studentResults.length === 0}
            className="btn-print-sheet"
            title="Print or export official class examination result sheet"
          >
            <Printer className="w-4 h-4" />
            Print Result Sheet
          </button>
        </div>
      </div>

      {/* ─── 2. Result Filter Panel ─── */}
      <div className="view-results-filter-card">
        <div className="view-results-filter-title">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Result Filters</span>
        </div>

        <div className="view-results-filter-grid">
          {/* Dropdown 1: Academic Session */}
          <div className="view-filter-group">
            <label htmlFor="filter-session">Academic Session</label>
            <select
              id="filter-session"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
              className="view-filter-select"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 2: Examination */}
          <div className="view-filter-group">
            <label htmlFor="filter-examination">Examination</label>
            <select
              id="filter-examination"
              value={selectedExamId}
              onChange={(e) => handleSelectExam(Number(e.target.value))}
              className="view-filter-select"
              disabled={availableExaminations.length === 0}
            >
              {availableExaminations.length === 0 ? (
                <option value={0}>No exams in this session</option>
              ) : (
                availableExaminations.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.status})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Dropdown 3: Class */}
          <div className="view-filter-group">
            <label htmlFor="filter-class">Class</label>
            <select
              id="filter-class"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="view-filter-select"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 4: Section */}
          <div className="view-filter-group">
            <label htmlFor="filter-section">Section</label>
            <select
              id="filter-section"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(Number(e.target.value))}
              className="view-filter-select"
            >
              <option value={0}>All Sections</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 3. Result Summary Cards (8 Statistics) ─── */}
      {stats && (
        <div className="view-results-stats-grid">
          {/* Card 1: Total Students */}
          <div className="summary-stat-card card-theme-blue">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Total Students</span>
              <div className="summary-stat-card-icon">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">{stats.totalStudents}</div>
            <div className="summary-stat-card-subtitle">Enrolled in scope</div>
          </div>

          {/* Card 2: Students Appeared */}
          <div className="summary-stat-card card-theme-indigo">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Students Appeared</span>
              <div className="summary-stat-card-icon">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">
              {stats.hasAnyMarks ? stats.appearedCount : '—'}
            </div>
            <div className="summary-stat-card-subtitle">
              {stats.hasAnyMarks
                ? `${Math.round((stats.appearedCount / stats.totalStudents) * 100)}% attendance rate`
                : 'No marks entered yet'}
            </div>
          </div>

          {/* Card 3: Passed */}
          <div className="summary-stat-card card-theme-emerald">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Passed</span>
              <div className="summary-stat-card-icon">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">
              {stats.hasAnyMarks ? stats.passedStudents : '—'}
            </div>
            <div className="summary-stat-card-subtitle">
              {stats.hasAnyMarks
                ? `Cleared all subjects (${stats.passPercentage})`
                : 'Pending evaluation'}
            </div>
          </div>

          {/* Card 4: Failed */}
          <div className="summary-stat-card card-theme-rose">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Failed</span>
              <div className="summary-stat-card-icon">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">
              {stats.hasAnyMarks ? stats.failedStudents : '—'}
            </div>
            <div className="summary-stat-card-subtitle">
              {stats.hasAnyMarks ? 'One or more subjects failed' : 'Pending evaluation'}
            </div>
          </div>

          {/* Card 5: Pass Rate */}
          <div className="summary-stat-card card-theme-teal">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Pass Rate</span>
              <div className="summary-stat-card-icon">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">{stats.passPercentage}</div>
            <div className="summary-stat-card-subtitle">
              {stats.hasAnyMarks ? 'Class clearance percentage' : 'No marks recorded'}
            </div>
          </div>

          {/* Card 6: Highest Score */}
          <div className="summary-stat-card card-theme-amber">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Highest Score</span>
              <div className="summary-stat-card-icon">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">{stats.highestPercentage}</div>
            <div className="summary-stat-card-subtitle truncate" title={stats.topStudentName}>
              {stats.hasAnyMarks ? `Top: ${stats.topStudentName}` : 'No marks recorded'}
            </div>
          </div>

          {/* Card 7: Class Average */}
          <div className="summary-stat-card card-theme-blue">
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Class Average</span>
              <div className="summary-stat-card-icon">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value">{stats.averagePercentage}</div>
            <div className="summary-stat-card-subtitle">Mean percentage score</div>
          </div>

          {/* Card 8: Overall Performance */}
          <div className={`summary-stat-card ${stats.performanceColorClass}`}>
            <div className="summary-stat-card-header">
              <span className="summary-stat-card-label">Class Performance</span>
              <div className="summary-stat-card-icon">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="summary-stat-card-value text-lg">
              {stats.performanceRating}
            </div>
            <div className="summary-stat-card-subtitle">Overall benchmark grade</div>
          </div>
        </div>
      )}

      {/* ─── 4. Class Result Sheet (Main Table Section) ─── */}
      <div className="view-results-sheet-card">
        {/* Card Header */}
        <div className="view-results-sheet-header">
          <div className="view-results-sheet-title">
            <h3>
              {selectedExam?.name || 'Examination'} — {selectedClass?.name || 'Class'}
              {selectedSectionId ? ` (Section ${selectedSection?.name})` : ' (All Sections)'}
            </h3>
            <p>
              Ranked in official order of merit based on percentage and total obtained marks.
            </p>
          </div>

          <div className="view-results-sheet-controls">
            <div className="view-results-search-wrap">
              <Search className="w-4 h-4 view-results-search-icon" />
              <input
                type="text"
                placeholder="Search by student name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="view-results-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="view-results-search-clear"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {classResults && (
              <span className="student-count-badge">
                Showing {filteredStudentResults.length} of {classResults.totalStudents} students
              </span>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="view-results-empty-state">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Calculating and loading results...</p>
          </div>
        ) : !classResults || classResults.studentResults.length === 0 ? (
          /* Empty State: No results or no students */
          <div className="view-results-empty-state">
            <div className="view-results-empty-icon">
              <Layers className="w-7 h-7" />
            </div>
            <h4 className="view-results-empty-title">No Examination Results Available</h4>
            <p className="view-results-empty-desc">
              There are no student results found for {selectedExam?.name || 'the selected examination'} in{' '}
              {selectedClass?.name || 'this class'}. Either no marks have been recorded yet, or no students are enrolled.
            </p>
            {onNavigateToEnterMarks && selectedExamId > 0 && selectedClassId > 0 && (
              <button
                onClick={() =>
                  onNavigateToEnterMarks(selectedExamId, selectedClassId, selectedSectionId || undefined)
                }
                className="btn-empty-action"
              >
                <span>Enter Student Marks Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : filteredStudentResults.length === 0 ? (
          /* Empty State: Search yielded no matches */
          <div className="view-results-empty-state">
            <div className="view-results-empty-icon">
              <Search className="w-7 h-7" />
            </div>
            <h4 className="view-results-empty-title">No Matching Students Found</h4>
            <p className="view-results-empty-desc">
              No student records matched your search query "{searchQuery}". Please check the spelling or try searching by Student ID.
            </p>
            <button onClick={() => setSearchQuery('')} className="btn-empty-action">
              Clear Search Filter
            </button>
          </div>
        ) : (
          /* ─── Result Table with Sticky Header & Contained Scroll ─── */
          <div className="view-results-table-wrap">
            <table className="view-results-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Position</th>
                  <th style={{ width: '130px' }}>Student ID</th>
                  <th>Student Name</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Total Marks</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Obtained</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Percentage</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Grade</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentResults.map((r) => {
                  // Position badge class
                  let posClass = 'pos-default';
                  if (r.position === 1) posClass = 'pos-gold';
                  else if (r.position === 2) posClass = 'pos-silver';
                  else if (r.position === 3) posClass = 'pos-bronze';

                  // Grade class
                  const gradeKey = (r.grade || 'f').toLowerCase().replace('+', 'plus');

                  return (
                    <tr
                      key={r.studentId}
                      className={!r.isPassed ? 'row-failed' : ''}
                    >
                      {/* Position */}
                      <td style={{ textAlign: 'center' }}>
                        {r.position ? (
                          <span className={`pos-badge ${posClass}`} title={`Position: ${r.position}`}>
                            {r.position}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>

                      {/* Student ID */}
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {r.systemStudentId}
                        </span>
                      </td>

                      {/* Student Name & Father's Name */}
                      <td>
                        <div className="view-results-student-info">
                          <span className="view-results-student-name">{r.displayName}</span>
                          <span className="view-results-student-sub">
                            {r.fatherName ? `S/D of ${r.fatherName}` : ''}
                            {r.admissionNumber ? ` • Adm: ${r.admissionNumber}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Total Marks */}
                      <td style={{ textAlign: 'right' }} className="font-medium text-slate-600">
                        {r.totalMaxMarks}
                      </td>

                      {/* Obtained Marks */}
                      <td style={{ textAlign: 'right' }} className="font-bold text-slate-900">
                        {r.totalObtainedMarks}
                      </td>

                      {/* Percentage */}
                      <td style={{ textAlign: 'right' }} className="font-extrabold text-slate-900">
                        {r.percentage.toFixed(2)}%
                      </td>

                      {/* Grade */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-grade grade-${gradeKey}`}>
                          {r.grade}
                        </span>
                      </td>

                      {/* Result Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={r.isPassed ? 'badge-result-pass' : 'badge-result-fail'}>
                          {r.isPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="view-results-actions">
                          <button
                            onClick={() => setSelectedStudentResult(r)}
                            className="btn-action-view"
                            title="View Student Subject Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>
                          <button
                            onClick={() => handleGenerateStudentDMC(r.studentId)}
                            className="btn-action-dmc"
                            title="Generate and view official DMC"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>DMC</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. Individual Student Result Breakdown Modal ─── */}
      {selectedStudentResult && (
        <div
          className="exam-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStudentResult(null);
          }}
        >
          <div className="student-breakdown-modal">
            {/* Header */}
            <div className="student-breakdown-header">
              <div className="student-breakdown-header-title">
                <h3>{selectedStudentResult.displayName} — Examination Details</h3>
                <p>
                  ID: {selectedStudentResult.systemStudentId} • Class: {selectedStudentResult.className}
                  {selectedStudentResult.sectionName ? ` (${selectedStudentResult.sectionName})` : ''} •{' '}
                  {selectedExam?.name || 'Examination'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentResult(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="student-breakdown-body">
              {/* Subjects Table */}
              <table className="student-breakdown-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th style={{ textAlign: 'right' }}>Max Marks</th>
                    <th style={{ textAlign: 'right' }}>Passing</th>
                    <th style={{ textAlign: 'right' }}>Obtained</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudentResult.subjects.map((sub) => (
                    <tr key={sub.examinationSubjectId}>
                      <td className="font-semibold text-slate-900">
                        {sub.subjectName}
                        {sub.subjectCode && (
                          <span className="text-[11px] font-mono text-slate-400 ml-1.5">
                            ({sub.subjectCode})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-slate-600">
                        {sub.maxMarks}
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-slate-600">
                        {sub.passingMarks}
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-bold text-slate-900">
                        {sub.status === 'Absent' ? (
                          <span className="text-amber-700 font-bold">Absent</span>
                        ) : sub.obtainedMarks !== null ? (
                          sub.obtainedMarks
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={
                            sub.status === 'Absent'
                              ? 'badge-result-abs'
                              : sub.isPass
                              ? 'badge-result-pass'
                              : 'badge-result-fail'
                          }
                        >
                          {sub.status === 'Absent' ? 'ABSENT' : sub.isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Strip */}
              <div className="student-breakdown-summary-strip">
                <div className="summary-strip-item">
                  <span className="label">Total Marks</span>
                  <span className="val">
                    {selectedStudentResult.totalObtainedMarks} / {selectedStudentResult.totalMaxMarks}
                  </span>
                </div>
                <div className="summary-strip-item">
                  <span className="label">Percentage</span>
                  <span className="val">{selectedStudentResult.percentage.toFixed(2)}%</span>
                </div>
                <div className="summary-strip-item">
                  <span className="label">Grade</span>
                  <span className="val text-blue-700">{selectedStudentResult.grade}</span>
                </div>
                <div className="summary-strip-item">
                  <span className="label">Position</span>
                  <span className="val text-amber-700">
                    {selectedStudentResult.position ? `#${selectedStudentResult.position}` : '—'}
                  </span>
                </div>
                <div className="summary-strip-item">
                  <span className="label">Overall Result</span>
                  <span
                    className={`val ${
                      selectedStudentResult.isPassed ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {selectedStudentResult.isPassed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="student-breakdown-footer">
              <button
                onClick={() => setSelectedStudentResult(null)}
                className="btn-print-sheet"
              >
                Close
              </button>
              <button
                onClick={() => handleGenerateStudentDMC(selectedStudentResult.studentId)}
                className="btn-generate-dmc"
              >
                <FileText className="w-4 h-4" />
                <span>Generate & Print Official DMC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. DMC Certificate Preview Carousel Modal ─── */}
      {showDmcModal && dmcList.length > 0 && (
        <div
          className="exam-modal-overlay dmc-preview-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDmcModal(false);
          }}
        >
          <div className="dmc-modal-card">
            {/* Modal Header */}
            <div className="dmc-modal-header dmc-no-print no-print">
              <div className="dmc-modal-header-left">
                <div className="dmc-modal-header-icon">
                  <FileText style={{ width: 20, height: 20 }} />
                </div>
                <div className="dmc-modal-header-title">
                  <h3>Detailed Marks Certificate (DMC) Preview</h3>
                  <p>
                    Student {activeDmcIndex + 1} of {dmcList.length} —{' '}
                    {dmcList[activeDmcIndex]?.student?.displayName}
                  </p>
                </div>
              </div>

              <div className="dmc-modal-header-actions">
                {dmcList.length > 1 && (
                  <>
                    <div className="dmc-modal-toggle-group">
                      <button
                        type="button"
                        onClick={() => setDmcModalViewMode('single')}
                        className={`dmc-modal-toggle-btn ${
                          dmcModalViewMode === 'single' ? 'active' : ''
                        }`}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        onClick={() => setDmcModalViewMode('all')}
                        className={`dmc-modal-toggle-btn ${
                          dmcModalViewMode === 'all' ? 'active' : ''
                        }`}
                      >
                        All ({dmcList.length})
                      </button>
                    </div>

                    {dmcModalViewMode === 'single' && (
                      <div className="dmc-modal-stepper">
                        <button
                          type="button"
                          onClick={() => setActiveDmcIndex((prev) => Math.max(0, prev - 1))}
                          disabled={activeDmcIndex === 0}
                          className="dmc-modal-stepper-btn"
                          title="Previous Student"
                        >
                          <ChevronLeft style={{ width: 14, height: 14 }} />
                          Prev
                        </button>
                        <span className="dmc-modal-stepper-counter">
                          {activeDmcIndex + 1} / {dmcList.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveDmcIndex((prev) => Math.min(dmcList.length - 1, prev + 1))}
                          disabled={activeDmcIndex === dmcList.length - 1}
                          className="dmc-modal-stepper-btn"
                          title="Next Student"
                        >
                          Next
                          <ChevronRight style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {dmcModalViewMode === 'single' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePrintDMC('current')}
                      className="dmc-modal-action-btn"
                      title="Print only this student's certificate"
                    >
                      <Printer style={{ width: 16, height: 16 }} />
                      Print Current DMC
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDMCPDF('current')}
                      className="dmc-modal-action-btn secondary"
                      title="Export this student's certificate to PDF"
                    >
                      <Download style={{ width: 16, height: 16 }} />
                      Export PDF
                    </button>
                  </>
                ) : null}

                {dmcList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePrintDMC('all')}
                      className="dmc-modal-action-btn secondary"
                      title="Print all student certificates in this class"
                    >
                      <Printer style={{ width: 16, height: 16 }} />
                      Print All ({dmcList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDMCPDF('all')}
                      className="dmc-modal-action-btn success"
                      title="Export all student certificates in this class to PDF"
                    >
                      <Download style={{ width: 16, height: 16 }} />
                      Export All PDF
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowDmcModal(false)}
                  className="dmc-modal-close-btn"
                  title="Close Preview"
                >
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            {/* Modal Body: DMC Report Card Component */}
            <div className="dmc-modal-body dmc-preview-container">
              {dmcModalViewMode === 'single' ? (
                dmcList[activeDmcIndex] ? (
                  <DMCReportCard key={dmcList[activeDmcIndex].student.id} dmc={dmcList[activeDmcIndex]} />
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
        </div>
      )}

      {/* ─── 7. Dedicated Print Result Sheet (High Resolution `@media print`) ─── */}
      <div
        className={`print-result-sheet-container print-only ${
          showDmcModal ? 'hidden-during-dmc-print' : ''
        }`}
      >
        {/* School Header */}
        <div className="print-sheet-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <InstitutionLogo
              size={56}
              src={schoolLogo}
              schoolName={schoolSettings?.schoolName}
              framed
            />
          </div>
          <div className="print-sheet-school-name">
            {schoolSettings?.schoolName || 'MS Institute Management System'}
          </div>
          <div className="print-sheet-school-contact">
            {[schoolSettings?.address, schoolSettings?.city].filter(Boolean).join(', ')}
            {schoolSettings?.phone ? ` • Tel: ${schoolSettings.phone}` : ''}
            {schoolSettings?.email ? ` • Email: ${schoolSettings.email}` : ''}
          </div>
          <div className="print-sheet-doc-title">Official Examination Result Sheet</div>
        </div>

        {/* Metadata Grid */}
        <div className="print-sheet-meta-grid">
          <div className="print-sheet-meta-item">
            <span className="print-sheet-meta-label">Examination</span>
            <span className="print-sheet-meta-val">{selectedExam?.name || 'Examination'}</span>
          </div>
          <div className="print-sheet-meta-item">
            <span className="print-sheet-meta-label">Academic Session</span>
            <span className="print-sheet-meta-val">
              {sessions.find((s) => s.id === selectedSessionId)?.name || 'Session'}
            </span>
          </div>
          <div className="print-sheet-meta-item">
            <span className="print-sheet-meta-label">Class & Section</span>
            <span className="print-sheet-meta-val">
              {selectedClass?.name || 'Class'}
              {selectedSectionId ? ` - Section ${selectedSection?.name}` : ' (All Sections)'}
            </span>
          </div>
          <div className="print-sheet-meta-item">
            <span className="print-sheet-meta-label">Date Generated</span>
            <span className="print-sheet-meta-val">{new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* Summary Statistics Strip */}
        {classResults && (
          <div className="print-sheet-stats-strip">
            <div className="print-stat-col">
              <div className="p-label">Total Students</div>
              <div className="p-val">{classResults.totalStudents}</div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Appeared</div>
              <div className="p-val">
                {classResults.studentResults.filter((sr) =>
                  sr.subjects.some((s) => s.obtainedMarks !== null || s.status === 'Absent')
                ).length}
              </div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Passed</div>
              <div className="p-val">{classResults.passedStudents}</div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Failed</div>
              <div className="p-val">{classResults.failedStudents}</div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Pass Percentage</div>
              <div className="p-val">{classResults.passPercentage.toFixed(1)}%</div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Highest Score</div>
              <div className="p-val">{classResults.highestPercentage.toFixed(1)}%</div>
            </div>
            <div className="print-stat-col">
              <div className="p-label">Class Average</div>
              <div className="p-val">{classResults.averagePercentage.toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Results Table */}
        <table className="print-sheet-table">
          <thead>
            <tr>
              <th style={{ width: '45px', textAlign: 'center' }}>Pos</th>
              <th style={{ width: '90px' }}>Student ID</th>
              <th style={{ width: '80px' }}>Adm No</th>
              <th>Student Name</th>
              <th>Father's Name</th>
              <th style={{ width: '65px', textAlign: 'right' }}>Total</th>
              <th style={{ width: '65px', textAlign: 'right' }}>Obtained</th>
              <th style={{ width: '70px', textAlign: 'right' }}>Percentage</th>
              <th style={{ width: '55px', textAlign: 'center' }}>Grade</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(classResults?.studentResults || []).map((sr) => (
              <tr key={sr.studentId}>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                  {sr.position ? sr.position : '—'}
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {sr.systemStudentId}
                </td>
                <td>{sr.admissionNumber || '—'}</td>
                <td style={{ fontWeight: 'bold' }}>{sr.displayName}</td>
                <td>{sr.fatherName || '—'}</td>
                <td style={{ textAlign: 'right' }}>{sr.totalMaxMarks}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {sr.totalObtainedMarks}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {sr.percentage.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sr.grade}</td>
                <td
                  style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: sr.isPassed ? '#065f46' : '#991b1b',
                  }}
                >
                  {sr.isPassed ? 'PASS' : 'FAIL'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="print-sheet-signatures">
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-title">Class Teacher</div>
          </div>
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-title">Controller of Examinations</div>
          </div>
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-title">Principal</div>
          </div>
        </div>
      </div>
    </div>
  );
};
