import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  Camera,
  Trash2,
  User,
  Users,
  GraduationCap,
  FileCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Printer,
} from 'lucide-react';
import type { StudentItem, AcademicSession, ClassItem, SectionItem } from '../../types/electron';
import { resizeImageToMaxDimension } from '../../utils/image';
import '../../styles/students.css';

interface StudentAdmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedStudent: StudentItem) => void;
  student: StudentItem | null; // null for new admission, non-null for edit
  sessions: AcademicSession[];
  classes: ClassItem[];
  sessionToken: string;
}

export const StudentAdmissionWizard: React.FC<StudentAdmissionWizardProps> = ({
  isOpen,
  onClose,
  onSaved,
  student,
  sessions,
  classes,
  sessionToken,
}) => {
  const isEdit = Boolean(student);

  // Active Wizard Step (1: Student Info, 2: Academic Info, 3: Guardian/Address, 4: Photo & Docs, 5: Review & Save)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Success Confirmation Screen
  const [registeredStudent, setRegisteredStudent] = useState<StudentItem | null>(null);

  // STEP 1: Student Information
  // Single "Student Name" field as requested for simplicity
  const [studentFullName, setStudentFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState('');
  const [bFormNumber, setBFormNumber] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [nationality, setNationality] = useState('Pakistani');
  const [religion, setReligion] = useState('Islam');

  // STEP 2: Academic Information
  const [studentId, setStudentId] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [academicSessionId, setAcademicSessionId] = useState<number | ''>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentStatus, setStudentStatus] = useState<'Active' | 'Inactive'>('Active');
  const [rollNumber, setRollNumber] = useState('');

  // Sections for chosen class
  const [sections, setSections] = useState<SectionItem[]>([]);

  // STEP 3: Guardian / Contact / Address
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');
  const [guardianContact, setGuardianContact] = useState('');
  const [alternativeContact, setAlternativeContact] = useState('');
  const [address, setAddress] = useState('');
  const [cityLocation, setCityLocation] = useState('Lahore');

  // STEP 4: Photo & Documents
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string>('png');
  const [isPhotoRemoved, setIsPhotoRemoved] = useState<boolean>(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or reset form on open / student change
  useEffect(() => {
    if (!isOpen) return;

    setValidationError(null);
    setRegisteredStudent(null);
    setCurrentStep(1);
    setIsPhotoRemoved(false);

    if (student) {
      // Editing existing student
      setStudentFullName(student.displayName || `${student.firstName} ${student.lastName}`);
      setFatherName(student.fatherName || '');
      setDateOfBirth(student.dateOfBirth || '');
      setGender(student.gender || 'Male');
      setBloodGroup(student.bloodGroup || '');
      setBFormNumber('');
      setPrimaryPhone(student.phone || '');
      setNationality(student.nationality || 'Pakistani');
      setReligion(student.religion || 'Islam');

      setStudentId(student.studentId);
      setAdmissionNumber(student.admissionNumber || '');
      setStudentStatus(student.isActive ? 'Active' : 'Inactive');

      if (student.currentEnrollment) {
        setAcademicSessionId(student.currentEnrollment.academicSessionId);
        setClassId(student.currentEnrollment.classId);
        setSectionId(student.currentEnrollment.sectionId);
        setAdmissionDate(student.currentEnrollment.admissionDate || new Date().toISOString().split('T')[0]);
      } else {
        const curSes = sessions.find((s) => s.isActive) || sessions[0];
        setAcademicSessionId(curSes ? curSes.id : '');
        const fCls = classes.find((c) => c.isActive) || classes[0];
        setClassId(fCls ? fCls.id : '');
        setSectionId('');
        setAdmissionDate(new Date().toISOString().split('T')[0]);
      }

      setGuardianName(student.guardianName || student.fatherName || '');
      setGuardianRelationship(student.guardianRelationship || 'Father');
      setGuardianContact(student.phone || '');
      setAlternativeContact(student.alternativePhone || '');
      setAddress(student.currentAddress || '');
      setCityLocation(student.city || 'Lahore');

      if (student.photoDataUrl) {
        setPhotoPreview(student.photoDataUrl);
      } else if (student.photoPath) {
        window.electronAPI?.students?.getById(student.id).then((res) => {
          if (res.success && res.student?.photoDataUrl) {
            setPhotoPreview(res.student.photoDataUrl);
          }
        }).catch(() => {});
        setPhotoPreview(null);
      } else {
        setPhotoPreview(null);
      }
      setPhotoBase64(null);
    } else {
      // New Admission defaults
      setStudentFullName('');
      setFatherName('');
      setDateOfBirth('');
      setGender('Male');
      setBloodGroup('');
      setBFormNumber('');
      setPrimaryPhone('');
      setNationality('Pakistani');
      setReligion('Islam');

      setStudentId('');
      setAdmissionNumber(`ADM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setStudentStatus('Active');

      const currentSes = sessions.find((s) => s.isActive) || sessions[0];
      setAcademicSessionId(currentSes ? currentSes.id : '');
      const firstClass = classes.find((c) => c.isActive) || classes[0];
      setClassId(firstClass ? firstClass.id : '');
      setSectionId('');
      setRollNumber('');
      setAdmissionDate(new Date().toISOString().split('T')[0]);

      setGuardianName('');
      setGuardianRelationship('Father');
      setGuardianContact('');
      setAlternativeContact('');
      setAddress('');
      setCityLocation('Lahore');

      setPhotoPreview(null);
      setPhotoBase64(null);

      // Fetch auto-generated Student ID
      if (window.electronAPI?.students) {
        window.electronAPI.students.generateNextId().then((res) => {
          if (res.success && res.nextId) {
            setStudentId(res.nextId);
          }
        });
      }
    }
  }, [isOpen, student, sessions, classes]);

  // Load sections when class changes
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId('');
      return;
    }

    const loadSec = async () => {
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(classId));
          if (res.success) {
            const activeSecs = res.sections.filter((s) => s.isActive);
            setSections(activeSecs);
            if (!activeSecs.some((s) => s.id === Number(sectionId))) {
              setSectionId(activeSecs[0] ? activeSecs[0].id : '');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    };

    loadSec();
  }, [classId]);

  if (!isOpen) return null;

  // Handle Photo selection
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setValidationError('Please select a JPG or PNG image file.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setValidationError('Photo size must not exceed 8 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    setPhotoExt(ext);

    try {
      // Downscale to max 400x400 to prevent quota issues and preserve fast performance
      const compressed = await resizeImageToMaxDimension(file, 400);
      setPhotoPreview(compressed);
      setPhotoBase64(compressed);
      setIsPhotoRemoved(false);
      setValidationError(null);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setPhotoBase64(result);
        setIsPhotoRemoved(false);
        setValidationError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setIsPhotoRemoved(true);
  };

  // Step Validation logic
  const validateStep = (stepNumber: number): boolean => {
    setValidationError(null);

    if (stepNumber === 1) {
      if (!studentFullName.trim()) {
        setValidationError('Student Name is required.');
        return false;
      }
      if (!fatherName.trim()) {
        setValidationError("Father's Name is required.");
        return false;
      }
      if (!primaryPhone.trim()) {
        setValidationError('Primary contact number is required.');
        return false;
      }
    }

    if (stepNumber === 2) {
      if (!studentId.trim()) {
        setValidationError('Student ID is required.');
        return false;
      }
      if (!academicSessionId) {
        setValidationError('Please select an Academic Session.');
        return false;
      }
      if (!classId) {
        setValidationError('Please select an Admission Class.');
        return false;
      }
    }

    if (stepNumber === 3) {
      // Guardian & Address fields are optional or soft-validated
      if (!guardianContact.trim() && !primaryPhone.trim()) {
        setValidationError('Please provide at least one contact phone number.');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevStep = () => {
    setValidationError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit / Save Student
  const handleSaveStudent = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    // Derive firstName and lastName for database compatibility
    const trimmedFullName = studentFullName.trim();
    const nameParts = trimmedFullName.split(/\s+/);
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '—';

    try {
      if (isEdit && student) {
        // Update existing student: pass stable internal database record ID 'id',
        // and preserve studentId and admissionNumber
        const updatePayload = {
          sessionToken,
          id: student.id,
          studentId: studentId.trim() || student.studentId,
          admissionNumber: admissionNumber.trim() || student.admissionNumber,
          firstName,
          lastName,
          displayName: trimmedFullName,
          gender,
          dateOfBirth,
          bloodGroup,
          nationality,
          religion,
          fatherName: fatherName.trim(),
          guardianName: guardianName.trim() || fatherName.trim(),
          guardianRelationship,
          phone: primaryPhone.trim(),
          alternativePhone: alternativeContact.trim() || guardianContact.trim(),
          currentAddress: address.trim(),
          permanentAddress: address.trim(),
          city: cityLocation.trim(),
          province: 'Punjab',
          isActive: studentStatus === 'Active',
          academicSessionId: academicSessionId ? Number(academicSessionId) : undefined,
          classId: classId ? Number(classId) : undefined,
          sectionId: sectionId ? Number(sectionId) : undefined,
          enrollment:
            academicSessionId && classId
              ? {
                  academicSessionId: Number(academicSessionId),
                  classId: Number(classId),
                  sectionId: sectionId ? Number(sectionId) : undefined,
                  admissionDate: admissionDate || undefined,
                  status: studentStatus,
                }
              : undefined,
        };

        const res = await window.electronAPI!.students.update(updatePayload);
        if (!res.success || !res.student) {
          setValidationError(res.error || 'Failed to update student profile.');
          setIsSubmitting(false);
          return;
        }

        let updatedStudent = res.student;

        // Upload photo if new photo selected
        if (photoBase64) {
          const upRes = await window.electronAPI!.students.uploadPhoto({
            sessionToken,
            studentId: student.id,
            base64Data: photoBase64,
            fileExtension: photoExt,
          });
          if (upRes.success && upRes.dataUrl) {
            updatedStudent = {
              ...updatedStudent,
              photoDataUrl: upRes.dataUrl,
              photoPath: upRes.photoPath || updatedStudent.photoPath,
            };
          }
        } else if (isPhotoRemoved) {
          await window.electronAPI!.students.removePhoto(sessionToken, student.id);
          updatedStudent = {
            ...updatedStudent,
            photoDataUrl: null,
            photoPath: null,
          };
        }

        onSaved(updatedStudent);
      } else {
        // Create new student
        const createPayload = {
          sessionToken,
          studentId: studentId.trim(),
          admissionNumber: admissionNumber.trim() || undefined,
          firstName,
          lastName,
          gender,
          dateOfBirth,
          bloodGroup,
          nationality,
          religion,
          fatherName: fatherName.trim(),
          guardianName: guardianName.trim() || fatherName.trim(),
          guardianRelationship,
          phone: primaryPhone.trim(),
          alternativePhone: alternativeContact.trim() || guardianContact.trim(),
          currentAddress: address.trim(),
          permanentAddress: address.trim(),
          city: cityLocation.trim(),
          province: 'Punjab',
          academicSessionId: Number(academicSessionId),
          classId: Number(classId),
          sectionId: sectionId ? Number(sectionId) : undefined,
          rollNumber: rollNumber.trim() || undefined,
          admissionDate,
          enrollment:
            academicSessionId && classId
              ? {
                  academicSessionId: Number(academicSessionId),
                  classId: Number(classId),
                  sectionId: sectionId ? Number(sectionId) : undefined,
                  rollNumber: rollNumber.trim() || undefined,
                  admissionDate,
                  status: studentStatus,
                }
              : undefined,
        };

        const res = await window.electronAPI!.students.create(createPayload);
        if (!res.success || !res.student) {
          setValidationError(res.error || 'Failed to register student record.');
          setIsSubmitting(false);
          return;
        }

        // Upload photo if selected
        if (photoBase64 && res.student.id) {
          await window.electronAPI!.students.uploadPhoto({
            sessionToken,
            studentId: res.student.id,
            base64Data: photoBase64,
            fileExtension: photoExt,
          });
        }

        setRegisteredStudent(res.student);
        onSaved(res.student);
      }
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step definitions
  const steps = [
    { number: 1, title: 'Student Info', desc: 'Identity & demographics' },
    { number: 2, title: 'Academic Info', desc: 'Class, session & IDs' },
    { number: 3, title: 'Guardian & Address', desc: 'Contact & residence' },
    { number: 4, title: 'Photo & Docs', desc: 'Picture upload' },
    { number: 5, title: 'Review & Save', desc: 'Verify & commit' },
  ];

  return (
    <div className="modal-overlay">
      <div className="wizard-modal-card">
        {/* Modal Header */}
        <div className="modal-header-bar">
          <div className="modal-header-left">
            <div className="modal-header-icon">
              <User size={20} />
            </div>
            <div className="modal-header-titles">
              <h2>{isEdit ? 'Edit Student Profile' : 'Add New Student'}</h2>
              <p>
                {isEdit
                  ? `Editing student record for ${student?.displayName} (${student?.studentId})`
                  : 'Complete the steps below to register a new student.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-icon-btn" title="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Successful Registration Screen */}
        {registeredStudent ? (
          <div className="wizard-success-screen">
            <div className="wizard-success-icon">
              <CheckCircle2 size={36} />
            </div>
            <h2>Student Successfully Registered</h2>
            <p>
              The student profile and academic enrollment have been created and saved in the school database.
            </p>
            <div className="registered-id-card">
              Student ID: {registeredStudent.studentId}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-modal-secondary"
              >
                <Printer size={14} />
                <span>Print Admission Slip</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegisteredStudent(null);
                  setCurrentStep(1);
                  setStudentFullName('');
                  setFatherName('');
                  setPrimaryPhone('');
                  setAdmissionNumber(`ADM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                  if (window.electronAPI?.students) {
                    window.electronAPI.students.generateNextId().then((res) => {
                      if (res.success && res.nextId) setStudentId(res.nextId);
                    });
                  }
                }}
                className="btn-modal-secondary"
              >
                + Register Another Student
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-modal-primary"
              >
                Done & Return to Directory
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Steps Progress Track */}
            <div className="wizard-steps-track">
              {steps.map((st, idx) => {
                const isCurrent = currentStep === st.number;
                const isCompleted = currentStep > st.number;

                return (
                  <React.Fragment key={st.number}>
                    <button
                      type="button"
                      onClick={() => {
                        if (st.number < currentStep) setCurrentStep(st.number);
                      }}
                      disabled={st.number > currentStep}
                      className={`wizard-step-node ${isCurrent ? 'active' : ''}`}
                    >
                      <div className={`step-circle ${isCurrent ? 'active' : isCompleted ? 'completed' : 'pending'}`}>
                        {isCompleted ? <CheckCircle2 size={14} /> : st.number}
                      </div>
                      <div>
                        <span className="step-text-title">{st.title}</span>
                        <span className="step-text-desc">{st.desc}</span>
                      </div>
                    </button>
                    {idx < steps.length - 1 && <div className="step-divider-line" />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Error Notification */}
            {validationError && (
              <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Wizard Body Steps */}
            <div className="wizard-content-body">
              {/* ════ STEP 1: STUDENT INFORMATION ════ */}
              {currentStep === 1 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <User size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 1: Student Information</h3>
                  </div>

                  <div className="form-2col-grid">
                    {/* Single Student Name field */}
                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">
                        Student Full Name <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentFullName}
                        onChange={(e) => setStudentFullName(e.target.value)}
                        placeholder="e.g. Muhammad Ali Khan"
                        className="form-field-input"
                        autoFocus
                      />
                      <span className="form-field-helper">Enter the student's full name as on official documents.</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Father's Full Name <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="e.g. Tariq Mehmood"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Primary Contact Number <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={primaryPhone}
                        onChange={(e) => setPrimaryPhone(e.target.value)}
                        placeholder="e.g. 0300-1234567"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Date of Birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Gender <span className="required-star">*</span>
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                        className="form-field-input"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="form-field-input"
                      >
                        <option value="">Select blood group...</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">B-Form / CNIC Number</label>
                      <input
                        type="text"
                        value={bFormNumber}
                        onChange={(e) => setBFormNumber(e.target.value)}
                        placeholder="35202-XXXXXXXX-X"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Nationality</label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="Pakistani"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Religion</label>
                      <input
                        type="text"
                        value={religion}
                        onChange={(e) => setReligion(e.target.value)}
                        placeholder="Islam"
                        className="form-field-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 2: ACADEMIC INFORMATION ════ */}
              {currentStep === 2 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <GraduationCap size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 2: Academic Information</h3>
                  </div>

                  <div className="form-2col-grid">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        Student ID <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        disabled={isEdit}
                        placeholder="STD-2026-0001"
                        className="form-field-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span className="form-field-helper">Unique permanent identifier in the school database.</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Admission Number</label>
                      <input
                        type="text"
                        value={admissionNumber}
                        onChange={(e) => setAdmissionNumber(e.target.value)}
                        placeholder="ADM-2026-001"
                        className="form-field-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span className="form-field-helper">Official register or ledger admission number.</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Academic Session <span className="required-star">*</span>
                      </label>
                      <select
                        value={academicSessionId}
                        onChange={(e) => setAcademicSessionId(e.target.value ? Number(e.target.value) : '')}
                        className="form-field-input"
                      >
                        <option value="">Select Session...</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.isActive ? '(Current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Class <span className="required-star">*</span>
                      </label>
                      <select
                        value={classId}
                        onChange={(e) => {
                          setClassId(e.target.value ? Number(e.target.value) : '');
                          setSectionId('');
                        }}
                        className="form-field-input"
                      >
                        <option value="">Select Class...</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Section</label>
                      <select
                        value={sectionId}
                        onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
                        disabled={!classId}
                        className="form-field-input"
                      >
                        <option value="">Select Section (Optional)...</option>
                        {sections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Roll Number</label>
                      <input
                        type="text"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="e.g. 15"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Admission Date</label>
                      <input
                        type="date"
                        value={admissionDate}
                        onChange={(e) => setAdmissionDate(e.target.value)}
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Student Status</label>
                      <select
                        value={studentStatus}
                        onChange={(e) => setStudentStatus(e.target.value as 'Active' | 'Inactive')}
                        className="form-field-input"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 3: GUARDIAN / CONTACT / ADDRESS ════ */}
              {currentStep === 3 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <Users size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 3: Guardian, Contact & Address</h3>
                  </div>

                  <div className="form-2col-grid">
                    <div className="form-field-group">
                      <label className="form-field-label">Parent / Guardian Name</label>
                      <input
                        type="text"
                        value={guardianName || fatherName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="Guardian full name"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Relationship to Student</label>
                      <input
                        type="text"
                        value={guardianRelationship}
                        onChange={(e) => setGuardianRelationship(e.target.value)}
                        placeholder="Father, Mother, Uncle..."
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Guardian Contact Number</label>
                      <input
                        type="text"
                        value={guardianContact || primaryPhone}
                        onChange={(e) => setGuardianContact(e.target.value)}
                        placeholder="0300-XXXXXXX"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Alternative / Emergency Contact</label>
                      <input
                        type="text"
                        value={alternativeContact}
                        onChange={(e) => setAlternativeContact(e.target.value)}
                        placeholder="Emergency contact phone"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">Residential Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street address, House number, Area..."
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">City / Location</label>
                      <input
                        type="text"
                        value={cityLocation}
                        onChange={(e) => setCityLocation(e.target.value)}
                        placeholder="Lahore"
                        className="form-field-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 4: DOCUMENTS & PHOTO ════ */}
              {currentStep === 4 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <Camera size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 4: Student Photo & Identification</h3>
                  </div>

                  <div className="photo-upload-container">
                    <div className="photo-preview-box">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Student Preview"
                          onError={() => setPhotoPreview(null)}
                        />
                      ) : (
                        <User size={40} style={{ color: 'var(--color-neutral-300)' }} />
                      )}
                    </div>

                    <div className="photo-upload-actions">
                      <label className="btn-upload-file">
                        <Upload size={14} />
                        <span>{photoPreview ? 'Change Photo' : 'Upload Student Photo'}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handlePhotoSelect}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {photoPreview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="btn-remove-photo"
                        >
                          <Trash2 size={12} />
                          <span>Remove Photo</span>
                        </button>
                      )}

                      <span style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>
                        Recommended: Passport size photo (JPG/PNG under 5 MB).
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 5: REVIEW & CONFIRM ════ */}
              {currentStep === 5 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <FileCheck size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 5: Review Student Information</h3>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-500)' }}>
                    Please review the details below before saving the student record to the local database.
                  </p>

                  <div className="review-summary-card">
                    {/* Student Basic */}
                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Student Name</span>
                        <span className="review-item-val">{studentFullName || '—'}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Father's Name</span>
                        <span className="review-item-val">{fatherName || '—'}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Gender & DOB</span>
                        <span className="review-item-val">{gender} • {dateOfBirth || '—'}</span>
                      </div>
                    </div>

                    {/* Academic */}
                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Student ID</span>
                        <span className="review-item-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                          {studentId}
                        </span>
                      </div>
                      <div>
                        <span className="review-item-label">Admission No.</span>
                        <span className="review-item-val" style={{ fontFamily: 'var(--font-mono)' }}>
                          {admissionNumber || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="review-item-label">Class & Section</span>
                        <span className="review-item-val">
                          {classes.find((c) => c.id === Number(classId))?.name || '—'}
                          {sectionId ? ` (${sections.find((s) => s.id === Number(sectionId))?.name})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Contact & Location */}
                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Primary Contact</span>
                        <span className="review-item-val">{primaryPhone || '—'}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Guardian / Rel</span>
                        <span className="review-item-val">
                          {guardianName || fatherName} ({guardianRelationship})
                        </span>
                      </div>
                      <div>
                        <span className="review-item-label">City / Address</span>
                        <span className="review-item-val">{cityLocation} • {address || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="modal-footer-bar">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="btn-modal-secondary"
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="btn-modal-secondary"
                >
                  Cancel
                </button>

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="btn-modal-primary"
                  >
                    <span>Next Step</span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveStudent}
                    disabled={isSubmitting}
                    className="btn-modal-primary"
                  >
                    <CheckCircle2 size={14} />
                    <span>{isSubmitting ? 'Saving Student...' : 'Save Student'}</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
