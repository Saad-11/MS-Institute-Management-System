import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Camera, Trash2, User, BookOpen } from 'lucide-react';
import type { StudentItem, AcademicSession, ClassItem, SectionItem } from '../../types/electron';
import { resizeImageToMaxDimension } from '../../utils/image';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  student: StudentItem | null;
  sessions: AcademicSession[];
  classes: ClassItem[];
  sessionToken: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  student,
  sessions,
  classes,
  sessionToken,
}) => {
  const isEdit = Boolean(student);

  // Basic Details
  const [studentId, setStudentId] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nationality, setNationality] = useState('Pakistani');
  const [religion, setReligion] = useState('Islam');

  // Parent / Guardian
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');

  // Contact & Address
  const [phone, setPhone] = useState('');
  const [alternativePhone, setAlternativePhone] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [city, setCity] = useState('Lahore');
  const [province, setProvince] = useState('Punjab');

  // Initial Enrollment (only for new students)
  const [academicSessionId, setAcademicSessionId] = useState<number | ''>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [rollNumber, setRollNumber] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);

  // Section options dependent on class
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string>('png');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sections when class changes
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId('');
      return;
    }

    const loadSections = async () => {
      setIsLoadingSections(true);
      try {
        if (window.electronAPI?.sections) {
          const res = await window.electronAPI.sections.getByClassId(Number(classId));
          if (res.success) {
            setSections(res.sections.filter((s) => s.isActive));
            // Reset section if current selection is not in list
            if (!res.sections.some((s) => s.id === Number(sectionId))) {
              setSectionId('');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      } finally {
        setIsLoadingSections(false);
      }
    };

    loadSections();
  }, [classId]);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (student) {
      // Editing student
      setStudentId(student.studentId);
      setAdmissionNumber(student.admissionNumber);
      setFirstName(student.firstName);
      setMiddleName(student.middleName || '');
      setLastName(student.lastName || '');
      setGender(student.gender);
      setDateOfBirth(student.dateOfBirth || '');
      setBloodGroup(student.bloodGroup || '');
      setNationality(student.nationality || 'Pakistani');
      setReligion(student.religion || 'Islam');

      setFatherName(student.fatherName || '');
      setMotherName(student.motherName || '');
      setGuardianName(student.guardianName || '');
      setGuardianRelationship(student.guardianRelationship || 'Father');

      setPhone(student.phone || '');
      setAlternativePhone(student.alternativePhone || '');
      setCurrentAddress(student.currentAddress || '');
      setPermanentAddress(student.permanentAddress || '');
      setCity(student.city || 'Lahore');
      setProvince(student.province || 'Punjab');

      setPhotoPreview(student.photoDataUrl || null);
      setPhotoBase64(null);
    } else {
      // New student - reset fields
      setAdmissionNumber('');
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setGender('Male');
      setDateOfBirth('');
      setBloodGroup('');
      setNationality('Pakistani');
      setReligion('Islam');

      setFatherName('');
      setMotherName('');
      setGuardianName('');
      setGuardianRelationship('Father');

      setPhone('');
      setAlternativePhone('');
      setCurrentAddress('');
      setPermanentAddress('');
      setCity('Lahore');
      setProvince('Punjab');

      setPhotoPreview(null);
      setPhotoBase64(null);

      // Default active session if available
      const activeSes = sessions.find((s) => s.isActive) || sessions[0];
      setAcademicSessionId(activeSes ? activeSes.id : '');
      const firstClass = classes.find((c) => c.isActive) || classes[0];
      setClassId(firstClass ? firstClass.id : '');
      setSectionId('');
      setRollNumber('');
      setAdmissionDate(new Date().toISOString().split('T')[0]);

      // Auto generate Student ID
      if (window.electronAPI?.students) {
        window.electronAPI.students.generateNextId().then((res) => {
          if (res.success && res.nextId) {
            setStudentId(res.nextId);
          }
        });
      }
    }
  }, [isOpen, student, sessions, classes]);

  if (!isOpen) return null;

  // Handle Photo File selection (works in both desktop & browser mock)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Please select a PNG or JPG image.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Photo size must be less than 8 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    setPhotoExt(ext);

    try {
      const compressed = await resizeImageToMaxDimension(file, 400);
      setPhotoPreview(compressed);
      setPhotoBase64(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setPhotoBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    if (isEdit && student && student.photoPath) {
      try {
        if (window.electronAPI?.students) {
          await window.electronAPI.students.removePhoto(sessionToken, student.id);
        }
      } catch (err) {
        console.error('Failed to remove photo:', err);
      }
    }
    setPhotoPreview(null);
    setPhotoBase64(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!studentId.trim()) {
      setError('Student ID is required.');
      return;
    }
    if (!admissionNumber.trim()) {
      setError('Admission Number is required.');
      return;
    }
    if (!fatherName.trim() && !guardianName.trim()) {
      setError('Either Father Name or Guardian Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Primary phone number is required.');
      return;
    }

    if (!isEdit) {
      if (!academicSessionId) {
        setError('Academic Session is required for initial enrollment.');
        return;
      }
      if (!classId) {
        setError('Class is required for initial enrollment.');
        return;
      }
      if (!sectionId) {
        setError('Section is required for initial enrollment.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEdit && student) {
        // Update Student
        const res = await window.electronAPI!.students.update({
          sessionToken,
          id: student.id,
          studentId: student.studentId,
          admissionNumber: admissionNumber.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth,
          bloodGroup: bloodGroup.trim(),
          nationality: nationality.trim(),
          religion: religion.trim(),
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          guardianName: guardianName.trim(),
          guardianRelationship: guardianRelationship.trim(),
          phone: phone.trim(),
          alternativePhone: alternativePhone.trim(),
          currentAddress: currentAddress.trim(),
          permanentAddress: permanentAddress.trim(),
          city: city.trim(),
          province: province.trim(),
        });

        if (!res.success) {
          setError(res.error || 'Failed to update student.');
          setIsSubmitting(false);
          return;
        }

        // Upload photo if new photo selected
        if (photoBase64) {
          await window.electronAPI!.students.uploadPhoto({
            sessionToken,
            studentId: student.id,
            base64Data: photoBase64,
            fileExtension: photoExt,
          });
        }
      } else {
        // Create Student with Enrollment
        const res = await window.electronAPI!.students.create({
          sessionToken,
          studentId: studentId.trim(),
          admissionNumber: admissionNumber.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth,
          bloodGroup: bloodGroup.trim(),
          nationality: nationality.trim(),
          religion: religion.trim(),
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          guardianName: guardianName.trim(),
          guardianRelationship: guardianRelationship.trim(),
          phone: phone.trim(),
          alternativePhone: alternativePhone.trim(),
          currentAddress: currentAddress.trim(),
          permanentAddress: permanentAddress.trim(),
          city: city.trim(),
          province: province.trim(),
          academicSessionId: Number(academicSessionId),
          classId: Number(classId),
          sectionId: Number(sectionId),
          rollNumber: rollNumber.trim() || undefined,
          admissionDate,
          enrollment: {
            academicSessionId: Number(academicSessionId),
            classId: Number(classId),
            sectionId: Number(sectionId),
            rollNumber: rollNumber.trim() || undefined,
            admissionDate,
            status: 'Active',
          },
        });

        if (!res.success || !res.student) {
          setError(res.error || 'Failed to register student.');
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
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
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
              <h2 className="text-xl font-bold text-slate-800">
                {isEdit ? 'Edit Student Details' : 'Student Admission & Registration'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Updating profile for ${student?.displayName} (${student?.studentId})`
                  : 'Enter student information and assign initial academic enrollment.'}
              </p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: Identity & Photo */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Basic Information
            </h3>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Photo Box */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group shadow-sm">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Student preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-medium">Change Photo</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
                <span className="text-[11px] text-slate-400">JPG/PNG (max 5MB)</span>
              </div>

              {/* Identity Fields Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={isEdit}
                    placeholder="STD-2026-0001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Unique permanent system ID</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admission Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    placeholder="ADM-2026-101"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Institutional register number</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Ali"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="e.g. Raza"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Khan"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Pakistani"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Parent / Guardian Information */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Parent & Guardian Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Father Name
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Father's full name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mother Name
                </label>
                <input
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Mother's full name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Guardian Name
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Leave empty if same as Father"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Guardian Relationship
                </label>
                <input
                  type="text"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  placeholder="Father, Uncle, Mother..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Contact & Address */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Contact & Address
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alternative Phone
                </label>
                <input
                  type="text"
                  value={alternativePhone}
                  onChange={(e) => setAlternativePhone(e.target.value)}
                  placeholder="+92 321 7654321"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lahore"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Province
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Punjab"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Residential Address
                </label>
                <input
                  type="text"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  placeholder="House #, Street, Area"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Permanent Address
                </label>
                <input
                  type="text"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Permanent village / hometown address"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Academic Enrollment (New student only) */}
          {!isEdit && (
            <div className="bg-blue-50/60 p-5 rounded-xl border border-blue-200 space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" /> Initial Academic Enrollment
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Session <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={academicSessionId}
                    onChange={(e) => setAcademicSessionId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
                    disabled={!classId || isLoadingSections}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  >
                    <option value="">
                      {isLoadingSections ? 'Loading sections...' : 'Select section...'}
                    </option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admission Date
                  </label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
