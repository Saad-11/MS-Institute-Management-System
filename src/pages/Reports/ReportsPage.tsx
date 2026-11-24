import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Users,
  CalendarCheck,
  Receipt,
  AlertTriangle,
  Award,
  Layers,
  GraduationCap,
  Filter,
  Printer,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  FeeTypeItem,
  ExaminationItem,
  ExaminationSubjectItem,
  ReportHeaderMetadata,
  StudentListReportRow,
  AttendanceReportRow,
  FeeCollectionReportRow,
  FeeOutstandingReportRow,
  ExamMarksReportRow,
  ClassStrengthRow,
  TeacherReportRow,
  ClassExamResults,
} from '../../types/electron';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/reports.css';

export type ReportType =
  | 'student_list'
  | 'attendance_summary'
  | 'fee_collection'
  | 'fee_dues'
  | 'exam_marks'
  | 'class_results'
  | 'class_strength'
  | 'teacher_directory';

interface ReportCategoryMeta {
  id: ReportType;
  title: string;
  description: string;
  icon: LucideIcon;
}

const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  {
    id: 'student_list',
    title: 'Student Directory',
    description: 'Comprehensive student roster, admission numbers, class, section, and contact details.',
    icon: Users,
  },
  {
    id: 'attendance_summary',
    title: 'Attendance Summary',
    description: 'Class-wise attendance percentages, total working days, present, absent, and leave counts.',
    icon: CalendarCheck,
  },
  {
    id: 'fee_collection',
    title: 'Fee Collections',
    description: 'Itemized fee collection ledger, transaction dates, payment modes, and financial totals.',
    icon: Receipt,
  },
  {
    id: 'fee_dues',
    title: 'Fee Dues & Defaulters',
    description: 'Outstanding student balances, unpaid fee vouchers, due dates, and defaulter tracking.',
    icon: AlertTriangle,
  },
  {
    id: 'exam_marks',
    title: 'Examination Marks Sheet',
    description: 'Subject-wise marks breakdown, maximum and passing marks, grades, and entry status.',
    icon: Award,
  },
  {
    id: 'class_results',
    title: 'Class Result & Merit List',
    description: 'Consolidated examination merit list with percentages, GPA/grades, class ranks, and pass/fail.',
    icon: Award,
  },
  {
    id: 'class_strength',
    title: 'Class Strength Demographics',
    description: 'Class and section enrollment counts, gender distribution (male/female), and active student ratios.',
    icon: Layers,
  },
  {
    id: 'teacher_directory',
    title: 'Faculty Directory',
    description: 'Teaching staff roster, employee IDs, designations, academic qualifications, and contact details.',
    icon: GraduationCap,
  },
];

export const ReportsPage: React.FC = () => {
  // Selected Report Category
  const [reportType, setReportType] = useState<ReportType>('student_list');

  // Filter Reference Lists
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
  const [examinations, setExaminations] = useState<ExaminationItem[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExaminationSubjectItem[]>([]);

  // Selected Filter State
  const [selectedSessionId, setSelectedSessionId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(0);
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<number>(0);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Generated Report Data State
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [metadata, setMetadata] = useState<ReportHeaderMetadata | null>(null);
  const [studentRows, setStudentRows] = useState<StudentListReportRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceReportRow[]>([]);
  const [feeCollectionRows, setFeeCollectionRows] = useState<FeeCollectionReportRow[]>([]);
  const [feeDuesRows, setFeeDuesRows] = useState<FeeOutstandingReportRow[]>([]);
  const [examMarksRows, setExamMarksRows] = useState<ExamMarksReportRow[]>([]);
  const [classResultsData, setClassResultsData] = useState<ClassExamResults | null>(null);
  const [classStrengthRows, setClassStrengthRows] = useState<ClassStrengthRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherReportRow[]>([]);

  // Summary Metrics State & Messages
  const [extraMetrics, setExtraMetrics] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── 1. Load Initial Filter Datasets ─────────────────────────────────────────
  useEffect(() => {
    const fetchInit = async () => {
      try {
        if (window.electronAPI) {
          const [sessRes, classRes, ftRes] = await Promise.all([
            window.electronAPI.sessions.getAll(),
            window.electronAPI.classes.getAll(),
            window.electronAPI.fees.getTypes(),
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

          if (ftRes.success && ftRes.types) {
            setFeeTypes(ftRes.types);
          }
        }
      } catch (err) {
        console.error('Failed to load initial report references:', err);
      }
    };
    fetchInit();
  }, []);

  // ─── 2. Fetch Sections when Class Changes ────────────────────────────────────
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedClassId || !window.electronAPI?.sections) {
        setSections([]);
        setSelectedSectionId(0);
        return;
      }
      try {
        const res = await window.electronAPI.sections.getByClassId(selectedClassId);
        if (res.success && res.sections) {
          setSections(res.sections);
          setSelectedSectionId(0); // All sections default
        }
      } catch (err) {
        console.error('Failed to fetch sections:', err);
      }
    };
    fetchSections();
  }, [selectedClassId]);

  // ─── 3. Fetch Examinations when Session Changes ──────────────────────────────
  useEffect(() => {
    const fetchExams = async () => {
      if (!selectedSessionId || !window.electronAPI?.exams) return;
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
      } catch (err) {
        console.error('Failed to fetch exams:', err);
      }
    };
    fetchExams();
  }, [selectedSessionId]);

  // ─── 4. Fetch Exam Subjects when Exam or Class Changes ───────────────────────
  useEffect(() => {
    const fetchExamSubjects = async () => {
      if (!selectedExamId || !selectedClassId || !window.electronAPI?.exams) {
        setExamSubjects([]);
        return;
      }
      try {
        const res = await window.electronAPI.exams.getSubjects({
          examinationId: selectedExamId,
          classId: selectedClassId,
        });
        if (res.success && res.subjects) {
          setExamSubjects(res.subjects);
          setSelectedSubjectId(0); // All subjects default
        }
      } catch (err) {
        console.error('Failed to load exam subjects:', err);
      }
    };
    fetchExamSubjects();
  }, [selectedExamId, selectedClassId]);

  // ─── 5. Reset Filters Handler ───────────────────────────────────────────────
  const handleResetFilters = () => {
    const activeSession = sessions.find((s) => s.isActive) || sessions[0];
    if (activeSession) setSelectedSessionId(activeSession.id);
    if (classes.length > 0) setSelectedClassId(classes[0].id);
    setSelectedSectionId(0);
    setSelectedFeeTypeId(0);
    if (examinations.length > 0) setSelectedExamId(examinations[0].id);
    setSelectedSubjectId(0);
    setSelectedGender('all');
    setSelectedStatus('Active');
    setStartDate('');
    setEndDate('');
    setError(null);
  };

  // ─── 6. Generate Report Handler ─────────────────────────────────────────────
  const handleGenerateReport = async () => {
    if (!window.electronAPI?.reports) {
      setError('Desktop reporting service is not available.');
      return;
    }

    // Required Field Validations
    if (reportType === 'exam_marks' || reportType === 'class_results') {
      if (!selectedExamId) {
        setError('Please select an Examination to generate this report.');
        return;
      }
      if (!selectedClassId) {
        setError('Please select a Class to generate this report.');
        return;
      }
    }

    if (reportType === 'attendance_summary' && !selectedClassId) {
      setError('Please select a Class to generate the Attendance Summary.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Reset previous datasets
    setStudentRows([]);
    setAttendanceRows([]);
    setFeeCollectionRows([]);
    setFeeDuesRows([]);
    setExamMarksRows([]);
    setClassResultsData(null);
    setClassStrengthRows([]);
    setTeacherRows([]);
    setExtraMetrics({});

    try {
      switch (reportType) {
        case 'student_list': {
          const res = await window.electronAPI.reports.getStudentList({
            academicSessionId: selectedSessionId || undefined,
            classId: selectedClassId || undefined,
            sectionId: selectedSectionId || undefined,
            gender: selectedGender !== 'all' ? selectedGender : undefined,
            status: selectedStatus !== 'all' ? selectedStatus : undefined,
          });
          if (res.success) {
            setMetadata(res.metadata);
            setStudentRows(res.records);
            setExtraMetrics({
              'Total Students': res.totalStudents,
              'Active Enrolled': res.records.filter((r) => r.status === 'Active').length,
            });
            setHasGenerated(true);
            setSuccessMessage(`Successfully compiled Student Directory with ${res.totalStudents} records.`);
          } else {
            setError(res.error || 'Failed to generate Student Directory.');
          }
          break;
        }

        case 'attendance_summary': {
          const res = await window.electronAPI.reports.getAttendance({
            academicSessionId: selectedSessionId || undefined,
            classId: selectedClassId || undefined,
            sectionId: selectedSectionId || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          if (res.success) {
            setMetadata(res.metadata);
            setAttendanceRows(res.records);
            setExtraMetrics({
              'Students Recorded': res.records.length,
              'Class Average Attendance':
                res.classAveragePercentage !== null ? `${res.classAveragePercentage}%` : 'N/A',
              'Recorded Working Days': res.totalRecordedDays,
            });
            setHasGenerated(true);
            setSuccessMessage(`Attendance Summary generated for ${res.records.length} students.`);
          } else {
            setError(res.error || 'Failed to generate attendance report.');
          }
          break;
        }

        case 'fee_collection': {
          const res = await window.electronAPI.reports.getFeeCollection({
            academicSessionId: selectedSessionId || undefined,
            classId: selectedClassId || undefined,
            sectionId: selectedSectionId || undefined,
            feeTypeId: selectedFeeTypeId || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          if (res.success) {
            setMetadata(res.metadata);
            setFeeCollectionRows(res.records);
            setExtraMetrics({
              'Total Transactions': res.totalTransactions,
              'Total Amount Collected': res.totalCollectedFormatted,
            });
            setHasGenerated(true);
            setSuccessMessage(`Compiled ${res.totalTransactions} transactions totaling ${res.totalCollectedFormatted}.`);
          } else {
            setError(res.error || 'Failed to generate fee collection report.');
          }
          break;
        }

        case 'fee_dues': {
          const res = await window.electronAPI.reports.getFeeOutstanding({
            academicSessionId: selectedSessionId || undefined,
            classId: selectedClassId || undefined,
            sectionId: selectedSectionId || undefined,
          });
          if (res.success) {
            setMetadata(res.metadata);
            setFeeDuesRows(res.records);
            setExtraMetrics({
              'Total Defaulters': res.totalDefaulters,
              'Total Outstanding Balance': res.totalOutstandingFormatted,
            });
            setHasGenerated(true);
            setSuccessMessage(`Identified ${res.totalDefaulters} defaulter records.`);
          } else {
            setError(res.error || 'Failed to generate dues report.');
          }
          break;
        }

        case 'exam_marks': {
          const res = await window.electronAPI.reports.getExamMarks({
            examinationId: selectedExamId,
            classId: selectedClassId,
            sectionId: selectedSectionId || undefined,
            subjectId: selectedSubjectId || undefined,
          });
          if (res.success) {
            setMetadata(res.metadata);
            setExamMarksRows(res.records);
            setExtraMetrics({
              'Total Students Entered': res.totalEntered,
              'Passed': res.passCount,
              'Failed': res.failCount,
              'Pass Percentage': `${res.passPercentage}%`,
            });
            setHasGenerated(true);
            setSuccessMessage(`Marks sheet generated with ${res.totalEntered} entries.`);
          } else {
            setError(res.error || 'Failed to generate marks report.');
          }
          break;
        }

        case 'class_results': {
          const res = await window.electronAPI.reports.getClassResults({
            examinationId: selectedExamId,
            classId: selectedClassId,
            sectionId: selectedSectionId || undefined,
          });
          if (res.success && res.results) {
            setMetadata(res.metadata);
            setClassResultsData(res.results);
            setExtraMetrics({
              'Total Students': res.results.totalStudents,
              'Passed': res.results.passedStudents,
              'Failed': res.results.failedStudents,
              'Pass Percentage': `${res.results.passPercentage}%`,
              'Class Average': `${res.results.averagePercentage}%`,
              'Highest Score': `${res.results.highestPercentage}%`,
            });
            setHasGenerated(true);
            setSuccessMessage(`Consolidated results compiled for ${res.results.totalStudents} students.`);
          } else {
            setError(res.error || 'Failed to generate class results.');
          }
          break;
        }

        case 'class_strength': {
          const res = await window.electronAPI.reports.getClassStrength(selectedSessionId || undefined);
          if (res.success) {
            setMetadata(res.metadata);
            setClassStrengthRows(res.records);
            setExtraMetrics({
              'Total Institutional Enrollment': res.grandTotal,
              'Configured Class Sections': res.records.length,
            });
            setHasGenerated(true);
            setSuccessMessage(`Class strength demographics compiled (${res.grandTotal} total students).`);
          } else {
            setError(res.error || 'Failed to generate class strength report.');
          }
          break;
        }

        case 'teacher_directory': {
          const res = await window.electronAPI.reports.getTeacher({});
          if (res.success) {
            setMetadata(res.metadata);
            setTeacherRows(res.records);
            setExtraMetrics({
              'Total Faculty Members': res.totalTeachers,
              'Active Faculty': res.records.filter((t) => t.employmentStatus === 'Active' || t.employmentStatus === 'Permanent').length,
            });
            setHasGenerated(true);
            setSuccessMessage(`Faculty Directory loaded with ${res.totalTeachers} members.`);
          } else {
            setError(res.error || 'Failed to generate faculty directory.');
          }
          break;
        }
      }
    } catch (err: unknown) {
      console.error('Report Generation Error:', err);
      setError(err instanceof Error ? err.message : 'Error generating report.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 7. Print Report Handler with Isolation ─────────────────────────────────
  const handlePrintReport = async () => {
    // Preload logo if present
    const logoImg = document.querySelector('.report-doc-logo-img') as HTMLImageElement | null;
    if (logoImg && !logoImg.complete) {
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        setTimeout(resolve, 800);
      });
    }

    document.body.classList.add('printing-report');

    const cleanup = () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2500);
    }, 120);
  };

  // ─── 8. Export PDF Handler ──────────────────────────────────────────────────
  const handleExportPDF = async () => {
    const rawTitle = metadata?.reportTitle || 'Institutional_Report';
    const safeTitle = rawTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const defaultFileName = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;

    document.body.classList.add('printing-report');

    try {
      if (window.electronAPI?.exportPDF) {
        const res = await window.electronAPI.exportPDF({ defaultFileName });
        if (res.success && res.filePath) {
          setSuccessMessage(`Report successfully exported to: ${res.filePath}`);
        } else if (!res.canceled && res.error) {
          setError(res.error);
        }
      } else {
        window.print();
      }
    } catch (err: unknown) {
      console.error('PDF Export Error:', err);
      window.print();
    } finally {
      setTimeout(() => {
        document.body.classList.remove('printing-report');
      }, 1000);
    }
  };

  // Calculate total record count for header pill
  const recordCount = useMemo(() => {
    switch (reportType) {
      case 'student_list': return studentRows.length;
      case 'attendance_summary': return attendanceRows.length;
      case 'fee_collection': return feeCollectionRows.length;
      case 'fee_dues': return feeDuesRows.length;
      case 'exam_marks': return examMarksRows.length;
      case 'class_results': return classResultsData?.studentResults.length || 0;
      case 'class_strength': return classStrengthRows.length;
      case 'teacher_directory': return teacherRows.length;
      default: return 0;
    }
  }, [
    reportType,
    studentRows,
    attendanceRows,
    feeCollectionRows,
    feeDuesRows,
    examMarksRows,
    classResultsData,
    classStrengthRows,
    teacherRows,
  ]);

  const activeCategoryMeta = useMemo(() => {
    return REPORT_CATEGORIES.find((c) => c.id === reportType) || REPORT_CATEGORIES[0];
  }, [reportType]);

  return (
    <div className="reports-workspace">
      {/* ─── 1. Page Header (No Print) ──────────────────────────────────────── */}
      <div className="reports-header-card reports-no-print">
        <div className="reports-header-left">
          <div className="reports-header-icon">
            <PieChart size={24} />
          </div>
          <div>
            <h1 className="reports-header-title">Reports & Analytics Center</h1>
            <p className="reports-header-subtitle">
              Generate, review, and print accurate school reports using your selected filters.
            </p>
          </div>
        </div>

        <div className="reports-header-actions">
          {metadata && hasGenerated ? (
            <>
              <button
                onClick={handlePrintReport}
                className="btn-reset-filters"
                title="Print official report"
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-generate-report"
                title="Export high-resolution PDF"
              >
                <Download size={15} />
                <span>Export PDF</span>
              </button>
            </>
          ) : (
            <div className="filter-active-badge">
              <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Ready to Generate
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. Report Category Selection Cards (No Print) ─────────────────── */}
      <div className="reports-category-section reports-no-print">
        <div className="reports-section-label">
          <Layers size={14} />
          <span>Select Report Category</span>
        </div>

        <div className="reports-category-grid">
          {REPORT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = reportType === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => {
                  setReportType(cat.id);
                  setHasGenerated(false);
                  setMetadata(null);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`report-category-card ${isSelected ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
              >
                <div className="report-card-top">
                  <div className="report-card-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <div className="report-card-indicator">
                    <div className="report-card-radio-ring">
                      {isSelected && <div className="report-card-radio-dot" />}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="report-card-title">{cat.title}</div>
                  <p className="report-card-desc">{cat.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 3. Report Filters Card (No Print) ──────────────────────────────── */}
      <div className="reports-filter-card reports-no-print">
        <div className="filter-card-header">
          <div className="filter-header-left">
            <Filter size={16} className="text-blue-600" />
            <h2 className="filter-header-title">Report Filters</h2>
            <span className="filter-active-badge">{activeCategoryMeta.title}</span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            * Required fields for this category
          </div>
        </div>

        <div className="filter-form-grid">
          {/* Academic Session */}
          {reportType !== 'teacher_directory' && (
            <div className="filter-group">
              <label className="filter-label">Academic Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="filter-control"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Class Filter */}
          {reportType !== 'teacher_directory' && reportType !== 'class_strength' && (
            <div className="filter-group">
              <label className="filter-label">
                Class
                {(reportType === 'exam_marks' ||
                  reportType === 'class_results' ||
                  reportType === 'attendance_summary') && (
                  <span className="filter-required-mark">*</span>
                )}
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
                className="filter-control"
              >
                {reportType === 'student_list' ||
                reportType === 'fee_collection' ||
                reportType === 'fee_dues' ? (
                  <option value={0}>All Classes</option>
                ) : null}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section Filter */}
          {reportType !== 'teacher_directory' && reportType !== 'class_strength' && (
            <div className="filter-group">
              <label className="filter-label">Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                className="filter-control"
              >
                <option value={0}>All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Examination Filter */}
          {(reportType === 'exam_marks' || reportType === 'class_results') && (
            <div className="filter-group">
              <label className="filter-label">
                Examination <span className="filter-required-mark">*</span>
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(Number(e.target.value))}
                className="filter-control"
                style={{ fontWeight: 600 }}
              >
                {examinations.length === 0 ? (
                  <option value={0}>No exams found in session</option>
                ) : (
                  examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.status})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Examination Subject Filter */}
          {reportType === 'exam_marks' && (
            <div className="filter-group">
              <label className="filter-label">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                className="filter-control"
              >
                <option value={0}>All Configured Subjects</option>
                {examSubjects.map((es) => (
                  <option key={es.subjectId} value={es.subjectId}>
                    {es.subjectName} ({es.maxMarks} Marks)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fee Type Filter */}
          {reportType === 'fee_collection' && (
            <div className="filter-group">
              <label className="filter-label">Fee Type</label>
              <select
                value={selectedFeeTypeId}
                onChange={(e) => setSelectedFeeTypeId(Number(e.target.value))}
                className="filter-control"
              >
                <option value={0}>All Fee Types</option>
                {feeTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range: From & To */}
          {(reportType === 'attendance_summary' || reportType === 'fee_collection') && (
            <>
              <div className="filter-group">
                <label className="filter-label">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="filter-control"
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="filter-control"
                />
              </div>
            </>
          )}

          {/* Student Directory Filters: Gender & Status */}
          {reportType === 'student_list' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="filter-control"
                >
                  <option value="all">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Student Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="filter-control"
                >
                  <option value="Active">Active Enrolled</option>
                  <option value="all">All Statuses</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Left">Left</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Filter Action Buttons */}
        <div className="filter-actions-bar">
          <button
            onClick={handleResetFilters}
            className="btn-reset-filters"
            type="button"
          >
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="btn-generate-report"
            type="button"
          >
            <RefreshCw
              size={15}
              className={isLoading ? 'animate-spin' : ''}
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isLoading ? 'Compiling Report...' : 'Generate Report'}</span>
          </button>
        </div>
      </div>

      {/* ─── 4. Notifications & Alerts (No Print) ─────────────────────────── */}
      {error && (
        <div className="reports-alert reports-alert-error reports-no-print">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{error}</div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="reports-alert reports-alert-success reports-no-print">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── 5. Report Results Workspace ──────────────────────────────────── */}
      {isLoading ? (
        <div className="reports-empty-card reports-no-print">
          <div className="reports-empty-icon-wrap">
            <RefreshCw
              size={24}
              style={{ animation: 'spin 1s linear infinite' }}
              className="text-blue-600"
            />
          </div>
          <div className="reports-empty-title">Generating Report</div>
          <p className="reports-empty-desc">
            Querying database records and preparing your analytical document...
          </p>
        </div>
      ) : !hasGenerated ? (
        <div className="reports-empty-card reports-no-print">
          <div className="reports-empty-icon-wrap">
            <FileText size={26} />
          </div>
          <div className="reports-empty-title">Ready to Generate Report</div>
          <p className="reports-empty-desc">
            Select a report category, configure the available filters, and click <strong>Generate Report</strong>.
          </p>
        </div>
      ) : recordCount === 0 ? (
        <div className="reports-empty-card reports-no-print">
          <div className="reports-empty-icon-wrap" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
            <AlertTriangle size={26} />
          </div>
          <div className="reports-empty-title">No Matching Records Found</div>
          <p className="reports-empty-desc">
            No database entries match the specified filter criteria. Try choosing &quot;All Classes&quot; or selecting a different academic session.
          </p>
        </div>
      ) : (
        <div className="reports-results-section">
          {/* Results Action Bar (No Print) */}
          <div className="reports-results-header reports-no-print">
            <div className="reports-results-title-group">
              <h2 className="reports-results-title">{metadata?.reportTitle}</h2>
              <span className="reports-count-pill">{recordCount} Records</span>
            </div>

            <div className="reports-header-actions">
              <button
                onClick={handlePrintReport}
                className="btn-reset-filters"
                title="Print report"
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-generate-report"
                title="Export PDF"
              >
                <Download size={15} />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Dynamic KPI Metrics Strip */}
          {Object.keys(extraMetrics).length > 0 && (
            <div className="reports-metrics-strip reports-no-print">
              {Object.entries(extraMetrics).map(([label, val]) => (
                <div key={label} className="reports-metric-box">
                  <div className="reports-metric-label">{label}</div>
                  <div className="reports-metric-val">{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* ─── PRINTABLE DOCUMENT CARD ────────────────────────────────────── */}
          <div className="reports-print-document">
            {/* Official Institutional Document Header */}
            <div className="report-doc-header">
              <div className="report-doc-header-inner">
                <InstitutionLogo
                  size={68}
                  src={metadata?.schoolLogoDataUrl}
                  schoolName={metadata?.school.schoolName}
                  framed
                />

                <div className="report-doc-center">
                  <h1 className="report-doc-school-title">
                    {metadata?.school.schoolName || 'Oxford Model High School'}
                  </h1>
                  <div className="report-doc-school-address">
                    {[metadata?.school.address, metadata?.school.city, metadata?.school.province]
                      .filter(Boolean)
                      .join(', ') || 'Main Campus, Education City'}
                  </div>
                  <div className="report-doc-school-contact">
                    {metadata?.school.phone && <span>Tel: {metadata.school.phone}</span>}
                    {metadata?.school.phone && metadata?.school.email && <span>•</span>}
                    {metadata?.school.email && <span>Email: {metadata.school.email}</span>}
                    {metadata?.school.schoolCode && <span>•</span>}
                    {metadata?.school.schoolCode && <span>Code: {metadata.school.schoolCode}</span>}
                  </div>
                </div>

                <div style={{ width: '64px', textAlign: 'right', fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>
                  OFFICIAL REPORT
                </div>
              </div>

              {/* Title Banner */}
              <div className="report-doc-title-banner">
                <span className="report-doc-title-text">{metadata?.reportTitle}</span>
              </div>

              {/* Applied Filters Metadata Strip */}
              {metadata?.filtersApplied && (
                <div className="report-doc-meta-strip">
                  <div className="report-doc-meta-filters">
                    {Object.entries(metadata.filtersApplied).map(([k, v]) => (
                      <span key={k} className="report-doc-meta-item">
                        <strong>{k}:</strong> {v}
                      </span>
                    ))}
                  </div>
                  <div className="report-doc-meta-date">
                    Generated: {metadata.generatedAt}
                  </div>
                </div>
              )}
            </div>

            {/* Key KPI Metrics Box on Print */}
            {Object.keys(extraMetrics).length > 0 && (
              <div
                className="reports-metrics-strip"
                style={{ marginBottom: '14px', display: 'grid' }}
              >
                {Object.entries(extraMetrics).map(([label, val]) => (
                  <div key={label} className="reports-metric-box">
                    <div className="reports-metric-label">{label}</div>
                    <div className="reports-metric-val" style={{ fontSize: '13px' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── 8 DEDICATED REPORT DATA TABLES ────────────────────────────── */}
            <div className="reports-table-card">
              <div className="reports-table-container">
                {/* 1. Student Directory */}
                {reportType === 'student_list' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '110px' }}>Student ID</th>
                        <th style={{ width: '90px' }}>Adm #</th>
                        <th>Student Full Name</th>
                        <th>Father / Guardian Name</th>
                        <th>Class & Section</th>
                        <th style={{ width: '70px' }}>Gender</th>
                        <th style={{ width: '100px' }}>Phone</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.studentId}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>
                            {r.admissionNumber || '—'}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ color: '#334155' }}>{r.fatherName || '—'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {r.className} {r.sectionName ? `(${r.sectionName})` : ''}
                          </td>
                          <td style={{ color: '#475569' }}>{r.gender}</td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>{r.phone || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`report-badge ${
                                r.status === 'Active' ? 'report-badge-active' : 'report-badge-neutral'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 2. Attendance Summary */}
                {reportType === 'attendance_summary' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '110px' }}>Student ID</th>
                        <th style={{ width: '90px' }}>Adm #</th>
                        <th>Student Full Name</th>
                        <th>Class & Section</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>Working Days</th>
                        <th style={{ width: '65px', textAlign: 'center', color: '#34d399' }}>Present</th>
                        <th style={{ width: '65px', textAlign: 'center', color: '#fbbf24' }}>Late</th>
                        <th style={{ width: '65px', textAlign: 'center', color: '#f87171' }}>Absent</th>
                        <th style={{ width: '65px', textAlign: 'center', color: '#60a5fa' }}>Leave</th>
                        <th style={{ width: '95px', textAlign: 'right' }}>Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.studentId}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>
                            {r.admissionNumber || '—'}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ fontWeight: 600 }}>
                            {r.className} ({r.sectionName})
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.totalDays}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>
                            {r.presentCount}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#b45309' }}>
                            {r.lateCount}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#b91c1c' }}>
                            {r.absentCount}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>
                            {r.leaveCount}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f2942' }}>
                            {r.attendancePercentage !== null ? `${r.attendancePercentage}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 3. Fee Collections */}
                {reportType === 'fee_collection' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '100px' }}>Receipt #</th>
                        <th style={{ width: '90px' }}>Payment Date</th>
                        <th>Student Full Name</th>
                        <th style={{ width: '100px' }}>Student ID</th>
                        <th>Class</th>
                        <th>Fee Period</th>
                        <th>Fee Type</th>
                        <th style={{ width: '110px', textAlign: 'right' }}>Amount Paid</th>
                        <th style={{ width: '85px', textAlign: 'center' }}>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeCollectionRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#047857' }}>
                            {r.receiptNumber}
                          </td>
                          <td style={{ color: '#475569' }}>{r.paymentDate}</td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>{r.studentId}</td>
                          <td style={{ fontWeight: 600 }}>{r.className}</td>
                          <td style={{ color: '#475569' }}>{r.feePeriodName}</td>
                          <td style={{ color: '#475569' }}>{r.feeTypeName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                            {r.amountFormatted}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="report-badge report-badge-neutral">{r.paymentMode}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 4. Fee Dues & Defaulters */}
                {reportType === 'fee_dues' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '110px' }}>Student ID</th>
                        <th>Student Name</th>
                        <th>Father Name</th>
                        <th>Class & Section</th>
                        <th>Fee Period</th>
                        <th>Fee Type</th>
                        <th style={{ width: '85px' }}>Due Date</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Net Billed</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Paid</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeDuesRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.studentId}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ color: '#475569' }}>{r.fatherName || '—'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {r.className} ({r.sectionName})
                          </td>
                          <td style={{ color: '#475569' }}>{r.feePeriodName}</td>
                          <td style={{ color: '#475569' }}>{r.feeTypeName}</td>
                          <td style={{ color: '#64748b' }}>{r.dueDate}</td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>{r.netAmountFormatted}</td>
                          <td style={{ textAlign: 'right', color: '#047857', fontWeight: 600 }}>
                            {r.paidAmountFormatted}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#b91c1c' }}>
                            {r.remainingBalanceFormatted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 5. Examination Marks Sheet */}
                {reportType === 'exam_marks' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '110px' }}>Student ID</th>
                        <th>Student Name</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Roll #</th>
                        <th>Subject Title</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Max Marks</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>Pass Marks</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Obtained</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Grade</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examMarksRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.studentId}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                            {r.rollNumber || '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{r.subjectName}</td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>{r.maxMarks}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{r.passingMarks}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {r.obtainedMarks !== null ? (
                              r.obtainedMarks
                            ) : (
                              <span style={{ color: '#b45309', fontWeight: 800 }}>ABSENT</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f2942' }}>
                            {r.grade || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`report-badge ${
                                r.isPass ? 'report-badge-pass' : 'report-badge-fail'
                              }`}
                            >
                              {r.isPass ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 6. Class Result & Merit List */}
                {reportType === 'class_results' && classResultsData && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '65px', textAlign: 'center' }}>Position</th>
                        <th style={{ width: '110px' }}>Student ID</th>
                        <th>Student Name</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Roll #</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Total Max</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Obtained</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Percentage</th>
                        <th style={{ width: '65px', textAlign: 'center' }}>Grade</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classResultsData.studentResults.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center' }}>
                            {r.position === 1 ? (
                              <span className="report-pos-badge report-pos-1">🥇 1st</span>
                            ) : r.position === 2 ? (
                              <span className="report-pos-badge report-pos-2">🥈 2nd</span>
                            ) : r.position === 3 ? (
                              <span className="report-pos-badge report-pos-3">🥉 3rd</span>
                            ) : r.position ? (
                              <span style={{ fontWeight: 700, color: '#475569' }}>#{r.position}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.systemStudentId}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                            {r.rollNumber || '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>{r.totalMaxMarks}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {r.totalObtainedMarks}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f2942' }}>
                            {r.percentage}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 900, color: '#0f2942' }}>
                            {r.grade}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`report-badge ${
                                r.isPassed ? 'report-badge-pass' : 'report-badge-fail'
                              }`}
                            >
                              {r.isPassed ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 7. Class Strength Demographics */}
                {reportType === 'class_strength' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th>Class Name</th>
                        <th>Section</th>
                        <th style={{ width: '75px', textAlign: 'center', color: '#60a5fa' }}>Male</th>
                        <th style={{ width: '75px', textAlign: 'center', color: '#f472b6' }}>Female</th>
                        <th style={{ width: '75px', textAlign: 'center', color: '#cbd5e1' }}>Other</th>
                        <th style={{ width: '85px', textAlign: 'center', color: '#34d399' }}>Active</th>
                        <th style={{ width: '85px', textAlign: 'center', color: '#94a3b8' }}>Inactive</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Total Enrolled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStrengthRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontWeight: 800, color: '#0f172a' }}>{r.className}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{r.sectionName}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#1d4ed8' }}>
                            {r.maleCount}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#be185d' }}>
                            {r.femaleCount}
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{r.otherCount}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>
                            {r.activeCount}
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{r.inactiveCount}</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f2942', fontSize: '13px' }}>
                            {r.totalCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 8. Faculty Directory */}
                {reportType === 'teacher_directory' && (
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '100px' }}>Faculty ID</th>
                        <th style={{ width: '90px' }}>Emp #</th>
                        <th>Faculty Full Name</th>
                        <th>Designation</th>
                        <th>Qualification</th>
                        <th>Specialization</th>
                        <th style={{ width: '90px' }}>Joining Date</th>
                        <th style={{ width: '100px' }}>Phone</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f2942' }}>
                            {r.teacherId}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>
                            {r.employeeId || '—'}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</td>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{r.designation}</td>
                          <td style={{ color: '#475569' }}>{r.qualification || '—'}</td>
                          <td style={{ color: '#475569' }}>{r.specialization || '—'}</td>
                          <td style={{ color: '#64748b' }}>{r.joiningDate || '—'}</td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>{r.phone || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="report-badge report-badge-active">
                              {r.employmentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Official Sign-off Block */}
            <div className="report-doc-signoff">
              <div className="report-doc-sig-block">
                <div className="report-doc-sig-line" />
                <div className="report-doc-sig-title">Prepared By</div>
                <div className="report-doc-sig-sub">Academic In-Charge</div>
              </div>

              <div className="report-doc-sig-block">
                <div className="report-doc-sig-line" />
                <div className="report-doc-sig-title">Verified By</div>
                <div className="report-doc-sig-sub">Controller of Examinations</div>
              </div>

              <div className="report-doc-sig-block">
                <div className="report-doc-sig-line" />
                <div className="report-doc-sig-title">
                  {metadata?.school.principalName || 'Principal'}
                </div>
                <div className="report-doc-sig-sub">Head of Institution / Official Seal</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
