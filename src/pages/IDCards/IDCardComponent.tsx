import React from 'react';
import { User } from 'lucide-react';
import type { StudentItem, SchoolSettings } from '../../types/electron';
import { getInstitutionInitial } from '../../components/Common/InstitutionLogo';

export interface IDCardComponentProps {
  student: StudentItem;
  school: SchoolSettings | null;
  mode?: 'both' | 'front' | 'back';
}

export const IDCardComponent: React.FC<IDCardComponentProps> = ({
  student,
  school,
  mode = 'both',
}) => {
  const schoolName = (school?.schoolName || 'MS INSTITUTE OF LEARNING').trim();
  const schoolInitial = getInstitutionInitial(schoolName);
  const schoolLogo = (school as any)?.logoDataUrl || school?.logoPath || null;
  const principalSignature = (school as any)?.signatureDataUrl || (school as any)?.signaturePath || null;

  const studentName = (
    student.displayName ||
    `${student.firstName} ${student.lastName || ''}`.trim() ||
    'Student Name'
  ).trim();

  const fatherName = student.fatherName?.trim() || '—';
  const studentId = student.studentId?.trim() || `STD-${student.id}`;
  const admissionNumber = student.admissionNumber?.trim() || '—';
  const className = student.currentEnrollment?.className || 'Class';
  const sectionName = student.currentEnrollment?.sectionName || 'A';
  const sessionName =
    student.currentEnrollment?.academicSessionName ||
    school?.academicSession ||
    '2026-2027';

  const emergencyPhone =
    student.phone?.trim() ||
    student.alternativePhone?.trim() ||
    school?.phone?.trim() ||
    '—';

  const schoolAddress = [
    school?.address?.trim(),
    school?.city?.trim(),
    school?.province?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  /* ─── Front Face ────────────────────────────────────────── */
  const renderFrontFace = () => (
    <div className="id-card-wrapper">
      <div className="id-card-face">
        {/* Front Header */}
        <div className="id-card-front-header">
          {schoolLogo ? (
            <img
              src={schoolLogo}
              alt={schoolName}
              className="id-card-front-logo"
            />
          ) : (
            <div className="id-card-front-logo-fallback">
              {schoolInitial}
            </div>
          )}
          <div className="id-card-front-school-info">
            <div className="id-card-front-school-name" title={schoolName}>
              {schoolName}
            </div>
            <div className="id-card-front-badge-title">
              Student Identity Card
            </div>
          </div>
        </div>

        {/* Front Body */}
        <div className="id-card-front-body">
          {/* Photo */}
          <div className="id-card-front-photo-wrap">
            {student.photoDataUrl ? (
              <img
                src={student.photoDataUrl}
                alt={studentName}
                className="id-card-front-photo-img"
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: '#94a3b8',
                }}
              >
                <User size={38} strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="id-card-front-details">
            <div className="id-card-student-name" title={studentName}>
              {studentName}
            </div>

            <div className="id-card-detail-row">
              <span className="id-card-detail-label">Father Name:</span>
              <span className="id-card-detail-value" title={fatherName}>
                {fatherName}
              </span>
            </div>

            <div className="id-card-detail-row">
              <span className="id-card-detail-label">Student ID:</span>
              <span className="id-card-detail-value highlight">
                {studentId}
              </span>
            </div>

            <div className="id-card-detail-row">
              <span className="id-card-detail-label">Adm No:</span>
              <span className="id-card-detail-value">
                {admissionNumber}
              </span>
            </div>

            <div className="id-card-detail-row">
              <span className="id-card-detail-label">Class & Sec:</span>
              <span className="id-card-detail-value">
                {className} ({sectionName})
              </span>
            </div>

            <div className="id-card-detail-row">
              <span className="id-card-detail-label">Session:</span>
              <span className="id-card-detail-value">
                {sessionName}
              </span>
            </div>
          </div>
        </div>

        {/* Front Footer */}
        <div className="id-card-front-footer">
          <span>Emergency: {emergencyPhone}</span>
          <span>{student.bloodGroup ? `Blood: ${student.bloodGroup}` : 'Official Card'}</span>
        </div>
      </div>
    </div>
  );

  /* ─── Back Face ─────────────────────────────────────────── */
  const renderBackFace = () => (
    <div className="id-card-wrapper">
      <div className="id-card-face">
        {/* Back Header */}
        <div className="id-card-back-header">
          Terms & Conditions
        </div>

        {/* Back Body */}
        <div className="id-card-back-body">
          <ul className="id-card-instructions">
            <li>This card is non-transferable and remains property of the institute.</li>
            <li>Student must carry and visibly display this card during campus hours.</li>
            <li>Loss of this card must be immediately reported to the school office.</li>
          </ul>

          <div className="id-card-return-box">
            <div className="id-card-return-title">If found, please return to:</div>
            <div className="id-card-return-text">
              <strong>{schoolName}</strong>
              {schoolAddress ? <div>{schoolAddress}</div> : null}
              <div>
                {school?.phone ? `Tel: ${school.phone}` : ''}
                {school?.phone && school?.email ? ' | ' : ''}
                {school?.email ? `Email: ${school.email}` : ''}
              </div>
            </div>
          </div>

          {/* Back Footer */}
          <div className="id-card-back-footer">
            <span style={{ fontSize: '5pt', color: '#64748b', fontWeight: 600 }}>
              Session: {sessionName}
            </span>
            <div className="id-card-sig-container">
              {principalSignature ? (
                <img
                  src={principalSignature}
                  alt="Principal Signature"
                  className="id-card-sig-img"
                />
              ) : null}
              <div className="id-card-sig-line">
                Principal Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'front') {
    return <div className="id-card-row">{renderFrontFace()}</div>;
  }

  if (mode === 'back') {
    return <div className="id-card-row">{renderBackFace()}</div>;
  }

  // mode === 'both' (Side-by-side front and back)
  return (
    <div className="id-card-row">
      {renderFrontFace()}
      <div className="id-card-fold-indicator" />
      {renderBackFace()}
    </div>
  );
};
