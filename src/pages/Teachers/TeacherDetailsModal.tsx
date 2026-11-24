import React from 'react';
import { X, GraduationCap, Phone, Award } from 'lucide-react';
import type { TeacherItem } from '../../types/electron';

interface TeacherDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherItem | null;
}

export const TeacherDetailsModal: React.FC<TeacherDetailsModalProps> = ({
  isOpen,
  onClose,
  teacher,
}) => {
  if (!isOpen || !teacher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{teacher.displayName}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono text-purple-600 font-semibold">{teacher.teacherId}</span>
                <span>•</span>
                <span>EMP #{teacher.employeeId}</span>
                <span>•</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    teacher.employmentStatus === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : teacher.employmentStatus === 'On Leave'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {teacher.employmentStatus}
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
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Top Profile Card */}
          <div className="flex flex-col sm:flex-row gap-6 p-5 bg-gradient-to-r from-purple-50/50 via-slate-50 to-slate-50 rounded-2xl border border-slate-200">
            {/* Photo Avatar */}
            <div className="w-24 h-24 rounded-2xl border-2 border-white shadow bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              {teacher.photoDataUrl ? (
                <img
                  src={teacher.photoDataUrl}
                  alt={teacher.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-12 h-12 text-slate-300" />
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Designation</span>
                <span className="text-sm font-semibold text-slate-800">{teacher.designation}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Joining Date</span>
                <span className="text-sm font-semibold text-slate-800">{teacher.joiningDate}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Gender</span>
                <span className="text-sm text-slate-700">{teacher.gender}</span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 uppercase">Date of Birth</span>
                <span className="text-sm text-slate-700">{teacher.dateOfBirth || '—'}</span>
              </div>
            </div>
          </div>

          {/* Academic & Professional Card */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" /> Academic & Professional Background
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Highest Qualification:</span>
                <span className="font-semibold text-slate-800">{teacher.qualification}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Specialization:</span>
                <span className="font-semibold text-slate-800">{teacher.specialization || 'General'}</span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-purple-600" /> Contact & Residence
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Phone:</span>
                <span className="font-medium text-slate-800">{teacher.phone}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-800">{teacher.email || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">City / Province:</span>
                <span className="font-medium text-slate-800">
                  {teacher.city}, {teacher.province}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs mb-0.5">Address:</span>
                <span className="text-xs text-slate-800 font-medium">
                  {teacher.address || 'No residential address recorded'}
                </span>
              </div>
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
