import React, { useState, useEffect, useMemo } from 'react';
import {
  IdCard,
  Printer,
  Download,
  Users,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  User,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  StudentItem,
  SchoolSettings,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';
import { IDCardComponent } from './IDCardComponent';
import { printIDCards, exportIDCardsPDF } from '../../utils/printIDCards';
import '../../styles/id-cards.css';

export const IDCardsPage: React.FC = () => {
  const { schoolSettings: contextSchoolSettings } = useAuth();

  // State: Filter metadata
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(
    contextSchoolSettings || null
  );

  // Selected filters
  const [selectedSessionId, setSelectedSessionId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(0);

  // Student records & selection
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [tableSearch, setTableSearch] = useState<string>('');

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'both' | 'front' | 'back'>('both');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 1. Initial Load: Academic Sessions, Classes, School Settings
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        if (!window.electronAPI) return;

        const [sessRes, classRes, schoolRes] = await Promise.all([
          window.electronAPI.sessions.getAll(),
          window.electronAPI.classes.getAll(),
          window.electronAPI.school.getSettings(),
        ]);

        if (!isMounted) return;

        if (sessRes.success && sessRes.sessions) {
          setSessions(sessRes.sessions);
          const activeSession =
            sessRes.sessions.find((s) => s.isActive) || sessRes.sessions[0];
          if (activeSession) {
            setSelectedSessionId(activeSession.id);
          }
        }

        if (classRes.success && classRes.classes) {
          setClasses(classRes.classes);
          if (classRes.classes.length > 0) {
            setSelectedClassId(classRes.classes[0].id);
          }
        }

        if (schoolRes.success && schoolRes.settings) {
          const logoDataUrl =
            schoolRes.logoDataUrl ||
            (schoolRes.settings as any).logoDataUrl ||
            null;
          setSchoolSettings({
            ...schoolRes.settings,
            logoDataUrl,
          });
        }
      } catch (err) {
        console.error('[IDCardsPage] Failed to load initial metadata:', err);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update school settings if AuthContext updates
  useEffect(() => {
    if (contextSchoolSettings) {
      setSchoolSettings((prev) => ({
        ...prev,
        ...contextSchoolSettings,
      }));
    }
  }, [contextSchoolSettings]);

  // 2. Load Sections when Class changes
  useEffect(() => {
    let isMounted = true;

    const loadSections = async () => {
      if (!selectedClassId || !window.electronAPI?.sections) {
        setSections([]);
        setSelectedSectionId(0);
        return;
      }

      try {
        const res = await window.electronAPI.sections.getByClassId(
          selectedClassId
        );
        if (isMounted && res.success && res.sections) {
          setSections(res.sections);
          setSelectedSectionId(0); // 0 means "All Sections"
        }
      } catch (err) {
        console.error('[IDCardsPage] Failed to load sections:', err);
      }
    };

    loadSections();

    return () => {
      isMounted = false;
    };
  }, [selectedClassId]);

  // 3. Fetch Students on "Load Students" click
  const handleLoadStudents = async () => {
    if (!selectedSessionId || !selectedClassId) {
      setFeedback({
        type: 'error',
        text: 'Please select both an Academic Session and a Class.',
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (!window.electronAPI?.students) {
        throw new Error('Electron API students module unavailable.');
      }

      const filters: Record<string, any> = {
        academicSessionId: selectedSessionId,
        classId: selectedClassId,
        isActive: true,
        limit: 200, // Load all class students with photo data URLs embedded
        page: 1,
      };

      if (selectedSectionId && selectedSectionId > 0) {
        filters.sectionId = selectedSectionId;
      }

      const res = await window.electronAPI.students.getAll(filters);

      if (res.success && res.students) {
        setStudents(res.students);
        // By default, select all loaded students for instant convenience
        const allIds = new Set<number>(res.students.map((s) => s.id));
        setSelectedIds(allIds);

        if (res.students.length === 0) {
          setFeedback({
            type: 'error',
            text: 'No active students found for the selected Class and Section.',
          });
        } else {
          setFeedback({
            type: 'success',
            text: `Successfully loaded ${res.students.length} student(s).`,
          });
        }
      } else {
        setStudents([]);
        setSelectedIds(new Set());
        setFeedback({
          type: 'error',
          text: res.error || 'Failed to load students.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading students';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Selection Management
  const filteredStudents = useMemo(() => {
    if (!tableSearch.trim()) return students;
    const q = tableSearch.toLowerCase().trim();
    return students.filter((s) => {
      const name = (s.displayName || `${s.firstName} ${s.lastName}`).toLowerCase();
      const sId = (s.studentId || '').toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      const father = (s.fatherName || '').toLowerCase();
      return (
        name.includes(q) ||
        sId.includes(q) ||
        adm.includes(q) ||
        father.includes(q)
      );
    });
  }, [students, tableSearch]);

  const isAllSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedIds.has(s.id));
  }, [filteredStudents, selectedIds]);

  const handleToggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllSelected) {
      filteredStudents.forEach((s) => next.delete(s.id));
    } else {
      filteredStudents.forEach((s) => next.add(s.id));
    }
    setSelectedIds(next);
  };

  const handleToggleStudent = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 5. Selected Students List for Printing
  const selectedStudentsList = useMemo(() => {
    return students.filter((s) => selectedIds.has(s.id));
  }, [students, selectedIds]);

  // 6. Pagination of ID Cards on A4 Sheets (5 cards / sheet)
  const a4Sheets = useMemo(() => {
    const chunkSize = 5; // Exactly 5 cards / A4 sheet
    const sheets: StudentItem[][] = [];
    for (let i = 0; i < selectedStudentsList.length; i += chunkSize) {
      sheets.push(selectedStudentsList.slice(i, i + chunkSize));
    }
    return sheets;
  }, [selectedStudentsList]);

  // 7. Print Handler
  const handlePrint = async () => {
    if (selectedStudentsList.length === 0) return;
    setIsActionPending(true);
    try {
      await printIDCards({
        onAfterPrint: () => {
          setIsActionPending(false);
        },
      });
    } catch (err) {
      console.error('[IDCardsPage] Print error:', err);
      setIsActionPending(false);
    }
  };

  // 8. PDF Export Handler
  const handleExportPDF = async () => {
    if (selectedStudentsList.length === 0) return;
    setIsActionPending(true);

    const currentClass = classes.find((c) => c.id === selectedClassId)?.name || 'Class';
    const fileName = `Student_ID_Cards_${currentClass.replace(/\s+/g, '_')}.pdf`;

    try {
      const res = await exportIDCardsPDF({
        defaultFileName: fileName,
      });

      if (res.success && !res.canceled) {
        setFeedback({
          type: 'success',
          text: `ID Cards PDF successfully saved${res.filePath ? `: ${res.filePath}` : '!'}.`,
        });
      } else if (res.error) {
        setFeedback({
          type: 'error',
          text: `Failed to export PDF: ${res.error}`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Failed to export PDF file.',
      });
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <div className="id-cards-workspace">
      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="id-cards-header">
        <div className="id-cards-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <IdCard size={28} color="#2563eb" />
            <h1>Student ID Cards</h1>
          </div>
          <p>
            Generate and batch-print CR80 standard identity cards (85.6 mm × 54 mm) with 5 cards per A4 sheet
          </p>
        </div>

        {selectedStudentsList.length > 0 && (
          <button
            type="button"
            className="id-cards-btn-primary"
            onClick={() => setIsPreviewOpen(true)}
          >
            <Printer size={16} />
            Preview & Print ID Cards ({selectedStudentsList.length})
          </button>
        )}
      </div>

      {/* ─── Feedback Alert ─────────────────────────────────────── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0.2rem',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── Filter Bar Card ────────────────────────────────────── */}
      <div className="id-cards-filter-card">
        <div className="id-cards-filter-grid">
          {/* Academic Session */}
          <div className="id-cards-filter-group">
            <label className="id-cards-filter-label" htmlFor="id-cards-session">
              Academic Session
            </label>
            <select
              id="id-cards-session"
              className="id-cards-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div className="id-cards-filter-group">
            <label className="id-cards-filter-label" htmlFor="id-cards-class">
              Class
            </label>
            <select
              id="id-cards-class"
              className="id-cards-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="id-cards-filter-group">
            <label className="id-cards-filter-label" htmlFor="id-cards-section">
              Section
            </label>
            <select
              id="id-cards-section"
              className="id-cards-select"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(Number(e.target.value))}
            >
              <option value={0}>All Sections</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Load Students Button */}
          <button
            type="button"
            className="id-cards-btn-load"
            onClick={handleLoadStudents}
            disabled={isLoading || !selectedSessionId || !selectedClassId}
          >
            {isLoading ? (
              <>
                <RotateCcw size={16} className="spin" />
                Loading...
              </>
            ) : (
              <>
                <Users size={16} />
                Load Students
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Student Selection Table Card ───────────────────────── */}
      <div className="id-cards-table-card">
        <div className="id-cards-table-header">
          <div className="id-cards-selection-meta">
            <strong>Class Students</strong>
            <span className="id-cards-badge">
              {selectedStudentsList.length} of {students.length} Selected
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {students.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.3rem 0.6rem',
                  gap: '0.4rem',
                }}
              >
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Filter in list..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8rem',
                    width: '130px',
                  }}
                />
              </div>
            )}

            <button
              type="button"
              className="id-cards-btn-primary"
              disabled={selectedStudentsList.length === 0}
              onClick={() => setIsPreviewOpen(true)}
            >
              <Printer size={15} />
              Preview & Print ID Cards
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <div
            style={{
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <IdCard size={44} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1e293b' }}>
              No Students Loaded
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
              Select an Academic Session, Class, and Section above, then click <strong>Load Students</strong>.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="id-cards-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isAllSelected ? '#2563eb' : '#64748b',
                      }}
                      title={isAllSelected ? 'Deselect All' : 'Select All'}
                    >
                      {isAllSelected ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th style={{ width: '50px' }}>Photo</th>
                  <th>Student ID</th>
                  <th>Adm No</th>
                  <th>Full Name</th>
                  <th>Father's Name</th>
                  <th>Class & Section</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const isChecked = selectedIds.has(s.id);
                  const sName =
                    s.displayName ||
                    `${s.firstName} ${s.lastName || ''}`.trim() ||
                    'Student';
                  const cName = s.currentEnrollment?.className || 'Class';
                  const secName = s.currentEnrollment?.sectionName || 'A';

                  return (
                    <tr
                      key={s.id}
                      style={{
                        backgroundColor: isChecked ? '#f8fafc' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStudent(s.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isChecked ? '#2563eb' : '#94a3b8',
                          }}
                        >
                          {isChecked ? (
                            <CheckSquare size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td>
                        {s.photoDataUrl ? (
                          <img
                            src={s.photoDataUrl}
                            alt={sName}
                            className="id-cards-thumb"
                          />
                        ) : (
                          <div className="id-cards-thumb-placeholder">
                            <User size={16} />
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#1e40af' }}>
                        {s.studentId || `STD-${s.id}`}
                      </td>
                      <td>{s.admissionNumber || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{sName}</td>
                      <td style={{ color: '#475569' }}>{s.fatherName || '—'}</td>
                      <td>
                        {cName} ({secName})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Preview & Print Modal ───────────────────────────────── */}
      {isPreviewOpen && (
        <div className="id-cards-modal-overlay">
          {/* Modal Toolbar */}
          <div className="id-cards-modal-toolbar">
            <div className="id-cards-modal-title">
              <IdCard size={20} color="#60a5fa" />
              <span>
                Student ID Cards Preview ({selectedStudentsList.length} Cards, {a4Sheets.length} A4 Sheet{a4Sheets.length === 1 ? '' : 's'})
              </span>
            </div>

            {/* Layout Mode Switcher */}
            <div className="id-cards-segmented">
              <button
                type="button"
                className={`id-cards-segment-btn ${previewMode === 'both' ? 'active' : ''}`}
                onClick={() => setPreviewMode('both')}
              >
                Side-by-Side (5 / Sheet)
              </button>
              <button
                type="button"
                className={`id-cards-segment-btn ${previewMode === 'front' ? 'active' : ''}`}
                onClick={() => setPreviewMode('front')}
              >
                Front Side Only
              </button>
              <button
                type="button"
                className={`id-cards-segment-btn ${previewMode === 'back' ? 'active' : ''}`}
                onClick={() => setPreviewMode('back')}
              >
                Back Side Only
              </button>
            </div>

            {/* Action Buttons */}
            <div className="id-cards-modal-controls">
              <button
                type="button"
                className="id-cards-btn-primary"
                onClick={handlePrint}
                disabled={isActionPending}
                style={{
                  background: '#2563eb',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
                }}
              >
                <Printer size={16} />
                Print ID Cards
              </button>

              <button
                type="button"
                className="id-cards-btn-primary"
                onClick={handleExportPDF}
                disabled={isActionPending}
                style={{
                  background: '#059669',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)',
                }}
              >
                <Download size={16} />
                Export PDF
              </button>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: '0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close Preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Printable Sheet Canvas */}
          <div className="id-cards-modal-scroll">
            <div className="id-cards-print-container">
              {a4Sheets.map((sheetStudents, sheetIdx) => (
                <div className="id-card-sheet" key={`sheet-${sheetIdx}`}>
                  {sheetStudents.map((st) => (
                    <IDCardComponent
                      key={`card-${st.id}-${previewMode}`}
                      student={st}
                      school={schoolSettings}
                      mode={previewMode}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
