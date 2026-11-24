import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  Trash2,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  User,
  Phone,
  BookOpen,
} from 'lucide-react';
import type { TeacherItem, ClassItem, SubjectItem } from '../../types/electron';
import '../../styles/teachers.css';

interface TeacherAdmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedTeacher: TeacherItem) => void;
  teacher: TeacherItem | null;
  sessionToken: string;
}

export const TeacherAdmissionWizard: React.FC<TeacherAdmissionWizardProps> = ({
  isOpen,
  onClose,
  onSaved,
  teacher,
  sessionToken,
}) => {
  const isEdit = Boolean(teacher);

  // Active step (1: Personal, 2: Contact & Address, 3: Professional, 4: Review & Save)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [registeredTeacher, setRegisteredTeacher] = useState<TeacherItem | null>(null);

  // STEP 1: Personal Information
  const [teacherFullName, setTeacherFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string>('png');

  // STEP 2: Contact & Address
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Lahore');
  const [province, setProvince] = useState('Punjab');
  const [address, setAddress] = useState('');

  // STEP 3: Professional Information
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [designation, setDesignation] = useState('Senior Teacher');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employmentStatus, setEmploymentStatus] = useState<'Active' | 'Inactive' | 'On Leave' | 'Resigned'>('Active');

  // Assigned Classes & Subjects
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectItem[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load available classes & subjects
  useEffect(() => {
    if (!isOpen) return;

    const loadMetadata = async () => {
      try {
        if (window.electronAPI?.classes) {
          const cRes = await window.electronAPI.classes.getAll();
          if (cRes.success) setAvailableClasses(cRes.classes);
        }
        if (window.electronAPI?.subjects) {
          const sRes = await window.electronAPI.subjects.getAll();
          if (sRes.success) setAvailableSubjects(sRes.subjects);
        }
      } catch (err) {
        console.error('Failed to load classes/subjects:', err);
      }
    };

    loadMetadata();
  }, [isOpen]);

  // Reset or populate fields
  useEffect(() => {
    if (!isOpen) return;

    setValidationError(null);
    setRegisteredTeacher(null);
    setCurrentStep(1);

    if (teacher) {
      setTeacherFullName(teacher.displayName || `${teacher.firstName} ${teacher.lastName}`);
      setFatherName('');
      setGender(teacher.gender || 'Male');
      setDateOfBirth(teacher.dateOfBirth || '');
      setTeacherId(teacher.teacherId);
      setEmployeeId(teacher.employeeId || '');

      setPhone(teacher.phone || '');
      setEmail(teacher.email || '');
      setCity(teacher.city || 'Lahore');
      setProvince(teacher.province || 'Punjab');
      setAddress(teacher.address || '');

      setQualification(teacher.qualification || '');
      setSpecialization(teacher.specialization || '');
      setDesignation(teacher.designation || 'Senior Teacher');
      setJoiningDate(teacher.joiningDate || new Date().toISOString().split('T')[0]);
      setEmploymentStatus(teacher.employmentStatus || 'Active');

      if (teacher.photoDataUrl) {
        setPhotoPreview(teacher.photoDataUrl);
      } else {
        setPhotoPreview(null);
      }
      setPhotoBase64(null);
    } else {
      setTeacherFullName('');
      setFatherName('');
      setGender('Male');
      setDateOfBirth('');
      setTeacherId('');
      setEmployeeId(`EMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);

      setPhone('');
      setEmail('');
      setCity('Lahore');
      setProvince('Punjab');
      setAddress('');

      setQualification('M.Sc. Mathematics');
      setSpecialization('Mathematics');
      setDesignation('Senior Teacher');
      setJoiningDate(new Date().toISOString().split('T')[0]);
      setEmploymentStatus('Active');
      setAssignedClasses([]);
      setAssignedSubjects([]);

      setPhotoPreview(null);
      setPhotoBase64(null);

      // Fetch auto-generated Teacher ID
      if (window.electronAPI?.teachers) {
        window.electronAPI.teachers.generateNextId().then((res) => {
          if (res.success && res.nextId) {
            setTeacherId(res.nextId);
          }
        });
      }
    }
  }, [isOpen, teacher]);

  if (!isOpen) return null;

  // Photo handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setValidationError('Please select a JPG or PNG image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Photo size must not exceed 5 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    setPhotoExt(ext);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
      setValidationError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
  };

  // Step validation
  const validateStep = (stepNumber: number): boolean => {
    setValidationError(null);

    if (stepNumber === 1) {
      if (!teacherFullName.trim()) {
        setValidationError('Teacher Name is required.');
        return false;
      }
      if (!teacherId.trim()) {
        setValidationError('Teacher ID is required.');
        return false;
      }
      if (!employeeId.trim()) {
        setValidationError('Employee ID is required.');
        return false;
      }
    }

    if (stepNumber === 2) {
      if (!phone.trim()) {
        setValidationError('Primary phone number is required.');
        return false;
      }
    }

    if (stepNumber === 3) {
      if (!qualification.trim()) {
        setValidationError('Qualification is required (e.g. M.Sc. Mathematics, B.Ed).');
        return false;
      }
      if (!designation.trim()) {
        setValidationError('Designation is required (e.g. Senior Teacher, Head of Department).');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevStep = () => {
    setValidationError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Save submission
  const handleSaveTeacher = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setIsSubmitting(true);
    setValidationError(null);

    const trimmedFullName = teacherFullName.trim();
    const nameParts = trimmedFullName.split(/\s+/);
    const firstName = nameParts[0] || 'Teacher';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '—';

    try {
      if (isEdit && teacher) {
        // Update teacher
        const updatePayload = {
          sessionToken,
          id: teacher.id,
          employeeId: employeeId.trim(),
          firstName,
          lastName,
          displayName: trimmedFullName,
          gender,
          dateOfBirth,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          qualification: qualification.trim(),
          specialization: specialization.trim() || undefined,
          joiningDate,
          designation: designation.trim(),
          employmentStatus,
        };

        const res = await window.electronAPI!.teachers.update(updatePayload);
        if (!res.success || !res.teacher) {
          setValidationError(res.error || 'Failed to update teacher profile.');
          setIsSubmitting(false);
          return;
        }

        if (photoBase64) {
          await window.electronAPI!.teachers.uploadPhoto({
            sessionToken,
            teacherId: teacher.id,
            base64Data: photoBase64,
            fileExtension: photoExt,
          });
        }

        onSaved(res.teacher);
      } else {
        // Create teacher
        const createPayload = {
          sessionToken,
          teacherId: teacherId.trim(),
          employeeId: employeeId.trim(),
          firstName,
          lastName,
          gender,
          dateOfBirth,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          qualification: qualification.trim(),
          specialization: specialization.trim() || undefined,
          joiningDate,
          designation: designation.trim(),
          employmentStatus,
        };

        const res = await window.electronAPI!.teachers.create(createPayload);
        if (!res.success || !res.teacher) {
          setValidationError(res.error || 'Failed to register teacher record.');
          setIsSubmitting(false);
          return;
        }

        if (photoBase64 && res.teacher.id) {
          await window.electronAPI!.teachers.uploadPhoto({
            sessionToken,
            teacherId: res.teacher.id,
            base64Data: photoBase64,
            fileExtension: photoExt,
          });
        }

        setRegisteredTeacher(res.teacher);
        onSaved(res.teacher);
      }
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Personal Info', desc: 'Identity & photo' },
    { number: 2, title: 'Contact & Address', desc: 'Phone, email & city' },
    { number: 3, title: 'Professional Info', desc: 'Qualification & status' },
    { number: 4, title: 'Review & Save', desc: 'Verify & commit' },
  ];

  return (
    <div className="modal-overlay">
      <div className="wizard-modal-card">
        {/* Modal Header */}
        <div className="modal-header-bar">
          <div className="modal-header-left">
            <div className="modal-header-icon">
              <GraduationCap size={22} />
            </div>
            <div className="modal-header-titles">
              <h2>{isEdit ? 'Edit Teacher Profile' : 'Add New Teacher'}</h2>
              <p>
                {isEdit
                  ? `Updating record for ${teacher?.displayName} (${teacher?.teacherId})`
                  : 'Complete the steps below to register a faculty member.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-icon-btn" title="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Success Confirmation Screen */}
        {registeredTeacher ? (
          <div className="wizard-success-screen">
            <div className="wizard-success-icon">
              <CheckCircle2 size={36} />
            </div>
            <h2>Teacher Successfully Registered</h2>
            <p>
              The faculty record has been saved and assigned to the institutional registry.
            </p>
            <div className="registered-id-card">
              Teacher ID: {registeredTeacher.teacherId}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setRegisteredTeacher(null);
                  setCurrentStep(1);
                  setTeacherFullName('');
                  setPhone('');
                  setEmail('');
                  setEmployeeId(`EMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                  if (window.electronAPI?.teachers) {
                    window.electronAPI.teachers.generateNextId().then((res) => {
                      if (res.success && res.nextId) setTeacherId(res.nextId);
                    });
                  }
                }}
                className="btn-modal-secondary"
              >
                + Register Another Teacher
              </button>
              <button type="button" onClick={onClose} className="btn-modal-primary">
                Done & Return to Directory
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step Breadcrumbs */}
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
              {/* ════ STEP 1: PERSONAL INFORMATION ════ */}
              {currentStep === 1 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <User size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 1: Personal Information</h3>
                  </div>

                  {/* Photo Component */}
                  <div className="photo-upload-container">
                    <div className="photo-preview-box">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Teacher Preview" />
                      ) : (
                        <User size={40} style={{ color: 'var(--color-neutral-300)' }} />
                      )}
                    </div>
                    <div className="photo-upload-actions">
                      <label className="btn-upload-file">
                        <Upload size={14} />
                        <span>{photoPreview ? 'Change Photo' : 'Upload Teacher Photo'}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handlePhotoSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {photoPreview && (
                        <button type="button" onClick={handleRemovePhoto} className="btn-remove-photo">
                          <Trash2 size={12} />
                          <span>Remove Photo</span>
                        </button>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--color-neutral-400)' }}>
                        Recommended: Official passport photo (JPG/PNG under 5 MB).
                      </span>
                    </div>
                  </div>

                  <div className="form-2col-grid">
                    {/* Single Teacher Name */}
                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">
                        Teacher Full Name <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={teacherFullName}
                        onChange={(e) => setTeacherFullName(e.target.value)}
                        placeholder="e.g. Professor Tariq Mehmood"
                        className="form-field-input"
                        autoFocus
                      />
                      <span className="form-field-helper">Enter the complete legal name as on academic degrees.</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Father / Spouse Name</label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="Father or spouse name"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Gender <span className="required-star">*</span></label>
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
                        Teacher ID <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        disabled={isEdit}
                        placeholder="TCH-2026-0001"
                        className="form-field-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span className="form-field-helper">Unique system ID for staff management.</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Employee ID <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="EMP-2026-101"
                        className="form-field-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span className="form-field-helper">Official payroll or employment code.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 2: CONTACT & ADDRESS ════ */}
              {currentStep === 2 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <Phone size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 2: Contact & Address</h3>
                  </div>

                  <div className="form-2col-grid">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        Primary Phone Number <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0300-1234567"
                        className="form-field-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="teacher@school.edu.pk"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Lahore"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Province</label>
                      <input
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="Punjab"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">Residential Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="House / Street, Area, Colony..."
                        className="form-field-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 3: PROFESSIONAL INFORMATION ════ */}
              {currentStep === 3 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <Briefcase size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 3: Professional Information</h3>
                  </div>

                  <div className="form-2col-grid">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        Highest Qualification <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="e.g. M.Sc. Mathematics, B.Ed"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Subject Specialization</label>
                      <input
                        type="text"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        placeholder="e.g. Mathematics, Physics"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        Designation <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Senior Teacher, Head of Department"
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">Joining Date</label>
                      <input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">Employment Status</label>
                      <select
                        value={employmentStatus}
                        onChange={(e) => setEmploymentStatus(e.target.value as any)}
                        className="form-field-input"
                      >
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Resigned">Resigned</option>
                      </select>
                    </div>

                    {/* Assigned Classes Preview */}
                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">Assigned Classes (Institutional Curriculum)</label>
                      <div className="checkbox-tag-group">
                        {availableClasses.map((cls) => {
                          const isChecked = assignedClasses.includes(cls.name);
                          return (
                            <label
                              key={cls.id}
                              className={`checkbox-tag-item ${isChecked ? 'checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAssignedClasses([...assignedClasses, cls.name]);
                                  } else {
                                    setAssignedClasses(assignedClasses.filter((c) => c !== cls.name));
                                  }
                                }}
                                style={{ display: 'none' }}
                              />
                              <BookOpen size={12} />
                              <span>{cls.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assigned Subjects Preview */}
                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-field-label">Subjects Taught</label>
                      <div className="checkbox-tag-group">
                        {availableSubjects.map((sub) => {
                          const isChecked = assignedSubjects.includes(sub.name);
                          return (
                            <label
                              key={sub.id}
                              className={`checkbox-tag-item ${isChecked ? 'checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAssignedSubjects([...assignedSubjects, sub.name]);
                                  } else {
                                    setAssignedSubjects(assignedSubjects.filter((s) => s !== sub.name));
                                  }
                                }}
                                style={{ display: 'none' }}
                              />
                              <span>{sub.name} ({sub.code})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ STEP 4: REVIEW & SAVE ════ */}
              {currentStep === 4 && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <CheckCircle2 size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <h3>Step 4: Review Teacher Information</h3>
                  </div>

                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-500)' }}>
                    Verify the faculty profile details before saving to the local SQLite database.
                  </p>

                  <div className="review-summary-card">
                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Faculty Name</span>
                        <span className="review-item-val">{teacherFullName || '—'}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Gender & DOB</span>
                        <span className="review-item-val">{gender} • {dateOfBirth || '—'}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Contact Phone</span>
                        <span className="review-item-val">{phone || '—'}</span>
                      </div>
                    </div>

                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Teacher ID</span>
                        <span className="review-item-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                          {teacherId}
                        </span>
                      </div>
                      <div>
                        <span className="review-item-label">Employee Code</span>
                        <span className="review-item-val" style={{ fontFamily: 'var(--font-mono)' }}>
                          {employeeId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="review-item-label">Joining Date</span>
                        <span className="review-item-val">{joiningDate || '—'}</span>
                      </div>
                    </div>

                    <div className="review-summary-row">
                      <div>
                        <span className="review-item-label">Designation</span>
                        <span className="review-item-val">{designation}</span>
                      </div>
                      <div>
                        <span className="review-item-label">Qualification & Subject</span>
                        <span className="review-item-val">{qualification} ({specialization || 'General'})</span>
                      </div>
                      <div>
                        <span className="review-item-label">Status</span>
                        <span className="review-item-val">{employmentStatus}</span>
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

                {currentStep < 4 ? (
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
                    onClick={handleSaveTeacher}
                    disabled={isSubmitting}
                    className="btn-modal-primary"
                  >
                    <CheckCircle2 size={14} />
                    <span>{isSubmitting ? 'Saving Teacher...' : 'Save Teacher'}</span>
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
