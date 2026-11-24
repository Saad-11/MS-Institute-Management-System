import React, { useState } from 'react';
import { User } from 'lucide-react';
import type { StudentDMCData } from '../../types/electron';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/dmc.css';

interface DMCReportCardProps {
  dmc: StudentDMCData;
}

export const DMCReportCard: React.FC<DMCReportCardProps> = ({ dmc }) => {
  const { school, examination, student, subjects, summary, issueDate } = dmc;

  // Authoritative school logo resolution
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(() => {
    const rawLogo = (school as any).logoDataUrl;
    if (rawLogo && typeof rawLogo === 'string' && rawLogo.startsWith('data:')) {
      return rawLogo;
    }
    if (
      school.logoPath &&
      typeof school.logoPath === 'string' &&
      (school.logoPath.startsWith('data:') ||
        school.logoPath.startsWith('blob:') ||
        school.logoPath.startsWith('http'))
    ) {
      return school.logoPath;
    }
    return null;
  });

  // Authoritative student photo resolution
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(student.photoDataUrl || null);
  const [prevStudentId, setPrevStudentId] = useState(student.id);

  // Authoritative principal signature resolution
  const [resolvedSignature, setResolvedSignature] = useState<string | null>(() => {
    const rawSig = (school as any).signatureDataUrl;
    if (rawSig && typeof rawSig === 'string' && rawSig.startsWith('data:')) {
      return rawSig;
    }
    if (
      (school as any).signaturePath &&
      typeof (school as any).signaturePath === 'string' &&
      ((school as any).signaturePath.startsWith('data:') ||
        (school as any).signaturePath.startsWith('blob:') ||
        (school as any).signaturePath.startsWith('http'))
    ) {
      return (school as any).signaturePath;
    }
    return null;
  });

  // Synchronously update photo when student prop changes to avoid any frame of stale photo
  if (prevStudentId !== student.id) {
    setPrevStudentId(student.id);
    setResolvedPhoto(student.photoDataUrl || null);
  }

  // Sync / fetch logo if not already an embedded data URL
  React.useEffect(() => {
    let isMounted = true;

    const initialLogo =
      (school as any).logoDataUrl ||
      (school.logoPath?.startsWith('data:') ? school.logoPath : null);
    if (initialLogo) {
      setResolvedLogo(initialLogo);
      return;
    }

    const fetchAuthoritativeLogo = async () => {
      try {
        if (window.electronAPI?.school?.getLogoDataUrl) {
          const res = await window.electronAPI.school.getLogoDataUrl();
          if (isMounted && res.success && res.dataUrl) {
            setResolvedLogo(res.dataUrl);
            return;
          }
        }
        if (window.electronAPI?.school?.getSettings) {
          const sRes = await window.electronAPI.school.getSettings();
          if (isMounted && sRes.success && sRes.logoDataUrl) {
            setResolvedLogo(sRes.logoDataUrl);
          }
        }
      } catch (err) {
        console.warn('Could not retrieve school logo:', err);
      }
    };

    fetchAuthoritativeLogo();
    return () => {
      isMounted = false;
    };
  }, [school.logoPath, (school as any).logoDataUrl]);

  // Sync / fetch principal signature if available
  React.useEffect(() => {
    let isMounted = true;

    const initialSig =
      (school as any).signatureDataUrl ||
      ((school as any).signaturePath?.startsWith('data:') ? (school as any).signaturePath : null);
    if (initialSig) {
      setResolvedSignature(initialSig);
      return;
    }

    const fetchAuthoritativeSig = async () => {
      try {
        if (window.electronAPI?.school?.getSignatureDataUrl) {
          const res = await window.electronAPI.school.getSignatureDataUrl();
          if (isMounted && res.success && res.dataUrl) {
            setResolvedSignature(res.dataUrl);
            return;
          }
        }
        if (window.electronAPI?.school?.getSettings) {
          const sRes = await window.electronAPI.school.getSettings();
          if (isMounted && sRes.success && sRes.signatureDataUrl) {
            setResolvedSignature(sRes.signatureDataUrl);
          }
        }
      } catch (err) {
        console.warn('Could not retrieve principal signature:', err);
      }
    };

    fetchAuthoritativeSig();
    return () => {
      isMounted = false;
    };
  }, [(school as any).signaturePath, (school as any).signatureDataUrl]);

  // Sync / fetch student photo when student or photoDataUrl changes
  React.useEffect(() => {
    let isMounted = true;
    if (student.photoDataUrl) {
      setResolvedPhoto(student.photoDataUrl);
      return;
    }

    // Reset photo immediately when student changes so old photo is never displayed
    setResolvedPhoto(null);

    const fetchStudentPhoto = async () => {
      if (!student.id || !window.electronAPI?.students?.getById) return;
      try {
        const sRes = await window.electronAPI.students.getById(student.id);
        if (isMounted && sRes.success && sRes.student) {
          const pUrl = sRes.student.photoDataUrl || null;
          if (pUrl) {
            setResolvedPhoto(pUrl);
          }
        }
      } catch {
        // Safe silent fallback to placeholder
      }
    };

    fetchStudentPhoto();
    return () => {
      isMounted = false;
    };
  }, [student.id, student.photoDataUrl]);

  const isPending =
    summary.result === 'Pending' ||
    subjects.some((s) => (s.obtainedMarks === null || s.obtainedMarks === undefined) && s.status !== 'Absent');
  const isPassed = !isPending && summary.result === 'Pass';
  const schoolName = school.schoolName || 'School Name';

  // Load active DMC display preferences from Settings
  const preferences = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('dmc_display_preferences');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      showGradeSymbol: true,
      showGradePoint: true,
      showPercentage: true,
      showPosition: true,
      showRemarks: true,
    };
  }, [student.id, dmc]);

  // Format position nicely: 1st, 2nd, 3rd, etc.
  const formatPosition = (pos?: number, total?: number) => {
    if (!pos || isPending) return '—';
    const j = pos % 10;
    const k = pos % 100;
    let suffix = 'th';
    if (j === 1 && k !== 11) suffix = 'st';
    else if (j === 2 && k !== 12) suffix = 'nd';
    else if (j === 3 && k !== 13) suffix = 'rd';

    return `${pos}${suffix}${total ? ` of ${total}` : ''}`;
  };

  const schoolAddressParts = [school.address, school.city, school.province, school.country].filter(Boolean);

  return (
    <div className="dmc-document" id={`dmc-${student.id}`}>
      <div className="dmc-inner-frame">
        {/* ─── 1. Header / School Branding ─────────────────────────────────── */}
        <div className="dmc-header">
          {/* Left: School Crest / Logo */}
          <div className="dmc-header-left dmc-logo-fallback">
            <InstitutionLogo
              size={68}
              src={resolvedLogo}
              schoolName={schoolName}
              framed
            />
          </div>

          {/* Center: School Info, Title Badge, Exam Name */}
          <div className="dmc-header-center">
            <h1 className="dmc-school-title">
              {schoolName}
            </h1>
            {(school as any).tagline && (
              <div className="dmc-school-tagline">
                {(school as any).tagline}
              </div>
            )}
            {schoolAddressParts.length > 0 && (
              <div className="dmc-school-address">
                {schoolAddressParts.join(', ')}
              </div>
            )}
            <div className="dmc-school-contact">
              {school.phone && <span>Tel: {school.phone}</span>}
              {school.phone && school.email && <span>•</span>}
              {school.email && <span>Email: {school.email}</span>}
              {school.schoolCode && <span>•</span>}
              {school.schoolCode && <span>School Code: {school.schoolCode}</span>}
            </div>

            <div className="dmc-title-badge-wrap">
              <span className="dmc-title-badge">Detailed Marks Certificate</span>
            </div>
            <div className="dmc-exam-subtitle">
              {examination.name} • Academic Session: {examination.academicSessionName}
            </div>
          </div>

          {/* Right: Student Passport Photo Box */}
          <div className="dmc-header-right">
            <div className={`dmc-photo-box ${resolvedPhoto ? 'has-photo' : ''}`}>
              {resolvedPhoto ? (
                <img
                  src={resolvedPhoto}
                  alt={student.displayName}
                  className="dmc-photo-img"
                  onError={() => setResolvedPhoto(null)}
                />
              ) : (
                <div className="dmc-photo-placeholder" title="No photograph on record">
                  <User size={20} style={{ margin: '0 auto 4px', color: '#94a3b8' }} />
                  PHOTO NOT<br />AVAILABLE
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── 2. Student & Academic Information ──────────────────────────── */}
        <div className="dmc-student-card">
          <div className="dmc-student-grid">
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Student Name</span>
              <span className="dmc-meta-value highlight">{student.displayName}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Father's Name</span>
              <span className="dmc-meta-value">{student.fatherName || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Student Unique ID</span>
              <span className="dmc-meta-value mono">{student.systemStudentId}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Admission No.</span>
              <span className="dmc-meta-value mono">{student.admissionNumber || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Class</span>
              <span className="dmc-meta-value">{student.className}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Section</span>
              <span className="dmc-meta-value">{student.sectionName || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Roll Number</span>
              <span className="dmc-meta-value">{student.rollNumber || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Academic Session</span>
              <span className="dmc-meta-value">{examination.academicSessionName || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Examination</span>
              <span className="dmc-meta-value">{examination.name || '—'}</span>
            </div>
            {preferences.showPosition !== false && (
              <div className="dmc-meta-item">
                <span className="dmc-meta-label">Position in Class</span>
                <span className="dmc-meta-value">{formatPosition(summary.position, summary.totalStudents)}</span>
              </div>
            )}
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Date of Birth</span>
              <span className="dmc-meta-value">{student.dateOfBirth || '—'}</span>
            </div>
            <div className="dmc-meta-item">
              <span className="dmc-meta-label">Date of Issue</span>
              <span className="dmc-meta-value">{issueDate || new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>

        {/* ─── 3. Subject Marks Table ─────────────────────────────────────── */}
        <div className="dmc-table-wrap">
          <table className="dmc-marks-table">
            <thead>
              <tr>
                <th className="dmc-col-sno">S.#</th>
                <th className="dmc-col-name" style={{ textAlign: 'left' }}>Subject Title</th>
                <th className="dmc-col-max">Max Marks</th>
                <th className="dmc-col-pass">Passing</th>
                <th className="dmc-col-obt">Obtained</th>
                {preferences.showPercentage !== false && <th className="dmc-col-pct">Percentage</th>}
                {preferences.showGradeSymbol !== false && <th className="dmc-col-grade">Grade</th>}
                <th className="dmc-col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, idx) => {
                const isAbsent = sub.status === 'Absent';
                const hasMarks = sub.obtainedMarks !== null && sub.obtainedMarks !== undefined;
                const isSubPending = !isAbsent && !hasMarks;
                const isSubPass = !isAbsent && hasMarks && (sub.obtainedMarks ?? 0) >= sub.passingMarks;
                const pct = sub.maxMarks > 0 && hasMarks && !isAbsent
                  ? ((sub.obtainedMarks ?? 0) / sub.maxMarks) * 100
                  : 0;

                return (
                  <tr key={idx}>
                    <td className="dmc-col-sno">{idx + 1}</td>
                    <td className="dmc-col-name">{sub.subjectName}</td>
                    <td className="dmc-col-max">{sub.maxMarks}</td>
                    <td className="dmc-col-pass">{sub.passingMarks}</td>
                    <td className="dmc-col-obt">
                      {isAbsent ? (
                        <span style={{ color: '#b45309', fontWeight: 800 }}>ABSENT</span>
                      ) : isSubPending ? (
                        <span style={{ color: '#d97706', fontWeight: 700 }}>PENDING</span>
                      ) : hasMarks ? (
                        sub.obtainedMarks
                      ) : (
                        '—'
                      )}
                    </td>
                    {preferences.showPercentage !== false && (
                      <td className="dmc-col-pct">
                        {isAbsent || isSubPending ? '—' : `${pct.toFixed(1)}%`}
                      </td>
                    )}
                    {preferences.showGradeSymbol !== false && (
                      <td className="dmc-col-grade">
                        {isAbsent || isSubPending ? '—' : sub.grade || '—'}
                      </td>
                    )}
                    <td className="dmc-col-status">
                      {isAbsent ? (
                        <span className="dmc-status-badge dmc-status-abs">ABSENT</span>
                      ) : isSubPending ? (
                        <span className="dmc-status-badge dmc-status-pending">PENDING</span>
                      ) : isSubPass ? (
                        <span className="dmc-status-badge dmc-status-pass">PASS</span>
                      ) : (
                        <span className="dmc-status-badge dmc-status-fail">FAIL</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="dmc-grand-total-label">
                  Grand Total:
                </td>
                <td className="dmc-col-max" style={{ fontWeight: 800 }}>
                  {summary.totalMaxMarks}
                </td>
                <td className="dmc-col-pass">—</td>
                <td className="dmc-grand-total-val">
                  {summary.totalObtainedMarks}
                </td>
                {preferences.showPercentage !== false && (
                  <td className="dmc-col-pct" style={{ fontWeight: 800, color: '#0f2942' }}>
                    {summary.percentage ? `${summary.percentage.toFixed(2)}%` : '—'}
                  </td>
                )}
                {preferences.showGradeSymbol !== false && (
                  <td className="dmc-col-grade" style={{ fontWeight: 900 }}>
                    {summary.grade || '—'}
                  </td>
                )}
                <td className="dmc-col-status">
                  <span
                    className={`dmc-status-badge ${
                      isPending
                        ? 'dmc-status-pending'
                        : isPassed
                        ? 'dmc-status-pass'
                        : 'dmc-status-fail'
                    }`}
                  >
                    {isPending ? 'PENDING' : summary.result.toUpperCase()}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ─── 4. Performance Summary Strip ───────────────────────────────── */}
        <div className="dmc-summary-card">
          <div className="dmc-summary-col">
            <div className="dmc-summary-label">Marks Obtained</div>
            <div className="dmc-summary-val">
              {summary.totalObtainedMarks} <span style={{ fontSize: '11px', color: '#64748b' }}>/ {summary.totalMaxMarks}</span>
            </div>
          </div>
          {preferences.showPercentage !== false && (
            <div className="dmc-summary-col">
              <div className="dmc-summary-label">Percentage</div>
              <div className="dmc-summary-val">
                {summary.percentage ? `${summary.percentage.toFixed(2)}%` : '—'}
              </div>
            </div>
          )}
          {preferences.showGradeSymbol !== false && (
            <div className="dmc-summary-col">
              <div className="dmc-summary-label">Overall Grade</div>
              <div className="dmc-summary-val">
                {summary.grade || '—'}
              </div>
            </div>
          )}
          {preferences.showGradePoint !== false && summary.gradePoint !== undefined && (
            <div className="dmc-summary-col">
              <div className="dmc-summary-label">Grade Point (GPA)</div>
              <div className="dmc-summary-val">
                {summary.gradePoint ? summary.gradePoint.toFixed(1) : '—'}
              </div>
            </div>
          )}
          <div className="dmc-summary-col">
            <div className="dmc-summary-label">Final Result</div>
            <div
              className={`dmc-summary-val ${
                isPending ? 'result-pending' : isPassed ? 'result-pass' : 'result-fail'
              }`}
            >
              {isPending ? 'PENDING' : isPassed ? 'PASSED' : 'FAILED'}
            </div>
          </div>
          {preferences.showPosition !== false && (
            <div className="dmc-summary-col">
              <div className="dmc-summary-label">Position in Class</div>
              <div className="dmc-summary-val">
                {formatPosition(summary.position, summary.totalStudents)}
              </div>
            </div>
          )}
          {preferences.showRemarks !== false && summary.overallRemarks && (
            <div className="dmc-summary-col">
              <div className="dmc-summary-label">Remarks</div>
              <div className="dmc-summary-val remarks">
                {summary.overallRemarks}
              </div>
            </div>
          )}
        </div>

        {/* ─── 5. Grading Scale Reference Key ─────────────────────────────── */}
        {preferences.showGradeSymbol !== false && (
          <div className="dmc-scale-strip">
            <strong>Grading Scale:</strong>
            {dmc.gradingRules && dmc.gradingRules.length > 0 ? (
              dmc.gradingRules.map((r, i) => (
                <span key={r.id || i}>
                  {i > 0 && <span style={{ margin: '0 5px', color: '#94a3b8' }}>•</span>}
                  <strong>{r.grade}</strong> ({r.minPercentage}% - {r.maxPercentage}%)
                </span>
              ))
            ) : (
              <span>
                A+ (80% - 100%) &nbsp;•&nbsp; A (70% - 79%) &nbsp;•&nbsp; B (60% - 69%) &nbsp;•&nbsp; C (50% - 59%) &nbsp;•&nbsp; D (40% - 49%) &nbsp;•&nbsp; E (33% - 39%) &nbsp;•&nbsp; F (Below 33% / Fail)
              </span>
            )}
          </div>
        )}

        {/* ─── 6. Institutional Footer: Signatures & Verification Note ─────── */}
        <div className="dmc-footer-section">
          <div className="dmc-signatures-grid">
            <div className="dmc-sig-col">
              <div className="dmc-sig-line" />
              <div className="dmc-sig-name">Class Teacher</div>
              <div className="dmc-sig-role">Prepared &amp; Verified By</div>
            </div>
            <div className="dmc-sig-col">
              <div className="dmc-stamp-box">
                <span>Official</span>
                <span>School Seal</span>
              </div>
              <div className="dmc-sig-role">Institutional Seal</div>
            </div>
            <div className="dmc-sig-col">
              {resolvedSignature ? (
                <div className="dmc-sig-img-wrap">
                  <img
                    src={resolvedSignature}
                    alt="Principal Signature"
                    className="dmc-sig-img"
                  />
                </div>
              ) : null}
              <div className="dmc-sig-line" />
              <div className="dmc-sig-name">{school.principalName || 'Principal'}</div>
              <div className="dmc-sig-role">Head of Institution</div>
            </div>
          </div>

          <div className="dmc-footer-note">
            This is an official computer-generated Detailed Marks Certificate issued by {schoolName}.
            Any alteration, erasure, or unauthorized tampering renders this document invalid.
          </div>
        </div>
      </div>
    </div>
  );
};
