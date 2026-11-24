import React, { useState, useEffect } from 'react';
import { X, User, Phone, Clock, Plus, AlertCircle, CalendarCheck, Receipt, GraduationCap } from 'lucide-react';
import type {
  StudentItem,
  StudentEnrollmentItem,
  AcademicSession,
  ClassItem,
  SectionItem,
  StudentAttendanceStats,
  AttendanceRecordItem,
  StudentFeeSummary,
  FeeRecordItem,
  StudentAcademicHistoryEntry,
} from '../../types/electron';
import { formatMoney } from '../../utils/money';

interface StudentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentItem | null;
  sessions: AcademicSession[];
  classes: ClassItem[];
  sessionToken: string;
  onEnrollmentAdded: () => void;
}

export const StudentDetailsModal: React.FC<StudentDetailsModalProps> = ({
  isOpen,
  onClose,
  student,
  sessions,
  classes,
  sessionToken,
  onEnrollmentAdded,
}) => {
  const [history, setHistory] = useState<StudentEnrollmentItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [academicHistory, setAcademicHistory] = useState<StudentAcademicHistoryEntry[]>([]);
  const [isLoadingAcademicHistory, setIsLoadingAcademicHistory] = useState(false);

  // Attendance history state
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordItem[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  // Fee state
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummary | null>(null);
  const [feeRecords, setFeeRecords] = useState<FeeRecordItem[]>([]);
  const [isLoadingFees, setIsLoadingFees] = useState(false);

  // New Enrollment Form state
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [newSessionId, setNewSessionId] = useState<number | ''>('');
  const [newClassId, setNewClassId] = useState<number | ''>('');
  const [newSectionId, setNewSectionId] = useState<number | ''>('');
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newAdmissionDate, setNewAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);

  // Fetch enrollment history when modal opens
  useEffect(() => {
    if (!isOpen || !student) return;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      setIsLoadingAttendance(true);
      setIsLoadingFees(true);
      setIsLoadingAcademicHistory(true);
      try {
        if (window.electronAPI?.students) {
          const res = await window.electronAPI.students.getEnrollmentHistory(student.id);
          if (res.success) {
            setHistory(res.history);
          }
        }
        if (window.electronAPI?.promotions) {
          const acadRes = await window.electronAPI.promotions.getAcademicHistory(student.id);
          if (acadRes.success) {
            setAcademicHistory(acadRes.history || []);
          }
        }
        if (window.electronAPI?.attendance) {
          const attRes = await window.electronAPI.attendance.getStudentHistory({ studentId: student.id });
          if (attRes.success) {
            setAttendanceStats(attRes.stats);
            setAttendanceRecords(attRes.history);
          }
        }
        if (window.electronAPI?.fees) {
          const feeRes = await window.electronAPI.fees.getStudentFeeSummary(student.id);
          if (feeRes.success) {
            setFeeSummary(feeRes.summary);
            setFeeRecords(feeRes.records);
          }
        }
      } catch (err) {
        console.error('Failed to load student details:', err);
      } finally {
        setIsLoadingHistory(false);
        setIsLoadingAttendance(false);
        setIsLoadingFees(false);
        setIsLoadingAcademicHistory(false);
      }
    };

    fetchHistory();
    setShowAddEnrollment(false);
  }, [isOpen, student]);

  // Load sections when class selection changes in Add Enrollment form
  useEffect(() => {
    if (!newClassId) {
      setSections([]);
      setNewSectionId('');
      return;
    }

    const loadSections = async () => {
      setIsLoadingSections(true);
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(newClassId));
          if (res.success) {
            setSections(res.sections.filter((s) => s.isActive));
            setNewSectionId('');
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      } finally {
        setIsLoadingSections(false);
      }
    };

    loadSections();
  }, [newClassId]);

  if (!isOpen || !student) return null;

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollmentError(null);

    if (!newSessionId || !newClassId || !newSectionId) {
      setEnrollmentError('Session, Class, and Section are required.');
      return;
    }

    setIsSubmittingEnrollment(true);
    try {
      if (window.electronAPI?.students) {
        const res = await window.electronAPI.students.createEnrollment({
          sessionToken,
          studentId: student.id,
          academicSessionId: Number(newSessionId),
          classId: Number(newClassId),
          sectionId: Number(newSectionId),
          rollNumber: newRollNumber.trim() || undefined,
          admissionDate: newAdmissionDate,
        });

        if (res.success) {
          setShowAddEnrollment(false);
          // Refresh history
          const histRes = await window.electronAPI.students.getEnrollmentHistory(student.id);
          if (histRes.success) {
            setHistory(histRes.history);
          }
          if (window.electronAPI?.promotions) {
            const acadRes = await window.electronAPI.promotions.getAcademicHistory(student.id);
            if (acadRes.success) {
              setAcademicHistory(acadRes.history || []);
            }
          }
          onEnrollmentAdded();
        } else {
          setEnrollmentError(res.error || 'Failed to create enrollment.');
        }
      }
    } catch (err: unknown) {
      setEnrollmentError(err instanceof Error ? err.message : 'Error creating enrollment.');
    } finally {
      setIsSubmittingEnrollment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{student.displayName}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono text-blue-600 font-semibold">{student.studentId}</span>
                <span>•</span>
                <span>Adm #{student.admissionNumber}</span>
                <span>•</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    student.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Profile Card */}
          <div className="flex flex-col sm:flex-row gap-6 p-5 bg-gradient-to-r from-blue-50/50 via-slate-50 to-slate-50 rounded-2xl border border-slate-200">
            {/* Photo Avatar */}
            <div className="w-24 h-24 rounded-2xl border-2 border-white shadow bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              {student.photoDataUrl ? (
                <img
                  src={student.photoDataUrl}
                  alt={student.displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-12 h-12 text-slate-300" />
              )}
            </div>

            {/* Current Academic Status Box */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Current Session</span>
                <span className="text-sm font-semibold text-slate-800">
                  {student.currentEnrollment?.academicSessionName || 'Not Assigned'}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Class & Section</span>
                <span className="text-sm font-semibold text-slate-800">
                  {student.currentEnrollment
                    ? `${student.currentEnrollment.className} (${student.currentEnrollment.sectionName})`
                    : 'None'}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Roll Number</span>
                <span className="text-sm font-semibold text-slate-800">
                  {student.currentEnrollment?.rollNumber || '—'}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Enrollment Status</span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-semibold ${
                    student.currentEnrollment?.status === 'Active'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {student.currentEnrollment?.status || 'Unenrolled'}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Gender</span>
                <span className="text-sm text-slate-700">{student.gender}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Date of Birth</span>
                <span className="text-sm text-slate-700">{student.dateOfBirth || '—'}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Blood Group</span>
                <span className="text-sm text-slate-700 font-semibold">{student.bloodGroup || '—'}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Nationality / Religion</span>
                <span className="text-sm text-slate-700">
                  {student.nationality || 'Pakistani'} / {student.religion || 'Islam'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact & Parent Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Parent Card */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Parent / Guardian Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Father Name:</span>
                  <span className="font-medium text-slate-800">{student.fatherName || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Mother Name:</span>
                  <span className="font-medium text-slate-800">{student.motherName || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Guardian Name:</span>
                  <span className="font-medium text-slate-800">{student.guardianName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Guardian Relation:</span>
                  <span className="font-medium text-slate-800">{student.guardianRelationship || '—'}</span>
                </div>
              </div>
            </div>

            {/* Contact Card */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" /> Contact & Residence
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Primary Phone:</span>
                  <span className="font-medium text-slate-800">{student.phone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Alt Phone:</span>
                  <span className="font-medium text-slate-800">{student.alternativePhone || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">City / Province:</span>
                  <span className="font-medium text-slate-800">
                    {student.city}, {student.province}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs mb-0.5">Address:</span>
                  <span className="text-xs text-slate-800 font-medium">
                    {student.currentAddress || 'No current address recorded'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Enrollment History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Academic Enrollment History
                </h3>
                <p className="text-xs text-slate-500">
                  Track student admissions, promotions, and transfers across academic sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEnrollment(!showAddEnrollment)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {showAddEnrollment ? 'Cancel' : 'New Enrollment'}
              </button>
            </div>

            {/* New Enrollment Form */}
            {showAddEnrollment && (
              <form
                onSubmit={handleCreateEnrollment}
                className="p-4 bg-slate-50 rounded-xl border border-blue-200 space-y-3"
              >
                <h4 className="text-xs font-bold text-blue-900 uppercase">
                  Assign to New Academic Session / Class
                </h4>
                {enrollmentError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {enrollmentError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Session <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newSessionId}
                      onChange={(e) => setNewSessionId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      required
                    >
                      <option value="">Select session...</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.isActive ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newClassId}
                      onChange={(e) => setNewClassId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      required
                    >
                      <option value="">Select class...</option>
                      {classes
                        .filter((c) => c.isActive)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newSectionId}
                      onChange={(e) => setNewSectionId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!newClassId || isLoadingSections}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                      required
                    >
                      <option value="">{isLoadingSections ? 'Loading...' : 'Select section...'}</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Roll #</label>
                    <input
                      type="text"
                      value={newRollNumber}
                      onChange={(e) => setNewRollNumber(e.target.value)}
                      placeholder="e.g. 21"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Admission Date</label>
                    <input
                      type="date"
                      value={newAdmissionDate}
                      onChange={(e) => setNewAdmissionDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEnrollment(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEnrollment}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmittingEnrollment ? 'Enrolling...' : 'Save Enrollment'}
                  </button>
                </div>
              </form>
            )}

            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Roll #</th>
                    <th className="py-2.5 px-3">Admission Date</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        Loading enrollment history...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        No enrollment history found for this student.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{h.academicSessionName}</td>
                        <td className="py-2 px-3 text-slate-700">{h.className}</td>
                        <td className="py-2 px-3 text-slate-700">{h.sectionName}</td>
                        <td className="py-2 px-3 text-slate-600">{h.rollNumber || '—'}</td>
                        <td className="py-2 px-3 text-slate-600">{h.admissionDate}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              h.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Progression & Promotion History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" /> Academic Progression &amp; Promotion History
              </h3>
              <p className="text-xs text-slate-500">
                Complete progression records across academic sessions, promotion statuses, attendance, and exam grades.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">Class &amp; Section</th>
                    <th className="py-2.5 px-3">Roll #</th>
                    <th className="py-2.5 px-3">Attendance %</th>
                    <th className="py-2.5 px-3">Exam Result</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Promotion</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingAcademicHistory ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-400">
                        Loading academic progression history...
                      </td>
                    </tr>
                  ) : academicHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-400">
                        No progression history found for this student.
                      </td>
                    </tr>
                  ) : (
                    academicHistory.map((entry) => (
                      <tr key={entry.enrollmentId} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{entry.academicSessionName}</td>
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {entry.className} ({entry.sectionName})
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{entry.rollNumber || '—'}</td>
                        <td className="py-2 px-3">
                          {entry.attendancePercentage !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                entry.attendancePercentage >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : entry.attendancePercentage >= 75
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {entry.attendancePercentage}%
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {entry.examGrade ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-semibold text-slate-800">{entry.examGrade}</span>
                              {entry.examPercentage !== null && (
                                <span className="text-slate-500 text-[10px]">({entry.examPercentage}%)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              entry.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : entry.status === 'Graduated'
                                ? 'bg-purple-100 text-purple-800'
                                : entry.status === 'Transferred'
                                ? 'bg-indigo-100 text-indigo-800'
                                : entry.status === 'Left'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {entry.promotionStatus && entry.promotionStatus !== 'None' ? (
                            <div className="flex flex-col">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold w-fit ${
                                  entry.promotionStatus === 'Promote' || entry.promotionStatus === 'Promoted'
                                    ? 'bg-blue-100 text-blue-800'
                                    : entry.promotionStatus === 'Retain' || entry.promotionStatus === 'Retained'
                                    ? 'bg-amber-100 text-amber-800'
                                    : entry.promotionStatus === 'Graduate' || entry.promotionStatus === 'Graduated'
                                    ? 'bg-purple-100 text-purple-800'
                                    : entry.promotionStatus === 'Transfer' || entry.promotionStatus === 'Transferred'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {entry.promotionStatus}
                              </span>
                              {entry.promotionDate && (
                                <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                  {entry.promotionDate}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 italic max-w-xs truncate">
                          {entry.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance History Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                Attendance Summary & History
              </h3>
            </div>

            {/* Attendance Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="block text-[10px] font-medium text-slate-500 uppercase">Recorded Days</span>
                <span className="text-base font-bold text-slate-800 mt-0.5">
                  {attendanceStats?.totalDaysRecorded || 0}
                </span>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                <span className="block text-[10px] font-medium text-emerald-700 uppercase">Present</span>
                <span className="text-base font-bold text-emerald-600 mt-0.5">
                  {attendanceStats?.presentCount || 0}
                </span>
              </div>
              <div className="bg-red-50/50 p-3 rounded-xl border border-red-200">
                <span className="block text-[10px] font-medium text-red-700 uppercase">Absent</span>
                <span className="text-base font-bold text-red-600 mt-0.5">
                  {attendanceStats?.absentCount || 0}
                </span>
              </div>
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-700/20">
                <span className="block text-[10px] font-medium text-amber-700 uppercase">Late</span>
                <span className="text-base font-bold text-amber-600 mt-0.5">
                  {attendanceStats?.lateCount || 0}
                </span>
              </div>
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                <span className="block text-[10px] font-medium text-blue-700 uppercase">Leave</span>
                <span className="text-base font-bold text-blue-600 mt-0.5">
                  {attendanceStats?.leaveCount || 0}
                </span>
              </div>
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200">
                <span className="block text-[10px] font-medium text-indigo-700 uppercase">Attendance %</span>
                <span className="text-base font-bold text-indigo-600 mt-0.5">
                  {attendanceStats?.attendancePercentage !== null && attendanceStats?.attendancePercentage !== undefined
                    ? `${attendanceStats.attendancePercentage}%`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Attendance History Table */}
            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">Class & Section</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingAttendance ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Loading student attendance records...
                      </td>
                    </tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No attendance records recorded for this student yet.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">{rec.attendanceDate}</td>
                        <td className="py-2 px-3 text-slate-600">{rec.academicSessionName}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {rec.className} ({rec.sectionName})
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rec.status === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'Absent'
                                ? 'bg-red-100 text-red-800'
                                : rec.status === 'Late'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 italic">
                          {rec.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Fee Profile & Invoices */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" /> Fees &amp; Invoices Summary
              </h3>
              <p className="text-xs text-slate-500">
                Current financial standing, billed fees, and payment transactions for this student.
              </p>
            </div>

            {/* Fee Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Billed</span>
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {formatMoney(feeSummary?.totalBilled || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Discounts</span>
                <span className="text-sm font-bold text-slate-600 font-mono">
                  {formatMoney(feeSummary?.totalDiscount || 0)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Paid</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  {formatMoney(feeSummary?.totalPaid || 0)}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Outstanding Due</span>
                <span className="text-sm font-bold text-amber-800 font-mono">
                  {formatMoney(feeSummary?.totalOutstanding || 0)}
                </span>
              </div>
            </div>

            {/* Fee Invoices Mini Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Fee Type</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Net Billed</th>
                    <th className="py-2.5 px-3 text-right">Remaining</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingFees ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        Loading student fee records...
                      </td>
                    </tr>
                  ) : feeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        No fee invoices recorded for this student yet.
                      </td>
                    </tr>
                  ) : (
                    feeRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{r.feeTypeName}</td>
                        <td className="py-2 px-3 text-slate-600">{r.feePeriodName}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono">{r.dueDate}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{formatMoney(r.netAmount)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          {formatMoney(r.remainingBalance)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              r.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'Partially Paid'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
