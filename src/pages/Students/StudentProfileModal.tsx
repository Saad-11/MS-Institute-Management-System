import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  GraduationCap,
  CalendarCheck,
  Receipt,
  FileText,
  Printer,
  Edit2,
  ArrowUpRight,
  MapPin,
  Shield,
  Award,
} from 'lucide-react';
import type {
  StudentItem,
  StudentEnrollmentItem,
  AcademicSession,
  ClassItem,
  StudentAttendanceStats,
  AttendanceRecordItem,
  StudentFeeSummary,
  FeeRecordItem,
  StudentAcademicHistoryEntry,
  StudentDocumentRecord,
} from '../../types/electron';
import { formatMoney } from '../../utils/money';
import { useAuth } from '../../context/AuthContext';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/students.css';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentItem | null;
  sessions: AcademicSession[];
  classes: ClassItem[];
  sessionToken: string;
  onEditStudent: (student: StudentItem) => void;
  onPromoteClick?: () => void;
  onEnrollmentAdded: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  sessionToken: _sessionToken,
  onEditStudent,
  onPromoteClick,
  onEnrollmentAdded: _onEnrollmentAdded,
}) => {
  // Tabs: 'personal' | 'academic' | 'guardian' | 'address' | 'attendance' | 'fees' | 'results' | 'documents'
  const [activeTab, setActiveTab] = useState<
    'personal' | 'academic' | 'guardian' | 'address' | 'attendance' | 'fees' | 'results' | 'documents'
  >('personal');

  // Resolved authoritative student data & photo
  const [resolvedStudent, setResolvedStudent] = useState<StudentItem | null>(student);
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(student?.photoDataUrl || null);
  const [photoError, setPhotoError] = useState(false);
  const [prevStudentId, setPrevStudentId] = useState<number | null>(student?.id || null);

  // Synchronously update when incoming student prop changes to avoid stale state flash
  if (student && student.id !== prevStudentId) {
    setPrevStudentId(student.id);
    setResolvedStudent(student);
    setResolvedPhoto(student.photoDataUrl || null);
    setPhotoError(false);
  }

  // Async data states
  const [history, setHistory] = useState<StudentEnrollmentItem[]>([]);
  const [academicHistory, setAcademicHistory] = useState<StudentAcademicHistoryEntry[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordItem[]>([]);
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummary | null>(null);
  const [feeRecords, setFeeRecords] = useState<FeeRecordItem[]>([]);
  const [documents, setDocuments] = useState<StudentDocumentRecord[]>([]);

  // School branding settings from auth context
  const { schoolSettings } = useAuth();
  const schoolName = (schoolSettings?.schoolName || 'MS Institute Management System').trim();
  const schoolAddressParts = [
    schoolSettings?.address,
    schoolSettings?.city,
    schoolSettings?.province,
  ].filter(Boolean);
  const schoolAddress = schoolAddressParts.join(', ');
  const schoolPhone = schoolSettings?.phone || '';
  const schoolEmail = schoolSettings?.email || '';
  const schoolCode = schoolSettings?.schoolCode || '';
  const schoolLogo =
    schoolSettings?.logoDataUrl ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sms_school_logo_data_url') : null);

  // Reliable student profile print action
  const handlePrint = () => {
    document.body.classList.add('printing-student-profile');

    const cleanup = () => {
      document.body.classList.remove('printing-student-profile');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 2000);
      }, 80);
    });
  };

  // Sync print classes for browser shortcuts (e.g. Ctrl+P)
  React.useEffect(() => {
    if (!isOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add('printing-student-profile');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-student-profile');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-student-profile');
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !student) return;

    let isMounted = true;
    setResolvedStudent(student);
    setResolvedPhoto(student.photoDataUrl || null);
    setPhotoError(false);

    // Fetch full authoritative student record (including photoDataUrl)
    const fetchStudentDetails = async () => {
      try {
        if (window.electronAPI?.students?.getById) {
          const sRes = await window.electronAPI.students.getById(student.id);
          if (isMounted && sRes.success && sRes.student) {
            setResolvedStudent(sRes.student);
            if (sRes.student.photoDataUrl) {
              setResolvedPhoto(sRes.student.photoDataUrl);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching detailed student profile:', err);
      }
    };

    const fetchAllData = async () => {
      try {
        if (window.electronAPI?.students) {
          const res = await window.electronAPI.students.getEnrollmentHistory(student.id);
          if (isMounted && res.success) setHistory(res.history);
        }
        if (window.electronAPI?.promotions) {
          const res = await window.electronAPI.promotions.getAcademicHistory(student.id);
          if (isMounted && res.success) setAcademicHistory(res.history || []);
        }
        if (window.electronAPI?.attendance) {
          const aRes = await window.electronAPI.attendance.getStudentHistory({ studentId: student.id });
          if (isMounted && aRes.success) {
            setAttendanceStats(aRes.stats);
            setAttendanceRecords(aRes.history || []);
          }
        }
        if (window.electronAPI?.fees) {
          const fRes = await window.electronAPI.fees.getStudentFeeSummary(student.id);
          if (isMounted && fRes.success) {
            setFeeSummary(fRes.summary);
            setFeeRecords(fRes.records || []);
          }
        }
        if (window.electronAPI?.documents) {
          const docRes = await window.electronAPI.documents.getHistory({ studentId: student.id });
          if (isMounted && docRes.success) {
            setDocuments(docRes.documents || []);
          }
        }
      } catch (err) {
        console.error('Error fetching student profile associations:', err);
      }
    };

    fetchStudentDetails();
    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, student?.id]);

  if (!isOpen || !student) return null;

  const activeStudent = resolvedStudent || student;

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile-modal-card">
        {/* Top Header Banner */}
        <div className="profile-top-banner">
          <div className="profile-banner-left">
            <div className="profile-banner-avatar">
              {resolvedPhoto && !photoError ? (
                <img
                  src={resolvedPhoto}
                  alt={activeStudent.displayName}
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <span>
                  {activeStudent.firstName ? activeStudent.firstName[0] : 'S'}
                  {activeStudent.lastName ? activeStudent.lastName[0] : ''}
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="profile-banner-name">{activeStudent.displayName}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: activeStudent.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: activeStudent.isActive ? '#6ee7b7' : '#fca5a5',
                    border: activeStudent.isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {activeStudent.isActive ? '● Active' : '● Inactive'}
                </span>
              </div>

              <div className="profile-banner-chips">
                <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd', fontWeight: 'bold' }}>
                  ID: {activeStudent.studentId}
                </span>
                <span>•</span>
                <span>Class: {activeStudent.currentEnrollment?.className || 'Unassigned'}</span>
                <span>•</span>
                <span>Section: {activeStudent.currentEnrollment?.sectionName || '—'}</span>
              </div>
            </div>
          </div>

          {/* Banner Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onEditStudent(activeStudent)}
              className="btn-modal-secondary"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </button>

            {onPromoteClick && (
              <button
                type="button"
                onClick={onPromoteClick}
                className="btn-modal-secondary"
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <ArrowUpRight size={13} />
                <span>Promote</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="btn-modal-secondary"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              title="Print Student Profile (Ctrl+P)"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="modal-close-icon-btn"
              style={{ color: 'white', background: 'rgba(255, 255, 255, 0.1)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Profile Tabs Navigation */}
        <div className="profile-tabs-nav">
          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            <User size={14} />
            <span>Personal Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'academic' ? 'active' : ''}`}
            onClick={() => setActiveTab('academic')}
          >
            <GraduationCap size={14} />
            <span>Academic Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'guardian' ? 'active' : ''}`}
            onClick={() => setActiveTab('guardian')}
          >
            <Shield size={14} />
            <span>Guardian Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'address' ? 'active' : ''}`}
            onClick={() => setActiveTab('address')}
          >
            <MapPin size={14} />
            <span>Address</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <CalendarCheck size={14} />
            <span>Attendance</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'fees' ? 'active' : ''}`}
            onClick={() => setActiveTab('fees')}
          >
            <Receipt size={14} />
            <span>Fees</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            <Award size={14} />
            <span>Results</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={14} />
            <span>Documents</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="profile-body-container">
          {/* 1. Personal Information */}
          {activeTab === 'personal' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <User size={14} />
                  <span>Personal Identity</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Full Name</span>
                    <span className="info-v">{activeStudent.displayName}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Gender</span>
                    <span className="info-v">{activeStudent.gender}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Date of Birth</span>
                    <span className="info-v">{activeStudent.dateOfBirth || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Blood Group</span>
                    <span className="info-v">{activeStudent.bloodGroup || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <Shield size={14} />
                  <span>Demographics & Contact</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Primary Phone</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{activeStudent.phone || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Nationality</span>
                    <span className="info-v">{activeStudent.nationality || 'Pakistani'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Religion</span>
                    <span className="info-v">{activeStudent.religion || 'Islam'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">City / Town</span>
                    <span className="info-v">{activeStudent.city || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Academic Information */}
          {activeTab === 'academic' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <GraduationCap size={14} />
                  <span>Current Enrollment</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Permanent Student ID</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                      {activeStudent.studentId}
                    </span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Admission Number</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{activeStudent.admissionNumber || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Academic Session</span>
                    <span className="info-v">{activeStudent.currentEnrollment?.academicSessionName || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Class</span>
                    <span className="info-v">{activeStudent.currentEnrollment?.className || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Section</span>
                    <span className="info-v">{activeStudent.currentEnrollment?.sectionName || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <GraduationCap size={14} />
                  <span>Academic History</span>
                </div>
                {academicHistory.length > 0 || history.length > 0 ? (
                  <div className="info-key-val-list">
                    {(academicHistory.length > 0 ? academicHistory : history).map((h: any, idx: number) => (
                      <div key={idx} className="info-key-val-item">
                        <span className="info-k">{h.sessionName || h.academicSessionName || 'Session'}</span>
                        <span className="info-v">
                          {h.className} ({h.sectionName || 'General'}) —{' '}
                          <span style={{ color: 'var(--color-primary-600)' }}>{h.status || 'Active'}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                    No prior session enrollment history recorded.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 3. Guardian Information */}
          {activeTab === 'guardian' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <User size={14} />
                  <span>Father / Primary Guardian</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Father Name</span>
                    <span className="info-v">{activeStudent.fatherName || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Mother Name</span>
                    <span className="info-v">{activeStudent.motherName || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Emergency Contact</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{activeStudent.alternativePhone || activeStudent.phone || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <Shield size={14} />
                  <span>Designated Guardian</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Guardian Name</span>
                    <span className="info-v">{activeStudent.guardianName || activeStudent.fatherName || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Relationship</span>
                    <span className="info-v">{activeStudent.guardianRelationship || 'Father'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Address */}
          {activeTab === 'address' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <MapPin size={14} />
                  <span>Current Residential Address</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Street Address</span>
                    <span className="info-v">{activeStudent.currentAddress || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">City</span>
                    <span className="info-v">{activeStudent.city || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Province</span>
                    <span className="info-v">{activeStudent.province || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <MapPin size={14} />
                  <span>Permanent Address</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Permanent Residence</span>
                    <span className="info-v">{activeStudent.permanentAddress || activeStudent.currentAddress || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Attendance */}
          {activeTab === 'attendance' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <CalendarCheck size={14} />
                <span>Attendance Performance</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-primary-700)', fontWeight: 'bold' }}>Attendance Rate</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', color: 'var(--color-primary-800)', marginTop: '2px' }}>
                    {attendanceStats?.attendancePercentage != null ? `${attendanceStats.attendancePercentage}%` : 'N/A'}
                  </span>
                </div>
                <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#047857', fontWeight: 'bold' }}>Present Days</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', color: '#065f46', marginTop: '2px' }}>
                    {attendanceStats?.presentCount || 0}
                  </span>
                </div>
                <div style={{ padding: '12px', background: '#fef2f2', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#b91c1c', fontWeight: 'bold' }}>Absent Days</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', color: '#991b1b', marginTop: '2px' }}>
                    {attendanceStats?.absentCount || 0}
                  </span>
                </div>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 'bold' }}>Total Working Days</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', color: 'var(--color-neutral-800)', marginTop: '2px' }}>
                    {attendanceStats?.totalDaysRecorded || 0}
                  </span>
                </div>
              </div>

              {attendanceRecords.length > 0 ? (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRecords.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td>{r.attendanceDate}</td>
                          <td>
                            <span className={`status-pill ${r.status === 'Present' ? 'status-pill-active' : 'status-pill-inactive'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{r.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                  No attendance entries logged for this student yet.
                </p>
              )}
            </div>
          )}

          {/* 6. Fees */}
          {activeTab === 'fees' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <Receipt size={14} />
                <span>Fee Ledger & Invoices</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-neutral-600)', fontWeight: 'bold' }}>Total Billed</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>
                    {formatMoney(feeSummary?.totalBilled || 0)}
                  </span>
                </div>
                <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#047857', fontWeight: 'bold' }}>Paid Amount</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', color: '#065f46', marginTop: '2px' }}>
                    {formatMoney(feeSummary?.totalPaid || 0)}
                  </span>
                </div>
                <div style={{ padding: '12px', background: '#fef2f2', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#b91c1c', fontWeight: 'bold' }}>Outstanding Due</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', color: '#991b1b', marginTop: '2px' }}>
                    {formatMoney(feeSummary?.totalOutstanding || 0)}
                  </span>
                </div>
              </div>

              {feeRecords.length > 0 ? (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Fee Type</th>
                        <th>Due Date</th>
                        <th>Net Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeRecords.map((f, i) => (
                        <tr key={i}>
                          <td>{f.feePeriodName || 'Current'}</td>
                          <td>{f.feeTypeName || 'Tuition'}</td>
                          <td>{f.dueDate || '—'}</td>
                          <td>{formatMoney(f.netAmount)}</td>
                          <td>
                            <span className={`status-pill ${f.status === 'Paid' ? 'status-pill-active' : 'status-pill-inactive'}`}>
                              {f.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                  No fee vouchers generated for this student.
                </p>
              )}
            </div>
          )}

          {/* 7. Results */}
          {activeTab === 'results' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <Award size={14} />
                <span>Examination Results</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                View or generate Detailed Marks Certificate (DMC) from the DMC module or Examination section.
              </p>
            </div>
          )}

          {/* 8. Documents */}
          {activeTab === 'documents' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <FileText size={14} />
                <span>Issued Certificates & Documents</span>
              </div>
              {documents.length > 0 ? (
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Doc Number</th>
                      <th>Document Type</th>
                      <th>Issue Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.documentNumber}</td>
                        <td>{d.title || d.documentType}</td>
                        <td>{d.issueDate}</td>
                        <td>
                          <button
                            type="button"
                            onClick={handlePrint}
                            className="btn-table-action btn-action-view"
                          >
                            Print
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                  No certificates or leaving documents issued for this student yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-bar">
          <div style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            System ID: {activeStudent.studentId}
          </div>
          <button type="button" onClick={onClose} className="btn-modal-secondary">
            Close
          </button>
        </div>
      </div>

      {/* ─── Dedicated Print Profile Sheet (A4 Single Page) ─── */}
      <div className="student-print-profile-sheet" aria-hidden="true">
        {/* 1. School Header & Student Photo */}
        <div className="sprint-header">
          <div className="sprint-header-left">
            <InstitutionLogo
              size={64}
              src={schoolLogo}
              schoolName={schoolName}
              framed
            />
          </div>

          <div className="sprint-header-center">
            <h1 className="sprint-school-name">{schoolName}</h1>
            {schoolAddress && <p className="sprint-school-address">{schoolAddress}</p>}
            <div className="sprint-school-contacts">
              {schoolPhone && <span>Tel: {schoolPhone}</span>}
              {schoolPhone && (schoolEmail || schoolCode) && <span>•</span>}
              {schoolEmail && <span>Email: {schoolEmail}</span>}
              {schoolEmail && schoolCode && <span>•</span>}
              {schoolCode && <span>Code: {schoolCode}</span>}
            </div>
            <div className="sprint-doc-badge">
              <span>Official Student Cumulative Profile Record</span>
            </div>
          </div>

          <div className="sprint-header-right">
            <div className="sprint-photo-frame">
              {resolvedPhoto && !photoError ? (
                <img
                  src={resolvedPhoto}
                  alt={activeStudent.displayName}
                  className="sprint-photo-img"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className="sprint-photo-placeholder">
                  <User size={28} />
                  <span>Passport<br />Photo</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Key Identifier Ribbon */}
        <div className="sprint-id-ribbon">
          <div className="sprint-id-col">
            <span className="sprint-id-label">Student ID:</span>
            <span className="sprint-id-val sprint-mono">{activeStudent.studentId}</span>
          </div>
          <div className="sprint-id-col">
            <span className="sprint-id-label">Admission No:</span>
            <span className="sprint-id-val sprint-mono">{activeStudent.admissionNumber || '—'}</span>
          </div>
          <div className="sprint-id-col">
            <span className="sprint-id-label">Class & Section:</span>
            <span className="sprint-id-val">
              {activeStudent.currentEnrollment?.className || '—'}
              {activeStudent.currentEnrollment?.sectionName ? ` (${activeStudent.currentEnrollment.sectionName})` : ''}
            </span>
          </div>
          <div className="sprint-id-col">
            <span className="sprint-id-label">Session:</span>
            <span className="sprint-id-val">{activeStudent.currentEnrollment?.academicSessionName || 'Current'}</span>
          </div>
          <div className="sprint-id-col">
            <span className="sprint-id-label">Status:</span>
            <span className="sprint-status-pill">{activeStudent.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        {/* 3. Detailed Information Grids */}
        <div className="sprint-grid-2col">
          {/* Card 1: Student Personal Details */}
          <div className="sprint-section-box">
            <div className="sprint-section-title">
              <span>1. Student Identity & Demographics</span>
            </div>
            <table className="sprint-table-kv">
              <tbody>
                <tr>
                  <td className="sprint-td-k">Full Name:</td>
                  <td className="sprint-td-v" style={{ fontWeight: 700 }}>{activeStudent.displayName}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Gender:</td>
                  <td className="sprint-td-v">{activeStudent.gender}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Date of Birth:</td>
                  <td className="sprint-td-v">{activeStudent.dateOfBirth || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Blood Group:</td>
                  <td className="sprint-td-v">{activeStudent.bloodGroup || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Nationality:</td>
                  <td className="sprint-td-v">{activeStudent.nationality || 'Pakistani'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Religion:</td>
                  <td className="sprint-td-v">{activeStudent.religion || 'Islam'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Card 2: Parent & Guardian Details */}
          <div className="sprint-section-box">
            <div className="sprint-section-title">
              <span>2. Family & Guardian Contact</span>
            </div>
            <table className="sprint-table-kv">
              <tbody>
                <tr>
                  <td className="sprint-td-k">Father's Name:</td>
                  <td className="sprint-td-v" style={{ fontWeight: 700 }}>{activeStudent.fatherName || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Mother's Name:</td>
                  <td className="sprint-td-v">{activeStudent.motherName || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Guardian Name:</td>
                  <td className="sprint-td-v">{activeStudent.guardianName || activeStudent.fatherName || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Relationship:</td>
                  <td className="sprint-td-v">{activeStudent.guardianRelationship || 'Father'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Primary Phone:</td>
                  <td className="sprint-td-v sprint-mono" style={{ fontWeight: 700 }}>{activeStudent.phone || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Emergency / Alt:</td>
                  <td className="sprint-td-v sprint-mono">{activeStudent.alternativePhone || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Residential Address & Academic/Financial Info */}
        <div className="sprint-grid-2col">
          {/* Card 3: Residential Address */}
          <div className="sprint-section-box">
            <div className="sprint-section-title">
              <span>3. Residential Address</span>
            </div>
            <table className="sprint-table-kv">
              <tbody>
                <tr>
                  <td className="sprint-td-k">Current Address:</td>
                  <td className="sprint-td-v">{activeStudent.currentAddress || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">City / Town:</td>
                  <td className="sprint-td-v">{activeStudent.city || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Province:</td>
                  <td className="sprint-td-v">{activeStudent.province || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Permanent Address:</td>
                  <td className="sprint-td-v">{activeStudent.permanentAddress || activeStudent.currentAddress || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Card 4: Attendance & Fee Status */}
          <div className="sprint-section-box">
            <div className="sprint-section-title">
              <span>4. Attendance & Financial Summary</span>
            </div>
            <table className="sprint-table-kv">
              <tbody>
                <tr>
                  <td className="sprint-td-k">Admission Date:</td>
                  <td className="sprint-td-v">{activeStudent.currentEnrollment?.admissionDate || '—'}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Attendance Rate:</td>
                  <td className="sprint-td-v" style={{ fontWeight: 700 }}>
                    {attendanceStats?.attendancePercentage != null ? `${attendanceStats.attendancePercentage}%` : 'N/A'}{' '}
                    {attendanceStats?.presentCount != null && `(${attendanceStats.presentCount} / ${attendanceStats.totalDaysRecorded || 0} days)`}
                  </td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Total Fee Billed:</td>
                  <td className="sprint-td-v sprint-mono">{formatMoney(feeSummary?.totalBilled || 0)}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Fee Amount Paid:</td>
                  <td className="sprint-td-v sprint-mono">{formatMoney(feeSummary?.totalPaid || 0)}</td>
                </tr>
                <tr>
                  <td className="sprint-td-k">Outstanding Dues:</td>
                  <td className="sprint-td-v sprint-mono" style={{ fontWeight: 700 }}>
                    {(feeSummary?.totalOutstanding || 0) <= 0 ? 'Nil (Cleared)' : formatMoney(feeSummary?.totalOutstanding || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Official Signatures & Seal */}
        <div className="sprint-signatures-row">
          <div className="sprint-sig-col">
            <div className="sprint-sig-line">Class Incharge / Teacher</div>
            <div className="sprint-sig-caption">Signature & Date</div>
          </div>

          <div className="sprint-seal-box">
            <span>OFFICIAL<br />INSTITUTION<br />SEAL</span>
          </div>

          <div className="sprint-sig-col">
            <div className="sprint-sig-line">Principal / Head of Institution</div>
            <div className="sprint-sig-caption">Authorized Signatory</div>
          </div>
        </div>

        {/* 6. Document Verification Disclaimer Footer */}
        <div className="sprint-footer-row">
          <span>This is an official computer-generated student record from the MS Institute Management System. Valid without physical signature unless required.</span>
          <span className="sprint-mono">Printed: {new Date().toLocaleDateString('en-US')}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
