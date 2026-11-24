import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Printer,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  History,
  FileCheck,
  RefreshCw,
  Eye,
  User,
  ChevronDown,
  X,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type {
  StudentItem,
  AcademicSession,
  DocumentType,
  StudentDocumentPayload,
  StudentDocumentRecord,
} from '../../types/electron';
import { StudentDocumentCertificate } from './StudentDocumentCertificate';
import { printCertificate, exportCertificatePDF } from '../../utils/printDocument';
import '../../styles/documents.css';

export const DocumentsPage: React.FC = () => {
  const { sessionToken } = useAuth();

  // Active Tab: 'generate' | 'history'
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Common reference data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Form State
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('Bonafide');
  const [selectedSessionId, setSelectedSessionId] = useState<number>(0);
  const [customTitle, setCustomTitle] = useState('');
  const [conduct, setConduct] = useState('Good');
  const [reasonForLeaving, setReasonForLeaving] = useState("Parents' Request");
  const [duesCleared, setDuesCleared] = useState(true);
  const [customContent, setCustomContent] = useState('');
  const [customRemarks, setCustomRemarks] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  // Preview & Action States
  const [previewDocument, setPreviewDocument] = useState<StudentDocumentPayload | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History State
  const [historyRecords, setHistoryRecords] = useState<StudentDocumentRecord[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historySessionFilter, setHistorySessionFilter] = useState<number>(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoricalDoc, setSelectedHistoricalDoc] = useState<StudentDocumentPayload | null>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Sessions initially
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        if (window.electronAPI?.sessions) {
          const res = await window.electronAPI.sessions.getAll();
          if (res.success && res.sessions) {
            setSessions(res.sessions);
            const active = res.sessions.find((s) => s.isActive) || res.sessions[0];
            if (active) setSelectedSessionId(active.id);
          }
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    fetchSessions();
  }, []);

  // Search Students for Document Generation
  useEffect(() => {
    const searchStudents = async () => {
      if (!window.electronAPI?.students) return;
      setIsSearchingStudents(true);
      try {
        const res = await window.electronAPI.students.getAll({
          searchQuery: studentSearchQuery.trim() || undefined,
          limit: 15,
          isActive: true,
        });
        if (res.success && res.students) {
          setStudents(res.students);
        }
      } catch (err) {
        console.error('Error searching students:', err);
      } finally {
        setIsSearchingStudents(false);
      }
    };

    const timer = setTimeout(searchStudents, 250);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  // Load History when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyTypeFilter, historySessionFilter]);

  const fetchHistory = async () => {
    if (!window.electronAPI?.documents) return;
    setIsLoadingHistory(true);
    try {
      const res = await window.electronAPI.documents.getHistory({
        documentType: historyTypeFilter !== 'all' ? historyTypeFilter : undefined,
        academicSessionId: historySessionFilter > 0 ? historySessionFilter : undefined,
        searchQuery: historySearch.trim() || undefined,
        limit: 50,
      });
      if (res.success && res.documents) {
        setHistoryRecords(res.documents);
      }
    } catch (err) {
      console.error('Failed to load document history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Generate / Refresh Preview
  const handleGeneratePreview = async () => {
    if (!selectedStudent) {
      setErrorMessage('Please select a student first before generating a document preview.');
      return;
    }
    if (!window.electronAPI?.documents) return;

    setIsLoadingPreview(true);
    setErrorMessage(null);
    try {
      const res = await window.electronAPI.documents.getPreview({
        studentId: selectedStudent.id,
        documentType,
        academicSessionId: selectedSessionId || undefined,
        customTitle: customTitle.trim() || undefined,
        customRemarks: customRemarks.trim() || undefined,
        reasonForLeaving: documentType === 'Leaving' ? reasonForLeaving : undefined,
        conduct: conduct.trim() || undefined,
        customContent: documentType === 'General' ? customContent : undefined,
        duesCleared,
        issueDate,
      });

      if (res.success && res.document) {
        setPreviewDocument(res.document);
        setSelectedHistoricalDoc(null);
        setSuccessMessage(`Preview generated for ${selectedStudent.displayName} (${documentType} Certificate).`);
      } else {
        setErrorMessage(res.error || 'Failed to generate document preview.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error generating preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Issue & Save Document to SQLite History
  const handleIssueDocument = async () => {
    if (!selectedStudent || !window.electronAPI?.documents) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await window.electronAPI.documents.issue({
        sessionToken: sessionToken || '',
        studentId: selectedStudent.id,
        documentType,
        academicSessionId: selectedSessionId,
        title: previewDocument?.title || customTitle || `${documentType} Certificate`,
        issueDate,
        details: {
          conduct,
          reasonForLeaving: documentType === 'Leaving' ? reasonForLeaving : undefined,
          duesCleared,
          customContent: documentType === 'General' ? customContent : undefined,
          remarks: customRemarks,
        },
        remarks: customRemarks,
      });

      if (res.success && res.document) {
        setSuccessMessage(`Document issued successfully! Document Number: ${res.document.documentNumber}`);
        // Update current preview documentNumber with the saved one
        if (previewDocument) {
          setPreviewDocument({ ...previewDocument, documentNumber: res.document.documentNumber });
        }
      } else {
        setErrorMessage(res.error || 'Failed to record document in history.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error issuing document.');
    } finally {
      setIsSaving(false);
    }
  };

  // Offline PDF Export with robust image preloading
  const handleExportPDF = async () => {
    const doc = selectedHistoricalDoc || previewDocument;
    if (!doc) return;

    const safeTitle = (doc.title || 'Certificate').replace(/\s+/g, '_');
    const safeStudent = (doc.student.displayName || 'Student').replace(/\s+/g, '_');
    const defaultFileName = `${safeTitle}_${safeStudent}_${doc.student.studentId}.pdf`;

    try {
      const res = await exportCertificatePDF({ defaultFileName });
      if (res.success && res.filePath) {
        setSuccessMessage(`PDF saved successfully to: ${res.filePath}`);
      } else if (!res.canceled && res.error) {
        setErrorMessage(res.error || 'PDF export failed.');
      }
    } catch (err: unknown) {
      console.error('PDF Export Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error exporting PDF.');
    }
  };

  // Dedicated Certificate Print Handler
  const handlePrintCertificate = async () => {
    if (!currentDisplayDoc) return;
    try {
      await printCertificate();
    } catch (err: unknown) {
      console.error('Print Certificate Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error launching print dialog.');
    }
  };

  // View / Reprint historical document
  const handleViewHistoricalDoc = async (docRecord: StudentDocumentRecord) => {
    if (!window.electronAPI?.documents) return;
    try {
      const details = docRecord.contentJson ? JSON.parse(docRecord.contentJson) : {};
      const res = await window.electronAPI.documents.getPreview({
        studentId: docRecord.studentId,
        documentType: docRecord.documentType,
        academicSessionId: docRecord.academicSessionId,
        customTitle: docRecord.title,
        customRemarks: details.remarks || docRecord.remarks,
        reasonForLeaving: details.reasonForLeaving,
        conduct: details.conduct,
        customContent: details.customContent,
        duesCleared: details.duesCleared,
        issueDate: docRecord.issueDate,
      });

      if (res.success && res.document) {
        setSelectedHistoricalDoc({ ...res.document, documentNumber: docRecord.documentNumber });
        setPreviewDocument(null);
        setSuccessMessage(`Loaded historical document ${docRecord.documentNumber} for ${docRecord.studentName}.`);
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to load historical document:', err);
    }
  };

  const currentDisplayDoc = selectedHistoricalDoc || previewDocument;

  return (
    <div className="docs-workspace">
      {/* ─── 1. Header Card with Segmented Navigation ──────────────────────── */}
      <div className="no-print docs-header-card">
        <div className="docs-header-left">
          <div className="docs-header-icon-box">
            <FileText className="w-6 h-6" />
          </div>
          <div className="docs-header-info">
            <h1 className="docs-header-title">Student Documents & Certificates</h1>
            <p className="docs-header-subtitle">
              Generate, print, export, and archive official student documents using institutional records.
            </p>
          </div>
        </div>

        {/* Segmented Tab Controls */}
        <div className="docs-view-toggle">
          <button
            type="button"
            onClick={() => {
              setActiveTab('generate');
              setErrorMessage(null);
            }}
            className={`docs-toggle-btn ${activeTab === 'generate' ? 'active' : ''}`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Generate Document</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setErrorMessage(null);
            }}
            className={`docs-toggle-btn ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History className="w-4 h-4" />
            <span>Document History</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Feedback Notifications ─────────────────────────────────────── */}
      {successMessage && (
        <div className="no-print docs-alert docs-alert-success">
          <div className="docs-alert-content">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="docs-alert-close"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="no-print docs-alert docs-alert-error">
          <div className="docs-alert-content">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="docs-alert-close"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── 3. TAB 1: GENERATE DOCUMENT ───────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="no-print">
          <div className="docs-card">
            {/* Card Header */}
            <div className="docs-card-header">
              <div className="docs-card-title-group">
                <div className="docs-card-icon">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="docs-card-title">Document Configuration</h2>
                  <div className="docs-card-subtitle">
                    Select a student, configure certificate parameters, and generate an official record.
                  </div>
                </div>
              </div>

              {selectedStudent && (
                <span className="docs-selected-badge">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Student Linked: {selectedStudent.displayName}</span>
                </span>
              )}
            </div>

            {/* 3-Column Form Grid */}
            <div className="docs-config-grid">
              {/* ── Section A: Select Student ──────────────────────────────── */}
              <div className="docs-section-col docs-section-a">
                <h3 className="docs-section-heading">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Section A: Select Student</span>
                  <span className="req-star">*</span>
                </h3>
                <p className="docs-section-desc">
                  Search by student name, unique ID, or admission number to link official records.
                </p>

                {/* If student is selected, display highlighted student card */}
                {selectedStudent ? (
                  <div className="docs-selected-card">
                    <div className="docs-selected-header">
                      <span className="docs-selected-badge">
                        <CheckCircle2 className="w-3 h-3" /> Selected Student
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null);
                          setPreviewDocument(null);
                          setIsSearchOpen(true);
                        }}
                        className="docs-selected-change-btn"
                        title="Choose a different student"
                      >
                        Change Student
                      </button>
                    </div>

                    <div className="docs-selected-body">
                      <div className="docs-selected-avatar">
                        {selectedStudent.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="docs-selected-info">
                        <div className="docs-selected-name">{selectedStudent.displayName}</div>
                        <div className="docs-selected-meta">
                          <span className="docs-pill docs-pill-id">{selectedStudent.studentId}</span>
                          {selectedStudent.admissionNumber && (
                            <span className="docs-pill docs-pill-adm">Adm #{selectedStudent.admissionNumber}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Class: <strong>{selectedStudent.currentEnrollment?.className || 'Unassigned'}</strong>
                          {selectedStudent.currentEnrollment?.sectionName ? ` (${selectedStudent.currentEnrollment.sectionName})` : ''}
                          {selectedStudent.fatherName ? ` • S/D of ${selectedStudent.fatherName}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Interactive Search Box */
                  <div className="docs-search-container" ref={searchContainerRef}>
                    <div className="docs-search-input-wrap">
                      <Search className="docs-search-icon" />
                      <input
                        type="text"
                        placeholder="Search student name, ID, or Adm #..."
                        value={studentSearchQuery}
                        onFocus={() => setIsSearchOpen(true)}
                        onChange={(e) => {
                          setStudentSearchQuery(e.target.value);
                          setIsSearchOpen(true);
                        }}
                        className="docs-search-input"
                      />
                      {isSearchingStudents && <RefreshCw className="docs-search-spinner" />}
                      {!isSearchingStudents && studentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchQuery('')}
                          className="docs-search-clear"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Popover Student Results Dropdown (only visible when searching / open) */}
                    {isSearchOpen && (
                      <div className="docs-student-dropdown">
                        {isSearchingStudents ? (
                          <div className="docs-student-empty">
                            <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1 text-emerald-600" />
                            <span>Searching student registry...</span>
                          </div>
                        ) : students.length === 0 ? (
                          <div className="docs-student-empty">
                            No students found matching "{studentSearchQuery}".
                          </div>
                        ) : (
                          students.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => {
                                setSelectedStudent(st);
                                if (st.currentEnrollment?.academicSessionId) {
                                  setSelectedSessionId(st.currentEnrollment.academicSessionId);
                                }
                                setIsSearchOpen(false);
                                setStudentSearchQuery('');
                                setErrorMessage(null);
                              }}
                              className="docs-student-item"
                            >
                              <div className="docs-student-item-info">
                                <div className="docs-student-item-name">{st.displayName}</div>
                                <div className="docs-student-item-sub">
                                  <span>{st.studentId}</span>
                                  <span>•</span>
                                  <span>{st.currentEnrollment?.className || 'Unassigned'}</span>
                                  {st.fatherName && <span>• S/O {st.fatherName}</span>}
                                </div>
                              </div>
                              <span className="docs-student-item-adm">
                                {st.admissionNumber ? `Adm #${st.admissionNumber}` : '—'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Section B: Document Details ────────────────────────────── */}
              <div className="docs-section-col docs-section-b">
                <h3 className="docs-section-heading">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Section B: Document Details</span>
                  <span className="req-star">*</span>
                </h3>
                <p className="docs-section-desc">
                  Select certificate type, academic session, and official issuance date.
                </p>

                {/* Document Type */}
                <div className="docs-field">
                  <label className="docs-label">
                    <span>Document Type</span>
                    <span className="req-star">*</span>
                  </label>
                  <div className="docs-select-wrapper">
                    <select
                      value={documentType}
                      onChange={(e) => {
                        setDocumentType(e.target.value as DocumentType);
                        setPreviewDocument(null);
                      }}
                      className="docs-select"
                    >
                      <option value="Bonafide">Bonafide / Student Certificate</option>
                      <option value="Character">Character Certificate</option>
                      <option value="Leaving">School Leaving / Transfer Certificate</option>
                      <option value="General">General Student Certificate (Customizable)</option>
                    </select>
                    <ChevronDown className="docs-select-icon" />
                  </div>
                </div>

                {/* Academic Session */}
                <div className="docs-field">
                  <label className="docs-label">
                    <span>Academic Session</span>
                    <span className="req-star">*</span>
                  </label>
                  <div className="docs-select-wrapper">
                    <select
                      value={selectedSessionId}
                      onChange={(e) => {
                        setSelectedSessionId(Number(e.target.value));
                        setPreviewDocument(null);
                      }}
                      className="docs-select"
                    >
                      {sessions.map((sess) => (
                        <option key={sess.id} value={sess.id}>
                          {sess.name} {sess.isActive ? '(Current Active)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="docs-select-icon" />
                  </div>
                </div>

                {/* Date of Issue */}
                <div className="docs-field">
                  <label className="docs-label">
                    <span>Date of Issue</span>
                    <span className="req-star">*</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="docs-input"
                  />
                </div>
              </div>

              {/* ── Section C: Particulars & Options ───────────────────────── */}
              <div className="docs-section-col docs-section-c">
                <h3 className="docs-section-heading">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Section C: Particulars &amp; Options</span>
                </h3>
                <p className="docs-section-desc">
                  Customize assessments, statements, and specific institutional clauses.
                </p>

                {/* Bonafide Conduct Assessment */}
                {documentType === 'Bonafide' && (
                  <div className="docs-field">
                    <label className="docs-label">
                      <span>General Conduct Assessment</span>
                    </label>
                    <div className="docs-select-wrapper">
                      <select
                        value={conduct}
                        onChange={(e) => setConduct(e.target.value)}
                        className="docs-select"
                      >
                        <option value="Good">Good</option>
                        <option value="Exemplary">Exemplary</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                      </select>
                      <ChevronDown className="docs-select-icon" />
                    </div>
                  </div>
                )}

                {/* Character Assessment */}
                {documentType === 'Character' && (
                  <div className="docs-field">
                    <label className="docs-label">
                      <span>Moral Character Assessment</span>
                    </label>
                    <div className="docs-select-wrapper">
                      <select
                        value={conduct}
                        onChange={(e) => setConduct(e.target.value)}
                        className="docs-select"
                      >
                        <option value="Exemplary">Exemplary</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                      </select>
                      <ChevronDown className="docs-select-icon" />
                    </div>
                  </div>
                )}

                {/* Leaving Certificate Specifics */}
                {documentType === 'Leaving' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div className="docs-field">
                      <label className="docs-label">
                        <span>Reason for Leaving</span>
                      </label>
                      <div className="docs-select-wrapper">
                        <select
                          value={reasonForLeaving}
                          onChange={(e) => setReasonForLeaving(e.target.value)}
                          className="docs-select"
                        >
                          <option value="Parents' Request">Parents' Request</option>
                          <option value="Family Relocation / Transfer">Family Relocation / Transfer</option>
                          <option value="Completion of Studies">Completion of Studies</option>
                          <option value="Admission to Another Institution">Admission to Another Institution</option>
                          <option value="Personal Reasons">Personal Reasons</option>
                        </select>
                        <ChevronDown className="docs-select-icon" />
                      </div>
                    </div>

                    <div className="docs-checkbox-wrap">
                      <input
                        type="checkbox"
                        id="duesCleared"
                        checked={duesCleared}
                        onChange={(e) => setDuesCleared(e.target.checked)}
                        className="docs-checkbox"
                      />
                      <label htmlFor="duesCleared" className="docs-checkbox-label">
                        All school and tuition dues have been cleared
                      </label>
                    </div>
                  </div>
                )}

                {/* General Certificate Customization */}
                {documentType === 'General' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div className="docs-field">
                      <label className="docs-label">
                        <span>Custom Document Title</span>
                      </label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="e.g. MERIT CERTIFICATE"
                        className="docs-input"
                      />
                    </div>
                    <div className="docs-field">
                      <label className="docs-label">
                        <span>Custom Certificate Narrative / Text</span>
                      </label>
                      <textarea
                        rows={3}
                        value={customContent}
                        onChange={(e) => setCustomContent(e.target.value)}
                        placeholder="Enter custom certificate statement..."
                        className="docs-textarea"
                      />
                    </div>
                  </div>
                )}

                {/* Remarks (Multiline Textarea) */}
                <div className="docs-field">
                  <label className="docs-label">
                    <span>Remarks (Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={customRemarks}
                    onChange={(e) => setCustomRemarks(e.target.value)}
                    placeholder="Enter optional administrative remarks or notes..."
                    className="docs-textarea"
                  />
                </div>
              </div>
            </div>

            {/* ── Section D: Actions Toolbar ───────────────────────────────── */}
            <div className="docs-actions-bar">
              <div className="docs-actions-left">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={!selectedStudent || isLoadingPreview}
                  className="docs-btn docs-btn-primary"
                  title={selectedStudent ? 'Compile and preview document' : 'Please select a student first'}
                >
                  <Eye className="w-4 h-4" />
                  <span>{isLoadingPreview ? 'Preparing Preview...' : 'Preview Document'}</span>
                </button>
              </div>

              <div className="docs-actions-right">
                <button
                  type="button"
                  onClick={handleIssueDocument}
                  disabled={!previewDocument || isSaving}
                  className="docs-btn docs-btn-blue"
                  title={previewDocument ? 'Save to permanent institutional history' : 'Preview document first to enable issuance'}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSaving ? 'Archiving...' : 'Save & Issue Document'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  disabled={!currentDisplayDoc}
                  className="docs-btn docs-btn-dark"
                  title="Print official certificate document"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={!currentDisplayDoc}
                  className="docs-btn docs-btn-emerald"
                  title="Export high-resolution PDF certificate"
                >
                  <Download className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. TAB 2: DOCUMENT HISTORY ────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="no-print">
          <div className="docs-history-card">
            <div className="docs-card-header">
              <div className="docs-card-title-group">
                <div className="docs-card-icon">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="docs-card-title">Issued Documents Register</h2>
                  <div className="docs-card-subtitle">
                    Search, inspect, and reprint official institutional student documents.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="docs-btn docs-btn-secondary"
                title="Refresh history list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="docs-history-toolbar">
              <div className="docs-search-input-wrap">
                <Search className="docs-search-icon" />
                <input
                  type="text"
                  placeholder="Search Doc #, Student Name, or Student ID..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
                  className="docs-search-input"
                />
              </div>

              <div className="docs-select-wrapper">
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="docs-select"
                >
                  <option value="all">All Document Types</option>
                  <option value="Bonafide">Bonafide Certificates</option>
                  <option value="Character">Character Certificates</option>
                  <option value="Leaving">School Leaving Certificates</option>
                  <option value="General">General Certificates</option>
                </select>
                <ChevronDown className="docs-select-icon" />
              </div>

              <div className="docs-select-wrapper">
                <select
                  value={historySessionFilter}
                  onChange={(e) => setHistorySessionFilter(Number(e.target.value))}
                  className="docs-select"
                >
                  <option value={0}>All Academic Sessions</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="docs-select-icon" />
              </div>

              <button
                type="button"
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="docs-btn docs-btn-primary"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
            </div>

            {/* History Records Table */}
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Doc #</th>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th>Class</th>
                    <th>Document Type</th>
                    <th>Academic Session</th>
                    <th>Issue Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-emerald-600" />
                        Loading document register...
                      </td>
                    </tr>
                  ) : historyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        No issued documents found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    historyRecords.map((r) => {
                      const badgeClass =
                        r.documentType === 'Bonafide'
                          ? 'docs-badge-bonafide'
                          : r.documentType === 'Character'
                          ? 'docs-badge-character'
                          : r.documentType === 'Leaving'
                          ? 'docs-badge-leaving'
                          : 'docs-badge-general';

                      return (
                        <tr key={r.id}>
                          <td className="docs-doc-no">{r.documentNumber}</td>
                          <td className="docs-student-col">{r.studentName}</td>
                          <td style={{ fontFamily: 'monospace', color: '#475569' }}>{r.studentSystemId}</td>
                          <td>
                            {r.className} {r.sectionName ? `(${r.sectionName})` : ''}
                          </td>
                          <td>
                            <span className={`docs-badge ${badgeClass}`}>{r.documentType}</span>
                          </td>
                          <td style={{ color: '#64748b' }}>{r.academicSessionName}</td>
                          <td style={{ color: '#475569' }}>{r.issueDate}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleViewHistoricalDoc(r)}
                              className="docs-btn docs-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View / Reprint</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. DOCUMENT PREVIEW & PRINT AREA ───────────────────────────────── */}
      {currentDisplayDoc && (
        <div className="docs-preview-container">
          <div className="no-print docs-preview-toolbar">
            <div className="docs-preview-title">
              <FileText className="w-5 h-5 text-emerald-700" />
              <span>
                Document Preview: {currentDisplayDoc.title} • {currentDisplayDoc.student.displayName}
              </span>
            </div>

            <div className="docs-preview-actions">
              <button
                type="button"
                onClick={handlePrintCertificate}
                className="docs-btn docs-btn-dark"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="docs-btn docs-btn-primary"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <StudentDocumentCertificate document={currentDisplayDoc} />
        </div>
      )}
    </div>
  );
};
