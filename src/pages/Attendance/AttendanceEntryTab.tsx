import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Save,
  Check,
  X,
  Clock,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  SectionItem,
  AttendanceStatus,
  DailyAttendanceSummary,
  EnrolledStudentForAttendance,
} from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

interface AttendanceEntryTabProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
}

export const AttendanceEntryTab: React.FC<AttendanceEntryTabProps> = ({ sessions, classes }) => {
  const { sessionToken } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Selection states
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSectionId, setSelectedSectionId] = useState<number | ''>('');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(todayStr);

  // Loaded data & form state
  const [loadedParams, setLoadedParams] = useState<{
    academicSessionId: number;
    classId: number;
    sectionId: number;
    attendanceDate: string;
    isRecorded: boolean;
  } | null>(null);

  // Student rows being edited
  const [students, setStudents] = useState<
    Array<{
      studentId: number;
      enrollmentId: number;
      admissionNumber: string;
      displayName: string;
      gender: string;
      rollNumber?: string;
      status: AttendanceStatus | '';
      remarks: string;
      originalStatus: AttendanceStatus | '';
      originalRemarks: string;
    }>
  >([]);

  const [, setSummary] = useState<DailyAttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize active session
  useEffect(() => {
    if (sessions.length > 0 && selectedSessionId === '') {
      const active = sessions.find((s: AcademicSession) => s.isActive);
      if (active) {
        setSelectedSessionId(active.id);
      } else {
        setSelectedSessionId(sessions[0].id);
      }
    }
  }, [sessions, selectedSessionId]);

  // Load sections when class changes
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
          if (res.success && res.sections) {
            const activeSections = res.sections.filter((s: SectionItem) => s.isActive);
            setSections(activeSections);
            if (activeSections.length > 0) {
              setSelectedSectionId(activeSections[0].id);
            } else {
              setSelectedSectionId('');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    };

    loadSections();
  }, [selectedClassId]);

  // Track unsaved changes
  useEffect(() => {
    if (!loadedParams || students.length === 0) {
      setHasUnsavedChanges(false);
      return;
    }

    const changed = students.some(
      (s) => s.status !== s.originalStatus || s.remarks !== s.originalRemarks
    );
    setHasUnsavedChanges(changed);
  }, [students, loadedParams]);

  // Prompt if user navigates away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load students for attendance
  const handleLoadStudents = async () => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        'You have unsaved attendance changes. Loading new records will discard them. Proceed?'
      );
      if (!confirmDiscard) return;
    }

    if (!selectedSessionId || !selectedClassId || !selectedSectionId || !attendanceDate) {
      setError('Please select Session, Class, Section, and Attendance Date.');
      return;
    }

    if (attendanceDate > todayStr) {
      setError('Attendance cannot be recorded for a future date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (window.electronAPI?.attendance) {
        const res = await window.electronAPI.attendance.getEnrolledStudents({
          academicSessionId: Number(selectedSessionId),
          classId: Number(selectedClassId),
          sectionId: Number(selectedSectionId),
          attendanceDate,
        });

        if (res.success && res.students) {
          const mapped = res.students.map((item: EnrolledStudentForAttendance) => ({
            studentId: item.studentId,
            enrollmentId: item.enrollmentId,
            admissionNumber: item.admissionNumber,
            displayName: item.displayName,
            gender: item.gender,
            rollNumber: item.rollNumber,
            status: (item.status as AttendanceStatus) || '',
            remarks: item.remarks || '',
            originalStatus: (item.status as AttendanceStatus) || '',
            originalRemarks: item.remarks || '',
          }));

          setStudents(mapped);
          setLoadedParams({
            academicSessionId: Number(selectedSessionId),
            classId: Number(selectedClassId),
            sectionId: Number(selectedSectionId),
            attendanceDate,
            isRecorded: res.isRecorded,
          });

          // Fetch daily summary
          const sumRes = await window.electronAPI.attendance.getDailySummary({
            academicSessionId: Number(selectedSessionId),
            classId: Number(selectedClassId),
            sectionId: Number(selectedSectionId),
            attendanceDate,
          });
          if (sumRes.success && sumRes.summary) {
            setSummary(sumRes.summary);
          }
        } else {
          setError(res.error || 'Failed to load enrolled students.');
          setStudents([]);
          setLoadedParams(null);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading students.');
      setStudents([]);
      setLoadedParams(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk set status
  const handleBulkSetStatus = (status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((student) => ({
        ...student,
        status,
      }))
    );
  };

  // Single student status toggle
  const handleStudentStatusChange = (studentId: number, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  // Single student remarks change
  const handleStudentRemarksChange = (studentId: number, remarks: string) => {
    if (remarks.length > 255) return;
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  // Save Attendance
  const handleSaveAttendance = async () => {
    if (!loadedParams) return;

    // Validate if any student has empty status
    const unselected = students.filter((s) => !s.status);
    if (unselected.length > 0) {
      const confirmSave = window.confirm(
        `${unselected.length} student(s) have no attendance status marked. Records without a status will not be saved. Do you want to proceed?`
      );
      if (!confirmSave) return;
    }

    const recordsToSave = students
      .filter((s) => s.status !== '')
      .map((s) => ({
        studentId: s.studentId,
        enrollmentId: s.enrollmentId,
        status: s.status as AttendanceStatus,
        remarks: s.remarks.trim() || undefined,
      }));

    if (recordsToSave.length === 0) {
      setError('No attendance records to save.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (window.electronAPI?.attendance) {
        const res = await window.electronAPI.attendance.save({
          sessionToken: sessionToken || '',
          academicSessionId: loadedParams.academicSessionId,
          classId: loadedParams.classId,
          sectionId: loadedParams.sectionId,
          attendanceDate: loadedParams.attendanceDate,
          records: recordsToSave,
        });

        if (res.success) {
          setSuccessMessage(
            `Attendance saved successfully! (${res.savedCount} record(s) processed)`
          );

          // Update original statuses to match new saved values
          setStudents((prev) =>
            prev.map((s) => ({
              ...s,
              originalStatus: s.status,
              originalRemarks: s.remarks,
            }))
          );

          setLoadedParams((prev) => (prev ? { ...prev, isRecorded: true } : null));

          // Refresh summary
          const sumRes = await window.electronAPI.attendance.getDailySummary({
            academicSessionId: loadedParams.academicSessionId,
            classId: loadedParams.classId,
            sectionId: loadedParams.sectionId,
            attendanceDate: loadedParams.attendanceDate,
          });
          if (sumRes.success && sumRes.summary) {
            setSummary(sumRes.summary);
          }
        } else {
          setError(res.error || 'Failed to save attendance.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamic live stats calculation from current UI state
  const liveStats = React.useMemo(() => {
    const total = students.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    let unrecorded = 0;

    students.forEach((s) => {
      if (s.status === 'Present') present++;
      else if (s.status === 'Absent') absent++;
      else if (s.status === 'Late') late++;
      else if (s.status === 'Leave') leave++;
      else unrecorded++;
    });

    const recorded = present + absent + late + leave;
    const percentage = recorded > 0 ? Math.round(((present + late) / recorded) * 10000) / 100 : null;

    return { total, present, absent, late, leave, unrecorded, percentage };
  }, [students]);

  // Current session & class names for banner
  const currentClassName = classes.find((c) => c.id === Number(selectedClassId))?.name || 'Class';
  const currentSectionName = sections.find((s) => s.id === Number(selectedSectionId))?.name || 'Section';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Selection Card */}
      <div className="attendance-control-card">
        <div className="attendance-control-header">
          <div className="attendance-control-title">
            <Calendar size={18} />
            <span>Select Class & Date for Attendance</span>
          </div>
          {hasUnsavedChanges && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#d97706',
                background: '#fef3c7',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #fde68a',
              }}
            >
              <AlertTriangle size={13} />
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="attendance-selection-grid">
          {/* Academic Session */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Academic Session *</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(Number(e.target.value) || '')}
              className="attendance-select"
            >
              <option value="">Select Session</option>
              {sessions.map((s: AcademicSession) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Class *</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value) || '')}
              className="attendance-select"
            >
              <option value="">Select Class</option>
              {classes.map((c: ClassItem) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Section *</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(Number(e.target.value) || '')}
              disabled={!selectedClassId || sections.length === 0}
              className="attendance-select"
            >
              <option value="">Select Section</option>
              {sections.map((s: SectionItem) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="attendance-form-group">
            <label className="attendance-form-label">Attendance Date *</label>
            <input
              type="date"
              value={attendanceDate}
              max={todayStr}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="attendance-input"
            />
          </div>

          {/* Load Students Button */}
          <div className="attendance-form-group">
            <button
              type="button"
              onClick={handleLoadStudents}
              disabled={isLoading || !selectedSessionId || !selectedClassId || !selectedSectionId}
              className="btn-attendance-primary"
            >
              <Users size={16} />
              {isLoading ? 'Loading...' : 'Load Students'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="attendance-alert error">
          <AlertCircle size={16} className="attendance-alert-icon" />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>Notice</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="attendance-alert success">
          <CheckCircle size={16} className="attendance-alert-icon" />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>Success</strong>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* If students are not loaded yet, show clear beginner prompt */}
      {!loadedParams && (
        <div className="attendance-sheet-card">
          <div className="attendance-empty-state">
            <div className="attendance-empty-icon">
              <Users size={26} />
            </div>
            <div className="attendance-empty-title">Ready to Take Attendance</div>
            <div className="attendance-empty-subtitle">
              Select an Academic Session, Class, Section, and Date above, then click{' '}
              <strong>"Load Students"</strong> to display the daily attendance sheet.
            </div>
          </div>
        </div>
      )}

      {/* Loaded Content: Notice Banner, Stats, and Attendance Sheet */}
      {loadedParams && (
        <>
          {/* Duplicate / Existing Attendance Status Banner */}
          {loadedParams.isRecorded && (
            <div className="attendance-recorded-banner">
              <div className="attendance-recorded-banner-left">
                <FileText size={17} />
                <span>
                  Attendance has already been recorded for <strong>{currentClassName} - {currentSectionName}</strong> on{' '}
                  <strong>{loadedParams.attendanceDate}</strong>. Any changes you make below will safely update the existing record.
                </span>
              </div>
            </div>
          )}

          {/* Live Summary Metrics Bar */}
          <div className="attendance-stats-grid">
            <div className="attendance-stat-card">
              <span className="attendance-stat-label">Total Students</span>
              <span className="attendance-stat-value">{liveStats.total}</span>
            </div>
            <div className="attendance-stat-card present">
              <span className="attendance-stat-label">Present</span>
              <span className="attendance-stat-value present">{liveStats.present}</span>
            </div>
            <div className="attendance-stat-card absent">
              <span className="attendance-stat-label">Absent</span>
              <span className="attendance-stat-value absent">{liveStats.absent}</span>
            </div>
            <div className="attendance-stat-card late">
              <span className="attendance-stat-label">Late</span>
              <span className="attendance-stat-value late">{liveStats.late}</span>
            </div>
            <div className="attendance-stat-card leave">
              <span className="attendance-stat-label">Leave</span>
              <span className="attendance-stat-value leave">{liveStats.leave}</span>
            </div>
            <div className="attendance-stat-card percentage">
              <span className="attendance-stat-label">Attendance %</span>
              <span className="attendance-stat-value percentage">
                {liveStats.percentage !== null ? `${liveStats.percentage}%` : '—'}
              </span>
            </div>
          </div>

          {/* Daily Attendance Sheet Card */}
          <div className="attendance-sheet-card">
            {/* Action Bar: Fast Bulk Attendance + Save */}
            <div className="attendance-sheet-toolbar">
              <div className="attendance-quick-actions">
                <span className="attendance-quick-label">Fast Actions:</span>
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus('Present')}
                  className="btn-quick-pill present"
                  title="Mark all students as Present"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus('Absent')}
                  className="btn-quick-pill absent"
                  title="Mark all students as Absent"
                >
                  Mark All Absent
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus('Late')}
                  className="btn-quick-pill late"
                  title="Mark all students as Late"
                >
                  Mark All Late
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetStatus('Leave')}
                  className="btn-quick-pill leave"
                  title="Mark all students as Leave"
                >
                  Mark All Leave
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving || students.length === 0}
                className="btn-attendance-save"
              >
                <Save size={15} />
                {isSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>

            {/* Attendance Table */}
            {students.length === 0 ? (
              <div className="attendance-empty-state">
                <div className="attendance-empty-icon">
                  <Users size={26} />
                </div>
                <div className="attendance-empty-title">No Enrolled Students Found</div>
                <div className="attendance-empty-subtitle">
                  There are no active students enrolled in {currentClassName} - {currentSectionName} for this academic session.
                </div>
              </div>
            ) : (
              <div className="attendance-table-container">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '48px', textAlign: 'center' }}>Photo</th>
                      <th style={{ width: '130px' }}>Student ID</th>
                      <th>Student Name</th>
                      <th style={{ width: '270px', textAlign: 'center' }}>Attendance Status</th>
                      <th style={{ width: '220px' }}>Remarks (Optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const initials = (student.displayName || 'S')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr key={student.studentId}>
                          {/* Row Index */}
                          <td style={{ textAlign: 'center', color: 'var(--color-neutral-400)', fontWeight: '600' }}>
                            {idx + 1}
                          </td>

                          {/* Student Photo / Avatar */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="student-avatar" style={{ margin: '0 auto', width: '32px', height: '32px', fontSize: '11px' }}>
                              <span>{initials}</span>
                            </div>
                          </td>

                          {/* Student ID & Admission No */}
                          <td>
                            <span className="id-badge">{student.admissionNumber || `STD-${student.studentId}`}</span>
                            {student.rollNumber && (
                              <div style={{ fontSize: '10px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                                Roll: {student.rollNumber}
                              </div>
                            )}
                          </td>

                          {/* Student Name */}
                          <td>
                            <div style={{ fontWeight: '600', color: 'var(--color-neutral-900)' }}>
                              {student.displayName}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>
                              {student.gender || 'Student'}
                            </div>
                          </td>

                          {/* 1-Click Status Segmented Control */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="status-toggle-group">
                              <button
                                type="button"
                                onClick={() => handleStudentStatusChange(student.studentId, 'Present')}
                                className={`status-toggle-btn ${
                                  student.status === 'Present' ? 'active-present' : ''
                                }`}
                                title="Present"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Check size={12} /> Present
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStudentStatusChange(student.studentId, 'Absent')}
                                className={`status-toggle-btn ${
                                  student.status === 'Absent' ? 'active-absent' : ''
                                }`}
                                title="Absent"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <X size={12} /> Absent
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStudentStatusChange(student.studentId, 'Late')}
                                className={`status-toggle-btn ${
                                  student.status === 'Late' ? 'active-late' : ''
                                }`}
                                title="Late"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={12} /> Late
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStudentStatusChange(student.studentId, 'Leave')}
                                className={`status-toggle-btn ${
                                  student.status === 'Leave' ? 'active-leave' : ''
                                }`}
                                title="Leave"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <FileText size={12} /> Leave
                                </span>
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td>
                            <input
                              type="text"
                              placeholder="Doctor note, family event..."
                              value={student.remarks}
                              maxLength={255}
                              onChange={(e) =>
                                handleStudentRemarksChange(student.studentId, e.target.value)
                              }
                              className="attendance-remarks-input"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Footer Save Bar */}
            {students.length > 0 && (
              <div className="attendance-sheet-footer">
                <div className="attendance-footer-status">
                  {liveStats.unrecorded > 0 ? (
                    <span style={{ color: '#d97706', fontWeight: '600' }}>
                      ⚠️ {liveStats.unrecorded} student(s) not yet marked.
                    </span>
                  ) : (
                    <span style={{ color: '#059669', fontWeight: '600' }}>
                      ✓ All {students.length} students marked.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={isSaving}
                  className="btn-attendance-save"
                >
                  <Save size={15} />
                  {isSaving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
