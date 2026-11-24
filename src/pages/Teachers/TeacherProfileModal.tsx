import React, { useState } from 'react';
import {
  X,
  User,
  GraduationCap,
  Briefcase,
  Phone,
  Printer,
  Edit2,
  Award,
  BookOpen,
  Calendar,
  FileText,
} from 'lucide-react';
import type { TeacherItem } from '../../types/electron';
import '../../styles/teachers.css';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherItem | null;
  onEditTeacher: (teacher: TeacherItem) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onEditTeacher,
}) => {
  // Tabs: 'personal' | 'contact' | 'professional' | 'classes' | 'employment' | 'documents'
  const [activeTab, setActiveTab] = useState<
    'personal' | 'contact' | 'professional' | 'classes' | 'employment' | 'documents'
  >('personal');

  if (!isOpen || !teacher) return null;

  return (
    <div className="modal-overlay">
      <div className="profile-modal-card">
        {/* Top Header Banner */}
        <div className="profile-top-banner">
          <div className="profile-banner-left">
            <div className="profile-banner-avatar">
              {teacher.photoDataUrl ? (
                <img src={teacher.photoDataUrl} alt={teacher.displayName} />
              ) : (
                <span>
                  {teacher.firstName[0]}
                  {teacher.lastName ? teacher.lastName[0] : ''}
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="profile-banner-name">{teacher.displayName}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background:
                      teacher.employmentStatus === 'Active'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : teacher.employmentStatus === 'On Leave'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      teacher.employmentStatus === 'Active'
                        ? '#6ee7b7'
                        : teacher.employmentStatus === 'On Leave'
                        ? '#fde68a'
                        : '#fca5a5',
                    border:
                      teacher.employmentStatus === 'Active'
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  ● {teacher.employmentStatus}
                </span>
              </div>

              <div className="profile-banner-chips">
                <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd', fontWeight: 'bold' }}>
                  ID: {teacher.teacherId}
                </span>
                <span>•</span>
                <span>Emp Code: {teacher.employeeId}</span>
                <span>•</span>
                <span>{teacher.designation}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onEditTeacher(teacher)}
              className="btn-modal-secondary"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn-modal-secondary"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
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
            <span>1. Personal Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            <Phone size={14} />
            <span>2. Contact & Address</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'professional' ? 'active' : ''}`}
            onClick={() => setActiveTab('professional')}
          >
            <Award size={14} />
            <span>3. Professional Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            <BookOpen size={14} />
            <span>4. Assigned Classes & Subjects</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'employment' ? 'active' : ''}`}
            onClick={() => setActiveTab('employment')}
          >
            <Briefcase size={14} />
            <span>5. Employment Information</span>
          </button>

          <button
            type="button"
            className={`profile-tab-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={14} />
            <span>6. Documents</span>
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
                  <span>Personal Demographics</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Full Name</span>
                    <span className="info-v">{teacher.displayName}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Gender</span>
                    <span className="info-v">{teacher.gender}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Date of Birth</span>
                    <span className="info-v">{teacher.dateOfBirth || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">System Teacher ID</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                      {teacher.teacherId}
                    </span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <Briefcase size={14} />
                  <span>Institutional Assignment</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Employee Code</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{teacher.employeeId}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Designation</span>
                    <span className="info-v">{teacher.designation}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Joining Date</span>
                    <span className="info-v">{teacher.joiningDate}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Status</span>
                    <span className="info-v">{teacher.employmentStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Contact & Address */}
          {activeTab === 'contact' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <Phone size={14} />
                  <span>Communication Details</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Primary Phone</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{teacher.phone || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Email Address</span>
                    <span className="info-v">{teacher.email || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <GraduationCap size={14} />
                  <span>Mailing Address</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Residential Address</span>
                    <span className="info-v">{teacher.address || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">City</span>
                    <span className="info-v">{teacher.city || '—'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Province</span>
                    <span className="info-v">{teacher.province || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Professional Information */}
          {activeTab === 'professional' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <Award size={14} />
                  <span>Academic Qualifications</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Highest Qualification</span>
                    <span className="info-v">{teacher.qualification}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Subject Specialization</span>
                    <span className="info-v">{teacher.specialization || 'General'}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <Briefcase size={14} />
                  <span>Teaching Rank & Experience</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Faculty Rank</span>
                    <span className="info-v">{teacher.designation}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Appointment Date</span>
                    <span className="info-v">{teacher.joiningDate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Assigned Classes & Subjects */}
          {activeTab === 'classes' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <BookOpen size={14} />
                <span>Class & Subject Workload</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>
                  Assigned curriculum subject teaching areas for <strong>{teacher.displayName}</strong>:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="filter-chip" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    <BookOpen size={14} />
                    <span>Specialization: {teacher.specialization || 'General Curriculum'}</span>
                  </span>
                  <span className="filter-chip" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    <GraduationCap size={14} />
                    <span>Qualification: {teacher.qualification}</span>
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-neutral-400)', marginTop: '8px' }}>
                  * Specific period-by-period class timetables can also be scheduled via the Academic Structure settings.
                </span>
              </div>
            </div>
          )}

          {/* 5. Employment Information */}
          {activeTab === 'employment' && (
            <div className="info-cards-grid">
              <div className="info-display-card">
                <div className="info-card-title">
                  <Calendar size={14} />
                  <span>Employment Contract</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Current Status</span>
                    <span className="info-v">{teacher.employmentStatus}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">System Access</span>
                    <span className="info-v">{teacher.isActive ? 'Active Staff' : 'Disabled'}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">Date Joined</span>
                    <span className="info-v">{teacher.joiningDate}</span>
                  </div>
                </div>
              </div>

              <div className="info-display-card">
                <div className="info-card-title">
                  <Briefcase size={14} />
                  <span>Payroll / Identifier Info</span>
                </div>
                <div className="info-key-val-list">
                  <div className="info-key-val-item">
                    <span className="info-k">Employee Code</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{teacher.employeeId}</span>
                  </div>
                  <div className="info-key-val-item">
                    <span className="info-k">System Staff ID</span>
                    <span className="info-v" style={{ fontFamily: 'var(--font-mono)' }}>{teacher.teacherId}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. Documents */}
          {activeTab === 'documents' && (
            <div className="info-display-card">
              <div className="info-card-title">
                <FileText size={14} />
                <span>Faculty Records & Credentials</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
                Official appointment letters, degree attestations, and service certificates for this faculty member.
              </p>
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-modal-secondary"
                >
                  <Printer size={13} />
                  <span>Print Faculty Service Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-bar">
          <div style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            Staff ID: {teacher.teacherId}
          </div>
          <button type="button" onClick={onClose} className="btn-modal-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
