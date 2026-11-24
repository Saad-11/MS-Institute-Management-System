import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  LayoutDashboard,
  Calendar,
  PlayCircle,
  Eye,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  ExamTypeItem,
  ExaminationItem,
  GradingRuleItem,
  ExamStatus,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';
import { ResultDashboardTab } from './ResultDashboardTab';
import { ExaminationsTab } from './ExaminationsTab';
import { CreateExaminationTab } from './CreateExaminationTab';
import { EnterMarksTab } from './EnterMarksTab';
import { ViewResultsTab } from './ViewResultsTab';
import { ResultSettingsTab } from './ResultSettingsTab';
import { ReportsPage } from '../Reports/ReportsPage';

export type ResultTabKey =
  | 'dashboard'
  | 'create_exam'
  | 'enter_marks'
  | 'view_results'
  | 'reports'
  | 'settings';

export const ResultsPage: React.FC = () => {
  const { sessionToken } = useAuth();
  const [activeTab, setActiveTab] = useState<ResultTabKey>('dashboard');

  // Shared state across Results tabs
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number>(0);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeItem[]>([]);
  const [examinations, setExaminations] = useState<ExaminationItem[]>([]);
  const [gradingRules, setGradingRules] = useState<GradingRuleItem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExaminationItem | null>(null);

  // Contextual examination ID passed between tabs
  const [contextExamId, setContextExamId] = useState<number | undefined>(undefined);
  const [contextClassId, setContextClassId] = useState<number | undefined>(undefined);
  const [contextSectionId, setContextSectionId] = useState<number | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load foundational datasets
  const loadFoundationData = async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      if (window.electronAPI) {
        const [sessRes, classRes, typesRes, examsRes, rulesRes] = await Promise.all([
          window.electronAPI.sessions.getAll(),
          window.electronAPI.classes.getAll(),
          window.electronAPI.exams.getTypes(),
          window.electronAPI.exams.getAll(),
          window.electronAPI.exams.getGradingRules(),
        ]);

        if (sessRes.success && sessRes.sessions) {
          setSessions(sessRes.sessions);
          const active = sessRes.sessions.find((s) => s.isActive) || sessRes.sessions[0];
          if (active) setSelectedSessionId(active.id);
        }

        if (classRes.success && classRes.classes) {
          setClasses(classRes.classes);
        }

        if (typesRes.success && typesRes.types) {
          setExamTypes(typesRes.types);
        }

        if (examsRes.success && examsRes.examinations) {
          setExaminations(examsRes.examinations);
          if (examsRes.examinations.length > 0 && !contextExamId) {
            setContextExamId(examsRes.examinations[0].id);
          }
        }

        if (rulesRes.success && rulesRes.rules) {
          setGradingRules(rulesRes.rules);
        }
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load examination data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFoundationData();
  }, []);

  const handleOpenCreateExamModal = () => {
    setEditingExam(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditExamModal = (exam: ExaminationItem) => {
    setEditingExam(exam);
    setIsCreateModalOpen(true);
  };

  // Action: Create or Update Examination & auto-attach class subjects
  const handleSaveExamination = async (data: {
    id?: number;
    academicSessionId: number;
    examTypeId: number;
    name: string;
    startDate: string;
    endDate: string;
    description: string;
    selectedClassIds: number[];
  }) => {
    if (!window.electronAPI) return { success: false, error: 'Desktop API not available.' };

    try {
      if (data.id) {
        // Edit mode
        const res = await window.electronAPI.exams.update({
          sessionToken: sessionToken || '',
          id: data.id,
          academicSessionId: data.academicSessionId,
          examTypeId: data.examTypeId,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description,
        });

        if (!res.success || !res.examination) {
          return { success: false, error: res.error || 'Failed to update examination.' };
        }

        const updatedExam = res.examination;

        // Auto-configure subjects for newly selected classes
        for (const classId of data.selectedClassIds) {
          try {
            const currRes = await window.electronAPI.classSubjects.getByClassId(classId);
            if (currRes.success && currRes.classSubjects && currRes.classSubjects.length > 0) {
              await window.electronAPI.exams.configureSubjects({
                sessionToken: sessionToken || '',
                examinationId: updatedExam.id,
                classId,
                subjects: currRes.classSubjects.map((cs, idx) => ({
                  subjectId: cs.subjectId,
                  maxMarks: 100,
                  passingMarks: 40,
                  displayOrder: idx + 1,
                })),
              });
            }
          } catch (subErr) {
            console.warn('Subject auto-attachment warning for class', classId, subErr);
          }
        }

        // Refresh all examinations from DB to pick up any updated relationships
        const allRes = await window.electronAPI.exams.getAll();
        if (allRes.success && allRes.examinations) {
          setExaminations(allRes.examinations);
        } else {
          setExaminations((prev) => prev.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
        }

        setIsCreateModalOpen(false);
        setEditingExam(null);
        return { success: true };
      } else {
        // Create mode
        const res = await window.electronAPI.exams.create({
          sessionToken: sessionToken || '',
          academicSessionId: data.academicSessionId,
          examTypeId: data.examTypeId,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description,
        });

        if (!res.success || !res.examination) {
          return { success: false, error: res.error || 'Failed to create examination.' };
        }

        const createdExam = res.examination;

        // Auto-configure subjects for each selected class from the curriculum
        for (const classId of data.selectedClassIds) {
          try {
            const currRes = await window.electronAPI.classSubjects.getByClassId(classId);
            if (currRes.success && currRes.classSubjects && currRes.classSubjects.length > 0) {
              await window.electronAPI.exams.configureSubjects({
                sessionToken: sessionToken || '',
                examinationId: createdExam.id,
                classId,
                subjects: currRes.classSubjects.map((cs, idx) => ({
                  subjectId: cs.subjectId,
                  maxMarks: 100,
                  passingMarks: 40,
                  displayOrder: idx + 1,
                })),
              });
            }
          } catch (subErr) {
            console.warn('Subject auto-attachment warning for class', classId, subErr);
          }
        }

        // Automatically open marks entry for convenience
        await window.electronAPI.exams.updateStatus(sessionToken || '', createdExam.id, 'Open');
        createdExam.status = 'Open';

        // Refresh all examinations from DB to pick up any updated relationships
        const allRes = await window.electronAPI.exams.getAll();
        if (allRes.success && allRes.examinations) {
          setExaminations(allRes.examinations);
        } else {
          setExaminations((prev) => [createdExam, ...prev]);
        }
        setContextExamId(createdExam.id);

        setIsCreateModalOpen(false);
        setEditingExam(null);
        return { success: true };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Error saving exam.' };
    }
  };

  // Action: Update Examination status (Open / Closed / Draft)
  const handleUpdateExamStatus = async (examId: number, status: ExamStatus) => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.exams.updateStatus(sessionToken || '', examId, status);
      if (res.success && res.examination) {
        setExaminations((prev) =>
          prev.map((e) => (e.id === examId ? res.examination! : e))
        );
      } else {
        alert(res.error || 'Failed to update exam status.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating status.');
    }
  };

  // Action: Delete examination
  const handleDeleteExam = async (examId: number) => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.exams.delete(sessionToken || '', examId);
      if (res.success) {
        setExaminations((prev) => prev.filter((e) => e.id !== examId));
        if (contextExamId === examId) {
          setContextExamId(undefined);
        }
      } else {
        alert(res.error || 'Failed to delete examination.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting examination.');
    }
  };

  const handleNavigateToTab = (
    tabKey: ResultTabKey,
    examId?: number,
    classId?: number,
    sectionId?: number
  ) => {
    if (examId) setContextExamId(examId);
    if (classId) setContextClassId(classId);
    if (sectionId !== undefined) setContextSectionId(sectionId);
    setActiveTab(tabKey);
  };

  const navItems = [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'create_exam', label: 'Examinations', icon: Calendar },
    { key: 'enter_marks', label: 'Enter Marks', icon: PlayCircle },
    { key: 'view_results', label: 'View Results', icon: Eye },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Sliders },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Loading examinations and results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-page-container">
      {/* ─── Top Header & Title ─── */}
      <div className="results-header no-print">
        <div className="results-header-left">
          <div className="results-header-icon">
            <BarChart3 size={24} />
          </div>
          <div className="results-header-title">
            <h1>Results &amp; Examinations</h1>
            <p>Manage examinations, configure participating classes, schedule exams, and manage examination records.</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="results-tabs-container">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key as ResultTabKey)}
                className={`results-tab-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Active Tab Content ─── */}
      <div>
        {activeTab === 'dashboard' && (
          <ResultDashboardTab
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSessionId={setSelectedSessionId}
            examinations={examinations}
            classes={classes}
            onOpenNewExamModal={handleOpenCreateExamModal}
            onNavigateToTab={handleNavigateToTab}
            onUpdateExamStatus={handleUpdateExamStatus}
          />
        )}

        {activeTab === 'create_exam' && (
          <ExaminationsTab
            sessions={sessions}
            examTypes={examTypes}
            classes={classes}
            examinations={examinations}
            selectedSessionId={selectedSessionId}
            onSelectSessionId={setSelectedSessionId}
            onOpenCreateExamModal={handleOpenCreateExamModal}
            onOpenEditExamModal={handleOpenEditExamModal}
            onNavigateToTab={handleNavigateToTab}
            onUpdateExamStatus={handleUpdateExamStatus}
            onDeleteExam={handleDeleteExam}
          />
        )}

        {activeTab === 'enter_marks' && (
          <EnterMarksTab
            sessions={sessions}
            examinations={examinations}
            classes={classes}
            gradingRules={gradingRules}
            defaultExamId={contextExamId}
            defaultClassId={contextClassId}
            defaultSectionId={contextSectionId}
            onNavigateToResults={(examId, classId, sectionId) =>
              handleNavigateToTab('view_results', examId, classId, sectionId)
            }
            onNavigateToExaminations={() => setActiveTab('create_exam')}
          />
        )}

        {activeTab === 'view_results' && (
          <ViewResultsTab
            sessions={sessions}
            examinations={examinations}
            classes={classes}
            initialExamId={contextExamId}
            initialClassId={contextClassId}
            initialSectionId={contextSectionId}
            onNavigateToEnterMarks={(examId, classId, sectionId) =>
              handleNavigateToTab('enter_marks', examId, classId, sectionId)
            }
          />
        )}

        {activeTab === 'reports' && (
          <ReportsPage />
        )}

        {activeTab === 'settings' && (
          <ResultSettingsTab
            gradingRules={gradingRules}
            onReloadRules={async () => {
              if (window.electronAPI) {
                const res = await window.electronAPI.exams.getGradingRules();
                if (res.success && res.rules) setGradingRules(res.rules);
              }
            }}
          />
        )}
      </div>

      {/* ─── Create / Edit Examination Modal Overlay ─── */}
      {isCreateModalOpen && (
        <div
          className="exam-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCreateModalOpen(false);
              setEditingExam(null);
            }
          }}
        >
          <div className="exam-modal-container">
            <CreateExaminationTab
              isModal={true}
              sessions={sessions}
              classes={classes}
              examTypes={examTypes}
              selectedSessionId={selectedSessionId}
              editingExam={editingExam}
              onSaveExam={handleSaveExamination}
              onCancel={() => {
                setIsCreateModalOpen(false);
                setEditingExam(null);
              }}
              onReloadExamTypes={async () => {
                if (window.electronAPI) {
                  const res = await window.electronAPI.exams.getTypes();
                  if (res.success && res.types) setExamTypes(res.types);
                }
              }}
              onNavigateToMarks={(examId) => {
                setIsCreateModalOpen(false);
                setEditingExam(null);
                handleNavigateToTab('enter_marks', examId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
