import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Edit3,
  CheckCircle2,
  AlertCircle,
  Save,
  BookOpen,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Lock,
  RotateCcw,
  AlertTriangle,
  FolderPlus,
  Check,
  CheckCheck,
  Layers,
  Sliders,
  Award,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  ExaminationItem,
  ExaminationSubjectItem,
  StudentMarksEntryItem,
  GradingRuleItem,
  MarkStatus,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

interface EnterMarksTabProps {
  sessions: AcademicSession[];
  examinations: ExaminationItem[];
  classes: ClassItem[];
  gradingRules?: GradingRuleItem[];
  defaultExamId?: number;
  defaultClassId?: number;
  defaultSectionId?: number;
  onNavigateToResults: (examId: number, classId: number, sectionId?: number) => void;
  onNavigateToExaminations?: () => void;
}

export const EnterMarksTab: React.FC<EnterMarksTabProps> = ({
  sessions,
  examinations,
  classes,
  gradingRules: propGradingRules,
  defaultExamId,
  defaultClassId,
  defaultSectionId,
  onNavigateToResults,
  onNavigateToExaminations,
}) => {
  const { sessionToken } = useAuth();

  // ─── 1. Core Selection States ───
  // Academic Session (defaults to current exam's session or first active session)
  const [selectedSessionId, setSelectedSessionId] = useState<number>(() => {
    if (defaultExamId) {
      const match = examinations.find((e) => e.id === defaultExamId);
      if (match?.academicSessionId) return match.academicSessionId;
    }
    const active = sessions.find((s) => s.isActive);
    return active?.id || sessions[0]?.id || 0;
  });

  // Filter exams by selected session
  const sessionExams = useMemo(() => {
    if (!selectedSessionId) return examinations;
    return examinations.filter((e) => e.academicSessionId === selectedSessionId);
  }, [examinations, selectedSessionId]);

  // Selected Examination
  const [selectedExamId, setSelectedExamId] = useState<number>(() => {
    if (defaultExamId && examinations.some((e) => e.id === defaultExamId)) {
      return defaultExamId;
    }
    return sessionExams[0]?.id || examinations[0]?.id || 0;
  });

  const currentExam = useMemo(() => {
    return examinations.find((e) => e.id === selectedExamId);
  }, [examinations, selectedExamId]);

  // Participating classes for the selected examination
  const [participatingClasses, setParticipatingClasses] = useState<ClassItem[]>([]);

  // Selected Class & Section
  const [selectedClassId, setSelectedClassId] = useState<number>(() => defaultClassId || 0);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(() => defaultSectionId || 0);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Selected Subject & Configuration
  const [classSubjects, setClassSubjects] = useState<ExaminationSubjectItem[]>([]);
  const [selectedExamSubId, setSelectedExamSubId] = useState<number>(0);
  const [currentExamSubject, setCurrentExamSubject] = useState<ExaminationSubjectItem | null>(null);

  // Informative Reason if no subjects are available for the class
  const [noSubjectsReason, setNoSubjectsReason] = useState<
    'no_exam_subjects' | 'no_curriculum_subjects' | null
  >(null);

  // ─── 2. Students & Marks State ───
  const [students, setStudents] = useState<StudentMarksEntryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessTick, setSaveSuccessTick] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Configure Subject Total Marks Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configMaxMarks, setConfigMaxMarks] = useState<number | string>(100);
  const [configPassingMarks, setConfigPassingMarks] = useState<number | string>(40);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configModalError, setConfigModalError] = useState<string | null>(null);

  // Grading rules
  const [gradingRulesList, setGradingRulesList] = useState<GradingRuleItem[]>(
    propGradingRules || []
  );

  // Ref to track input DOM elements for keyboard navigation
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // ─── 3. Sync defaultExamId Prop ───
  useEffect(() => {
    if (defaultExamId && defaultExamId !== selectedExamId) {
      const targetExam = examinations.find((e) => e.id === defaultExamId);
      if (targetExam) {
        if (targetExam.academicSessionId !== selectedSessionId) {
          setSelectedSessionId(targetExam.academicSessionId);
        }
        setSelectedExamId(defaultExamId);
      }
    }
  }, [defaultExamId]);

  // Load grading rules if not provided via props
  useEffect(() => {
    if (!propGradingRules || propGradingRules.length === 0) {
      const fetchRules = async () => {
        if (window.electronAPI) {
          try {
            const res = await window.electronAPI.exams.getGradingRules();
            if (res.success && res.rules) {
              setGradingRulesList(res.rules);
            }
          } catch (err) {
            console.warn('[EnterMarks] Could not load grading rules:', err);
          }
        }
      };
      fetchRules();
    } else {
      setGradingRulesList(propGradingRules);
    }
  }, [propGradingRules]);

  // ─── 4. Fetch Participating Classes & Subjects when Examination Changes ───
  useEffect(() => {
    const resolveExamClassesAndSubjects = async () => {
      if (!selectedExamId || !window.electronAPI) {
        setParticipatingClasses([]);
        setClassSubjects([]);
        setSelectedClassId(0);
        setSelectedExamSubId(0);
        return;
      }

      setIsLoadingSubjects(true);
      try {
        const res = await window.electronAPI.exams.getSubjects({
          examinationId: selectedExamId,
        });

        const activeClasses = classes.filter((c) => c.isActive !== false);
        setParticipatingClasses(activeClasses.length > 0 ? activeClasses : classes);

        if (res.success && res.subjects && res.subjects.length > 0) {
          const classIdSet = new Set(res.subjects.map((s) => s.classId));
          const matchedClasses = classes.filter((c) => classIdSet.has(c.id));

          // Auto-select class:
          // Keep current if still valid, else pick defaultClassId, else first participating, else first active
          setSelectedClassId((prevClassId) => {
            if (prevClassId && classes.some((c) => c.id === prevClassId)) {
              return prevClassId;
            }
            if (defaultClassId && classes.some((c) => c.id === defaultClassId)) {
              return defaultClassId;
            }
            return matchedClasses[0]?.id || activeClasses[0]?.id || classes[0]?.id || 0;
          });
        } else {
          // No subjects configured for this examination yet
          if (!selectedClassId && classes.length > 0) {
            setSelectedClassId(defaultClassId || activeClasses[0]?.id || classes[0]?.id || 0);
          }
        }
      } catch (err) {
        console.error('[EnterMarks] Failed to load exam subjects:', err);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    resolveExamClassesAndSubjects();
  }, [selectedExamId, classes]);

  // ─── 5. Resolve Subjects when Selected Class Changes ───
  useEffect(() => {
    const resolveClassSubjectsAndSections = async () => {
      if (!selectedClassId || !window.electronAPI) {
        setSections([]);
        setClassSubjects([]);
        setSelectedExamSubId(0);
        setCurrentExamSubject(null);
        setNoSubjectsReason(null);
        return;
      }

      // 1. Fetch valid sections for this class
      try {
        const secRes = await window.electronAPI.sections.getByClassId(selectedClassId);
        if (secRes.success && secRes.sections) {
          setSections(secRes.sections);
          // If previous sectionId not in this class's sections, reset to 0 (All Sections)
          setSelectedSectionId((prevSec) => {
            if (prevSec !== 0 && !secRes.sections.some((s) => s.id === prevSec)) {
              return 0;
            }
            return prevSec;
          });
        }
      } catch (err) {
        console.error('[EnterMarks] Failed to load sections:', err);
      }

      // 2. Fetch examination subjects and curriculum subjects for this class
      if (!selectedExamId) return;

      try {
        // Fetch subjects legitimately assigned to this class in the academic curriculum
        let assignedCurriculumSubjects: any[] = [];
        try {
          const currRes = await window.electronAPI.classSubjects.getByClassId(selectedClassId);
          if (currRes.success && currRes.classSubjects) {
            assignedCurriculumSubjects = currRes.classSubjects.filter((cs) => cs.isActive !== false);
          }
        } catch (currErr) {
          console.warn('[EnterMarks] Error fetching curriculum subjects:', currErr);
        }

        // If no subjects are configured for this class in curriculum:
        if (assignedCurriculumSubjects.length === 0) {
          setClassSubjects([]);
          setSelectedExamSubId(0);
          setCurrentExamSubject(null);
          setNoSubjectsReason('no_curriculum_subjects');
          return;
        }

        // Fetch examination subjects configured for this class in this exam
        const subRes = await window.electronAPI.exams.getSubjects({
          examinationId: selectedExamId,
          classId: selectedClassId,
        });

        let finalSubjects: ExaminationSubjectItem[] = (subRes.success && subRes.subjects) ? subRes.subjects : [];

        // Check if any curriculum subjects are still missing from finalSubjects
        const existingSubjectIds = new Set(finalSubjects.map((s) => s.subjectId));
        const missingAssigned = assignedCurriculumSubjects.filter((cs) => !existingSubjectIds.has(cs.subjectId));

        if (missingAssigned.length > 0 && currentExam?.status !== 'Closed') {
          try {
            const subjectsToConfigure = [
              ...finalSubjects.map((s, idx) => ({
                subjectId: s.subjectId,
                maxMarks: s.maxMarks || 100,
                passingMarks: s.passingMarks || 40,
                displayOrder: s.displayOrder || idx + 1,
                examDate: s.examDate,
                startTime: s.startTime,
                durationMinutes: s.durationMinutes,
              })),
              ...missingAssigned.map((cs, idx) => ({
                subjectId: cs.subjectId,
                maxMarks: 100,
                passingMarks: 40,
                displayOrder: cs.displayOrder || finalSubjects.length + idx + 1,
              })),
            ];

            const syncRes = await window.electronAPI.exams.configureSubjects({
              sessionToken: sessionToken || '',
              examinationId: selectedExamId,
              classId: selectedClassId,
              subjects: subjectsToConfigure,
            });

            if (syncRes.success && syncRes.subjects && syncRes.subjects.length > 0) {
              finalSubjects = syncRes.subjects;
            }
          } catch (syncErr) {
            console.warn('[EnterMarks] Auto-configure subjects error:', syncErr);
          }
        }

        if (finalSubjects.length > 0) {
          setClassSubjects(finalSubjects);
          setNoSubjectsReason(null);
          // Keep current selected subject if it belongs to this class, else select first
          setSelectedExamSubId((prevSubId) => {
            const exists = finalSubjects.some((s) => s.id === prevSubId);
            return exists ? prevSubId : finalSubjects[0].id;
          });
        } else {
          setClassSubjects([]);
          setSelectedExamSubId(0);
          setCurrentExamSubject(null);
          setNoSubjectsReason('no_exam_subjects');
        }
      } catch (err) {
        console.error('[EnterMarks] Error fetching subjects for class:', err);
        setClassSubjects([]);
        setSelectedExamSubId(0);
      }
    };

    resolveClassSubjectsAndSections();
  }, [selectedExamId, selectedClassId]);

  // Keep currentExamSubject synced
  useEffect(() => {
    if (selectedExamSubId && classSubjects.length > 0) {
      const match = classSubjects.find((s) => s.id === selectedExamSubId);
      setCurrentExamSubject(match || null);
    } else {
      setCurrentExamSubject(null);
    }
  }, [selectedExamSubId, classSubjects]);

  // ─── 6. Fetch Students for Marks Entry ───
  const fetchStudents = async () => {
    if (!selectedExamId || !selectedClassId || !selectedExamSubId || !window.electronAPI) {
      setStudents([]);
      return;
    }

    setIsLoadingStudents(true);
    setLoadError(null);
    setNotification(null);
    try {
      const res = await window.electronAPI.exams.getStudentsForMarksEntry({
        examinationId: selectedExamId,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
        examinationSubjectId: selectedExamSubId,
      });

      if (res.success && res.students) {
        setStudents(res.students);
        if (res.examinationSubject) {
          setCurrentExamSubject(res.examinationSubject);
        }
        setIsDirty(false);
      } else {
        setLoadError(res.error || 'Failed to load students for marks entry.');
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Error fetching students.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedExamId, selectedClassId, selectedSectionId, selectedExamSubId]);

  // ─── 7. Safe Selection Changes with Unsaved Marks Protection ───
  const handleSessionChange = (newSessionId: number) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved marks! Switching academic session will discard unsaved changes. Proceed?')) {
        return;
      }
    }
    setSelectedSessionId(newSessionId);
    const matchingExams = examinations.filter((e) => e.academicSessionId === newSessionId);
    if (matchingExams.length > 0) {
      setSelectedExamId(matchingExams[0].id);
    } else {
      setSelectedExamId(0);
    }
    setIsDirty(false);
  };

  const handleExamChange = (newExamId: number) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved marks! Switching examination will discard unsaved changes. Proceed?')) {
        return;
      }
    }
    setSelectedExamId(newExamId);
    setIsDirty(false);
  };

  const handleClassChange = (newClassId: number) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved marks! Switching class will discard unsaved changes. Proceed?')) {
        return;
      }
    }
    setSelectedClassId(newClassId);
    setIsDirty(false);
  };

  const handleSectionChange = (newSectionId: number) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved marks! Switching section will discard unsaved changes. Proceed?')) {
        return;
      }
    }
    setSelectedSectionId(newSectionId);
    setIsDirty(false);
  };

  const handleSubjectChange = (newSubjectId: number) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved marks! Switching subject will discard unsaved changes. Proceed?')) {
        return;
      }
    }
    setSelectedExamSubId(newSubjectId);
    setIsDirty(false);
  };

  // ─── 8. Marks Manipulation Handlers ───
  const maxMarks = currentExamSubject?.maxMarks || 100;
  const passingMarks = currentExamSubject?.passingMarks || 40;

  const handleMarkChange = (studentId: number, rawVal: string) => {
    setIsDirty(true);
    let numVal: number | null = null;
    if (rawVal.trim() !== '') {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    }

    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          obtainedMarks: numVal,
          status: 'Entered' as MarkStatus,
        };
      })
    );
  };

  const handleRemarksChange = (studentId: number, remarks: string) => {
    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  const handleAttendanceToggle = (studentId: number, nextStatus: MarkStatus) => {
    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          status: nextStatus,
          obtainedMarks: nextStatus === 'Absent' ? null : s.obtainedMarks,
        };
      })
    );
  };

  const handleMarkAllPresent = () => {
    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        status: 'Entered',
      }))
    );
  };

  // Keyboard navigation between mark inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = inputRefs.current.get(currentIndex + 1);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = inputRefs.current.get(currentIndex - 1);
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  };

  // ─── 8b. Configure Subject Marks Handlers ───
  const handleOpenConfigureMarksModal = () => {
    if (!currentExamSubject) return;
    setConfigMaxMarks(currentExamSubject.maxMarks || 100);
    setConfigPassingMarks(currentExamSubject.passingMarks || 40);
    setConfigModalError(null);
    setIsConfigModalOpen(true);
  };

  const handlePresetClick = (preset: number) => {
    setConfigMaxMarks(preset);
    // Standard 40% passing threshold rounded
    setConfigPassingMarks(Math.round(preset * 0.4));
    setConfigModalError(null);
  };

  const handleSaveConfiguredMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamSubId || !window.electronAPI) return;

    const max = Number(configMaxMarks);
    const pass = Number(configPassingMarks);

    if (isNaN(max) || max <= 0) {
      setConfigModalError('Total Marks / Maximum Marks must be greater than zero.');
      return;
    }
    if (isNaN(pass) || pass < 0 || pass > max) {
      setConfigModalError(`Passing marks must be between 0 and maximum marks (${max}).`);
      return;
    }

    setIsSavingConfig(true);
    setConfigModalError(null);
    try {
      const res = await window.electronAPI.exams.updateSubjectMarks({
        sessionToken: sessionToken || '',
        examinationSubjectId: selectedExamSubId,
        maxMarks: max,
        passingMarks: pass,
      });

      if (res.success && res.examinationSubject) {
        const updated = res.examinationSubject;
        setCurrentExamSubject(updated);
        setClassSubjects((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setIsConfigModalOpen(false);
        setNotification({
          type: 'success',
          message: `Subject "${updated.subjectName}" Total Marks successfully updated to ${max} (Passing Marks: ${pass}).`,
        });
      } else {
        setConfigModalError(res.error || 'Failed to update subject maximum marks.');
      }
    } catch (err: unknown) {
      setConfigModalError(err instanceof Error ? err.message : 'Error updating marks configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ─── 9. Save Marks Workflow ───
  const handleSaveMarks = async () => {
    if (!selectedExamSubId || !window.electronAPI) return;

    if (currentExam?.status === 'Closed') {
      setNotification({
        type: 'error',
        message: 'This examination is Closed. Please reopen it from Examinations to enter or edit marks.',
      });
      return;
    }

    // Validation check: ensure no entered marks exceed maxMarks or are negative
    const invalidStudent = students.find(
      (s) =>
        s.status !== 'Absent' &&
        s.obtainedMarks !== null &&
        (s.obtainedMarks < 0 || s.obtainedMarks > maxMarks)
    );

    if (invalidStudent) {
      setNotification({
        type: 'error',
        message: `Validation Error for ${invalidStudent.displayName}: Marks (${invalidStudent.obtainedMarks}) cannot exceed maximum marks (${maxMarks}) or be negative.`,
      });
      return;
    }

    // Filter to save only students who have entered marks or are marked absent
    const marksToSave = students.filter(
      (s) => s.status === 'Absent' || (s.status === 'Entered' && s.obtainedMarks !== null)
    );

    if (marksToSave.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No student marks have been entered yet. Enter marks or mark attendance for at least one student before saving.',
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);
    try {
      const res = await window.electronAPI.exams.saveMarks({
        sessionToken: sessionToken || '',
        examinationId: selectedExamId,
        examinationSubjectId: selectedExamSubId,
        marks: marksToSave.map((s) => ({
          studentId: s.studentId,
          enrollmentId: s.enrollmentId,
          obtainedMarks: s.status === 'Absent' ? null : s.obtainedMarks,
          status: s.status,
          remarks: s.remarks || '',
        })),
      });

      if (res.success) {
        setIsDirty(false);
        setSaveSuccessTick(true);
        setTimeout(() => setSaveSuccessTick(false), 2500);
        setNotification({
          type: 'success',
          message: `Marks successfully saved for ${res.savedCount ?? marksToSave.length} student(s).`,
        });
        // Re-fetch to confirm stored IDs & clean state
        fetchStudents();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to save examination marks.',
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error occurred while saving marks.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── 10. Grade Evaluation Helper ───
  const getGradeForPercentage = (pct: number | null): { grade: string; colorClass: string } => {
    if (pct === null) return { grade: '—', colorClass: '' };
    if (!gradingRulesList || gradingRulesList.length === 0) {
      return { grade: '—', colorClass: '' };
    }
    const rounded = Math.round(pct * 100) / 100;
    for (const r of gradingRulesList) {
      if (rounded >= r.minPercentage && rounded <= r.maxPercentage) {
        const g = r.grade.toUpperCase();
        let cls = 'grade-b';
        if (g.startsWith('A')) cls = 'grade-a';
        else if (g.startsWith('C') || g.startsWith('D')) cls = 'grade-c';
        else if (g.startsWith('F')) cls = 'grade-f';
        return { grade: r.grade, colorClass: cls };
      }
    }
    return { grade: 'F', colorClass: 'grade-f' };
  };

  // ─── 11. Filtered Students by Search ───
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((s) => {
      const matchName = s.displayName && s.displayName.toLowerCase().includes(q);
      const matchId = s.systemStudentId && s.systemStudentId.toLowerCase().includes(q);
      const matchAdm = s.admissionNumber && s.admissionNumber.toLowerCase().includes(q);
      const matchFather = s.fatherName && s.fatherName.toLowerCase().includes(q);
      const matchRoll = s.rollNumber && s.rollNumber.toLowerCase().includes(q);
      return matchName || matchId || matchAdm || matchFather || matchRoll;
    });
  }, [students, searchQuery]);

  // ─── 12. Dynamic Calculations for Marks Summary ───
  const totalStudentsCount = students.length;
  const enteredCount = students.filter(
    (s) => s.status === 'Entered' && s.obtainedMarks !== null
  ).length;
  const absentCount = students.filter((s) => s.status === 'Absent').length;
  const pendingCount = totalStudentsCount - enteredCount - absentCount;
  const passingCount = students.filter(
    (s) => s.status === 'Entered' && s.obtainedMarks !== null && s.obtainedMarks >= passingMarks
  ).length;

  const currentSubIndex = classSubjects.findIndex((s) => s.id === selectedExamSubId);
  const currentClassObj = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-5" style={{ paddingBottom: '30px' }}>
      {/* ─── SECTION 2: Page Header ─── */}
      <div className="enter-marks-header">
        <div className="enter-marks-header-left">
          <div className="enter-marks-header-icon">
            <Edit3 size={22} />
          </div>
          <div>
            <h1 className="enter-marks-header-title">Enter Student Marks</h1>
            <p className="enter-marks-header-desc">
              Select an examination, class, section, and subject to enter and save student marks.
            </p>
          </div>
        </div>

        {currentExam && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Exam Status:
            </span>
            {currentExam.status === 'Open' ? (
              <span className="results-status-badge results-status-open">
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>Marks Entry Open</span>
              </span>
            ) : currentExam.status === 'Draft' ? (
              <span className="results-status-badge results-status-draft">
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>Draft / Upcoming</span>
              </span>
            ) : (
              <span className="results-status-badge results-status-closed">
                <Lock size={12} style={{ flexShrink: 0 }} />
                <span>Marks Entry Closed</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: Examination & Class Selection Panel ─── */}
      <div className="enter-marks-selection-card">
        <div className="selection-card-header">
          <h2 className="selection-card-title">Examination &amp; Class Selection</h2>
          <p className="selection-card-desc">
            Choose the examination and class to load the correct students and subjects.
          </p>
        </div>

        <div className="selection-grid">
          {/* Field 1: Academic Session */}
          <div className="selection-field-group">
            <label className="selection-field-label">
              <span>Academic Session</span>
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => handleSessionChange(Number(e.target.value))}
              className="selection-select"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Field 2: Examination */}
          <div className="selection-field-group">
            <label className="selection-field-label">
              <span>Examination</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => handleExamChange(Number(e.target.value))}
              className="selection-select"
            >
              {sessionExams.length > 0 ? (
                sessionExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {ex.status === 'Closed' ? '(Closed)' : ''}
                  </option>
                ))
              ) : (
                <option value={0}>No examinations in session</option>
              )}
            </select>
          </div>

          {/* Field 3: Class (Loads participating classes for this examination) */}
          <div className="selection-field-group">
            <label className="selection-field-label">
              <span>Class</span>
              {participatingClasses.length > 0 && (
                <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                  {participatingClasses.length} Exam Class{participatingClasses.length > 1 ? 'es' : ''}
                </span>
              )}
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(Number(e.target.value))}
              className="selection-select"
            >
              {participatingClasses.length > 0 ? (
                participatingClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : classes.length > 0 ? (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value={0}>No classes available</option>
              )}
            </select>
          </div>

          {/* Field 4: Section */}
          <div className="selection-field-group">
            <label className="selection-field-label">
              <span>Section</span>
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => handleSectionChange(Number(e.target.value))}
              className="selection-select"
              disabled={sections.length === 0}
            >
              <option value={0}>All Sections</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Field 5: Subject */}
          <div className="selection-field-group">
            <label className="selection-field-label">
              <span>Subject</span>
            </label>
            <select
              value={selectedExamSubId}
              onChange={(e) => handleSubjectChange(Number(e.target.value))}
              className="selection-select"
              disabled={classSubjects.length === 0}
            >
              {classSubjects.length > 0 ? (
                classSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subjectName} — Total Marks: {sub.maxMarks}
                  </option>
                ))
              ) : (
                <option value={0}>
                  {isLoadingSubjects ? 'Loading subjects...' : 'No subjects available'}
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Fast Subject Switcher Carousel (When subjects are configured) ─── */}
      {classSubjects.length > 0 && (
        <div className="subject-carousel-card">
          <div className="subject-carousel-list">
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginRight: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <BookOpen size={14} color="#2563eb" />
              Subjects ({classSubjects.length}):
            </span>
            {classSubjects.map((sub) => {
              const isCurrent = sub.id === selectedExamSubId;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSubjectChange(sub.id)}
                  className={`subject-pill-btn ${isCurrent ? 'active' : 'inactive'}`}
                >
                  <span>{sub.subjectName}</span>
                  <span className="subject-pill-badge">{sub.maxMarks}m</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Controls: Prev / Next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                if (currentSubIndex > 0) {
                  handleSubjectChange(classSubjects[currentSubIndex - 1].id);
                }
              }}
              disabled={currentSubIndex <= 0}
              className="exam-pagination-btn"
              title="Previous subject"
            >
              <ChevronLeft size={13} />
              <span>Prev</span>
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              {currentSubIndex + 1} of {classSubjects.length}
            </span>
            <button
              type="button"
              onClick={() => {
                if (currentSubIndex < classSubjects.length - 1) {
                  handleSubjectChange(classSubjects[currentSubIndex + 1].id);
                }
              }}
              disabled={currentSubIndex >= classSubjects.length - 1}
              className="exam-pagination-btn"
              title="Next subject"
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Notification Alert Banner ─── */}
      {notification && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
            background:
              notification.type === 'success'
                ? '#ecfdf5'
                : notification.type === 'warning'
                ? '#fffbeb'
                : '#fef2f2',
            borderColor:
              notification.type === 'success'
                ? '#a7f3d0'
                : notification.type === 'warning'
                ? '#fde68a'
                : '#fecaca',
            color:
              notification.type === 'success'
                ? '#065f46'
                : notification.type === 'warning'
                ? '#92400e'
                : '#991b1b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
            ) : notification.type === 'warning' ? (
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontWeight: 600 }}>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '2px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── Closed Exam Warning Notice ─── */}
      {currentExam?.status === 'Closed' && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            color: '#334155',
          }}
        >
          <Lock size={16} color="#64748b" style={{ flexShrink: 0 }} />
          <div>
            <strong>Examination Marks Locked:</strong> This examination is currently Closed.
            Marks entry and edits are read-only. To make changes, reopen the examination in the{' '}
            <button
              type="button"
              onClick={onNavigateToExaminations}
              style={{
                color: '#2563eb',
                fontWeight: 700,
                textDecoration: 'underline',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Examinations tab
            </button>
            .
          </div>
        </div>
      )}

      {/* ─── SECTION 4: Handle "No Subjects Configured" Issue Gracefully ─── */}
      {noSubjectsReason ? (
        <div className="exam-empty-card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div className="exam-empty-icon-wrap" style={{ background: '#fef3c7', color: '#b45309' }}>
            <BookOpen size={26} />
          </div>
          <h3 className="exam-empty-title">
            {noSubjectsReason === 'no_curriculum_subjects'
              ? 'No subjects are configured for this class'
              : 'Subjects not configured for this examination'}
          </h3>
          <p className="exam-empty-desc">
            {noSubjectsReason === 'no_curriculum_subjects'
              ? `Class "${currentClassObj?.name || 'Selected Class'}" does not currently have subjects assigned in the academic curriculum. Please assign subjects in the Classes & Subjects module before recording examination marks.`
              : `Subjects have not yet been assigned to "${currentClassObj?.name || 'Selected Class'}" for "${currentExam?.name || 'this examination'}". Please configure the subjects and max marks in the Examinations tab.`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {noSubjectsReason === 'no_curriculum_subjects' ? (
              <a
                href="#/classes"
                className="btn-results-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FolderPlus size={15} />
                <span>Open Classes &amp; Subjects</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={onNavigateToExaminations}
                className="btn-results-primary"
                style={{ cursor: 'pointer' }}
              >
                <Layers size={15} />
                <span>Configure in Examinations Tab</span>
              </button>
            )}

            {participatingClasses.length > 0 && participatingClasses[0].id !== selectedClassId && (
              <button
                type="button"
                onClick={() => setSelectedClassId(participatingClasses[0].id)}
                className="btn-results-secondary"
                style={{ cursor: 'pointer' }}
              >
                <span>Switch to {participatingClasses[0].name}</span>
              </button>
            )}
          </div>
        </div>
      ) : !selectedExamSubId ? (
        /* Empty selection state before choices are made */
        <div className="exam-empty-card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div className="exam-empty-icon-wrap">
            <Edit3 size={26} />
          </div>
          <h3 className="exam-empty-title">Select an examination, class, section, and subject to begin</h3>
          <p className="exam-empty-desc">
            Choose an examination and class from the selection panel above to load enrolled students and record marks.
          </p>
        </div>
      ) : (
        <>
          {/* ─── Active Subject Configuration Banner ─── */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Award size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Subject: {currentExamSubject?.subjectName || 'Selected Subject'}
                  </span>
                  <span
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    Total Marks: {maxMarks}
                  </span>
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    Passing: {passingMarks}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Allowed marks: <strong>0 to {maxMarks}</strong>. Percentage, ranking, and DMC are calculated against this subject's configured maximum marks.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleOpenConfigureMarksModal}
                disabled={currentExam?.status === 'Closed'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: currentExam?.status === 'Closed' ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={currentExam?.status === 'Closed' ? 'Examination is closed' : 'Configure Total Marks & Passing Marks for this subject'}
              >
                <Sliders size={14} color="#2563eb" />
                <span>Configure Total Marks</span>
              </button>
            </div>
          </div>

          {/* ─── SECTION 5 & 6: Student Marks Workspace & Table ─── */}
          <div className="marks-workspace-card">
          {/* Toolbar: Search, Counters, and Save Button */}
          <div className="marks-toolbar">
            {/* Search Box */}
            <div className="marks-search-box">
              <Search
                size={15}
                color="#94a3b8"
                style={{ position: 'absolute', left: '11px', top: '12px' }}
              />
              <input
                type="text"
                placeholder="Search by student name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="marks-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '11px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Dynamic Status Counts */}
            <div className="marks-stat-pills">
              <span className="marks-stat-pill total">
                <Users size={12} />
                <span>Total Students: {totalStudentsCount}</span>
              </span>

              <span className="marks-stat-pill entered">
                <Check size={12} />
                <span>Marks Entered: {enteredCount}</span>
              </span>

              {pendingCount > 0 && (
                <span className="marks-stat-pill pending">
                  <span>Pending: {pendingCount}</span>
                </span>
              )}

              {absentCount > 0 && (
                <span className="marks-stat-pill absent">
                  <span>Absent: {absentCount}</span>
                </span>
              )}

              {enteredCount > 0 && (
                <span
                  className="marks-stat-pill"
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                >
                  <span>Passing: {passingCount}</span>
                </span>
              )}
            </div>

            {/* Actions: Mark All Present & Primary Save Marks Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {pendingCount > 0 && currentExam?.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="exam-pagination-btn"
                  title="Set all pending/absent students to Present"
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  <CheckCheck size={13} color="#059669" />
                  <span>Mark All Present</span>
                </button>
              )}

              {isDirty && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#b45309',
                    background: '#fef3c7',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#d97706',
                    }}
                  />
                  Unsaved
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveMarks}
                disabled={isSaving || students.length === 0 || currentExam?.status === 'Closed'}
                className="btn-save-marks"
              >
                {isSaving ? (
                  <>
                    <div
                      style={{
                        width: '13px',
                        height: '13px',
                        border: '2px solid #ffffff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                      }}
                    />
                    <span>Saving...</span>
                  </>
                ) : saveSuccessTick ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Marks Saved</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save Marks</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ─── Student Marks Table or Loading / Empty State ─── */}
          {isLoadingStudents ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #2563eb',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>
                Loading enrolled students...
              </p>
            </div>
          ) : loadError ? (
            <div style={{ padding: '50px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <AlertCircle size={24} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Failed to load students
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '400px', margin: '0 auto 16px' }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={fetchStudents}
                className="btn-results-secondary"
                style={{ cursor: 'pointer' }}
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="marks-table-wrap">
              <table
                style={{
                  width: '100%',
                  minWidth: '1080px',
                  tableLayout: 'fixed',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}
              >
                <colgroup>
                  {/* 1. # */}
                  <col style={{ width: '4%', minWidth: '40px' }} />
                  {/* 2. Student ID */}
                  <col style={{ width: '13%', minWidth: '130px' }} />
                  {/* 3. Student Name */}
                  <col style={{ width: '20%', minWidth: '190px' }} />
                  {/* 4. Father Name */}
                  <col style={{ width: '14%', minWidth: '130px' }} />
                  {/* 5. Attendance Status */}
                  <col style={{ width: '10%', minWidth: '95px' }} />
                  {/* 6. Obtained Marks */}
                  <col style={{ width: '14%', minWidth: '135px' }} />
                  {/* 7. Maximum Marks */}
                  <col style={{ width: '6%', minWidth: '60px' }} />
                  {/* 8. Percentage */}
                  <col style={{ width: '8%', minWidth: '75px' }} />
                  {/* 9. Grade */}
                  <col style={{ width: '6%', minWidth: '55px' }} />
                  {/* 10. Status */}
                  <col style={{ width: '9%', minWidth: '85px' }} />
                  {/* 11. Remarks */}
                  <col style={{ width: '12%', minWidth: '120px' }} />
                </colgroup>

                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>#</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Father Name</th>
                    <th style={{ textAlign: 'center' }}>Attendance</th>
                    <th style={{ textAlign: 'center' }}>Obtained Marks (0 – {maxMarks})</th>
                    <th style={{ textAlign: 'center' }}>Max ({maxMarks})</th>
                    <th style={{ textAlign: 'center' }}>Percentage</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const isAbsent = student.status === 'Absent';
                    const obtained = student.obtainedMarks;
                    const isExceeded =
                      obtained !== null && (obtained < 0 || obtained > maxMarks);
                    const pct =
                      isAbsent || obtained === null
                        ? null
                        : Math.round(((obtained / maxMarks) * 100) * 10) / 10;
                    const isPass = !isAbsent && obtained !== null && obtained >= passingMarks;
                    const { grade, colorClass } = getGradeForPercentage(pct);

                    return (
                      <tr
                        key={student.studentId}
                        className={`marks-table-row ${
                          isAbsent ? 'absent' : isExceeded ? 'exceeded' : ''
                        }`}
                      >
                        {/* 1. # */}
                        <td
                          style={{
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#94a3b8',
                            fontFamily: 'monospace',
                            padding: '12px 6px',
                            verticalAlign: 'middle',
                          }}
                        >
                          {idx + 1}
                        </td>

                        {/* 2. Student ID */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0f172a',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '6px',
                            }}
                          >
                            {student.systemStudentId}
                          </span>
                        </td>

                        {/* 3. Student Name */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: '#0f172a',
                              fontSize: '13px',
                              lineHeight: '1.3',
                            }}
                          >
                            {student.displayName}
                          </div>
                          {student.admissionNumber && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#64748b',
                                marginTop: '2px',
                              }}
                            >
                              Adm: {student.admissionNumber}
                              {student.rollNumber ? ` • Roll: ${student.rollNumber}` : ''}
                            </div>
                          )}
                        </td>

                        {/* 4. Father Name */}
                        <td
                          style={{
                            padding: '12px 10px',
                            fontSize: '12px',
                            color: '#334155',
                            verticalAlign: 'middle',
                          }}
                        >
                          {student.fatherName || '—'}
                        </td>

                        {/* 5. Attendance Toggle */}
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleAttendanceToggle(
                                student.studentId,
                                isAbsent ? 'Entered' : 'Absent'
                              )
                            }
                            disabled={currentExam?.status === 'Closed'}
                            className={`btn-attendance-toggle ${isAbsent ? 'absent' : 'present'}`}
                            title={isAbsent ? 'Click to mark Present' : 'Click to mark Absent'}
                          >
                            {isAbsent ? 'Absent' : 'Present'}
                          </button>
                        </td>

                        {/* 6. Obtained Marks Input */}
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <input
                              type="number"
                              min={0}
                              max={maxMarks}
                              step="0.5"
                              ref={(el) => {
                                if (el) inputRefs.current.set(idx, el);
                                else inputRefs.current.delete(idx);
                              }}
                              disabled={isAbsent || currentExam?.status === 'Closed'}
                              value={isAbsent ? '' : obtained ?? ''}
                              placeholder={isAbsent ? 'ABS' : '0'}
                              onKeyDown={(e) => handleKeyDown(e, idx)}
                              onChange={(e) =>
                                handleMarkChange(student.studentId, e.target.value)
                              }
                              className={`marks-input-box ${isExceeded ? 'invalid' : ''}`}
                            />
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                fontWeight: 600,
                              }}
                            >
                              / {maxMarks}
                            </span>
                          </div>
                          {isExceeded && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: '#dc2626',
                                fontWeight: 700,
                                marginTop: '3px',
                              }}
                            >
                              {obtained !== null && obtained < 0 ? 'Cannot be negative' : `Max is ${maxMarks}`}
                            </div>
                          )}
                        </td>

                        {/* 7. Maximum Marks */}
                        <td
                          style={{
                            padding: '12px 6px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#64748b',
                            verticalAlign: 'middle',
                          }}
                        >
                          {maxMarks}
                        </td>

                        {/* 8. Percentage */}
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#1e293b',
                            verticalAlign: 'middle',
                          }}
                        >
                          {pct !== null ? `${pct}%` : '—'}
                        </td>

                        {/* 9. Grade */}
                        <td
                          style={{
                            padding: '12px 6px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {grade !== '—' ? (
                            <span className={`badge-grade ${colorClass}`}>{grade}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                          )}
                        </td>

                        {/* 10. Status Badge */}
                        <td
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {isAbsent ? (
                            <span className="badge-result-abs">ABSENT</span>
                          ) : obtained !== null ? (
                            isPass ? (
                              <span className="badge-result-pass">PASS</span>
                            ) : (
                              <span className="badge-result-fail">FAIL</span>
                            )
                          ) : (
                            <span className="badge-result-pending">PENDING</span>
                          )}
                        </td>

                        {/* 11. Remarks */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Optional remarks..."
                            value={student.remarks || ''}
                            disabled={currentExam?.status === 'Closed'}
                            onChange={(e) =>
                              handleRemarksChange(student.studentId, e.target.value)
                            }
                            className="marks-remarks-input"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : searchQuery ? (
            /* Search Query Empty State */
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Search size={20} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                No matching students found
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '380px', margin: '0 auto 16px' }}>
                No students matched "{searchQuery}". Try searching by another name or Student ID.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-results-secondary"
                style={{ cursor: 'pointer' }}
              >
                Clear Search
              </button>
            </div>
          ) : (
            /* SECTION 7: Empty state when no students are enrolled in this class/section */
            <div className="exam-empty-card" style={{ padding: '50px 20px' }}>
              <div className="exam-empty-icon-wrap">
                <Users size={26} />
              </div>
              <h3 className="exam-empty-title">No Students Found</h3>
              <p className="exam-empty-desc">
                No active students match the selected class, section, and academic session.
              </p>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 20px' }}>
                Check student enrollment and academic session assignment in the Students module.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {selectedSectionId !== 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSectionId(0)}
                    className="btn-results-secondary"
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Show All Sections</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchStudents}
                  className="btn-results-primary"
                  style={{ cursor: 'pointer' }}
                >
                  <RotateCcw size={14} />
                  <span>Refresh List</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── Bottom Navigation & Save Action Bar ─── */}
          {students.length > 0 && (
            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  onNavigateToResults(selectedExamId, selectedClassId, selectedSectionId)
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#2563eb',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <span>Done entering marks? View Compiled Class Results</span>
                <ArrowRight size={14} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={isSaving || currentExam?.status === 'Closed'}
                  className="btn-save-marks"
                >
                  {isSaving ? (
                    <>
                      <div
                        style={{
                          width: '13px',
                          height: '13px',
                          border: '2px solid #ffffff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite',
                        }}
                      />
                      <span>Saving Marks...</span>
                    </>
                  ) : saveSuccessTick ? (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Marks Saved</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save Marks</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* ─── Configure Subject Total Marks Modal ─── */}
      {isConfigModalOpen && (
        <div
          className="exam-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingConfig) {
              setIsConfigModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              margin: '20px',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Configure Total Marks
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    {currentExamSubject?.subjectName || 'Subject'} • {currentClassObj?.name || 'Class'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingConfig && setIsConfigModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveConfiguredMarks}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {configModalError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{configModalError}</span>
                  </div>
                )}

                {/* Common Presets */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '8px',
                    }}
                  >
                    Quick Presets (Common Total Marks)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[100, 75, 60, 50].map((preset) => {
                      const isSelected = Number(configMaxMarks) === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handlePresetClick(preset)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            color: isSelected ? '#1d4ed8' : '#334155',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {preset} Marks
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Maximum Marks Input */}
                <div>
                  <label
                    htmlFor="config-max-marks-input"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Total Marks / Maximum Marks <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="config-max-marks-input"
                    type="number"
                    min={1}
                    max={1000}
                    step="any"
                    required
                    value={configMaxMarks}
                    onChange={(e) => {
                      setConfigMaxMarks(e.target.value);
                      setConfigModalError(null);
                    }}
                    placeholder="e.g. 100, 75, 60, 50"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
                    Supports 100, 75, 60, 50, or any valid custom positive number.
                  </p>
                </div>

                {/* Passing Marks Input */}
                <div>
                  <label
                    htmlFor="config-passing-marks-input"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Passing Marks Threshold <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="config-passing-marks-input"
                    type="number"
                    min={0}
                    max={Number(configMaxMarks) || 1000}
                    step="any"
                    required
                    value={configPassingMarks}
                    onChange={(e) => {
                      setConfigPassingMarks(e.target.value);
                      setConfigModalError(null);
                    }}
                    placeholder="e.g. 40, 30, 20"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
                    Students obtaining this value or higher will be marked as PASS.
                  </p>
                </div>

                {/* Contextual Notice */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#475569',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Note:</strong> Changes apply to this subject for <strong>{currentExam?.name}</strong>. Percentage, pass/fail status, DMC records, and merit ranking will dynamically calculate against this updated maximum.
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '14px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={() => setIsConfigModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  {isSavingConfig ? (
                    <>
                      <div
                        style={{
                          width: '13px',
                          height: '13px',
                          border: '2px solid #ffffff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite',
                        }}
                      />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
