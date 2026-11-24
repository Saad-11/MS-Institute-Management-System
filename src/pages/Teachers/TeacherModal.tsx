import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Camera, Trash2, GraduationCap, Briefcase } from 'lucide-react';
import type { TeacherItem } from '../../types/electron';

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  teacher: TeacherItem | null;
  sessionToken: string;
}

export const TeacherModal: React.FC<TeacherModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  teacher,
  sessionToken,
}) => {
  const isEdit = Boolean(teacher);

  // Form State
  const [teacherId, setTeacherId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Contact
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lahore');
  const [province, setProvince] = useState('Punjab');

  // Professional
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [designation, setDesignation] = useState('Senior Teacher');
  const [employmentStatus, setEmploymentStatus] = useState<'Active' | 'Inactive' | 'On Leave' | 'Resigned'>('Active');

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string>('png');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (teacher) {
      setTeacherId(teacher.teacherId);
      setEmployeeId(teacher.employeeId);
      setFirstName(teacher.firstName);
      setMiddleName(teacher.middleName || '');
      setLastName(teacher.lastName || '');
      setGender(teacher.gender);
      setDateOfBirth(teacher.dateOfBirth || '');

      setPhone(teacher.phone || '');
      setEmail(teacher.email || '');
      setAddress(teacher.address || '');
      setCity(teacher.city || 'Lahore');
      setProvince(teacher.province || 'Punjab');

      setQualification(teacher.qualification || '');
      setSpecialization(teacher.specialization || '');
      setJoiningDate(teacher.joiningDate || new Date().toISOString().split('T')[0]);
      setDesignation(teacher.designation || 'Teacher');
      setEmploymentStatus(teacher.employmentStatus || 'Active');

      setPhotoPreview(teacher.photoDataUrl || null);
      setPhotoBase64(null);
    } else {
      setEmployeeId('');
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setGender('Male');
      setDateOfBirth('');

      setPhone('');
      setEmail('');
      setAddress('');
      setCity('Lahore');
      setProvince('Punjab');

      setQualification('');
      setSpecialization('');
      setJoiningDate(new Date().toISOString().split('T')[0]);
      setDesignation('Senior Teacher');
      setEmploymentStatus('Active');

      setPhotoPreview(null);
      setPhotoBase64(null);

      // Auto generate Teacher ID
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Please select a PNG or JPG image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo size must be less than 5 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    setPhotoExt(ext);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    if (isEdit && teacher && teacher.photoPath) {
      try {
        if (window.electronAPI?.teachers) {
          await window.electronAPI.teachers.removePhoto(sessionToken, teacher.id);
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

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!teacherId.trim()) {
      setError('Teacher ID is required.');
      return;
    }
    if (!employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (!qualification.trim()) {
      setError('Qualification is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && teacher) {
        // Update
        const res = await window.electronAPI!.teachers.update({
          sessionToken,
          id: teacher.id,
          employeeId: employeeId.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          qualification: qualification.trim(),
          specialization: specialization.trim(),
          joiningDate,
          designation: designation.trim(),
          employmentStatus,
        });

        if (!res.success) {
          setError(res.error || 'Failed to update teacher.');
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
      } else {
        // Create
        const res = await window.electronAPI!.teachers.create({
          sessionToken,
          teacherId: teacherId.trim(),
          employeeId: employeeId.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          qualification: qualification.trim(),
          specialization: specialization.trim(),
          joiningDate,
          designation: designation.trim(),
          employmentStatus,
        });

        if (!res.success || !res.teacher) {
          setError(res.error || 'Failed to register teacher.');
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isEdit ? 'Edit Teacher Details' : 'Register New Faculty Member'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Updating profile for ${teacher?.displayName} (${teacher?.teacherId})`
                  : 'Enter teacher profile, qualifications, and employment details.'}
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identity & Photo */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600" /> Personal Information
            </h3>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Photo Box */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group shadow-sm">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Teacher preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <GraduationCap className="w-12 h-12 text-slate-300" />
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
                    Teacher ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    disabled={isEdit}
                    placeholder="TCH-2026-0001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Unique permanent system ID</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP-1001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Staff register number</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                    placeholder="e.g. Muhammad"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                    placeholder="e.g. Usman"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                    placeholder="e.g. Tariq"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
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
                  placeholder="+92 300 9876543"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House #, Street, Area"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Professional & Employment */}
          <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-200 space-y-4">
            <h3 className="text-sm font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-600" /> Professional & Employment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Highest Qualification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. M.Sc / M.Phil"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Specialization
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Mathematics, Physics"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Teacher, Head of Dept"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employment Status
                </label>
                <select
                  value={employmentStatus}
                  onChange={(e) =>
                    setEmploymentStatus(e.target.value as 'Active' | 'Inactive' | 'On Leave' | 'Resigned')
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Resigned">Resigned</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
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
              className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Faculty'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
