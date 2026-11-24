import React from 'react';
import { User } from 'lucide-react';
import type { StudentDocumentPayload } from '../../types/electron';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/documents.css';

interface StudentDocumentCertificateProps {
  document: StudentDocumentPayload;
}

export const StudentDocumentCertificate: React.FC<StudentDocumentCertificateProps> = ({ document }) => {
  const { school, student, details, title, issueDate, documentNumber, documentType, schoolLogoDataUrl } = document;
  const principalSignature = (school as any)?.signatureDataUrl || (school as any)?.signaturePath || null;

  return (
    <div className="cert-document-wrapper">
      <div className="cert-document" id={`doc-cert-${student.id}`}>
        <div className="cert-inner-frame">
          {/* ─── 1. Institutional Header ─────────────────────────────────────── */}
          <div className="cert-header">
            {/* Left: School Crest / Logo */}
            <div className="cert-header-left">
              <InstitutionLogo
                size={76}
                src={schoolLogoDataUrl || school.logoDataUrl}
                schoolName={school.schoolName}
                framed
              />
            </div>

            {/* Center: School Info */}
            <div className="cert-header-center">
              <h1 className="cert-school-name">{school.schoolName}</h1>
              {(school as any).tagline && <p className="cert-school-tagline">{(school as any).tagline}</p>}
              {school.address && <p className="cert-school-address">{school.address}</p>}
              <div className="cert-school-contacts">
                {school.phone && <span>Tel: {school.phone}</span>}
                {school.phone && (school.email || school.schoolCode) && <span className="cert-bullet">•</span>}
                {school.email && <span>Email: {school.email}</span>}
                {school.email && school.schoolCode && <span className="cert-bullet">•</span>}
                {school.schoolCode && <span>School Code: {school.schoolCode}</span>}
              </div>
            </div>

            {/* Right: Student Passport Photo Frame */}
            <div className="cert-header-right">
              <div className="cert-photo-box">
                {student.photoDataUrl ? (
                  <img
                    src={student.photoDataUrl}
                    alt={student.displayName}
                    className="cert-photo-img"
                  />
                ) : (
                  <div className="cert-photo-placeholder">
                    <User size={26} className="cert-photo-icon" />
                    <span>Affix Photo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Classical Decorative Divider */}
          <div className="cert-divider">
            <div className="cert-divider-line" />
            <div className="cert-divider-embellishment">❖</div>
            <div className="cert-divider-line" />
          </div>

          {/* ─── 2. Certificate Title & Reference Meta ───────────────────────── */}
          <div className="cert-title-section">
            <div className="cert-title-badge">
              {title}
            </div>
            <div className="cert-meta-row">
              <div className="cert-meta-item">
                <span className="cert-meta-label">Ref / Certificate No:</span>
                <span className="cert-meta-value cert-meta-docno">{documentNumber || '—'}</span>
              </div>
              <div className="cert-meta-item">
                <span className="cert-meta-label">Date of Issue:</span>
                <span className="cert-meta-value">{issueDate}</span>
              </div>
            </div>
          </div>

          {/* ─── 3. Certificate Narrative / Body ─────────────────────────────── */}
          <div className="cert-body">
            {/* Document Type A: Bonafide / Student Certificate */}
            {documentType === 'Bonafide' && (
              <>
                <p>
                  This is to officially certify that{' '}
                  <span className="cert-student-highlight">{student.displayName}</span>
                  , {student.gender === 'Female' ? 'daughter' : 'son'} of{' '}
                  <strong className="cert-strong">{student.fatherName}</strong>
                  , registered under System <strong>Student ID: </strong>
                  <span className="cert-tag">{student.studentId}</span>
                  {student.admissionNumber ? (
                    <> and Admission Number <strong className="cert-strong">{student.admissionNumber}</strong></>
                  ) : null}
                  , is a bonafide and regular student of this institution.
                </p>

                <p>
                  The student is presently enrolled in Class{' '}
                  <strong className="cert-strong">{student.className}</strong>
                  {student.sectionName ? <>, Section <strong className="cert-strong">{student.sectionName}</strong></> : null}
                  {student.rollNumber ? <>, Roll No. <strong className="cert-strong">{student.rollNumber}</strong></> : null}
                  {' '}for the Academic Session{' '}
                  <strong className="cert-strong">{student.academicSessionName}</strong>.
                </p>

                <p>
                  During his/her period of stay at this institution, his/her general conduct and moral behavior
                  have been evaluated as <strong className="cert-strong">{details.conduct || 'Good'}</strong>.
                  According to our official school records, he/she has maintained satisfactory attendance
                  and shown keen enthusiasm towards academic and co-curricular programs.
                </p>

                {details.remarks && (
                  <div className="cert-remarks-box">
                    <strong>Special Remarks: </strong>{details.remarks}
                  </div>
                )}

                <p>
                  This certificate is issued upon lawful request by the parent/guardian for official identification,
                  scholarship, visa, or educational verification purposes. We wish the student continued excellence
                  in all academic pursuits.
                </p>
              </>
            )}

            {/* Document Type B: Character Certificate */}
            {documentType === 'Character' && (
              <>
                <p>
                  This is to solemnly certify that{' '}
                  <span className="cert-student-highlight">{student.displayName}</span>
                  , {student.gender === 'Female' ? 'daughter' : 'son'} of{' '}
                  <strong className="cert-strong">{student.fatherName}</strong>
                  , registered under System <strong>Student ID: </strong>
                  <span className="cert-tag">{student.studentId}</span>
                  {student.admissionNumber ? (
                    <> (Admission #{student.admissionNumber})</>
                  ) : null}
                  , was a regular student of Class{' '}
                  <strong className="cert-strong">{student.className}</strong>
                  {student.sectionName ? <>, Section <strong className="cert-strong">{student.sectionName}</strong></> : null}
                  {' '}during the Academic Session{' '}
                  <strong className="cert-strong">{student.academicSessionName}</strong>.
                </p>

                <p>
                  To the best of our knowledge, observation, and institutional record, he/she bears an{' '}
                  <strong className="cert-strong uppercase text-emerald-800">
                    {details.conduct || 'Exemplary'}
                  </strong>{' '}
                  moral character and upright deportment. During his/her tenure at this institution,
                  he/she has observed all school rules, shown obedience to faculty, and has not participated
                  in any political, disruptive, or subversive activity detrimental to the discipline and
                  reputation of this institution.
                </p>

                {details.remarks && (
                  <div className="cert-remarks-box">
                    <strong>Administrative Observations: </strong>{details.remarks}
                  </div>
                )}

                <p>
                  The institution takes pride in certifying his/her character and wishes him/her resounding success,
                  honor, and prosperity in all future academic, career, and personal endeavors.
                </p>
              </>
            )}

            {/* Document Type C: School Leaving / Transfer Certificate */}
            {documentType === 'Leaving' && (
              <>
                <p style={{ textIndent: 0, marginBottom: '10px' }}>
                  This School Leaving / Transfer Certificate is issued to officially attest that the student particulars
                  recorded below correspond accurately with the official institutional admission and withdrawal registers:
                </p>

                <div className="cert-ledger-table-wrap">
                  <table className="cert-ledger-table">
                    <tbody>
                      <tr>
                        <td className="cert-ledger-label">1. Student Full Name:</td>
                        <td className="cert-ledger-value">{student.displayName}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">2. Father / Guardian Name:</td>
                        <td className="cert-ledger-value">{student.fatherName}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">3. System Student ID:</td>
                        <td className="cert-ledger-value"><span className="cert-tag">{student.studentId}</span></td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">4. School Admission Number:</td>
                        <td className="cert-ledger-value">{student.admissionNumber || '—'}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">5. Date of Birth:</td>
                        <td className="cert-ledger-value">{student.dateOfBirth || '—'}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">6. Nationality / Religion:</td>
                        <td className="cert-ledger-value">{student.nationality || 'Pakistani'} / {student.religion || 'Islam'}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">7. Date of Admission:</td>
                        <td className="cert-ledger-value">{student.admissionDate || '—'}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">8. Class at Time of Leaving:</td>
                        <td className="cert-ledger-value cert-strong">{student.className} {student.sectionName ? `(${student.sectionName})` : ''}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">9. Academic Session:</td>
                        <td className="cert-ledger-value">{student.academicSessionName}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">10. Reason for Leaving:</td>
                        <td className="cert-ledger-value">{details.reasonForLeaving || "Parents' Request"}</td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">11. School Dues Status:</td>
                        <td className="cert-ledger-value" style={{ color: details.duesCleared !== false ? '#15803d' : '#b91c1c' }}>
                          {details.duesCleared !== false ? 'Cleared Up to Date' : 'Outstanding / Pending Settlement'}
                        </td>
                      </tr>
                      <tr>
                        <td className="cert-ledger-label">12. Conduct and Character:</td>
                        <td className="cert-ledger-value cert-strong">{details.conduct || 'Satisfactory & Good'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {details.remarks && (
                  <div className="cert-remarks-box">
                    <strong>Remarks: </strong>{details.remarks}
                  </div>
                )}
              </>
            )}

            {/* Document Type D: General Student Certificate */}
            {documentType === 'General' && (
              <>
                <p>
                  This is to certify that{' '}
                  <span className="cert-student-highlight">{student.displayName}</span>
                  , {student.gender === 'Female' ? 'daughter' : 'son'} of{' '}
                  <strong className="cert-strong">{student.fatherName}</strong>
                  , holding Student ID <span className="cert-tag">{student.studentId}</span>
                  {student.admissionNumber ? <>, Admission No. <strong className="cert-strong">{student.admissionNumber}</strong></> : null}
                  , is a recognized student of this institution in Class{' '}
                  <strong className="cert-strong">{student.className}</strong>
                  {student.sectionName ? <>, Section <strong className="cert-strong">{student.sectionName}</strong></> : null}
                  {' '}for Academic Session <strong className="cert-strong">{student.academicSessionName}</strong>.
                </p>

                {details.customContent ? (
                  <div className="cert-custom-content-box">
                    {details.customContent}
                  </div>
                ) : (
                  <p>
                    The student has actively participated in curricular and academic assignments in accordance
                    with institutional standards. He/She has complied with all policies and conduct norms
                    mandated by the school administration.
                  </p>
                )}

                {details.remarks && (
                  <div className="cert-remarks-box">
                    <strong>Official Remarks: </strong>{details.remarks}
                  </div>
                )}

                <p>
                  This testimonial is issued upon request for official verification and record documentation.
                </p>
              </>
            )}
          </div>

          {/* ─── 4. Signatures & Official Stamp ──────────────────────────────── */}
          <div className="cert-footer">
            <div className="cert-signatures-grid">
              {/* Column 1: Class Teacher */}
              <div className="cert-sig-column">
                <div className="cert-sig-line" />
                <div className="cert-sig-title">Class Teacher</div>
                <div className="cert-sig-subtitle">Signature</div>
              </div>

              {/* Column 2: Official Institutional Seal / Stamp */}
              <div className="cert-sig-column cert-stamp-column">
                <div className="cert-stamp-circle">
                  <span className="cert-stamp-text-top">OFFICIAL SEAL</span>
                  <span className="cert-stamp-star">★ ★ ★</span>
                  <span className="cert-stamp-text-bottom">INSTITUTION STAMP</span>
                </div>
                <div className="cert-sig-subtitle">Institution Seal</div>
              </div>

              {/* Column 3: Principal / Head of Institution */}
              <div className="cert-sig-column">
                <div className="cert-sig-line">
                  {principalSignature && (
                    <img
                      src={principalSignature}
                      alt="Principal Signature"
                      className="cert-sig-img"
                    />
                  )}
                </div>
                <div className="cert-sig-title">
                  {school.principalName ? school.principalName : 'Principal / Head of Institution'}
                </div>
                <div className="cert-sig-subtitle">Authorized Signature & Seal</div>
              </div>
            </div>

            {/* Verification Footer Note */}
            <div className="cert-bottom-note">
              This is a verified official institutional certificate issued under the authority of {school.schoolName}. Valid with original signature and official seal.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
