/**
 * Electron Preload Script
 * 
 * Secure bridge between the main process (Node.js/SQLite) and the React UI.
 * Exposes ONLY specifically validated, whitelisted channels via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_INVOKE_CHANNELS = [
  // Application
  'app:getInfo',
  'app:getSystemInfo',
  'app:getStatus',
  // Authentication
  'auth:getSetupStatus',
  'auth:createInitialAdmin',
  'auth:login',
  'auth:logout',
  'auth:getCurrentUser',
  // School Settings & Branding
  'school:getSettings',
  'school:updateSettings',
  'school:chooseLogoFile',
  'school:uploadLogo',
  'school:removeLogo',
  'school:getLogoDataUrl',
  'school:uploadSignature',
  'school:removeSignature',
  'school:getSignatureDataUrl',
  // Academic Sessions
  'sessions:getAll',
  'sessions:create',
  'sessions:update',
  'sessions:activate',
  'sessions:deactivate',
  // Classes & Sections
  'classes:getAll',
  'classes:getById',
  'classes:create',
  'classes:update',
  'classes:toggleStatus',
  'sections:getByClassId',
  'sections:create',
  'sections:update',
  'sections:toggleStatus',
  // Subjects & Assignments
  'subjects:getAll',
  'subjects:create',
  'subjects:update',
  'subjects:toggleStatus',
  'classSubjects:getByClassId',
  'classSubjects:assign',
  'classSubjects:remove',
  // Students & Enrollments
  'students:getAll',
  'students:getStats',
  'students:getById',
  'students:generateNextId',
  'students:create',
  'students:update',
  'students:toggleStatus',
  'students:getEnrollmentHistory',
  'students:createEnrollment',
  'students:choosePhoto',
  'students:uploadPhoto',
  'students:removePhoto',
  'students:delete',
  // Teachers
  'teachers:getAll',
  'teachers:getById',
  'teachers:generateNextId',
  'teachers:create',
  'teachers:update',
  'teachers:toggleStatus',
  'teachers:choosePhoto',
  'teachers:uploadPhoto',
  'teachers:removePhoto',
  // Attendance
  'attendance:getEnrolledStudents',
  'attendance:save',
  'attendance:getDailySummary',
  'attendance:getHistory',
  'attendance:getStudentHistory',
  // Fees & Fee Slips
  'fees:getTypes',
  'fees:createType',
  'fees:updateType',
  'fees:toggleTypeStatus',
  'fees:getStructures',
  'fees:createStructure',
  'fees:updateStructure',
  'fees:toggleStructureStatus',
  'fees:getPeriods',
  'fees:createPeriod',
  'fees:updatePeriod',
  'fees:getStudentAdjustments',
  'fees:createStudentAdjustment',
  'fees:generateFees',
  'fees:getRecords',
  'fees:getRecordById',
  'fees:getDues',
  'fees:recordPayment',
  'fees:getPaymentById',
  'fees:getReceiptByNumber',
  'fees:searchPayments',
  'fees:getStudentFeeSummary',
  // Examinations, Marks, Results & DMC
  'exams:getTypes',
  'exams:createType',
  'exams:updateType',
  'exams:toggleTypeStatus',
  'exams:getAll',
  'exams:getById',
  'exams:create',
  'exams:update',
  'exams:updateStatus',
  'exams:delete',
  'exams:getSubjects',
  'exams:configureSubjects',
  'exams:updateSubjectMarks',
  'exams:getGradingRules',
  'exams:saveGradingRule',
  'exams:deleteGradingRule',
  'exams:getStudentsForMarksEntry',
  'exams:saveMarks',
  'exams:calculateStudentResult',
  'exams:getClassResults',
  'exams:generateStudentDMC',
  'exams:generateClassDMC',
  // Student Documents
  'documents:generateNextNumber',
  'documents:getPreview',
  'documents:issue',
  'documents:getHistory',
  'documents:getById',
  // Student Promotion & Academic History
  'promotions:getCandidates',
  'promotions:execute',
  'promotions:getAcademicHistory',
  'promotions:getLogs',
  // Reports
  'reports:getStudentList',
  'reports:getAttendance',
  'reports:getFeeCollection',
  'reports:getFeeOutstanding',
  'reports:getExamMarks',
  'reports:getClassResults',
  'reports:getClassStrength',
  'reports:getTeacher',
  // Export PDF
  'app:exportPDF',
  // Dashboard
  'dashboard:getSummary',
  // Backup & Restore
  'backup:create',
  'backup:validate',
  'backup:restore',
  'backup:list',
  'backup:chooseFolder',
  'backup:chooseFile',
  'backup:getLastBackup',
  'backup:showInFolder',
  'backup:openFolder',
  // Offline Licensing
  'license:getStatus',
  'license:getInstallationId',
  'license:activate',
  'license:importFile',
  'license:exportFile',
  // Super Admin / Seller Portal
  'superAdmin:isSetupRequired',
  'superAdmin:setup',
  'superAdmin:login',
  'superAdmin:logout',
  'superAdmin:verifySession',
  'superAdmin:generateLicense',
  'superAdmin:getGeneratedLicenses',
  'superAdmin:getDashboardStats',
] as const;

type AllowedChannel = (typeof ALLOWED_INVOKE_CHANNELS)[number];

function isAllowedChannel(channel: string): channel is AllowedChannel {
  return (ALLOWED_INVOKE_CHANNELS as readonly string[]).includes(channel);
}

// ─── Expose Safe API to Renderer ───────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  // Application & System info
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
  getAppStatus: () => ipcRenderer.invoke('app:getStatus'),

  // Authentication API
  auth: {
    getSetupStatus: () => ipcRenderer.invoke('auth:getSetupStatus'),
    createInitialAdmin: (data: { username: string; displayName: string; password: string }) =>
      ipcRenderer.invoke('auth:createInitialAdmin', data),
    login: (data: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', data),
    logout: (sessionToken?: string) =>
      ipcRenderer.invoke('auth:logout', { sessionToken }),
    getCurrentUser: (sessionToken?: string) =>
      ipcRenderer.invoke('auth:getCurrentUser', { sessionToken }),
  },

  // School Settings & Branding API
  school: {
    getSettings: () => ipcRenderer.invoke('school:getSettings'),
    updateSettings: (sessionToken: string, settings: Record<string, unknown>) =>
      ipcRenderer.invoke('school:updateSettings', { sessionToken, ...settings }),
    chooseLogoFile: (sessionToken: string) =>
      ipcRenderer.invoke('school:chooseLogoFile', { sessionToken }),
    uploadLogo: (data: { sessionToken: string; base64Data: string; fileExtension: string }) =>
      ipcRenderer.invoke('school:uploadLogo', data),
    removeLogo: (sessionToken: string) =>
      ipcRenderer.invoke('school:removeLogo', { sessionToken }),
    getLogoDataUrl: () => ipcRenderer.invoke('school:getLogoDataUrl'),
    uploadSignature: (data: { sessionToken: string; base64Data: string; fileExtension: string }) =>
      ipcRenderer.invoke('school:uploadSignature', data),
    removeSignature: (sessionToken: string) =>
      ipcRenderer.invoke('school:removeSignature', { sessionToken }),
    getSignatureDataUrl: () => ipcRenderer.invoke('school:getSignatureDataUrl'),
  },

  // Academic Sessions API
  sessions: {
    getAll: (searchQuery?: string) =>
      ipcRenderer.invoke('sessions:getAll', { searchQuery }),
    create: (data: { sessionToken: string; name: string; startDate: string; endDate: string; isActive?: boolean }) =>
      ipcRenderer.invoke('sessions:create', data),
    update: (data: { sessionToken: string; id: number; name: string; startDate: string; endDate: string; isActive?: boolean }) =>
      ipcRenderer.invoke('sessions:update', data),
    activate: (sessionToken: string, id: number) =>
      ipcRenderer.invoke('sessions:activate', { sessionToken, id }),
    deactivate: (sessionToken: string, id: number) =>
      ipcRenderer.invoke('sessions:deactivate', { sessionToken, id }),
  },

  // Classes & Sections API
  classes: {
    getAll: (searchQuery?: string, includeInactive = true) =>
      ipcRenderer.invoke('classes:getAll', { searchQuery, includeInactive }),
    getById: (id: number) =>
      ipcRenderer.invoke('classes:getById', { id }),
    create: (data: {
      sessionToken: string;
      name: string;
      code?: string;
      displayOrder?: number;
      isActive?: boolean;
      sections?: Array<string | { id?: number; name: string; description?: string; isActive?: boolean }>;
    }) =>
      ipcRenderer.invoke('classes:create', data),
    update: (data: {
      sessionToken: string;
      id: number;
      name: string;
      code?: string;
      displayOrder?: number;
      isActive?: boolean;
      sections?: Array<string | { id?: number; name: string; description?: string; isActive?: boolean }>;
    }) =>
      ipcRenderer.invoke('classes:update', data),
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('classes:toggleStatus', { sessionToken, id, isActive }),
  },

  sections: {
    getByClassId: (classId: number, searchQuery?: string) =>
      ipcRenderer.invoke('sections:getByClassId', { classId, searchQuery }),
    create: (data: { sessionToken: string; classId: number; name: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('sections:create', data),
    update: (data: { sessionToken: string; id: number; name: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('sections:update', data),
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('sections:toggleStatus', { sessionToken, id, isActive }),
  },

  // Subjects & Assignments API
  subjects: {
    getAll: (searchQuery?: string, includeInactive = true) =>
      ipcRenderer.invoke('subjects:getAll', { searchQuery, includeInactive }),
    create: (data: { sessionToken: string; name: string; code?: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('subjects:create', data),
    update: (data: { sessionToken: string; id: number; name: string; code?: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('subjects:update', data),
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('subjects:toggleStatus', { sessionToken, id, isActive }),
  },

  classSubjects: {
    getByClassId: (classId: number) =>
      ipcRenderer.invoke('classSubjects:getByClassId', { classId }),
    assign: (data: { sessionToken: string; classId: number; subjectId: number; displayOrder?: number }) =>
      ipcRenderer.invoke('classSubjects:assign', data),
    remove: (sessionToken: string, classId: number, subjectId: number) =>
      ipcRenderer.invoke('classSubjects:remove', { sessionToken, classId, subjectId }),
  },

  // Students & Enrollments API
  students: {
    getAll: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('students:getAll', params),
    getStats: (academicSessionId?: number) =>
      ipcRenderer.invoke('students:getStats', { academicSessionId }),
    getById: (id: number) =>
      ipcRenderer.invoke('students:getById', { id }),
    generateNextId: (year?: string) =>
      ipcRenderer.invoke('students:generateNextId', { year }),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('students:create', data),
    update: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('students:update', data),
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('students:toggleStatus', { sessionToken, id, isActive }),
    getEnrollmentHistory: (studentId: number) =>
      ipcRenderer.invoke('students:getEnrollmentHistory', { studentId }),
    createEnrollment: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('students:createEnrollment', data),
    choosePhoto: (sessionToken: string, studentId: number) =>
      ipcRenderer.invoke('students:choosePhoto', { sessionToken, studentId }),
    uploadPhoto: (data: { sessionToken: string; studentId: number; base64Data: string; fileExtension: string }) =>
      ipcRenderer.invoke('students:uploadPhoto', data),
    removePhoto: (sessionToken: string, studentId: number) =>
      ipcRenderer.invoke('students:removePhoto', { sessionToken, studentId }),
    delete: (sessionToken: string, id: number) =>
      ipcRenderer.invoke('students:delete', { sessionToken, id }),
  },

  // Teachers API
  teachers: {
    getAll: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('teachers:getAll', params),
    getById: (id: number) =>
      ipcRenderer.invoke('teachers:getById', { id }),
    generateNextId: (year?: string) =>
      ipcRenderer.invoke('teachers:generateNextId', { year }),
    create: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('teachers:create', data),
    update: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('teachers:update', data),
    toggleStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('teachers:toggleStatus', { sessionToken, id, isActive }),
    choosePhoto: (sessionToken: string, teacherId: number) =>
      ipcRenderer.invoke('teachers:choosePhoto', { sessionToken, teacherId }),
    uploadPhoto: (data: { sessionToken: string; teacherId: number; base64Data: string; fileExtension: string }) =>
      ipcRenderer.invoke('teachers:uploadPhoto', data),
    removePhoto: (sessionToken: string, teacherId: number) =>
      ipcRenderer.invoke('teachers:removePhoto', { sessionToken, teacherId }),
  },

  // Attendance API
  attendance: {
    getEnrolledStudents: (params: { academicSessionId: number; classId: number; sectionId: number; attendanceDate: string }) =>
      ipcRenderer.invoke('attendance:getEnrolledStudents', params),
    save: (data: {
      sessionToken: string;
      academicSessionId: number;
      classId: number;
      sectionId: number;
      attendanceDate: string;
      records: Array<{ studentId: number; enrollmentId: number; status: string; remarks?: string }>;
    }) => ipcRenderer.invoke('attendance:save', data),
    getDailySummary: (params: { academicSessionId: number; classId: number; sectionId: number; attendanceDate: string }) =>
      ipcRenderer.invoke('attendance:getDailySummary', params),
    getHistory: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('attendance:getHistory', params),
    getStudentHistory: (params: { studentId: number; academicSessionId?: number; dateFrom?: string; dateTo?: string; limit?: number }) =>
      ipcRenderer.invoke('attendance:getStudentHistory', params),
  },

  // Fees & Fee Slips API
  fees: {
    getTypes: () => ipcRenderer.invoke('fees:getTypes'),
    createType: (data: { sessionToken: string; name: string; code: string; description?: string }) =>
      ipcRenderer.invoke('fees:createType', data),
    updateType: (data: { sessionToken: string; id: number; name: string; code: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('fees:updateType', data),
    toggleTypeStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('fees:toggleTypeStatus', { sessionToken, id, isActive }),
    getStructures: (params?: { academicSessionId?: number; classId?: number; isActive?: boolean }) =>
      ipcRenderer.invoke('fees:getStructures', params),
    createStructure: (data: { sessionToken: string; academicSessionId: number; classId: number; feeTypeId: number; amount: number; frequency: string; effectiveFrom?: string; effectiveTo?: string; description?: string }) =>
      ipcRenderer.invoke('fees:createStructure', data),
    updateStructure: (data: { sessionToken: string; id: number; amount: number; frequency: string; effectiveFrom?: string; effectiveTo?: string; description?: string; isActive?: boolean }) =>
      ipcRenderer.invoke('fees:updateStructure', data),
    toggleStructureStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('fees:toggleStructureStatus', { sessionToken, id, isActive }),
    getPeriods: (academicSessionId?: number) =>
      ipcRenderer.invoke('fees:getPeriods', { academicSessionId }),
    createPeriod: (data: { sessionToken: string; academicSessionId: number; name: string; startDate: string; endDate: string; dueDate: string }) =>
      ipcRenderer.invoke('fees:createPeriod', data),
    updatePeriod: (data: { sessionToken: string; id: number; name: string; startDate: string; endDate: string; dueDate: string; status?: 'Open' | 'Closed' }) =>
      ipcRenderer.invoke('fees:updatePeriod', data),
    getStudentAdjustments: (studentId: number) =>
      ipcRenderer.invoke('fees:getStudentAdjustments', { studentId }),
    createStudentAdjustment: (data: { sessionToken: string; studentId: number; enrollmentId: number; feeTypeId: number; amount: number; frequency?: string; effectiveFrom?: string; effectiveTo?: string; description?: string }) =>
      ipcRenderer.invoke('fees:createStudentAdjustment', data),
    toggleStudentAdjustmentStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('fees:toggleTypeStatus', { sessionToken, id, isActive }),
    generateFees: (data: { sessionToken: string; academicSessionId: number; classId: number; sectionId?: number; feePeriodId: number; dueDate?: string }) =>
      ipcRenderer.invoke('fees:generateFees', data),
    getRecords: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('fees:getRecords', params),
    getRecordById: (id: number) =>
      ipcRenderer.invoke('fees:getRecordById', { id }),
    getDues: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('fees:getDues', params),
    recordPayment: (data: { sessionToken: string; feeRecordId: number; amount: number; paymentDate: string; paymentMethod: string; referenceNotes?: string }) =>
      ipcRenderer.invoke('fees:recordPayment', data),
    getPaymentById: (id: number) =>
      ipcRenderer.invoke('fees:getPaymentById', { id }),
    getReceiptByNumber: (receiptNumber: string) =>
      ipcRenderer.invoke('fees:getReceiptByNumber', { receiptNumber }),
    searchPayments: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('fees:searchPayments', params),
    getStudentFeeSummary: (studentId: number) =>
      ipcRenderer.invoke('fees:getStudentFeeSummary', { studentId }),
  },

  // Examinations, Marks, Results & DMC API
  exams: {
    getTypes: () => ipcRenderer.invoke('exams:getTypes'),
    createType: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:createType', data),
    updateType: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:updateType', data),
    toggleTypeStatus: (sessionToken: string, id: number, isActive: boolean) =>
      ipcRenderer.invoke('exams:toggleTypeStatus', { sessionToken, id, isActive }),

    getAll: (params?: Record<string, unknown>) => ipcRenderer.invoke('exams:getAll', params),
    getById: (id: number) => ipcRenderer.invoke('exams:getById', { id }),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:update', data),
    updateStatus: (sessionToken: string, id: number, status: string) =>
      ipcRenderer.invoke('exams:updateStatus', { sessionToken, id, status }),
    delete: (sessionToken: string, id: number) =>
      ipcRenderer.invoke('exams:delete', { sessionToken, id }),

    getSubjects: (params: { examinationId: number; classId?: number }) =>
      ipcRenderer.invoke('exams:getSubjects', params),
    configureSubjects: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('exams:configureSubjects', data),
    updateSubjectMarks: (data: Record<string, unknown>) =>
      ipcRenderer.invoke('exams:updateSubjectMarks', data),

    getGradingRules: () => ipcRenderer.invoke('exams:getGradingRules'),
    saveGradingRule: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:saveGradingRule', data),
    deleteGradingRule: (sessionToken: string, id: number) =>
      ipcRenderer.invoke('exams:deleteGradingRule', { sessionToken, id }),

    getStudentsForMarksEntry: (params: Record<string, unknown>) =>
      ipcRenderer.invoke('exams:getStudentsForMarksEntry', params),
    saveMarks: (data: Record<string, unknown>) => ipcRenderer.invoke('exams:saveMarks', data),

    calculateStudentResult: (examinationId: number, studentId: number) =>
      ipcRenderer.invoke('exams:calculateStudentResult', { examinationId, studentId }),
    getClassResults: (params: Record<string, unknown>) =>
      ipcRenderer.invoke('exams:getClassResults', params),
    generateStudentDMC: (examinationId: number, studentId: number, classId?: number) =>
      ipcRenderer.invoke('exams:generateStudentDMC', { examinationId, studentId, classId }),
    generateClassDMC: (params: Record<string, unknown>) =>
      ipcRenderer.invoke('exams:generateClassDMC', params),
  },

  // Dashboard API
  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
  },

  // Student Documents API
  documents: {
    generateNextNumber: () => ipcRenderer.invoke('documents:generateNextNumber'),
    getPreview: (params: Record<string, unknown>) => ipcRenderer.invoke('documents:getPreview', params),
    issue: (params: Record<string, unknown>) => ipcRenderer.invoke('documents:issue', params),
    getHistory: (params: Record<string, unknown>) => ipcRenderer.invoke('documents:getHistory', params),
    getById: (id: number) => ipcRenderer.invoke('documents:getById', id),
  },

  // Student Promotion & Academic History API
  promotions: {
    getCandidates: (params: Record<string, unknown>) => ipcRenderer.invoke('promotions:getCandidates', params),
    execute: (params: Record<string, unknown>) => ipcRenderer.invoke('promotions:execute', params),
    getAcademicHistory: (studentId: number) => ipcRenderer.invoke('promotions:getAcademicHistory', studentId),
    getLogs: (params: Record<string, unknown>) => ipcRenderer.invoke('promotions:getLogs', params),
  },

  // Reports API
  reports: {
    getStudentList: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getStudentList', filters),
    getAttendance: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getAttendance', filters),
    getFeeCollection: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getFeeCollection', filters),
    getFeeOutstanding: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getFeeOutstanding', filters),
    getExamMarks: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getExamMarks', filters),
    getClassResults: (params: Record<string, unknown>) => ipcRenderer.invoke('reports:getClassResults', params),
    getClassStrength: (academicSessionId?: number) => ipcRenderer.invoke('reports:getClassStrength', academicSessionId),
    getTeacher: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getTeacher', filters),
  },

  // Backup & Restore API
  backup: {
    create: (customPath?: string) => ipcRenderer.invoke('backup:create', customPath),
    validate: (filePath: string) => ipcRenderer.invoke('backup:validate', filePath),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    list: () => ipcRenderer.invoke('backup:list'),
    chooseFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
    chooseFile: () => ipcRenderer.invoke('backup:chooseFile'),
    getLastBackup: () => ipcRenderer.invoke('backup:getLastBackup'),
    showInFolder: (filePath: string) => ipcRenderer.invoke('backup:showInFolder', filePath),
    openFolder: (folderPath: string) => ipcRenderer.invoke('backup:openFolder', folderPath),
  },

  // Offline Licensing API
  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    getInstallationId: () => ipcRenderer.invoke('license:getInstallationId'),
    activate: (licenseToken: string) => ipcRenderer.invoke('license:activate', licenseToken),
    importFile: () => ipcRenderer.invoke('license:importFile'),
    exportFile: (licenseToken: string) => ipcRenderer.invoke('license:exportFile', licenseToken),
  },

  // Super Admin / Vendor Portal API
  superAdmin: {
    isSetupRequired: () => ipcRenderer.invoke('superAdmin:isSetupRequired'),
    setup: (payload: { username?: string; password?: string; displayName?: string }) =>
      ipcRenderer.invoke('superAdmin:setup', payload),
    login: (payload: { username?: string; password?: string }) =>
      ipcRenderer.invoke('superAdmin:login', payload),
    logout: (token: string) => ipcRenderer.invoke('superAdmin:logout', token),
    verifySession: (token: string) => ipcRenderer.invoke('superAdmin:verifySession', token),
    generateLicense: (params: Record<string, unknown>) =>
      ipcRenderer.invoke('superAdmin:generateLicense', params),
    getGeneratedLicenses: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke('superAdmin:getGeneratedLicenses', params),
    getDashboardStats: () => ipcRenderer.invoke('superAdmin:getDashboardStats'),
  },

  // Native Offline PDF Export API
  exportPDF: (options?: { defaultFileName?: string }) => ipcRenderer.invoke('app:exportPDF', options),

  // Generic safe channel invoke with strict allow-list validation
  invoke: (channel: string, ...args: unknown[]) => {
    if (isAllowedChannel(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`));
  },
});
