/**
 * Type definitions for the Electron IPC bridge
 */

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  appDataPath: string;
  databasePath?: string;
  isDev: boolean;
}

export interface SystemInfo {
  hostname: string;
  osType: string;
  osRelease: string;
  totalMemoryGB: number;
  cpuCores: number;
  userHome: string;
}

export interface ModuleStatus {
  students: boolean;
  teachers: boolean;
  classes: boolean;
  attendance: boolean;
  fees: boolean;
  results: boolean;
  dmc: boolean;
  documents: boolean;
  reports: boolean;
  backup: boolean;
  settings: boolean;
}

export interface AppStatus {
  database: 'connected' | 'not-configured' | 'error';
  modules: ModuleStatus;
}

export interface SafeUser {
  id: number;
  username: string;
  displayName: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SchoolSettings {
  id: number;
  schoolName: string;
  schoolCode: string;
  schoolType: 'School' | 'College';
  principalName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  country: string;
  logoPath: string | null;
  logoDataUrl?: string | null;
  signaturePath?: string | null;
  signatureDataUrl?: string | null;
  academicSession: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSession {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassItem {
  id: number;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  sectionCount: number;
  subjectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectionItem {
  id: number;
  classId: number;
  name: string;
  description: string;
  isActive: boolean;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSectionInput {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  studentCount?: number;
}

export interface SubjectItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  assignedClassesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubjectItem {
  id: number;
  classId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface StudentEnrollmentItem {
  id: number;
  studentId: number;
  academicSessionId: number;
  academicSessionName?: string;
  classId: number;
  className?: string;
  sectionId: number;
  sectionName?: string;
  rollNumber?: string;
  admissionDate: string;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Graduated' | 'Left';
  createdAt: string;
  updatedAt: string;
}

export interface StudentItem {
  id: number;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  photoPath: string | null;
  photoDataUrl?: string | null;
  bloodGroup: string;
  nationality: string;
  religion: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  guardianRelationship: string;
  phone: string;
  alternativePhone: string;
  currentAddress: string;
  permanentAddress: string;
  city: string;
  province: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  currentEnrollment?: StudentEnrollmentItem | null;
}

export interface StudentFilterParams {
  searchQuery?: string;
  academicSessionId?: number;
  classId?: number;
  sectionId?: number;
  gender?: string;
  enrollmentStatus?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface TeacherItem {
  id: number;
  teacherId: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  photoPath: string | null;
  photoDataUrl?: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  designation: string;
  employmentStatus: 'Active' | 'Inactive' | 'On Leave' | 'Resigned';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherFilterParams {
  searchQuery?: string;
  employmentStatus?: string;
  designation?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface EnrolledStudentForAttendance {
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  rollNumber?: string;
  status?: AttendanceStatus;
  remarks?: string;
  attendanceId?: number;
}

export interface AttendanceRecordItem {
  id: number;
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  studentName: string;
  academicSessionId: number;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceHistoryParams {
  academicSessionId?: number;
  classId?: number;
  sectionId?: number;
  studentId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  searchQuery?: string;
  sortBy?: 'date' | 'studentName' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DailyAttendanceSummary {
  academicSessionId: number;
  classId: number;
  sectionId: number;
  attendanceDate: string;
  isRecorded: boolean;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number | null;
}

export interface StudentAttendanceStats {
  studentId: number;
  totalDaysRecorded: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number | null;
}

export interface DashboardSummary {
  schoolName: string;
  schoolType: 'School' | 'College';
  activeSession: string | null;
  activeClassesCount: number;
  activeSubjectsCount: number;
  activeStudentsCount: number;
  activeTeachersCount: number;
  hasLogo: boolean;
  // Financial metrics (Phase 6)
  totalFeesBilled?: number; // Minor units (paisa)
  totalFeesCollected?: number; // Minor units (paisa)
  totalFeesOutstanding?: number; // Minor units (paisa)
  todayCollection?: number; // Minor units (paisa)
}

// ─── Phase 6: Fees & Fee Slips Types ──────────────────────────────────────────

export interface FeeTypeItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FeeFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'One-Time';

export interface FeeStructureItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  classId: number;
  className?: string;
  feeTypeId: number;
  feeTypeName?: string;
  amount: number; // In minor units (paisa)
  frequency: FeeFrequency;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeePeriodItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: 'Open' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeAdjustmentItem {
  id: number;
  studentId: number;
  enrollmentId: number;
  feeTypeId: number;
  feeTypeName?: string;
  amount: number; // In minor units (paisa)
  frequency: FeeFrequency;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FeeRecordStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Waived' | 'Cancelled';

export interface FeeRecordItem {
  id: number;
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  studentName: string;
  academicSessionId: number;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  feePeriodId: number;
  feePeriodName: string;
  feeTypeId: number;
  feeTypeName: string;
  originalAmount: number; // Minor units
  discount: number; // Minor units
  fine: number; // Minor units
  netAmount: number; // Minor units
  paidAmount: number; // Minor units
  remainingBalance: number; // Minor units
  dueDate: string;
  status: FeeRecordStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface FeePaymentItem {
  id: number;
  receiptNumber: string;
  studentId: number;
  enrollmentId: number;
  feeRecordId: number;
  paymentDate: string;
  amount: number; // Minor units
  paymentMethod: PaymentMethod;
  referenceNotes: string;
  receivedByUserId: number | null;
  receivedByUsername?: string;
  createdAt: string;
  // Expanded fields for receipt printing / history
  systemStudentId?: string;
  admissionNumber?: string;
  studentName?: string;
  fatherName?: string;
  className?: string;
  sectionName?: string;
  academicSessionName?: string;
  feeTypeName?: string;
  feePeriodName?: string;
  originalAmount?: number;
  discount?: number;
  fine?: number;
  netAmount?: number;
  remainingBalanceAfterPayment?: number;
}

export interface StudentFeeSummary {
  studentId: number;
  totalBilled: number;
  totalDiscount: number;
  totalFine: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface SetupStatusResponse {
  success: boolean;
  isSetupRequired: boolean;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  user?: SafeUser;
  error?: string;
}

export interface SchoolSettingsResponse {
  success: boolean;
  settings?: SchoolSettings;
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  error?: string;
}

export interface ElectronAPI {
  getAppInfo: () => Promise<AppInfo>;
  getSystemInfo: () => Promise<SystemInfo>;
  getAppStatus: () => Promise<AppStatus>;
  auth: {
    getSetupStatus: () => Promise<SetupStatusResponse>;
    createInitialAdmin: (data: { username: string; displayName: string; password: string }) => Promise<AuthResponse>;
    login: (data: { username: string; password: string }) => Promise<AuthResponse>;
    logout: (sessionToken?: string) => Promise<{ success: boolean }>;
    getCurrentUser: (sessionToken?: string) => Promise<{ success: boolean; user: SafeUser | null }>;
  };
  school: {
    getSettings: () => Promise<SchoolSettingsResponse>;
    updateSettings: (sessionToken: string, settings: Partial<SchoolSettings>) => Promise<SchoolSettingsResponse>;
    chooseLogoFile: (sessionToken: string) => Promise<{ success: boolean; logoPath?: string; dataUrl?: string; canceled?: boolean; error?: string }>;
    uploadLogo: (data: { sessionToken: string; base64Data: string; fileExtension: string }) => Promise<{ success: boolean; logoPath?: string; dataUrl?: string; error?: string }>;
    removeLogo: (sessionToken: string) => Promise<{ success: boolean; error?: string }>;
    getLogoDataUrl: () => Promise<{ success: boolean; dataUrl: string | null }>;
    uploadSignature: (data: { sessionToken: string; base64Data: string; fileExtension: string }) => Promise<{ success: boolean; signaturePath?: string; dataUrl?: string; error?: string }>;
    removeSignature: (sessionToken: string) => Promise<{ success: boolean; error?: string }>;
    getSignatureDataUrl: () => Promise<{ success: boolean; dataUrl: string | null }>;
  };
  sessions: {
    getAll: (searchQuery?: string) => Promise<{ success: boolean; sessions: AcademicSession[] }>;
    create: (data: { sessionToken: string; name: string; startDate: string; endDate: string; isActive?: boolean }) => Promise<{ success: boolean; session?: AcademicSession; error?: string }>;
    update: (data: { sessionToken: string; id: number; name: string; startDate: string; endDate: string; isActive?: boolean }) => Promise<{ success: boolean; session?: AcademicSession; error?: string }>;
    activate: (sessionToken: string, id: number) => Promise<{ success: boolean; session?: AcademicSession; error?: string }>;
    deactivate: (sessionToken: string, id: number) => Promise<{ success: boolean; session?: AcademicSession; error?: string }>;
  };
  classes: {
    getAll: (searchQuery?: string, includeInactive?: boolean) => Promise<{ success: boolean; classes: ClassItem[] }>;
    getById: (id: number) => Promise<{ success: boolean; classItem?: ClassItem | null }>;
    create: (data: {
      sessionToken: string;
      name: string;
      code?: string;
      displayOrder?: number;
      isActive?: boolean;
      sections?: Array<string | ClassSectionInput>;
    }) => Promise<{ success: boolean; classItem?: ClassItem; error?: string }>;
    update: (data: {
      sessionToken: string;
      id: number;
      name: string;
      code?: string;
      displayOrder?: number;
      isActive?: boolean;
      sections?: Array<string | ClassSectionInput>;
    }) => Promise<{ success: boolean; classItem?: ClassItem; error?: string }>;
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; classItem?: ClassItem; error?: string }>;
  };
  sections: {
    getByClassId: (classId: number, searchQuery?: string) => Promise<{ success: boolean; sections: SectionItem[] }>;
    create: (data: { sessionToken: string; classId: number; name: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; section?: SectionItem; error?: string }>;
    update: (data: { sessionToken: string; id: number; name: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; section?: SectionItem; error?: string }>;
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; section?: SectionItem; error?: string }>;
  };
  subjects: {
    getAll: (searchQuery?: string, includeInactive?: boolean) => Promise<{ success: boolean; subjects: SubjectItem[] }>;
    create: (data: { sessionToken: string; name: string; code?: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; subject?: SubjectItem; error?: string }>;
    update: (data: { sessionToken: string; id: number; name: string; code?: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; subject?: SubjectItem; error?: string }>;
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; subject?: SubjectItem; error?: string }>;
  };
  classSubjects: {
    getByClassId: (classId: number) => Promise<{ success: boolean; classSubjects: ClassSubjectItem[] }>;
    assign: (data: { sessionToken: string; classId: number; subjectId: number; displayOrder?: number }) => Promise<{ success: boolean; classSubject?: ClassSubjectItem; error?: string }>;
    remove: (sessionToken: string, classId: number, subjectId: number) => Promise<{ success: boolean; error?: string }>;
  };
  students: {
    getAll: (params?: StudentFilterParams) => Promise<{ success: boolean; students: StudentItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;
    getStats: (academicSessionId?: number) => Promise<{ success: boolean; stats: { total: number; active: number; inactive: number; sessionCount: number }; error?: string }>;
    getById: (id: number) => Promise<{ success: boolean; student?: StudentItem | null }>;
    generateNextId: (year?: string) => Promise<{ success: boolean; nextId: string }>;
    create: (data: Record<string, unknown>) => Promise<{ success: boolean; student?: StudentItem; error?: string }>;
    update: (data: Record<string, unknown>) => Promise<{ success: boolean; student?: StudentItem; error?: string }>;
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; student?: StudentItem; error?: string }>;
    getEnrollmentHistory: (studentId: number) => Promise<{ success: boolean; history: StudentEnrollmentItem[] }>;
    createEnrollment: (data: Record<string, unknown>) => Promise<{ success: boolean; enrollment?: StudentEnrollmentItem; error?: string }>;
    choosePhoto: (sessionToken: string, studentId: number) => Promise<{ success: boolean; photoPath?: string; dataUrl?: string; canceled?: boolean; error?: string }>;
    uploadPhoto: (data: { sessionToken: string; studentId: number; base64Data: string; fileExtension: string }) => Promise<{ success: boolean; photoPath?: string; dataUrl?: string; error?: string }>;
    removePhoto: (sessionToken: string, studentId: number) => Promise<{ success: boolean; error?: string }>;
    delete: (sessionToken: string, id: number) => Promise<{ success: boolean; mode?: 'archived' | 'permanent'; error?: string }>;
  };
  teachers: {
    getAll: (params?: TeacherFilterParams) => Promise<{ success: boolean; teachers: TeacherItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;
    getById: (id: number) => Promise<{ success: boolean; teacher?: TeacherItem | null }>;
    generateNextId: (year?: string) => Promise<{ success: boolean; nextId: string }>;
    create: (data: Record<string, unknown>) => Promise<{ success: boolean; teacher?: TeacherItem; error?: string }>;
    update: (data: Record<string, unknown>) => Promise<{ success: boolean; teacher?: TeacherItem; error?: string }>;
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; teacher?: TeacherItem; error?: string }>;
    choosePhoto: (sessionToken: string, teacherId: number) => Promise<{ success: boolean; photoPath?: string; dataUrl?: string; canceled?: boolean; error?: string }>;
    uploadPhoto: (data: { sessionToken: string; teacherId: number; base64Data: string; fileExtension: string }) => Promise<{ success: boolean; photoPath?: string; dataUrl?: string; error?: string }>;
    removePhoto: (sessionToken: string, teacherId: number) => Promise<{ success: boolean; error?: string }>;
  };
  attendance: {
    getEnrolledStudents: (params: { academicSessionId: number; classId: number; sectionId: number; attendanceDate: string }) => Promise<{ success: boolean; students: EnrolledStudentForAttendance[]; isRecorded: boolean; error?: string }>;
    save: (data: {
      sessionToken: string;
      academicSessionId: number;
      classId: number;
      sectionId: number;
      attendanceDate: string;
      records: Array<{ studentId: number; enrollmentId: number; status: string; remarks?: string }>;
    }) => Promise<{ success: boolean; savedCount: number; error?: string }>;
    getDailySummary: (params: { academicSessionId: number; classId: number; sectionId: number; attendanceDate: string }) => Promise<{ success: boolean; summary?: DailyAttendanceSummary; error?: string }>;
    getHistory: (params?: AttendanceHistoryParams) => Promise<{ success: boolean; records: AttendanceRecordItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;
    getStudentHistory: (params: { studentId: number; academicSessionId?: number; dateFrom?: string; dateTo?: string; limit?: number }) => Promise<{ success: boolean; history: AttendanceRecordItem[]; stats: StudentAttendanceStats; error?: string }>;
  };
  fees: {
    // Fee Types
    getTypes: () => Promise<{ success: boolean; types: FeeTypeItem[]; error?: string }>;
    createType: (data: { sessionToken: string; name: string; code: string; description?: string }) => Promise<{ success: boolean; feeType?: FeeTypeItem; error?: string }>;
    updateType: (data: { sessionToken: string; id: number; name: string; code: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; feeType?: FeeTypeItem; error?: string }>;
    toggleTypeStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; feeType?: FeeTypeItem; error?: string }>;

    // Fee Structures
    getStructures: (params?: { academicSessionId?: number; classId?: number; isActive?: boolean }) => Promise<{ success: boolean; structures: FeeStructureItem[]; error?: string }>;
    createStructure: (data: { sessionToken: string; academicSessionId: number; classId: number; feeTypeId: number; amount: number; frequency: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string }) => Promise<{ success: boolean; structure?: FeeStructureItem; error?: string }>;
    updateStructure: (data: { sessionToken: string; id: number; amount: number; frequency: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; structure?: FeeStructureItem; error?: string }>;
    toggleStructureStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; structure?: FeeStructureItem; error?: string }>;

    // Fee Periods
    getPeriods: (academicSessionId?: number) => Promise<{ success: boolean; periods: FeePeriodItem[]; error?: string }>;
    createPeriod: (data: { sessionToken: string; academicSessionId: number; name: string; startDate: string; endDate: string; dueDate: string }) => Promise<{ success: boolean; period?: FeePeriodItem; error?: string }>;
    updatePeriod: (data: { sessionToken: string; id: number; name: string; startDate: string; endDate: string; dueDate: string; status?: 'Open' | 'Closed' }) => Promise<{ success: boolean; period?: FeePeriodItem; error?: string }>;

    // Student Specific Adjustments
    getStudentAdjustments: (studentId: number) => Promise<{ success: boolean; adjustments: StudentFeeAdjustmentItem[]; error?: string }>;
    createStudentAdjustment: (data: { sessionToken: string; studentId: number; enrollmentId: number; feeTypeId: number; amount: number; frequency?: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string }) => Promise<{ success: boolean; adjustment?: StudentFeeAdjustmentItem; error?: string }>;
    toggleStudentAdjustmentStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; adjustment?: StudentFeeAdjustmentItem; error?: string }>;

    // Fee Generation & Records
    generateFees: (data: { sessionToken: string; academicSessionId: number; classId: number; sectionId?: number; feePeriodId: number; dueDate?: string }) => Promise<{ success: boolean; summary: { totalEligible: number; createdCount: number; alreadyExistedCount: number; failedCount: number }; error?: string }>;
    getRecords: (params?: { academicSessionId?: number; classId?: number; sectionId?: number; feePeriodId?: number; studentId?: number; status?: FeeRecordStatus; searchQuery?: string; page?: number; limit?: number }) => Promise<{ success: boolean; records: FeeRecordItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;
    getRecordById: (id: number) => Promise<{ success: boolean; record?: FeeRecordItem; error?: string }>;
    
    // Fee Dues
    getDues: (params?: { academicSessionId?: number; classId?: number; sectionId?: number; feePeriodId?: number; dueStatus?: 'All' | 'Overdue' | 'Unpaid' | 'Partially Paid'; searchQuery?: string; page?: number; limit?: number }) => Promise<{ success: boolean; records: FeeRecordItem[]; totalOutstandingAmount: number; totalCount: number; page: number; totalPages: number; error?: string }>;

    // Payments & Receipts
    recordPayment: (data: { sessionToken: string; feeRecordId: number; amount: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNotes?: string }) => Promise<{ success: boolean; payment?: FeePaymentItem; receiptNumber?: string; remainingBalance?: number; error?: string }>;
    getPaymentById: (id: number) => Promise<{ success: boolean; payment?: FeePaymentItem; error?: string }>;
    getReceiptByNumber: (receiptNumber: string) => Promise<{ success: boolean; receipt?: FeePaymentItem; error?: string }>;
    searchPayments: (params?: { searchQuery?: string; academicSessionId?: number; classId?: number; sectionId?: number; paymentMethod?: PaymentMethod; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<{ success: boolean; payments: FeePaymentItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;

    // Student Fee Profiles
    getStudentFeeSummary: (studentId: number) => Promise<{ success: boolean; summary: StudentFeeSummary; records: FeeRecordItem[]; payments: FeePaymentItem[]; error?: string }>;
  };
  exams: {
    // Exam Types
    getTypes: () => Promise<{ success: boolean; types: ExamTypeItem[]; error?: string }>;
    createType: (data: { sessionToken: string; name: string; code: string; description?: string }) => Promise<{ success: boolean; examType?: ExamTypeItem; error?: string }>;
    updateType: (data: { sessionToken: string; id: number; name: string; code: string; description?: string; isActive?: boolean }) => Promise<{ success: boolean; examType?: ExamTypeItem; error?: string }>;
    toggleTypeStatus: (sessionToken: string, id: number, isActive: boolean) => Promise<{ success: boolean; examType?: ExamTypeItem; error?: string }>;

    // Examinations
    getAll: (params?: { academicSessionId?: number; examTypeId?: number; status?: ExamStatus }) => Promise<{ success: boolean; examinations: ExaminationItem[]; error?: string }>;
    getById: (id: number) => Promise<{ success: boolean; examination?: ExaminationItem; error?: string }>;
    create: (data: { sessionToken: string; academicSessionId: number; examTypeId: number; name: string; startDate: string; endDate: string; description?: string }) => Promise<{ success: boolean; examination?: ExaminationItem; error?: string }>;
    update: (data: { sessionToken: string; id: number; academicSessionId: number; examTypeId: number; name: string; startDate: string; endDate: string; description?: string }) => Promise<{ success: boolean; examination?: ExaminationItem; error?: string }>;
    updateStatus: (sessionToken: string, id: number, status: ExamStatus) => Promise<{ success: boolean; examination?: ExaminationItem; error?: string }>;
    delete: (sessionToken: string, id: number) => Promise<{ success: boolean; error?: string }>;

    // Examination Subjects
    getSubjects: (params: { examinationId: number; classId?: number }) => Promise<{ success: boolean; subjects: ExaminationSubjectItem[]; error?: string }>;
    configureSubjects: (data: {
      sessionToken: string;
      examinationId: number;
      classId: number;
      subjects: Array<{
        subjectId: number;
        maxMarks: number;
        passingMarks: number;
        displayOrder?: number;
        examDate?: string;
        startTime?: string;
        durationMinutes?: number;
      }>;
    }) => Promise<{ success: boolean; subjects?: ExaminationSubjectItem[]; error?: string }>;
    updateSubjectMarks: (data: {
      sessionToken: string;
      examinationSubjectId: number;
      maxMarks: number;
      passingMarks: number;
    }) => Promise<{ success: boolean; examinationSubject?: ExaminationSubjectItem; error?: string }>;

    // Grading Rules
    getGradingRules: () => Promise<{ success: boolean; rules: GradingRuleItem[]; error?: string }>;
    saveGradingRule: (data: { sessionToken: string; id?: number; name: string; minPercentage: number; maxPercentage: number; grade: string; gradePoint?: number; remarks?: string; displayOrder?: number }) => Promise<{ success: boolean; rule?: GradingRuleItem; error?: string }>;
    deleteGradingRule: (sessionToken: string, id: number) => Promise<{ success: boolean; error?: string }>;

    // Marks Entry
    getStudentsForMarksEntry: (params: { examinationId: number; classId: number; sectionId?: number; examinationSubjectId: number }) => Promise<{
      success: boolean;
      students: StudentMarksEntryItem[];
      examinationSubject?: ExaminationSubjectItem;
      examinationStatus?: ExamStatus;
      error?: string;
    }>;
    saveMarks: (data: {
      sessionToken: string;
      examinationId: number;
      examinationSubjectId: number;
      marks: Array<{
        studentId: number;
        enrollmentId: number;
        obtainedMarks: number | null;
        status: MarkStatus;
        remarks?: string;
      }>;
    }) => Promise<{ success: boolean; savedCount: number; error?: string }>;

    // Results & DMC
    calculateStudentResult: (examinationId: number, studentId: number) => Promise<{ success: boolean; result?: StudentExamResult; error?: string }>;
    getClassResults: (params: { examinationId: number; classId: number; sectionId?: number }) => Promise<{ success: boolean; results?: ClassExamResults; error?: string }>;
    generateStudentDMC: (examinationId: number, studentId: number, classId?: number) => Promise<{ success: boolean; dmc?: StudentDMCData; error?: string }>;
    generateClassDMC: (params: { examinationId: number; classId: number; sectionId?: number }) => Promise<{ success: boolean; dmcs?: StudentDMCData[]; error?: string }>;
  };
  dashboard: {
    getSummary: () => Promise<{ success: boolean; summary: DashboardSummary; error?: string }>;
  };
  documents: {
    generateNextNumber: () => Promise<{ success: boolean; documentNumber?: string; error?: string }>;
    getPreview: (params: {
      studentId: number;
      documentType: DocumentType;
      academicSessionId?: number;
      customTitle?: string;
      customRemarks?: string;
      reasonForLeaving?: string;
      conduct?: string;
      customContent?: string;
      duesCleared?: boolean;
      issueDate?: string;
    }) => Promise<{ success: boolean; document?: StudentDocumentPayload; error?: string }>;
    issue: (params: {
      sessionToken?: string;
      studentId: number;
      documentType: DocumentType;
      academicSessionId: number;
      title: string;
      issueDate?: string;
      details?: Record<string, unknown>;
      remarks?: string;
    }) => Promise<{ success: boolean; document?: StudentDocumentRecord; error?: string }>;
    getHistory: (params?: {
      studentId?: number;
      documentType?: string;
      academicSessionId?: number;
      searchQuery?: string;
      page?: number;
      limit?: number;
    }) => Promise<{ success: boolean; documents: StudentDocumentRecord[]; totalCount: number; page: number; totalPages: number; error?: string }>;
    getById: (id: number) => Promise<{ success: boolean; document?: StudentDocumentRecord; error?: string }>;
  };
  promotions: {
    getCandidates: (params: {
      fromSessionId: number;
      fromClassId: number;
      fromSectionId?: number;
      toSessionId?: number;
    }) => Promise<{ success: boolean; candidates: PromotionCandidate[]; error?: string }>;
    execute: (params: {
      sessionToken?: string;
      fromSessionId: number;
      toSessionId?: number;
      fromClassId: number;
      toClassId?: number;
      fromSectionId?: number;
      toSectionId?: number;
      promotions: Array<{
        studentId: number;
        action: PromotionAction;
        toClassId?: number;
        toSectionId?: number;
        rollNumber?: string;
        remarks?: string;
      }>;
    }) => Promise<{ success: boolean; processedCount: number; error?: string }>;
    getAcademicHistory: (studentId: number) => Promise<{ success: boolean; history: StudentAcademicHistoryEntry[]; error?: string }>;
    getLogs: (params?: { studentId?: number; sessionId?: number; page?: number; limit?: number }) => Promise<{ success: boolean; logs: PromotionLogItem[]; totalCount: number; page: number; totalPages: number; error?: string }>;
  };
  reports: {
    getStudentList: (filters?: {
      academicSessionId?: number;
      classId?: number;
      sectionId?: number;
      status?: string;
      gender?: string;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: StudentListReportRow[]; totalStudents: number; error?: string }>;
    getAttendance: (filters?: {
      academicSessionId?: number;
      classId?: number;
      sectionId?: number;
      studentId?: number;
      startDate?: string;
      endDate?: string;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: AttendanceReportRow[]; totalRecordedDays: number; classAveragePercentage: number | null; error?: string }>;
    getFeeCollection: (filters?: {
      academicSessionId?: number;
      classId?: number;
      sectionId?: number;
      feeTypeId?: number;
      startDate?: string;
      endDate?: string;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: FeeCollectionReportRow[]; totalCollectedMinor: number; totalCollectedFormatted: string; totalTransactions: number; error?: string }>;
    getFeeOutstanding: (filters?: {
      academicSessionId?: number;
      classId?: number;
      sectionId?: number;
      feePeriodId?: number;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: FeeOutstandingReportRow[]; totalOutstandingMinor: number; totalOutstandingFormatted: string; totalDefaulters: number; error?: string }>;
    getExamMarks: (filters: {
      examinationId: number;
      classId: number;
      sectionId?: number;
      subjectId?: number;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: ExamMarksReportRow[]; totalEntered: number; passCount: number; failCount: number; passPercentage: number; error?: string }>;
    getClassResults: (params: {
      examinationId: number;
      classId: number;
      sectionId?: number;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; results?: ClassExamResults; error?: string }>;
    getClassStrength: (academicSessionId?: number) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: ClassStrengthRow[]; grandTotal: number; error?: string }>;
    getTeacher: (filters?: {
      designation?: string;
      employmentStatus?: string;
      isActive?: boolean;
    }) => Promise<{ success: boolean; metadata: ReportHeaderMetadata; records: TeacherReportRow[]; totalTeachers: number; error?: string }>;
  };
  backup: {
    create: (customPath?: string) => Promise<{ success: boolean; backupPath?: string; manifest?: BackupManifest; error?: string }>;
    validate: (filePath: string) => Promise<BackupValidationResult>;
    restore: (filePath: string) => Promise<{ success: boolean; restoredAt?: string; manifest?: BackupManifest; error?: string }>;
    list: () => Promise<{ success: boolean; backups: BackupListItem[] }>;
    chooseFolder: () => Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }>;
    chooseFile: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
    getLastBackup: () => Promise<{ success: boolean; info: { lastBackupDate: string | null; backupName: string | null; backupSizeBytes: number | null } }>;
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  };
  license: {
    getStatus: () => Promise<{ success: boolean; statusInfo: LicenseStatusInfo }>;
    getInstallationId: () => Promise<{ success: boolean; installationId: string }>;
    activate: (licenseToken: string) => Promise<{ success: boolean; statusInfo?: LicenseStatusInfo; error?: string }>;
    importFile: () => Promise<{ success: boolean; statusInfo?: LicenseStatusInfo; canceled?: boolean; error?: string }>;
    exportFile: (licenseToken: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  };
  superAdmin: {
    isSetupRequired: () => Promise<{ success: boolean; isSetupRequired: boolean }>;
    setup: (payload: { username?: string; password?: string; displayName?: string }) => Promise<{ success: boolean; error?: string }>;
    login: (payload: { username?: string; password?: string }) => Promise<{ success: boolean; token?: string; superAdmin?: { id: number; username: string; displayName: string }; error?: string }>;
    logout: (token: string) => Promise<{ success: boolean }>;
    verifySession: (token: string) => Promise<{ success: boolean; superAdmin?: { id: number; username: string; displayName: string } }>;
    generateLicense: (params: Record<string, unknown>) => Promise<{ success: boolean; licenseId?: string; signedToken?: string; payload?: unknown; error?: string }>;
    getGeneratedLicenses: (params?: Record<string, unknown>) => Promise<{ success: boolean; records: SuperAdminLicenseRecordItem[]; totalCount: number; error?: string }>;
    getDashboardStats: () => Promise<{ success: boolean; totalLicensesGenerated: number; activeLicensesCount: number; expiredLicensesCount: number; licenseTypeDistribution: Record<string, number> }>;
  };
  exportPDF: (options?: { defaultFileName?: string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

// ─── Phase 7: Examination, Marks, Grading & DMC Interfaces ──────────────────────

export type ExamStatus = 'Draft' | 'Open' | 'Closed';
export type MarkStatus = 'Entered' | 'Absent';

export interface ExamTypeItem {
  id: number;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExaminationItem {
  id: number;
  academicSessionId: number;
  academicSessionName?: string;
  examTypeId: number;
  examTypeName?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  description: string;
  subjectCount?: number;
  participatingClasses?: string[];
  participatingClassNames?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExaminationSubjectItem {
  id: number;
  examinationId: number;
  classId: number;
  className?: string;
  subjectId: number;
  subjectName?: string;
  subjectCode?: string;
  maxMarks: number;
  passingMarks: number;
  displayOrder: number;
  examDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  isActive: boolean;
  marksEnteredCount?: number;
  totalStudentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GradingRuleItem {
  id: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  gradePoint: number;
  remarks: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentMarksEntryItem {
  studentId: number;
  enrollmentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  fatherName?: string;
  rollNumber?: string;
  obtainedMarks: number | null;
  status: MarkStatus;
  remarks: string;
  markId?: number;
}

export interface SubjectResultBreakdown {
  examinationSubjectId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
  obtainedMarks: number | null;
  status: MarkStatus;
  isPass: boolean;
  remarks: string;
}

export interface StudentExamResult {
  studentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  gender: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  rollNumber?: string;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  overallRemarks: string;
  position?: number;
  totalStudentsInClass?: number;
  subjects: SubjectResultBreakdown[];
}

export interface ClassExamResults {
  examinationId: number;
  examinationName: string;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId?: number;
  sectionName?: string;
  totalStudents: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number;
  highestPercentage: number;
  averagePercentage: number;
  subjects: Array<{
    id: number;
    subjectName: string;
    maxMarks: number;
    passingMarks: number;
    averageMarks: number;
    passCount: number;
    failCount: number;
  }>;
  studentResults: StudentExamResult[];
}

export interface StudentDMCData {
  school: SchoolSettings;
  examination: {
    id: number;
    name: string;
    examTypeName: string;
    academicSessionName: string;
    startDate: string;
    endDate: string;
  };
  student: {
    id: number;
    systemStudentId: string; // Labeled "Student ID" on DMC
    admissionNumber: string;
    displayName: string;
    fatherName: string;
    className: string;
    sectionName: string;
    rollNumber?: string;
    dateOfBirth?: string;
    photoDataUrl?: string | null;
  };
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    passingMarks: number;
    obtainedMarks: number | null;
    status: MarkStatus | 'Pending'; // 'Entered', 'Absent', or 'Pending'
    grade: string;
    remarks: string;
  }>;
  summary: {
    totalMaxMarks: number;
    totalObtainedMarks: number;
    percentage: number;
    grade: string;
    gradePoint: number;
    result: 'Pass' | 'Fail' | 'Pending';
    overallRemarks: string;
    position?: number;
    totalStudents?: number;
  };
  gradingRules?: GradingRuleItem[];
  issueDate: string;
}

// ─── Phase 8: Documents, Promotions & Reports Interfaces ────────────────────────

export type DocumentType = 'Bonafide' | 'Character' | 'Leaving' | 'General';
export type PromotionAction = 'Promote' | 'Retain' | 'Graduate' | 'Transfer' | 'Left';

export interface StudentDocumentRecord {
  id: number;
  documentNumber: string;
  studentId: number;
  studentSystemId: string;
  admissionNumber: string;
  studentName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  documentType: DocumentType;
  title: string;
  academicSessionId: number;
  academicSessionName: string;
  issueDate: string;
  generatedByUserId: number | null;
  generatedByUserName?: string;
  contentJson: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentDocumentPayload {
  documentNumber?: string;
  documentType: DocumentType;
  title: string;
  issueDate: string;
  school: SchoolSettings;
  schoolLogoDataUrl?: string | null;
  student: {
    id: number;
    studentId: string;
    admissionNumber: string;
    displayName: string;
    fatherName: string;
    motherName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    religion: string;
    bloodGroup: string;
    phone: string;
    currentAddress: string;
    admissionDate: string;
    className: string;
    sectionName: string;
    rollNumber: string;
    academicSessionName: string;
    academicSessionId: number;
    photoDataUrl?: string | null;
  };
  details: {
    conduct?: string;
    reasonForLeaving?: string;
    duesCleared?: boolean;
    customContent?: string;
    remarks?: string;
  };
}

export interface PromotionCandidate {
  studentId: number;
  systemStudentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  gender: string;
  currentEnrollmentId: number;
  currentClassId: number;
  currentClassName: string;
  currentSectionId: number;
  currentSectionName: string;
  currentRollNumber: string;
  attendanceTotalDays: number;
  attendancePresentDays: number;
  attendancePercentage: number | null;
  examPercentage: number | null;
  examGrade: string | null;
  examResultStatus: 'Pass' | 'Fail' | 'N/A';
  alreadyEnrolledInDestination: boolean;
  recommendedAction: PromotionAction;
}

export interface StudentAcademicHistoryEntry {
  enrollmentId: number;
  academicSessionId: number;
  academicSessionName: string;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  rollNumber: string;
  admissionDate: string;
  status: string;
  promotionStatus: string;
  promotionDate: string | null;
  remarks: string;
  attendancePercentage: number | null;
  examGrade: string | null;
  examPercentage: number | null;
}

export interface PromotionLogItem {
  id: number;
  studentId: number;
  studentSystemId: string;
  studentName: string;
  fromSessionName: string;
  toSessionName?: string;
  fromClassName: string;
  toClassName?: string;
  fromSectionName: string;
  toSectionName?: string;
  action: PromotionAction;
  promotionDate: string;
  performedByUserName?: string;
  remarks: string;
  createdAt: string;
}

export interface ReportHeaderMetadata {
  school: SchoolSettings;
  schoolLogoDataUrl?: string | null;
  reportTitle: string;
  generatedAt: string;
  filtersApplied: Record<string, string>;
}

export interface StudentListReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  gender: string;
  status: string;
  phone: string;
  admissionDate: string;
}

export interface AttendanceReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  className: string;
  sectionName: string;
  totalDays: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  attendancePercentage: number | null;
}

export interface FeeCollectionReportRow {
  receiptNumber: string;
  paymentDate: string;
  studentId: string;
  admissionNumber: string;
  displayName: string;
  className: string;
  feePeriodName: string;
  feeTypeName: string;
  amountMinor: number;
  amountFormatted: string;
  paymentMode: string;
  receivedBy: string;
}

export interface FeeOutstandingReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  fatherName: string;
  className: string;
  sectionName: string;
  feePeriodName: string;
  feeTypeName: string;
  dueDate: string;
  netAmountFormatted: string;
  paidAmountFormatted: string;
  remainingBalanceMinor: number;
  remainingBalanceFormatted: string;
  status: string;
}

export interface ExamMarksReportRow {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  rollNumber: string;
  subjectName: string;
  maxMarks: number;
  passingMarks: number;
  obtainedMarks: number | null;
  status: string;
  grade: string;
  isPass: boolean;
  remarks: string;
}

export interface ClassStrengthRow {
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  maleCount: number;
  femaleCount: number;
  otherCount: number;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
}

export interface TeacherReportRow {
  teacherId: string;
  employeeId: string;
  displayName: string;
  gender: string;
  designation: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  phone: string;
  email: string;
  employmentStatus: string;
}

// ─── Phase 9: Backup, Licensing & Super Admin Interfaces ──────────────────────

export type LicenseStatus =
  | 'Valid'
  | 'Not Yet Active'
  | 'Expired'
  | 'Invalid Signature'
  | 'Wrong Product'
  | 'Wrong Installation'
  | 'Corrupted'
  | 'Unlicensed';

export interface LicenseStatusInfo {
  status: LicenseStatus | 'Active' | 'Grace Period' | 'Tampered' | 'Clock Tampered';
  installationId: string;
  isClockTampered?: boolean;
  isValid?: boolean;
  isExpired?: boolean;
  isInGracePeriod?: boolean;
  licenseId?: string;
  customerName?: string;
  productName?: string;
  product?: string;
  edition?: string;
  licenseType?: string;
  issuedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  gracePeriodDays?: number;
  daysRemaining?: number;
  isNearExpiry?: boolean;
  maxStudents?: number;
  features?: string[];
  machineMatches?: boolean;
  details?: string;
  message?: string;
  error?: string;
}

export interface BackupManifest {
  formatVersion?: '1.0';
  version?: string;
  backupName?: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  schoolName: string;
  schoolCode?: string;
  databaseChecksum?: string;
  dbChecksumSha256?: string;
  databaseSize?: number;
  fileSize?: number;
  installationId: string;
  assetCount?: number;
  assetFilesCount?: number;
  assets?: Array<{
    relativePath: string;
    size: number;
    sha256: string;
  }>;
}

export interface BackupValidationResult {
  valid?: boolean;
  isValid?: boolean;
  manifest?: BackupManifest;
  stats?: {
    fileSizeBytes: number;
    dbSizeBytes: number;
    assetCount: number;
  };
  error?: string;
  errors?: string[];
  warnings?: string[];
}

export interface BackupListItem {
  fileName: string;
  filePath?: string;
  fullPath?: string;
  fileSizeBytes?: number;
  sizeBytes?: number;
  createdAt: string;
  schoolName: string;
  schemaVersion: number;
  appVersion?: string;
  isValid?: boolean;
  isSafetySnapshot?: boolean;
}

export interface SuperAdminLicenseRecordItem {
  id: number;
  licenseId: string;
  customerName: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  productName?: string;
  edition: string;
  licenseType: string;
  installationBinding: string;
  startsAt: string;
  expiresAt: string;
  gracePeriodDays?: number;
  price?: number;
  currency?: string;
  paymentStatus?: string;
  signedLicenseToken?: string;
  signedToken?: string;
  notes?: string;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

