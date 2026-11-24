/**
 * Browser Development Mock Bridge
 * 
 * When running the application in a standard web browser (e.g. http://localhost:5173)
 * outside of the Electron runtime, window.electronAPI is undefined.
 * 
 * This module provides a complete, persistent in-browser simulation using localStorage.
 * It allows full interactive testing of:
 * 1. First-run administrator setup and login
 * 2. School settings, branding, and logo uploads
 * 3. Academic sessions management & single-active transactions
 * 4. Classes & sections management
 * 5. Subjects catalog & class-subject mappings
 * 6. Live dashboard summary metrics
 * 
 * In Electron, this mock is bypassed completely.
 */

import type {
  ElectronAPI,
  SafeUser,
  SchoolSettings,
  AcademicSession,
  SectionItem,
  ClassSubjectItem,
  DashboardSummary,
  AppInfo,
  SystemInfo,
  AppStatus,
  StudentItem,
  StudentEnrollmentItem,
  StudentFilterParams,
  TeacherItem,
  TeacherFilterParams,
  EnrolledStudentForAttendance,
  AttendanceRecordItem,
  DailyAttendanceSummary,
  AttendanceHistoryParams,
  FeeTypeItem,
  FeeStructureItem,
  FeePeriodItem,
  StudentFeeAdjustmentItem,
  FeeRecordItem,
  FeePaymentItem,
  FeeFrequency,
  PaymentMethod,
  ExamTypeItem,
  ExaminationItem,
  ExaminationSubjectItem,
  GradingRuleItem,
  StudentMarksEntryItem,
  StudentExamResult,
  StudentDMCData,
  ExamStatus,
  MarkStatus,
  StudentDocumentRecord,
  PromotionCandidate,
  StudentAcademicHistoryEntry,
  PromotionLogItem,
  StudentListReportRow,
  AttendanceReportRow,
  FeeCollectionReportRow,
  FeeOutstandingReportRow,
  ExamMarksReportRow,
  ClassStrengthRow,
  TeacherReportRow,
} from '../types/electron';
import { resizeImageToMaxDimension } from '../utils/image';

interface MockStore {
  users: Array<{
    id: number;
    username: string;
    displayName: string;
    password: string;
    role: 'admin';
    createdAt: string;
  }>;
  activeToken: string | null;
  activeUser: SafeUser | null;
  settings: SchoolSettings;
  logoDataUrl: string | null;
  signatureDataUrl?: string | null;
  sessions: AcademicSession[];
  classes: Array<{
    id: number;
    name: string;
    code: string;
    displayOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  sections: SectionItem[];
  subjects: Array<{
    id: number;
    name: string;
    code: string;
    description: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  classSubjects: ClassSubjectItem[];
  students: StudentItem[];
  studentEnrollments: StudentEnrollmentItem[];
  teachers: TeacherItem[];
  attendance: Array<{
    id: number;
    studentId: number;
    enrollmentId: number;
    academicSessionId: number;
    classId: number;
    sectionId: number;
    attendanceDate: string;
    status: 'Present' | 'Absent' | 'Late' | 'Leave';
    remarks: string;
    createdAt: string;
    updatedAt: string;
  }>;
  feeTypes: FeeTypeItem[];
  feeStructures: FeeStructureItem[];
  feePeriods: FeePeriodItem[];
  studentAdjustments: StudentFeeAdjustmentItem[];
  feeRecords: FeeRecordItem[];
  feePayments: FeePaymentItem[];
  examTypes: ExamTypeItem[];
  examinations: ExaminationItem[];
  examSubjects: ExaminationSubjectItem[];
  gradingRules: GradingRuleItem[];
  examMarks: Array<{
    id: number;
    examinationId: number;
    examinationSubjectId: number;
    studentId: number;
    enrollmentId: number;
    obtainedMarks: number | null;
    status: MarkStatus;
    remarks: string;
    createdAt: string;
    updatedAt: string;
  }>;
  studentDocuments: StudentDocumentRecord[];
  promotionLogs: PromotionLogItem[];
}

const STORAGE_KEY = 'sms_browser_mock_db_v3';

function getDefaultStore(): MockStore {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 1,
        username: 'admin',
        displayName: 'Administrator',
        password: 'AdminPassword123!',
        role: 'admin',
        createdAt: now,
      },
    ],
    activeToken: null,
    activeUser: null,
    settings: {
      id: 1,
      schoolName: 'Oxford Model High School',
      schoolCode: 'OMHS-101',
      schoolType: 'School',
      principalName: 'Prof. Muhammad Akram',
      phone: '+92 42 3578 9012',
      email: 'info@oxfordschool.edu.pk',
      address: 'Main Boulevard, Gulberg III',
      city: 'Lahore',
      province: 'Punjab',
      country: 'Pakistan',
      logoPath: null,
      academicSession: '2026-2027',
      createdAt: now,
      updatedAt: now,
    },
    logoDataUrl: null,
    sessions: [
      {
        id: 1,
        name: '2025-2026',
        startDate: '2025-08-01',
        endDate: '2026-06-30',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        name: '2026-2027',
        startDate: '2026-08-01',
        endDate: '2027-06-30',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    classes: [
      { id: 1, name: 'Grade 8', code: 'G8', displayOrder: 8, isActive: true, createdAt: now, updatedAt: now },
      { id: 2, name: 'Grade 9', code: 'G9', displayOrder: 9, isActive: true, createdAt: now, updatedAt: now },
      { id: 3, name: 'Grade 10', code: 'G10', displayOrder: 10, isActive: true, createdAt: now, updatedAt: now },
      { id: 4, name: 'First Year (XI)', code: '11', displayOrder: 11, isActive: true, createdAt: now, updatedAt: now },
    ],
    sections: [
      { id: 1, classId: 1, name: 'Section A', description: 'Boys Section', isActive: true, createdAt: now, updatedAt: now },
      { id: 2, classId: 2, name: 'Section A', description: 'Science Group', isActive: true, createdAt: now, updatedAt: now },
      { id: 3, classId: 2, name: 'Section B', description: 'Computer Group', isActive: true, createdAt: now, updatedAt: now },
      { id: 4, classId: 3, name: 'Section A', description: 'Bio-Science', isActive: true, createdAt: now, updatedAt: now },
    ],
    subjects: [
      { id: 1, name: 'Mathematics', code: 'MATH-101', description: 'Algebra, Geometry & Trigonometry', isActive: true, createdAt: now, updatedAt: now },
      { id: 2, name: 'English Literature', code: 'ENG-101', description: 'Language and Composition', isActive: true, createdAt: now, updatedAt: now },
      { id: 3, name: 'Physics', code: 'PHY-101', description: 'Mechanics, Optics & Thermodynamics', isActive: true, createdAt: now, updatedAt: now },
      { id: 4, name: 'Chemistry', code: 'CHM-101', description: 'Organic & Inorganic Chemistry', isActive: true, createdAt: now, updatedAt: now },
      { id: 5, name: 'Computer Science', code: 'CS-101', description: 'Programming & Logic Design', isActive: true, createdAt: now, updatedAt: now },
      { id: 6, name: 'Urdu', code: 'URD-101', description: 'National Language & Literature', isActive: true, createdAt: now, updatedAt: now },
    ],
    classSubjects: [
      { id: 1, classId: 2, subjectId: 1, subjectName: 'Mathematics', subjectCode: 'MATH-101', displayOrder: 1, isActive: true, createdAt: now },
      { id: 2, classId: 2, subjectId: 2, subjectName: 'English Literature', subjectCode: 'ENG-101', displayOrder: 2, isActive: true, createdAt: now },
      { id: 3, classId: 2, subjectId: 3, subjectName: 'Physics', subjectCode: 'PHY-101', displayOrder: 3, isActive: true, createdAt: now },
      { id: 4, classId: 2, subjectId: 5, subjectName: 'Computer Science', subjectCode: 'CS-101', displayOrder: 4, isActive: true, createdAt: now },
    ],
    students: [
      {
        id: 1,
        studentId: 'STD-2026-0001',
        admissionNumber: 'ADM-2026-101',
        firstName: 'Ali',
        middleName: 'Raza',
        lastName: 'Khan',
        displayName: 'Ali Raza Khan',
        gender: 'Male',
        dateOfBirth: '2010-04-15',
        photoPath: null,
        bloodGroup: 'B+',
        nationality: 'Pakistani',
        religion: 'Islam',
        fatherName: 'Tariq Mehmood Khan',
        motherName: 'Nasreen Akhtar',
        guardianName: 'Tariq Mehmood Khan',
        guardianRelationship: 'Father',
        phone: '+92 300 1234567',
        alternativePhone: '+92 321 7654321',
        currentAddress: 'House 14, Street 3, Cavalry Ground',
        permanentAddress: 'House 14, Street 3, Cavalry Ground',
        city: 'Lahore',
        province: 'Punjab',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        currentEnrollment: {
          id: 1,
          studentId: 1,
          academicSessionId: 2,
          academicSessionName: '2026-2027',
          classId: 2,
          className: 'Grade 9',
          sectionId: 2,
          sectionName: 'Section A',
          admissionDate: '2026-08-01',
          status: 'Active',
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        id: 2,
        studentId: 'STD-2026-0002',
        admissionNumber: 'ADM-2026-102',
        firstName: 'Fatima',
        middleName: '',
        lastName: 'Zahra',
        displayName: 'Fatima Zahra',
        gender: 'Female',
        dateOfBirth: '2011-08-20',
        photoPath: null,
        bloodGroup: 'O+',
        nationality: 'Pakistani',
        religion: 'Islam',
        fatherName: 'Dr. Zulfiqar Ali',
        motherName: 'Tahira Bibi',
        guardianName: 'Dr. Zulfiqar Ali',
        guardianRelationship: 'Father',
        phone: '+92 333 4455667',
        alternativePhone: '',
        currentAddress: 'Apartment 4B, Askari 10',
        permanentAddress: 'Apartment 4B, Askari 10',
        city: 'Lahore',
        province: 'Punjab',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        currentEnrollment: {
          id: 2,
          studentId: 2,
          academicSessionId: 2,
          academicSessionName: '2026-2027',
          classId: 1,
          className: 'Grade 8',
          sectionId: 1,
          sectionName: 'Section A',
          admissionDate: '2026-08-01',
          status: 'Active',
          createdAt: now,
          updatedAt: now,
        },
      },
    ],
    studentEnrollments: [
      {
        id: 1,
        studentId: 1,
        academicSessionId: 2,
        academicSessionName: '2026-2027',
        classId: 2,
        className: 'Grade 9',
        sectionId: 2,
        sectionName: 'Section A',
        admissionDate: '2026-08-01',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        studentId: 2,
        academicSessionId: 2,
        academicSessionName: '2026-2027',
        classId: 1,
        className: 'Grade 8',
        sectionId: 1,
        sectionName: 'Section A',
        admissionDate: '2026-08-01',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    teachers: [
      {
        id: 1,
        teacherId: 'TCH-2026-0001',
        employeeId: 'EMP-101',
        firstName: 'Shahid',
        middleName: '',
        lastName: 'Afridi',
        displayName: 'Shahid Afridi',
        gender: 'Male',
        dateOfBirth: '1985-03-01',
        photoPath: null,
        phone: '+92 300 9876543',
        email: 'shahid.afridi@oxfordschool.edu.pk',
        address: 'Sector F, DHA Phase 5',
        city: 'Lahore',
        province: 'Punjab',
        qualification: 'M.Sc. Mathematics',
        specialization: 'Applied Mathematics & Calculus',
        joiningDate: '2020-09-01',
        designation: 'Senior Teacher',
        employmentStatus: 'Active',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        teacherId: 'TCH-2026-0002',
        employeeId: 'EMP-102',
        firstName: 'Ayesha',
        middleName: '',
        lastName: 'Siddiqua',
        displayName: 'Ayesha Siddiqua',
        gender: 'Female',
        dateOfBirth: '1990-11-12',
        photoPath: null,
        phone: '+92 321 5566778',
        email: 'ayesha.s@oxfordschool.edu.pk',
        address: 'Model Town, Block C',
        city: 'Lahore',
        province: 'Punjab',
        qualification: 'M.Phil English Literature',
        specialization: 'Linguistics & Phonetics',
        joiningDate: '2022-01-15',
        designation: 'Teacher',
        employmentStatus: 'Active',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    attendance: [],
    feeTypes: [
      { id: 1, name: 'Tuition Fee', code: 'TUIT', description: 'Regular monthly tuition fee', isActive: true, createdAt: now, updatedAt: now },
      { id: 2, name: 'Admission Fee', code: 'ADM', description: 'One-time initial admission fee', isActive: true, createdAt: now, updatedAt: now },
      { id: 3, name: 'Examination Fee', code: 'EXAM', description: 'Term exam fee', isActive: true, createdAt: now, updatedAt: now },
      { id: 4, name: 'Lab Charges', code: 'LAB', description: 'Science and computer laboratory charges', isActive: true, createdAt: now, updatedAt: now },
    ],
    feeStructures: [
      { id: 1, academicSessionId: 2, academicSessionName: '2026-2027', classId: 1, className: 'Grade 8', feeTypeId: 1, feeTypeName: 'Tuition Fee', amount: 350000, frequency: 'Monthly', effectiveFrom: '2026-08-01', effectiveTo: '', description: 'Monthly tuition for Grade 8', isActive: true, createdAt: now, updatedAt: now },
      { id: 2, academicSessionId: 2, academicSessionName: '2026-2027', classId: 2, className: 'Grade 9', feeTypeId: 1, feeTypeName: 'Tuition Fee', amount: 400000, frequency: 'Monthly', effectiveFrom: '2026-08-01', effectiveTo: '', description: 'Monthly tuition for Grade 9', isActive: true, createdAt: now, updatedAt: now },
      { id: 3, academicSessionId: 2, academicSessionName: '2026-2027', classId: 2, className: 'Grade 9', feeTypeId: 4, feeTypeName: 'Lab Charges', amount: 50000, frequency: 'Monthly', effectiveFrom: '2026-08-01', effectiveTo: '', description: 'Science lab fee', isActive: true, createdAt: now, updatedAt: now },
    ],
    feePeriods: [
      { id: 1, academicSessionId: 2, academicSessionName: '2026-2027', name: 'August 2026', startDate: '2026-08-01', endDate: '2026-08-31', dueDate: '2026-08-10', status: 'Closed', createdAt: now, updatedAt: now },
      { id: 2, academicSessionId: 2, academicSessionName: '2026-2027', name: 'September 2026', startDate: '2026-09-01', endDate: '2026-09-30', dueDate: '2026-09-10', status: 'Open', createdAt: now, updatedAt: now },
      { id: 3, academicSessionId: 2, academicSessionName: '2026-2027', name: 'October 2026', startDate: '2026-10-01', endDate: '2026-10-31', dueDate: '2026-10-10', status: 'Open', createdAt: now, updatedAt: now },
    ],
    studentAdjustments: [],
    feeRecords: [],
    feePayments: [],
    examTypes: [
      { id: 1, name: 'Mid Term Examination', code: 'MID', description: 'Mid-academic term evaluation', isActive: true, createdAt: now, updatedAt: now },
      { id: 2, name: 'Final Examination', code: 'FINAL', description: 'End of academic session comprehensive examination', isActive: true, createdAt: now, updatedAt: now },
      { id: 3, name: 'Monthly Class Assessment', code: 'MNT', description: 'Monthly class performance test', isActive: true, createdAt: now, updatedAt: now },
    ],
    examinations: [
      {
        id: 1,
        academicSessionId: 2,
        academicSessionName: '2026-2027',
        examTypeId: 1,
        examTypeName: 'Mid Term Examination',
        name: 'Mid Term 2026',
        startDate: '2026-10-10',
        endDate: '2026-10-25',
        status: 'Open',
        description: 'First semester comprehensive examinations',
        subjectCount: 4,
        createdAt: now,
        updatedAt: now,
      },
    ],
    examSubjects: [
      { id: 1, examinationId: 1, classId: 2, className: 'Grade 9', subjectId: 1, subjectName: 'English', subjectCode: 'ENG', maxMarks: 100, passingMarks: 40, displayOrder: 1, examDate: '2026-10-10', startTime: '09:00', durationMinutes: 180, isActive: true, marksEnteredCount: 2, totalStudentsCount: 2, createdAt: now, updatedAt: now },
      { id: 2, examinationId: 1, classId: 2, className: 'Grade 9', subjectId: 2, subjectName: 'Urdu', subjectCode: 'URD', maxMarks: 100, passingMarks: 40, displayOrder: 2, examDate: '2026-10-12', startTime: '09:00', durationMinutes: 180, isActive: true, marksEnteredCount: 2, totalStudentsCount: 2, createdAt: now, updatedAt: now },
      { id: 3, examinationId: 1, classId: 2, className: 'Grade 9', subjectId: 3, subjectName: 'Mathematics', subjectCode: 'MATH', maxMarks: 100, passingMarks: 40, displayOrder: 3, examDate: '2026-10-15', startTime: '09:00', durationMinutes: 180, isActive: true, marksEnteredCount: 2, totalStudentsCount: 2, createdAt: now, updatedAt: now },
      { id: 4, examinationId: 1, classId: 2, className: 'Grade 9', subjectId: 4, subjectName: 'Physics', subjectCode: 'PHY', maxMarks: 100, passingMarks: 40, displayOrder: 4, examDate: '2026-10-18', startTime: '09:00', durationMinutes: 180, isActive: true, marksEnteredCount: 2, totalStudentsCount: 2, createdAt: now, updatedAt: now },
    ],
    gradingRules: [
      { id: 1, name: 'A+ (Outstanding)', minPercentage: 90, maxPercentage: 100, grade: 'A+', gradePoint: 4.0, remarks: 'Outstanding', displayOrder: 1 },
      { id: 2, name: 'A (Excellent)', minPercentage: 80, maxPercentage: 89.99, grade: 'A', gradePoint: 3.7, remarks: 'Excellent', displayOrder: 2 },
      { id: 3, name: 'B (Very Good)', minPercentage: 70, maxPercentage: 79.99, grade: 'B', gradePoint: 3.0, remarks: 'Very Good', displayOrder: 3 },
      { id: 4, name: 'C (Good)', minPercentage: 60, maxPercentage: 69.99, grade: 'C', gradePoint: 2.5, remarks: 'Good', displayOrder: 4 },
      { id: 5, name: 'D (Satisfactory)', minPercentage: 50, maxPercentage: 59.99, grade: 'D', gradePoint: 2.0, remarks: 'Satisfactory', displayOrder: 5 },
      { id: 6, name: 'E (Pass)', minPercentage: 40, maxPercentage: 49.99, grade: 'E', gradePoint: 1.0, remarks: 'Pass', displayOrder: 6 },
      { id: 7, name: 'F (Fail)', minPercentage: 0, maxPercentage: 39.99, grade: 'F', gradePoint: 0.0, remarks: 'Fail', displayOrder: 7 },
    ],
    examMarks: [
      { id: 1, examinationId: 1, examinationSubjectId: 1, studentId: 1, enrollmentId: 1, obtainedMarks: 85, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 2, examinationId: 1, examinationSubjectId: 2, studentId: 1, enrollmentId: 1, obtainedMarks: 78, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 3, examinationId: 1, examinationSubjectId: 3, studentId: 1, enrollmentId: 1, obtainedMarks: 92, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 4, examinationId: 1, examinationSubjectId: 4, studentId: 1, enrollmentId: 1, obtainedMarks: 88, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 5, examinationId: 1, examinationSubjectId: 1, studentId: 2, enrollmentId: 2, obtainedMarks: 72, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 6, examinationId: 1, examinationSubjectId: 2, studentId: 2, enrollmentId: 2, obtainedMarks: 80, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 7, examinationId: 1, examinationSubjectId: 3, studentId: 2, enrollmentId: 2, obtainedMarks: 65, status: 'Entered', remarks: '', createdAt: now, updatedAt: now },
      { id: 8, examinationId: 1, examinationSubjectId: 4, studentId: 2, enrollmentId: 2, obtainedMarks: null, status: 'Absent', remarks: 'Medical leave', createdAt: now, updatedAt: now },
    ],
    studentDocuments: [],
    promotionLogs: [],
  };
}

function loadStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.attendance) parsed.attendance = [];
      if (!parsed.feeTypes) parsed.feeTypes = getDefaultStore().feeTypes;
      if (!parsed.feeStructures) parsed.feeStructures = getDefaultStore().feeStructures;
      if (!parsed.feePeriods) parsed.feePeriods = getDefaultStore().feePeriods;
      if (!parsed.studentAdjustments) parsed.studentAdjustments = [];
      if (!parsed.feeRecords) parsed.feeRecords = [];
      if (!parsed.feePayments) parsed.feePayments = [];
      if (!parsed.examTypes) parsed.examTypes = getDefaultStore().examTypes;
      if (!parsed.examinations) parsed.examinations = getDefaultStore().examinations;
      if (!parsed.examSubjects) parsed.examSubjects = getDefaultStore().examSubjects;
      if (!parsed.gradingRules) parsed.gradingRules = getDefaultStore().gradingRules;
      if (!parsed.examMarks) parsed.examMarks = getDefaultStore().examMarks;
      if (!parsed.studentDocuments) parsed.studentDocuments = [];
      if (!parsed.promotionLogs) parsed.promotionLogs = [];
      if (!parsed.studentEnrollments || parsed.studentEnrollments.length === 0) {
        parsed.studentEnrollments = getDefaultStore().studentEnrollments;
      }
      if (!parsed.students || parsed.students.length === 0) {
        parsed.students = getDefaultStore().students;
      }
      const dedicatedLogo = localStorage.getItem('sms_school_logo_data_url');
      if (dedicatedLogo) {
        parsed.logoDataUrl = dedicatedLogo;
        if (parsed.settings) {
          parsed.settings.logoDataUrl = dedicatedLogo;
        }
      }
      return parsed;
    }
  } catch (err) {
    console.warn('[BrowserMock] Could not load localStorage:', err);
  }
  const initial = getDefaultStore();
  const dedicatedLogo = localStorage.getItem('sms_school_logo_data_url');
  if (dedicatedLogo) {
    initial.logoDataUrl = dedicatedLogo;
    if (initial.settings) {
      initial.settings.logoDataUrl = dedicatedLogo;
    }
  }
  saveStore(initial);
  return initial;
}

function saveStore(store: MockStore): void {
  try {
    if (store.logoDataUrl) {
      try {
        localStorage.setItem('sms_school_logo_data_url', store.logoDataUrl);
      } catch {}
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[BrowserMock] Could not save full store to localStorage:', err);
    // Even if full store fails due to size, ensure the logo is saved
    if (store.logoDataUrl) {
      try {
        localStorage.setItem('sms_school_logo_data_url', store.logoDataUrl);
      } catch {}
    }
  }
}

export function initBrowserMock(): void {
  if (typeof window === 'undefined') return;

  // If already running in Electron, do not override native bridge
  if (window.electronAPI) {
    return;
  }

  console.info(
    '%c[MS Institute Management System] Running in Browser Preview Mode on localhost.\n%cDefault Admin: username: "admin", password: "AdminPassword123!"',
    'color: #2563eb; font-weight: bold; font-size: 14px;',
    'color: #059669; font-size: 12px;'
  );

  const mockAPI: ElectronAPI = {
    getAppInfo: async (): Promise<AppInfo> => ({
      name: 'MS Institute Management System',
      version: '1.0.0-phase3 (Browser Preview)',
      platform: 'browser',
      arch: navigator.userAgent.includes('x64') ? 'x64' : 'arm64',
      electronVersion: 'Web Browser Mode',
      nodeVersion: 'Client Runtime',
      chromeVersion: navigator.userAgent,
      appDataPath: 'localStorage://sms_browser_mock_db_v1',
      databasePath: 'Local Web Storage (Browser Simulated SQLite)',
      isDev: true,
    }),

    getSystemInfo: async (): Promise<SystemInfo> => ({
      hostname: window.location.hostname || 'localhost',
      osType: navigator.platform || 'Windows',
      osRelease: 'Web Runtime',
      totalMemoryGB: 16,
      cpuCores: navigator.hardwareConcurrency || 8,
      userHome: 'C:\\Users\\Administrator',
    }),

    getAppStatus: async (): Promise<AppStatus> => ({
      database: 'connected',
      modules: {
        students: true,
        teachers: true,
        classes: true,
        attendance: true,
        fees: true,
        results: true,
        dmc: true,
        documents: true,
        reports: true,
        backup: false,
        settings: true,
      },
    }),

    auth: {
      getSetupStatus: async () => {
        const store = loadStore();
        return { success: true, isSetupRequired: store.users.length === 0 };
      },

      createInitialAdmin: async ({ username, displayName, password }) => {
        const store = loadStore();
        const now = new Date().toISOString();
        const newUser = {
          id: store.users.length + 1,
          username: username.trim(),
          displayName: displayName.trim(),
          password,
          role: 'admin' as const,
          createdAt: now,
        };
        store.users.push(newUser);
        const token = 'mock_session_' + Math.random().toString(36).slice(2);
        store.activeToken = token;
        const safeUser: SafeUser = {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          role: 'admin',
          isActive: true,
          createdAt: newUser.createdAt,
          lastLoginAt: now,
        };
        store.activeUser = safeUser;
        saveStore(store);
        return { success: true, sessionToken: token, user: safeUser };
      },

      login: async ({ username, password }) => {
        const store = loadStore();
        const found = store.users.find(
          (u) => u.username.toLowerCase() === username.trim().toLowerCase()
        );
        if (!found || found.password !== password) {
          return { success: false, error: 'Username or password is incorrect.' };
        }
        const now = new Date().toISOString();
        const token = 'mock_session_' + Math.random().toString(36).slice(2);
        store.activeToken = token;
        const safeUser: SafeUser = {
          id: found.id,
          username: found.username,
          displayName: found.displayName,
          role: 'admin',
          isActive: true,
          createdAt: found.createdAt,
          lastLoginAt: now,
        };
        store.activeUser = safeUser;
        saveStore(store);
        return { success: true, sessionToken: token, user: safeUser };
      },

      logout: async () => {
        const store = loadStore();
        store.activeToken = null;
        store.activeUser = null;
        saveStore(store);
        return { success: true };
      },

      getCurrentUser: async (sessionToken?: string) => {
        const store = loadStore();
        if (sessionToken && store.activeToken === sessionToken && store.activeUser) {
          return { success: true, user: store.activeUser };
        }
        // Fallback: auto-login default admin in browser if token exists
        if (store.users.length > 0) {
          const u = store.users[0];
          return {
            success: true,
            user: {
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              role: 'admin',
              isActive: true,
              createdAt: u.createdAt,
              lastLoginAt: new Date().toISOString(),
            },
          };
        }
        return { success: false, user: null };
      },
    },

    school: {
      getSettings: async () => {
        const store = loadStore();
        const logoDataUrl = store.logoDataUrl || store.settings.logoDataUrl || null;
        return {
          success: true,
          settings: { ...store.settings, logoDataUrl },
          logoDataUrl,
        };
      },

      updateSettings: async (_sessionToken, settings) => {
        const store = loadStore();
        store.settings = {
          ...store.settings,
          ...settings,
          logoDataUrl: store.logoDataUrl || store.settings.logoDataUrl || null,
          updatedAt: new Date().toISOString(),
        };
        saveStore(store);
        return { success: true, settings: store.settings, logoDataUrl: store.logoDataUrl };
      },

      chooseLogoFile: async () => {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/png,image/jpeg,image/jpg';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve({ success: false, canceled: true });
              return;
            }
            try {
              const dataUrl = await resizeImageToMaxDimension(file, 512);
              const store = loadStore();
              store.logoDataUrl = dataUrl;
              store.settings.logoPath = 'uploads/logos/' + file.name;
              store.settings.logoDataUrl = dataUrl;
              try {
                localStorage.setItem('sms_school_logo_data_url', dataUrl);
              } catch {}
              saveStore(store);
              resolve({ success: true, dataUrl, logoPath: store.settings.logoPath });
            } catch (err) {
              resolve({ success: false, error: 'Failed to process image file.' });
            }
          };
          input.click();
        });
      },

      uploadLogo: async ({ base64Data }) => {
        try {
          const dataUrl = await resizeImageToMaxDimension(base64Data, 512);
          const store = loadStore();
          store.logoDataUrl = dataUrl;
          store.settings.logoDataUrl = dataUrl;
          try {
            localStorage.setItem('sms_school_logo_data_url', dataUrl);
          } catch {}
          saveStore(store);
          return { success: true, dataUrl };
        } catch {
          const store = loadStore();
          store.logoDataUrl = base64Data;
          store.settings.logoDataUrl = base64Data;
          try {
            localStorage.setItem('sms_school_logo_data_url', base64Data);
          } catch {}
          saveStore(store);
          return { success: true, dataUrl: base64Data };
        }
      },

      removeLogo: async () => {
        const store = loadStore();
        store.logoDataUrl = null;
        store.settings.logoPath = null;
        store.settings.logoDataUrl = null;
        try {
          localStorage.removeItem('sms_school_logo_data_url');
        } catch {}
        saveStore(store);
        return { success: true };
      },

      getLogoDataUrl: async () => {
        const store = loadStore();
        return { success: true, dataUrl: store.logoDataUrl };
      },

      uploadSignature: async ({ base64Data }: { sessionToken: string; base64Data: string; fileExtension: string }) => {
        try {
          const dataUrl = await resizeImageToMaxDimension(base64Data, 512);
          const store = loadStore();
          store.signatureDataUrl = dataUrl;
          store.settings.signatureDataUrl = dataUrl;
          try {
            localStorage.setItem('sms_school_signature_data_url', dataUrl);
          } catch {}
          saveStore(store);
          return { success: true, dataUrl, signaturePath: 'signature.png' };
        } catch {
          const store = loadStore();
          store.signatureDataUrl = base64Data;
          store.settings.signatureDataUrl = base64Data;
          try {
            localStorage.setItem('sms_school_signature_data_url', base64Data);
          } catch {}
          saveStore(store);
          return { success: true, dataUrl: base64Data, signaturePath: 'signature.png' };
        }
      },

      removeSignature: async () => {
        const store = loadStore();
        store.signatureDataUrl = null;
        store.settings.signaturePath = null;
        store.settings.signatureDataUrl = null;
        try {
          localStorage.removeItem('sms_school_signature_data_url');
        } catch {}
        saveStore(store);
        return { success: true };
      },

      getSignatureDataUrl: async () => {
        const store = loadStore();
        return { success: true, dataUrl: store.signatureDataUrl || null };
      },
    },

    sessions: {
      getAll: async (searchQuery?: string) => {
        const store = loadStore();
        let list = [...store.sessions];
        if (searchQuery?.trim()) {
          const q = searchQuery.trim().toLowerCase();
          list = list.filter((s) => s.name.toLowerCase().includes(q));
        }
        return { success: true, sessions: list };
      },

      create: async ({ name, startDate, endDate, isActive }) => {
        const store = loadStore();
        const trimmed = name.trim();
        if (store.sessions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Academic session "${trimmed}" already exists.` };
        }
        if (new Date(startDate) > new Date(endDate)) {
          return { success: false, error: 'Start date cannot be after end date.' };
        }
        const now = new Date().toISOString();
        if (isActive) {
          store.sessions.forEach((s) => (s.isActive = false));
          store.settings.academicSession = trimmed;
        }
        const newSession: AcademicSession = {
          id: store.sessions.length > 0 ? Math.max(...store.sessions.map((s) => s.id)) + 1 : 1,
          name: trimmed,
          startDate,
          endDate,
          isActive: Boolean(isActive),
          createdAt: now,
          updatedAt: now,
        };
        store.sessions.push(newSession);
        saveStore(store);
        return { success: true, session: newSession };
      },

      update: async ({ id, name, startDate, endDate, isActive }) => {
        const store = loadStore();
        const target = store.sessions.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Session not found.' };

        const trimmed = name.trim();
        if (store.sessions.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Academic session "${trimmed}" already exists.` };
        }
        if (new Date(startDate) > new Date(endDate)) {
          return { success: false, error: 'Start date cannot be after end date.' };
        }
        if (isActive) {
          store.sessions.forEach((s) => (s.isActive = false));
          store.settings.academicSession = trimmed;
        }
        target.name = trimmed;
        target.startDate = startDate;
        target.endDate = endDate;
        target.isActive = Boolean(isActive);
        target.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, session: target };
      },

      activate: async (_token, id) => {
        const store = loadStore();
        const target = store.sessions.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Session not found.' };
        store.sessions.forEach((s) => (s.isActive = false));
        target.isActive = true;
        store.settings.academicSession = target.name;
        saveStore(store);
        return { success: true, session: target };
      },

      deactivate: async (_token, id) => {
        const store = loadStore();
        const target = store.sessions.find((s) => s.id === id);
        if (target) {
          target.isActive = false;
          if (store.settings.academicSession === target.name) {
            store.settings.academicSession = '';
          }
          saveStore(store);
        }
        return { success: true, session: target };
      },
    },

    classes: {
      getAll: async (searchQuery?: string, includeInactive = true) => {
        const store = loadStore();
        let list = store.classes.map((cls) => {
          const secCount = store.sections.filter((sec) => sec.classId === cls.id).length;
          const subCount = store.classSubjects.filter((cs) => cs.classId === cls.id).length;
          return {
            ...cls,
            sectionCount: secCount,
            subjectCount: subCount,
          };
        });

        if (!includeInactive) {
          list = list.filter((c) => c.isActive);
        }

        if (searchQuery?.trim()) {
          const q = searchQuery.trim().toLowerCase();
          list = list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
        }

        list.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
        return { success: true, classes: list };
      },

      getById: async (id: number) => {
        const store = loadStore();
        const found = store.classes.find((c) => c.id === id);
        if (!found) return { success: true, classItem: null };
        const secCount = store.sections.filter((sec) => sec.classId === id).length;
        const subCount = store.classSubjects.filter((cs) => cs.classId === id).length;
        return {
          success: true,
          classItem: { ...found, sectionCount: secCount, subjectCount: subCount },
        };
      },

      create: async ({ name, code, displayOrder, isActive }) => {
        const store = loadStore();
        const trimmed = name.trim();
        if (store.classes.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Class "${trimmed}" already exists.` };
        }
        const now = new Date().toISOString();
        const newClass = {
          id: store.classes.length > 0 ? Math.max(...store.classes.map((c) => c.id)) + 1 : 1,
          name: trimmed,
          code: (code || '').trim(),
          displayOrder: Number(displayOrder) || 0,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          createdAt: now,
          updatedAt: now,
        };
        store.classes.push(newClass);
        saveStore(store);
        return {
          success: true,
          classItem: { ...newClass, sectionCount: 0, subjectCount: 0 },
        };
      },

      update: async ({ id, name, code, displayOrder, isActive }) => {
        const store = loadStore();
        const target = store.classes.find((c) => c.id === id);
        if (!target) return { success: false, error: 'Class not found.' };

        const trimmed = name.trim();
        if (store.classes.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Class "${trimmed}" already exists.` };
        }
        target.name = trimmed;
        target.code = (code || '').trim();
        target.displayOrder = Number(displayOrder) || 0;
        if (isActive !== undefined) target.isActive = Boolean(isActive);
        target.updatedAt = new Date().toISOString();
        saveStore(store);

        const secCount = store.sections.filter((sec) => sec.classId === id).length;
        const subCount = store.classSubjects.filter((cs) => cs.classId === id).length;
        return {
          success: true,
          classItem: { ...target, sectionCount: secCount, subjectCount: subCount },
        };
      },

      toggleStatus: async (_token, id, isActive) => {
        const store = loadStore();
        const target = store.classes.find((c) => c.id === id);
        if (!target) return { success: false, error: 'Class not found.' };
        target.isActive = isActive;
        target.updatedAt = new Date().toISOString();
        saveStore(store);
        const secCount = store.sections.filter((sec) => sec.classId === id).length;
        const subCount = store.classSubjects.filter((cs) => cs.classId === id).length;
        return { success: true, classItem: { ...target, sectionCount: secCount, subjectCount: subCount } };
      },
    },

    sections: {
      getByClassId: async (classId: number, searchQuery?: string) => {
        const store = loadStore();
        let list = store.sections.filter((s) => s.classId === classId);
        if (searchQuery?.trim()) {
          const q = searchQuery.trim().toLowerCase();
          list = list.filter((s) => s.name.toLowerCase().includes(q));
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        return { success: true, sections: list };
      },

      create: async ({ classId, name, description, isActive }) => {
        const store = loadStore();
        const trimmed = name.trim();
        if (
          store.sections.some(
            (s) => s.classId === classId && s.name.toLowerCase() === trimmed.toLowerCase()
          )
        ) {
          return { success: false, error: `Section "${trimmed}" already exists in this class.` };
        }
        const now = new Date().toISOString();
        const newSec: SectionItem = {
          id: store.sections.length > 0 ? Math.max(...store.sections.map((s) => s.id)) + 1 : 1,
          classId,
          name: trimmed,
          description: (description || '').trim(),
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          createdAt: now,
          updatedAt: now,
        };
        store.sections.push(newSec);
        saveStore(store);
        return { success: true, section: newSec };
      },

      update: async ({ id, name, description, isActive }) => {
        const store = loadStore();
        const target = store.sections.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Section not found.' };

        const trimmed = name.trim();
        if (
          store.sections.some(
            (s) => s.id !== id && s.classId === target.classId && s.name.toLowerCase() === trimmed.toLowerCase()
          )
        ) {
          return { success: false, error: `Section "${trimmed}" already exists in this class.` };
        }
        target.name = trimmed;
        target.description = (description || '').trim();
        if (isActive !== undefined) target.isActive = Boolean(isActive);
        target.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, section: target };
      },

      toggleStatus: async (_token, id, isActive) => {
        const store = loadStore();
        const target = store.sections.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Section not found.' };
        target.isActive = isActive;
        target.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, section: target };
      },
    },

    subjects: {
      getAll: async (searchQuery?: string, includeInactive = true) => {
        const store = loadStore();
        let list = store.subjects.map((s) => {
          const assignedCount = store.classSubjects.filter((cs) => cs.subjectId === s.id).length;
          return {
            ...s,
            assignedClassesCount: assignedCount,
          };
        });

        if (!includeInactive) {
          list = list.filter((s) => s.isActive);
        }

        if (searchQuery?.trim()) {
          const q = searchQuery.trim().toLowerCase();
          list = list.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
        }

        list.sort((a, b) => a.name.localeCompare(b.name));
        return { success: true, subjects: list };
      },

      create: async ({ name, code, description, isActive }) => {
        const store = loadStore();
        const trimmed = name.trim();
        if (store.subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Subject "${trimmed}" already exists.` };
        }
        const now = new Date().toISOString();
        const newSubject = {
          id: store.subjects.length > 0 ? Math.max(...store.subjects.map((s) => s.id)) + 1 : 1,
          name: trimmed,
          code: (code || '').trim(),
          description: (description || '').trim(),
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          createdAt: now,
          updatedAt: now,
        };
        store.subjects.push(newSubject);
        saveStore(store);
        return {
          success: true,
          subject: { ...newSubject, assignedClassesCount: 0 },
        };
      },

      update: async ({ id, name, code, description, isActive }) => {
        const store = loadStore();
        const target = store.subjects.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Subject not found.' };

        const trimmed = name.trim();
        if (store.subjects.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
          return { success: false, error: `Subject "${trimmed}" already exists.` };
        }
        target.name = trimmed;
        target.code = (code || '').trim();
        target.description = (description || '').trim();
        if (isActive !== undefined) target.isActive = Boolean(isActive);
        target.updatedAt = new Date().toISOString();
        saveStore(store);

        const assignedCount = store.classSubjects.filter((cs) => cs.subjectId === id).length;
        return {
          success: true,
          subject: { ...target, assignedClassesCount: assignedCount },
        };
      },

      toggleStatus: async (_token, id, isActive) => {
        const store = loadStore();
        const target = store.subjects.find((s) => s.id === id);
        if (!target) return { success: false, error: 'Subject not found.' };
        target.isActive = isActive;
        target.updatedAt = new Date().toISOString();
        saveStore(store);
        const assignedCount = store.classSubjects.filter((cs) => cs.subjectId === id).length;
        return { success: true, subject: { ...target, assignedClassesCount: assignedCount } };
      },
    },

    classSubjects: {
      getByClassId: async (classId: number) => {
        const store = loadStore();
        const list = store.classSubjects.filter((cs) => cs.classId === classId);
        list.sort((a, b) => a.displayOrder - b.displayOrder || a.subjectName.localeCompare(b.subjectName));
        return { success: true, classSubjects: list };
      },

      assign: async ({ classId, subjectId, displayOrder }) => {
        const store = loadStore();
        const existing = store.classSubjects.find(
          (cs) => cs.classId === classId && cs.subjectId === subjectId
        );
        if (existing) {
          return { success: false, error: 'This subject is already assigned to this class.' };
        }
        const subject = store.subjects.find((s) => s.id === subjectId);
        if (!subject) return { success: false, error: 'Subject not found.' };

        const now = new Date().toISOString();
        const newAssignment: ClassSubjectItem = {
          id: store.classSubjects.length > 0 ? Math.max(...store.classSubjects.map((c) => c.id)) + 1 : 1,
          classId,
          subjectId,
          subjectName: subject.name,
          subjectCode: subject.code,
          displayOrder: Number(displayOrder) || 0,
          isActive: true,
          createdAt: now,
        };
        store.classSubjects.push(newAssignment);

        // Auto-sync into active examinations that participate with this class
        const cls = store.classes.find((c) => c.id === classId);
        const activeExams = store.examinations.filter((e) => e.status !== 'Closed');
        for (const ex of activeExams) {
          const alreadyInExam = store.examSubjects.some(
            (es) => es.examinationId === ex.id && es.classId === classId && es.subjectId === subjectId
          );
          if (!alreadyInExam) {
            const nextExamSubId = store.examSubjects.length > 0 ? Math.max(...store.examSubjects.map((x) => x.id)) + 1 : 1;
            store.examSubjects.push({
              id: nextExamSubId,
              examinationId: ex.id,
              classId,
              className: cls?.name,
              subjectId,
              subjectName: subject.name,
              subjectCode: subject.code,
              maxMarks: 100,
              passingMarks: 40,
              displayOrder: Number(displayOrder) || store.examSubjects.length + 1,
              examDate: null,
              startTime: null,
              durationMinutes: null,
              isActive: true,
              marksEnteredCount: 0,
              totalStudentsCount: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        saveStore(store);
        return { success: true, classSubject: newAssignment };
      },

      remove: async (_token, classId, subjectId) => {
        const store = loadStore();
        store.classSubjects = store.classSubjects.filter(
          (cs) => !(cs.classId === classId && cs.subjectId === subjectId)
        );
        // Clean up from active exams if no student marks are recorded
        store.examSubjects = store.examSubjects.filter((es) => {
          if (es.classId === classId && es.subjectId === subjectId) {
            const hasMarks = store.examMarks.some((m) => m.examinationSubjectId === es.id);
            return hasMarks; // keep only if student marks already recorded
          }
          return true;
        });
        saveStore(store);
        return { success: true };
      },
    },

    students: {
      getAll: async (params?: StudentFilterParams) => {
        const store = loadStore();
        let list = store.students.filter((s) => !s.isDeleted);

        if (params?.searchQuery) {
          const q = params.searchQuery.toLowerCase();
          list = list.filter(
            (s) =>
              s.displayName.toLowerCase().includes(q) ||
              s.studentId.toLowerCase().includes(q) ||
              s.admissionNumber.toLowerCase().includes(q) ||
              s.phone.toLowerCase().includes(q) ||
              s.fatherName.toLowerCase().includes(q)
          );
        }

        if (params?.gender) {
          list = list.filter((s) => s.gender === params.gender);
        }

        if (params?.isActive !== undefined) {
          list = list.filter((s) => s.isActive === params.isActive);
        }

        if (params?.academicSessionId) {
          list = list.filter((s) => s.currentEnrollment?.academicSessionId === params.academicSessionId);
        }

        if (params?.classId) {
          list = list.filter((s) => s.currentEnrollment?.classId === params.classId);
        }

        if (params?.sectionId) {
          list = list.filter((s) => s.currentEnrollment?.sectionId === params.sectionId);
        }

        if (params?.enrollmentStatus) {
          list = list.filter((s) => s.currentEnrollment?.status === params.enrollmentStatus);
        }

        const totalCount = list.length;
        const page = params?.page || 1;
        const limit = params?.limit || 15;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const offset = (page - 1) * limit;
        const paginated = list.slice(offset, offset + limit);

        return {
          success: true,
          students: paginated,
          totalCount,
          page,
          totalPages,
        };
      },

      getStats: async (academicSessionId?: number) => {
        const store = loadStore();
        const nonDeleted = store.students.filter((s) => !s.isDeleted);
        const total = nonDeleted.length;
        const active = nonDeleted.filter((s) => s.isActive).length;
        const inactive = total - active;
        let sessionCount = active;
        if (academicSessionId) {
          const sIds = new Set(
            store.studentEnrollments
              .filter((e) => e.academicSessionId === academicSessionId && e.status === 'Active')
              .map((e) => e.studentId)
          );
          sessionCount = nonDeleted.filter((s) => sIds.has(s.id)).length;
        }
        return { success: true, stats: { total, active, inactive, sessionCount } };
      },

      getById: async (id: number) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === id) || null;
        return { success: true, student };
      },

      generateNextId: async (year?: string) => {
        const store = loadStore();
        const targetYear = year || new Date().getFullYear().toString();
        const yearStudents = store.students.filter((s) => s.studentId.startsWith(`STD-${targetYear}-`));
        let maxSeq = 0;
        for (const s of yearStudents) {
          const parts = s.studentId.split('-');
          if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        const nextSeq = String(maxSeq + 1).padStart(4, '0');
        return { success: true, nextId: `STD-${targetYear}-${nextSeq}` };
      },

      create: async (data: Record<string, unknown>) => {
        const store = loadStore();
        const now = new Date().toISOString();
        const newId = store.students.length > 0 ? Math.max(...store.students.map((s) => s.id)) + 1 : 1;

        const firstName = String(data.firstName || '').trim();
        const middleName = String(data.middleName || '').trim();
        const lastName = String(data.lastName || '').trim();
        const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');

        const studentId = String(data.studentId || '').trim();
        const admissionNumber = String(data.admissionNumber || '').trim();

        if (store.students.some((s) => s.studentId.toLowerCase() === studentId.toLowerCase())) {
          return { success: false, error: 'Student ID already exists.' };
        }
        if (store.students.some((s) => s.admissionNumber.toLowerCase() === admissionNumber.toLowerCase())) {
          return { success: false, error: 'Admission Number already exists.' };
        }

        let enrollmentItem: StudentEnrollmentItem | null = null;
        if (data.academicSessionId && data.classId && data.sectionId) {
          const session = store.sessions.find((s) => s.id === Number(data.academicSessionId));
          const cls = store.classes.find((c) => c.id === Number(data.classId));
          const sec = store.sections.find((s) => s.id === Number(data.sectionId));
          const enrollId = store.studentEnrollments.length > 0 ? Math.max(...store.studentEnrollments.map((e) => e.id)) + 1 : 1;

          enrollmentItem = {
            id: enrollId,
            studentId: newId,
            academicSessionId: Number(data.academicSessionId),
            academicSessionName: session?.name || '',
            classId: Number(data.classId),
            className: cls?.name || '',
            sectionId: Number(data.sectionId),
            sectionName: sec?.name || '',
            rollNumber: data.rollNumber ? String(data.rollNumber).trim() : undefined,
            admissionDate: String(data.admissionDate || now.split('T')[0]),
            status: 'Active',
            createdAt: now,
            updatedAt: now,
          };
          if (enrollmentItem) {
            store.studentEnrollments.push(enrollmentItem);
          }
        }

        const newStudent: StudentItem = {
          id: newId,
          studentId,
          admissionNumber,
          firstName,
          middleName,
          lastName,
          displayName,
          gender: (data.gender as 'Male' | 'Female' | 'Other') || 'Male',
          dateOfBirth: String(data.dateOfBirth || ''),
          photoPath: null,
          bloodGroup: String(data.bloodGroup || ''),
          nationality: String(data.nationality || 'Pakistani'),
          religion: String(data.religion || 'Islam'),
          fatherName: String(data.fatherName || ''),
          motherName: String(data.motherName || ''),
          guardianName: String(data.guardianName || ''),
          guardianRelationship: String(data.guardianRelationship || 'Father'),
          phone: String(data.phone || ''),
          alternativePhone: String(data.alternativePhone || ''),
          currentAddress: String(data.currentAddress || ''),
          permanentAddress: String(data.permanentAddress || ''),
          city: String(data.city || 'Lahore'),
          province: String(data.province || 'Punjab'),
          isActive: true,
          createdAt: now,
          updatedAt: now,
          currentEnrollment: enrollmentItem,
        };

        store.students.push(newStudent);
        saveStore(store);
        return { success: true, student: newStudent };
      },

      update: async (data: Record<string, unknown>) => {
        const store = loadStore();
        let id = Number(data.id);
        if (!id || isNaN(id)) {
          if (typeof data.studentId === 'number') {
            id = Number(data.studentId);
          }
        }

        let idx = -1;
        if (id && !isNaN(id)) {
          idx = store.students.findIndex((s) => s.id === id);
        }
        if (idx === -1 && data.studentId) {
          idx = store.students.findIndex((s) => s.studentId === String(data.studentId).trim());
        }
        if (idx === -1 && data.admissionNumber) {
          idx = store.students.findIndex(
            (s) => s.admissionNumber.toLowerCase() === String(data.admissionNumber).trim().toLowerCase()
          );
        }

        if (idx === -1) return { success: false, error: 'Student not found.' };

        const student = store.students[idx];
        const targetId = student.id;
        const now = new Date().toISOString();

        const firstName = data.firstName !== undefined ? String(data.firstName).trim() : student.firstName;
        const middleName = data.middleName !== undefined ? String(data.middleName).trim() : student.middleName;
        const lastName = data.lastName !== undefined ? String(data.lastName).trim() : student.lastName;
        const displayName = String(data.displayName || [firstName, middleName, lastName].filter(Boolean).join(' ')).trim();

        const admissionNumber = data.admissionNumber !== undefined ? String(data.admissionNumber).trim() : student.admissionNumber;
        if (
          admissionNumber &&
          store.students.some((s) => s.id !== targetId && s.admissionNumber.toLowerCase() === admissionNumber.toLowerCase())
        ) {
          return { success: false, error: 'Admission Number already in use by another student.' };
        }

        student.firstName = firstName;
        student.middleName = middleName;
        student.lastName = lastName;
        student.displayName = displayName;
        if (admissionNumber) student.admissionNumber = admissionNumber;
        if (data.studentId && typeof data.studentId === 'string' && data.studentId.trim()) {
          student.studentId = data.studentId.trim();
        }
        if (data.gender) student.gender = (data.gender as 'Male' | 'Female' | 'Other') || student.gender;
        if (data.dateOfBirth !== undefined) student.dateOfBirth = String(data.dateOfBirth || student.dateOfBirth);
        if (data.bloodGroup !== undefined) student.bloodGroup = String(data.bloodGroup ?? student.bloodGroup);
        if (data.nationality !== undefined) student.nationality = String(data.nationality ?? student.nationality);
        if (data.religion !== undefined) student.religion = String(data.religion ?? student.religion);
        if (data.fatherName !== undefined) student.fatherName = String(data.fatherName ?? student.fatherName);
        if (data.motherName !== undefined) student.motherName = String(data.motherName ?? student.motherName);
        if (data.guardianName !== undefined) student.guardianName = String(data.guardianName ?? student.guardianName);
        if (data.guardianRelationship !== undefined) student.guardianRelationship = String(data.guardianRelationship ?? student.guardianRelationship);
        if (data.phone !== undefined) student.phone = String(data.phone ?? student.phone);
        if (data.alternativePhone !== undefined) student.alternativePhone = String(data.alternativePhone ?? student.alternativePhone);
        if (data.currentAddress !== undefined) student.currentAddress = String(data.currentAddress ?? student.currentAddress);
        if (data.permanentAddress !== undefined) student.permanentAddress = String(data.permanentAddress ?? student.permanentAddress);
        if (data.city !== undefined) student.city = String(data.city ?? student.city);
        if (data.province !== undefined) student.province = String(data.province ?? student.province);
        if (data.isActive !== undefined) student.isActive = Boolean(data.isActive);
        student.updatedAt = now;

        // Handle enrollment update if provided
        const enrollmentData = (data.enrollment as Record<string, unknown>) || null;
        const classId = Number(enrollmentData?.classId ?? data.classId);
        const sectionId = Number(enrollmentData?.sectionId ?? data.sectionId);
        const academicSessionId = Number(enrollmentData?.academicSessionId ?? data.academicSessionId);

        if (academicSessionId && classId && sectionId) {
          const session = store.sessions.find((s) => s.id === academicSessionId);
          const cls = store.classes.find((c) => c.id === classId);
          const sec = store.sections.find((s) => s.id === sectionId);

          let enroll = store.studentEnrollments.find(
            (e) => e.studentId === targetId && e.academicSessionId === academicSessionId && e.status === 'Active'
          );
          if (enroll) {
            enroll.classId = classId;
            enroll.className = cls?.name || enroll.className;
            enroll.sectionId = sectionId;
            enroll.sectionName = sec?.name || enroll.sectionName;
            enroll.updatedAt = now;
          } else {
            const enrollId = store.studentEnrollments.length > 0 ? Math.max(...store.studentEnrollments.map((e) => e.id)) + 1 : 1;
            enroll = {
              id: enrollId,
              studentId: targetId,
              academicSessionId,
              academicSessionName: session?.name || '',
              classId,
              className: cls?.name || '',
              sectionId,
              sectionName: sec?.name || '',
              admissionDate: String(enrollmentData?.admissionDate || data.admissionDate || now.split('T')[0]),
              status: 'Active',
              createdAt: now,
              updatedAt: now,
            };
            store.studentEnrollments.push(enroll);
          }
          student.currentEnrollment = enroll;
        }

        saveStore(store);
        return { success: true, student };
      },

      toggleStatus: async (_token: string, id: number, isActive: boolean) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === id);
        if (!student) return { success: false, error: 'Student not found.' };
        student.isActive = isActive;
        student.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, student };
      },

      getEnrollmentHistory: async (studentId: number) => {
        const store = loadStore();
        const history = store.studentEnrollments
          .filter((e) => e.studentId === studentId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { success: true, history };
      },

      createEnrollment: async (data: Record<string, unknown>) => {
        const store = loadStore();
        const studentId = Number(data.studentId);
        const academicSessionId = Number(data.academicSessionId);
        const classId = Number(data.classId);
        const sectionId = Number(data.sectionId);

        const student = store.students.find((s) => s.id === studentId);
        if (!student) return { success: false, error: 'Student not found.' };

        // Deactivate existing active enrollment for this session
        for (const e of store.studentEnrollments) {
          if (e.studentId === studentId && e.academicSessionId === academicSessionId && e.status === 'Active') {
            e.status = 'Inactive';
            e.updatedAt = new Date().toISOString();
          }
        }

        const session = store.sessions.find((s) => s.id === academicSessionId);
        const cls = store.classes.find((c) => c.id === classId);
        const sec = store.sections.find((s) => s.id === sectionId);
        const now = new Date().toISOString();
        const enrollId = store.studentEnrollments.length > 0 ? Math.max(...store.studentEnrollments.map((e) => e.id)) + 1 : 1;

        const enrollment: StudentEnrollmentItem = {
          id: enrollId,
          studentId,
          academicSessionId,
          academicSessionName: session?.name || '',
          classId,
          className: cls?.name || '',
          sectionId,
          sectionName: sec?.name || '',
          rollNumber: data.rollNumber ? String(data.rollNumber).trim() : undefined,
          admissionDate: String(data.admissionDate || now.split('T')[0]),
          status: 'Active',
          createdAt: now,
          updatedAt: now,
        };

        store.studentEnrollments.push(enrollment);
        student.currentEnrollment = enrollment;
        student.updatedAt = now;
        saveStore(store);

        return { success: true, enrollment };
      },

      choosePhoto: async () => {
        return { success: false, error: 'File dialog is only available in desktop app.' };
      },

      uploadPhoto: async ({ studentId, base64Data }: { studentId: number; base64Data: string; fileExtension: string }) => {
        const store = loadStore();
        let targetId = Number(studentId);
        let student = store.students.find((s) => s.id === targetId);
        if (!student && typeof studentId === 'string') {
          student = store.students.find((s) => s.studentId === String(studentId).trim());
          if (student) targetId = student.id;
        }
        if (!student) return { success: false, error: 'Student not found.' };

        // Downscale image to max 400px so localStorage never exceeds quota
        let cleanDataUrl = base64Data;
        try {
          cleanDataUrl = await resizeImageToMaxDimension(base64Data, 400);
        } catch {}

        student.photoPath = `student_${targetId}.png`;
        student.photoDataUrl = cleanDataUrl;
        student.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, photoPath: student.photoPath, dataUrl: cleanDataUrl };
      },

      removePhoto: async (_token: string, studentId: number) => {
        const store = loadStore();
        let targetId = Number(studentId);
        let student = store.students.find((s) => s.id === targetId);
        if (!student && typeof studentId === 'string') {
          student = store.students.find((s) => s.studentId === String(studentId).trim());
        }
        if (!student) return { success: false, error: 'Student not found.' };
        student.photoPath = null;
        student.photoDataUrl = null;
        student.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true };
      },

      delete: async (_token: string, id: number) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === id);
        if (!student) return { success: false, error: 'Student not found.' };
        student.isDeleted = true;
        student.isActive = false;
        student.deletedAt = new Date().toISOString();
        student.updatedAt = new Date().toISOString();
        for (const e of store.studentEnrollments) {
          if (e.studentId === id) {
            e.status = 'Left';
            e.updatedAt = new Date().toISOString();
          }
        }
        saveStore(store);
        return { success: true, mode: 'archived' as const };
      },
    },

    teachers: {
      getAll: async (params?: TeacherFilterParams) => {
        const store = loadStore();
        let list = [...store.teachers];

        if (params?.searchQuery) {
          const q = params.searchQuery.toLowerCase();
          list = list.filter(
            (t) =>
              t.displayName.toLowerCase().includes(q) ||
              t.teacherId.toLowerCase().includes(q) ||
              t.employeeId.toLowerCase().includes(q) ||
              t.phone.toLowerCase().includes(q) ||
              t.email.toLowerCase().includes(q) ||
              t.qualification.toLowerCase().includes(q)
          );
        }

        if (params?.employmentStatus) {
          list = list.filter((t) => t.employmentStatus === params.employmentStatus);
        }

        if (params?.designation) {
          list = list.filter((t) => t.designation === params.designation);
        }

        if (params?.isActive !== undefined) {
          list = list.filter((t) => t.isActive === params.isActive);
        }

        const totalCount = list.length;
        const page = params?.page || 1;
        const limit = params?.limit || 15;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const offset = (page - 1) * limit;
        const paginated = list.slice(offset, offset + limit);

        return {
          success: true,
          teachers: paginated,
          totalCount,
          page,
          totalPages,
        };
      },

      getById: async (id: number) => {
        const store = loadStore();
        const teacher = store.teachers.find((t) => t.id === id) || null;
        return { success: true, teacher };
      },

      generateNextId: async (year?: string) => {
        const store = loadStore();
        const targetYear = year || new Date().getFullYear().toString();
        const yearTeachers = store.teachers.filter((t) => t.teacherId.startsWith(`TCH-${targetYear}-`));
        let maxSeq = 0;
        for (const t of yearTeachers) {
          const parts = t.teacherId.split('-');
          if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        const nextSeq = String(maxSeq + 1).padStart(4, '0');
        return { success: true, nextId: `TCH-${targetYear}-${nextSeq}` };
      },

      create: async (data: Record<string, unknown>) => {
        const store = loadStore();
        const now = new Date().toISOString();
        const newId = store.teachers.length > 0 ? Math.max(...store.teachers.map((t) => t.id)) + 1 : 1;

        const firstName = String(data.firstName || '').trim();
        const middleName = String(data.middleName || '').trim();
        const lastName = String(data.lastName || '').trim();
        const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');

        const teacherId = String(data.teacherId || '').trim();
        const employeeId = String(data.employeeId || '').trim();

        if (store.teachers.some((t) => t.teacherId.toLowerCase() === teacherId.toLowerCase())) {
          return { success: false, error: 'Teacher ID already exists.' };
        }
        if (store.teachers.some((t) => t.employeeId.toLowerCase() === employeeId.toLowerCase())) {
          return { success: false, error: 'Employee ID already exists.' };
        }

        const newTeacher: TeacherItem = {
          id: newId,
          teacherId,
          employeeId,
          firstName,
          middleName,
          lastName,
          displayName,
          gender: (data.gender as 'Male' | 'Female' | 'Other') || 'Male',
          dateOfBirth: String(data.dateOfBirth || ''),
          photoPath: null,
          phone: String(data.phone || ''),
          email: String(data.email || ''),
          address: String(data.address || ''),
          city: String(data.city || 'Lahore'),
          province: String(data.province || 'Punjab'),
          qualification: String(data.qualification || ''),
          specialization: String(data.specialization || ''),
          joiningDate: String(data.joiningDate || now.split('T')[0]),
          designation: String(data.designation || 'Teacher'),
          employmentStatus: (data.employmentStatus as 'Active' | 'Inactive' | 'On Leave' | 'Resigned') || 'Active',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        store.teachers.push(newTeacher);
        saveStore(store);
        return { success: true, teacher: newTeacher };
      },

      update: async (data: Record<string, unknown>) => {
        const store = loadStore();
        const id = Number(data.id);
        const idx = store.teachers.findIndex((t) => t.id === id);
        if (idx === -1) return { success: false, error: 'Teacher not found.' };

        const now = new Date().toISOString();
        const firstName = String(data.firstName || '').trim();
        const middleName = String(data.middleName || '').trim();
        const lastName = String(data.lastName || '').trim();
        const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');

        const employeeId = String(data.employeeId || '').trim();
        if (store.teachers.some((t) => t.id !== id && t.employeeId.toLowerCase() === employeeId.toLowerCase())) {
          return { success: false, error: 'Employee ID already in use by another teacher.' };
        }

        const teacher = store.teachers[idx];
        teacher.firstName = firstName;
        teacher.middleName = middleName;
        teacher.lastName = lastName;
        teacher.displayName = displayName;
        teacher.employeeId = employeeId;
        teacher.gender = (data.gender as 'Male' | 'Female' | 'Other') || teacher.gender;
        teacher.dateOfBirth = String(data.dateOfBirth || teacher.dateOfBirth);
        teacher.phone = String(data.phone ?? teacher.phone);
        teacher.email = String(data.email ?? teacher.email);
        teacher.address = String(data.address ?? teacher.address);
        teacher.city = String(data.city ?? teacher.city);
        teacher.province = String(data.province ?? teacher.province);
        teacher.qualification = String(data.qualification ?? teacher.qualification);
        teacher.specialization = String(data.specialization ?? teacher.specialization);
        teacher.joiningDate = String(data.joiningDate ?? teacher.joiningDate);
        teacher.designation = String(data.designation ?? teacher.designation);
        teacher.employmentStatus = (data.employmentStatus as 'Active' | 'Inactive' | 'On Leave' | 'Resigned') || teacher.employmentStatus;
        teacher.updatedAt = now;

        saveStore(store);
        return { success: true, teacher };
      },

      toggleStatus: async (_token: string, id: number, isActive: boolean) => {
        const store = loadStore();
        const teacher = store.teachers.find((t) => t.id === id);
        if (!teacher) return { success: false, error: 'Teacher not found.' };
        teacher.isActive = isActive;
        teacher.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, teacher };
      },

      choosePhoto: async () => {
        return { success: false, error: 'File dialog is only available in desktop app.' };
      },

      uploadPhoto: async ({ teacherId, base64Data }: { teacherId: number; base64Data: string; fileExtension: string }) => {
        const store = loadStore();
        const teacher = store.teachers.find((t) => t.id === teacherId);
        if (!teacher) return { success: false, error: 'Teacher not found.' };
        teacher.photoPath = `teacher_${teacherId}.png`;
        teacher.photoDataUrl = base64Data;
        teacher.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, photoPath: teacher.photoPath, dataUrl: base64Data };
      },

      removePhoto: async (_token: string, teacherId: number) => {
        const store = loadStore();
        const teacher = store.teachers.find((t) => t.id === teacherId);
        if (!teacher) return { success: false, error: 'Teacher not found.' };
        teacher.photoPath = null;
        teacher.photoDataUrl = null;
        teacher.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true };
      },
    },

    attendance: {
      getEnrolledStudents: async (params: {
        academicSessionId: number;
        classId: number;
        sectionId: number;
        attendanceDate: string;
      }) => {
        const store = loadStore();
        const enrollments = store.studentEnrollments.filter(
          (e) =>
            e.academicSessionId === params.academicSessionId &&
            e.classId === params.classId &&
            e.sectionId === params.sectionId &&
            e.status === 'Active'
        );

        const students: EnrolledStudentForAttendance[] = [];
        let hasAnyRecorded = false;

        for (const e of enrollments) {
          const student = store.students.find((s) => s.id === e.studentId && s.isActive);
          if (!student) continue;

          const existingAtt = store.attendance.find(
            (a) => a.studentId === student.id && a.attendanceDate === params.attendanceDate
          );
          if (existingAtt) hasAnyRecorded = true;

          students.push({
            studentId: student.id,
            enrollmentId: e.id,
            systemStudentId: student.studentId,
            admissionNumber: student.admissionNumber,
            displayName: student.displayName,
            gender: student.gender,
            rollNumber: e.rollNumber,
            attendanceId: existingAtt ? existingAtt.id : undefined,
            status: existingAtt ? existingAtt.status : undefined,
            remarks: existingAtt ? existingAtt.remarks : '',
          });
        }

        return {
          success: true,
          students,
          isRecorded: hasAnyRecorded,
        };
      },

      save: async (data: {
        sessionToken: string;
        academicSessionId: number;
        classId: number;
        sectionId: number;
        attendanceDate: string;
        records: Array<{ studentId: number; enrollmentId: number; status: string; remarks?: string }>;
      }) => {
        const store = loadStore();
        const now = new Date().toISOString();
        const validStatuses = ['Present', 'Absent', 'Late', 'Leave'];

        for (const rec of data.records) {
          if (!validStatuses.includes(rec.status)) {
            return { success: false, savedCount: 0, error: `Invalid status: ${rec.status}` };
          }

          const existingIdx = store.attendance.findIndex(
            (a) => a.studentId === rec.studentId && a.attendanceDate === data.attendanceDate
          );

          if (existingIdx >= 0) {
            store.attendance[existingIdx].status = rec.status as 'Present' | 'Absent' | 'Late' | 'Leave';
            store.attendance[existingIdx].remarks = (rec.remarks || '').trim();
            store.attendance[existingIdx].updatedAt = now;
          } else {
            const newId = store.attendance.length > 0 ? Math.max(...store.attendance.map((a) => a.id)) + 1 : 1;
            store.attendance.push({
              id: newId,
              studentId: rec.studentId,
              enrollmentId: rec.enrollmentId,
              academicSessionId: data.academicSessionId,
              classId: data.classId,
              sectionId: data.sectionId,
              attendanceDate: data.attendanceDate,
              status: rec.status as 'Present' | 'Absent' | 'Late' | 'Leave',
              remarks: (rec.remarks || '').trim(),
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        saveStore(store);
        return { success: true, savedCount: data.records.length };
      },

      getDailySummary: async (params: {
        academicSessionId: number;
        classId: number;
        sectionId: number;
        attendanceDate: string;
      }) => {
        const store = loadStore();
        const totalEligible = store.studentEnrollments.filter(
          (e) =>
            e.academicSessionId === params.academicSessionId &&
            e.classId === params.classId &&
            e.sectionId === params.sectionId &&
            e.status === 'Active'
        ).length;

        const dateRecords = store.attendance.filter(
          (a) =>
            a.academicSessionId === params.academicSessionId &&
            a.classId === params.classId &&
            a.sectionId === params.sectionId &&
            a.attendanceDate === params.attendanceDate
        );

        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let leaveCount = 0;

        for (const r of dateRecords) {
          if (r.status === 'Present') presentCount++;
          else if (r.status === 'Absent') absentCount++;
          else if (r.status === 'Late') lateCount++;
          else if (r.status === 'Leave') leaveCount++;
        }

        const recordedCount = presentCount + absentCount + lateCount + leaveCount;
        const isRecorded = recordedCount > 0;
        const attendancePercentage = isRecorded ? Math.round(((presentCount + lateCount) / recordedCount) * 10000) / 100 : null;

        const summary: DailyAttendanceSummary = {
          academicSessionId: params.academicSessionId,
          classId: params.classId,
          sectionId: params.sectionId,
          attendanceDate: params.attendanceDate,
          isRecorded,
          totalStudents: totalEligible,
          presentCount,
          absentCount,
          lateCount,
          leaveCount,
          attendancePercentage,
        };

        return { success: true, summary };
      },

      getHistory: async (params?: AttendanceHistoryParams) => {
        const store = loadStore();
        let list = [...store.attendance];

        if (params?.academicSessionId) list = list.filter((a) => a.academicSessionId === params.academicSessionId);
        if (params?.classId) list = list.filter((a) => a.classId === params.classId);
        if (params?.sectionId) list = list.filter((a) => a.sectionId === params.sectionId);
        if (params?.studentId) list = list.filter((a) => a.studentId === params.studentId);
        if (params?.dateFrom) list = list.filter((a) => a.attendanceDate >= params.dateFrom!);
        if (params?.dateTo) list = list.filter((a) => a.attendanceDate <= params.dateTo!);
        if (params?.status) list = list.filter((a) => a.status === params.status);

        const joined: AttendanceRecordItem[] = list.map((a) => {
          const student = store.students.find((s) => s.id === a.studentId);
          const session = store.sessions.find((s) => s.id === a.academicSessionId);
          const cls = store.classes.find((c) => c.id === a.classId);
          const sec = store.sections.find((s) => s.id === a.sectionId);

          return {
            id: a.id,
            studentId: a.studentId,
            enrollmentId: a.enrollmentId,
            systemStudentId: student?.studentId || '',
            admissionNumber: student?.admissionNumber || '',
            studentName: student?.displayName || '',
            academicSessionId: a.academicSessionId,
            academicSessionName: session?.name || '',
            classId: a.classId,
            className: cls?.name || '',
            sectionId: a.sectionId,
            sectionName: sec?.name || '',
            attendanceDate: a.attendanceDate,
            status: a.status,
            remarks: a.remarks,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          };
        });

        const totalCount = joined.length;
        const page = params?.page || 1;
        const limit = params?.limit || 25;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const offset = (page - 1) * limit;

        return {
          success: true,
          records: joined.slice(offset, offset + limit),
          totalCount,
          page,
          totalPages,
        };
      },

      getStudentHistory: async (params: {
        studentId: number;
        academicSessionId?: number;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
      }) => {
        const store = loadStore();
        let list = store.attendance.filter((a) => a.studentId === params.studentId);

        if (params.academicSessionId) list = list.filter((a) => a.academicSessionId === params.academicSessionId);
        if (params.dateFrom) list = list.filter((a) => a.attendanceDate >= params.dateFrom!);
        if (params.dateTo) list = list.filter((a) => a.attendanceDate <= params.dateTo!);

        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let leaveCount = 0;

        for (const a of list) {
          if (a.status === 'Present') presentCount++;
          else if (a.status === 'Absent') absentCount++;
          else if (a.status === 'Late') lateCount++;
          else if (a.status === 'Leave') leaveCount++;
        }

        const totalDaysRecorded = presentCount + absentCount + lateCount + leaveCount;
        const attendancePercentage = totalDaysRecorded > 0 ? Math.round(((presentCount + lateCount) / totalDaysRecorded) * 10000) / 100 : null;

        const student = store.students.find((s) => s.id === params.studentId);

        const history: AttendanceRecordItem[] = list.map((a) => {
          const session = store.sessions.find((s) => s.id === a.academicSessionId);
          const cls = store.classes.find((c) => c.id === a.classId);
          const sec = store.sections.find((s) => s.id === a.sectionId);

          return {
            id: a.id,
            studentId: a.studentId,
            enrollmentId: a.enrollmentId,
            systemStudentId: student?.studentId || '',
            admissionNumber: student?.admissionNumber || '',
            studentName: student?.displayName || '',
            academicSessionId: a.academicSessionId,
            academicSessionName: session?.name || '',
            classId: a.classId,
            className: cls?.name || '',
            sectionId: a.sectionId,
            sectionName: sec?.name || '',
            attendanceDate: a.attendanceDate,
            status: a.status,
            remarks: a.remarks,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          };
        });

        return {
          success: true,
          history,
          stats: {
            studentId: params.studentId,
            totalDaysRecorded,
            presentCount,
            absentCount,
            lateCount,
            leaveCount,
            attendancePercentage,
          },
        };
      },
    },

    // Fees API Mock
    fees: {
      getTypes: async () => {
        const store = loadStore();
        return { success: true, types: store.feeTypes };
      },
      createType: async (data: { sessionToken: string; name: string; code: string; description?: string }) => {
        const store = loadStore();
        const normName = data.name.trim();
        const normCode = data.code.trim().toUpperCase();
        if (store.feeTypes.some((t) => t.name.toLowerCase() === normName.toLowerCase())) {
          return { success: false, error: 'A fee type with this name already exists.' };
        }
        if (store.feeTypes.some((t) => t.code.toUpperCase() === normCode)) {
          return { success: false, error: 'A fee type with this code already exists.' };
        }
        const now = new Date().toISOString();
        const newType: FeeTypeItem = {
          id: store.feeTypes.length > 0 ? Math.max(...store.feeTypes.map((t) => t.id)) + 1 : 1,
          name: normName,
          code: normCode,
          description: data.description?.trim() || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        store.feeTypes.push(newType);
        saveStore(store);
        return { success: true, feeType: newType };
      },
      updateType: async (data: { sessionToken: string; id: number; name: string; code: string; description?: string; isActive?: boolean }) => {
        const store = loadStore();
        const typeIndex = store.feeTypes.findIndex((t) => t.id === data.id);
        if (typeIndex === -1) return { success: false, error: 'Fee type not found.' };
        const normName = data.name.trim();
        const normCode = data.code.trim().toUpperCase();
        if (store.feeTypes.some((t) => t.id !== data.id && t.name.toLowerCase() === normName.toLowerCase())) {
          return { success: false, error: 'A fee type with this name already exists.' };
        }
        if (store.feeTypes.some((t) => t.id !== data.id && t.code.toUpperCase() === normCode)) {
          return { success: false, error: 'A fee type with this code already exists.' };
        }
        const now = new Date().toISOString();
        store.feeTypes[typeIndex] = {
          ...store.feeTypes[typeIndex],
          name: normName,
          code: normCode,
          description: data.description?.trim() ?? store.feeTypes[typeIndex].description,
          isActive: data.isActive !== undefined ? data.isActive : store.feeTypes[typeIndex].isActive,
          updatedAt: now,
        };
        saveStore(store);
        return { success: true, feeType: store.feeTypes[typeIndex] };
      },
      toggleTypeStatus: async (_sessionToken: string, id: number, isActive: boolean) => {
        const store = loadStore();
        const t = store.feeTypes.find((item) => item.id === id);
        if (!t) return { success: false, error: 'Fee type not found.' };
        t.isActive = isActive;
        t.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, feeType: t };
      },
      getStructures: async (params?: { academicSessionId?: number; classId?: number; isActive?: boolean }) => {
        const store = loadStore();
        let list = [...store.feeStructures];
        if (params?.academicSessionId) list = list.filter((s) => s.academicSessionId === params.academicSessionId);
        if (params?.classId) list = list.filter((s) => s.classId === params.classId);
        if (params?.isActive !== undefined) list = list.filter((s) => s.isActive === params.isActive);
        return { success: true, structures: list };
      },
      createStructure: async (data: { sessionToken: string; academicSessionId: number; classId: number; feeTypeId: number; amount: number; frequency: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string }) => {
        const store = loadStore();
        const session = store.sessions.find((s) => s.id === data.academicSessionId);
        const cls = store.classes.find((c) => c.id === data.classId);
        const ftype = store.feeTypes.find((t) => t.id === data.feeTypeId);
        if (!session || !cls || !ftype) return { success: false, error: 'Invalid reference.' };
        const now = new Date().toISOString();
        const newStruct: FeeStructureItem = {
          id: store.feeStructures.length > 0 ? Math.max(...store.feeStructures.map((s) => s.id)) + 1 : 1,
          academicSessionId: data.academicSessionId,
          academicSessionName: session.name,
          classId: data.classId,
          className: cls.name,
          feeTypeId: data.feeTypeId,
          feeTypeName: ftype.name,
          amount: Math.round(data.amount),
          frequency: data.frequency,
          effectiveFrom: data.effectiveFrom || '',
          effectiveTo: data.effectiveTo || '',
          description: data.description?.trim() || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        store.feeStructures.push(newStruct);
        saveStore(store);
        return { success: true, structure: newStruct };
      },
      updateStructure: async (data: { sessionToken: string; id: number; amount: number; frequency: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string; isActive?: boolean }) => {
        const store = loadStore();
        const s = store.feeStructures.find((item) => item.id === data.id);
        if (!s) return { success: false, error: 'Fee structure not found.' };
        s.amount = Math.round(data.amount);
        s.frequency = data.frequency;
        if (data.effectiveFrom !== undefined) s.effectiveFrom = data.effectiveFrom;
        if (data.effectiveTo !== undefined) s.effectiveTo = data.effectiveTo;
        if (data.description !== undefined) s.description = data.description.trim();
        if (data.isActive !== undefined) s.isActive = data.isActive;
        s.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, structure: s };
      },
      toggleStructureStatus: async (_sessionToken: string, id: number, isActive: boolean) => {
        const store = loadStore();
        const s = store.feeStructures.find((item) => item.id === id);
        if (!s) return { success: false, error: 'Fee structure not found.' };
        s.isActive = isActive;
        s.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, structure: s };
      },
      getPeriods: async (academicSessionId?: number) => {
        const store = loadStore();
        let list = [...store.feePeriods];
        if (academicSessionId) list = list.filter((p) => p.academicSessionId === academicSessionId);
        return { success: true, periods: list };
      },
      createPeriod: async (data: { sessionToken: string; academicSessionId: number; name: string; startDate: string; endDate: string; dueDate: string }) => {
        const store = loadStore();
        const session = store.sessions.find((s) => s.id === data.academicSessionId);
        if (!session) return { success: false, error: 'Academic session not found.' };
        const now = new Date().toISOString();
        const newPeriod: FeePeriodItem = {
          id: store.feePeriods.length > 0 ? Math.max(...store.feePeriods.map((p) => p.id)) + 1 : 1,
          academicSessionId: data.academicSessionId,
          academicSessionName: session.name,
          name: data.name.trim(),
          startDate: data.startDate,
          endDate: data.endDate,
          dueDate: data.dueDate,
          status: 'Open',
          createdAt: now,
          updatedAt: now,
        };
        store.feePeriods.push(newPeriod);
        saveStore(store);
        return { success: true, period: newPeriod };
      },
      updatePeriod: async (data: { sessionToken: string; id: number; name: string; startDate: string; endDate: string; dueDate: string; status?: 'Open' | 'Closed' }) => {
        const store = loadStore();
        const p = store.feePeriods.find((item) => item.id === data.id);
        if (!p) return { success: false, error: 'Fee period not found.' };
        p.name = data.name.trim();
        p.startDate = data.startDate;
        p.endDate = data.endDate;
        p.dueDate = data.dueDate;
        if (data.status) p.status = data.status;
        p.updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, period: p };
      },
      getStudentAdjustments: async (studentId: number) => {
        const store = loadStore();
        const list = store.studentAdjustments.filter((a) => a.studentId === studentId);
        return { success: true, adjustments: list };
      },
      createStudentAdjustment: async (data: { sessionToken: string; studentId: number; enrollmentId: number; feeTypeId: number; amount: number; frequency?: FeeFrequency; effectiveFrom?: string; effectiveTo?: string; description?: string }) => {
        const store = loadStore();
        const ftype = store.feeTypes.find((t) => t.id === data.feeTypeId);
        const student = store.students.find((st) => st.id === data.studentId);
        if (!ftype || !student) return { success: false, error: 'Student or fee type not found.' };
        const now = new Date().toISOString();
        const adj: StudentFeeAdjustmentItem = {
          id: store.studentAdjustments.length > 0 ? Math.max(...store.studentAdjustments.map((a) => a.id)) + 1 : 1,
          studentId: data.studentId,
          enrollmentId: data.enrollmentId,
          feeTypeId: data.feeTypeId,
          feeTypeName: ftype.name,
          amount: Math.round(data.amount),
          frequency: data.frequency || 'Monthly',
          effectiveFrom: data.effectiveFrom || '',
          effectiveTo: data.effectiveTo || '',
          description: data.description?.trim() || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        store.studentAdjustments.push(adj);
        saveStore(store);
        return { success: true, adjustment: adj };
      },
      toggleStudentAdjustmentStatus: async (_sessionToken: string, id: number, isActive: boolean) => {
        const store = loadStore();
        const adj = store.studentAdjustments.find((a) => a.id === id);
        if (!adj) return { success: false, error: 'Adjustment not found.' };
        adj.isActive = isActive;
        saveStore(store);
        return { success: true, adjustment: adj };
      },
      generateFees: async (data: { sessionToken: string; academicSessionId: number; classId: number; sectionId?: number; feePeriodId: number; dueDate?: string }) => {
        const store = loadStore();
        const period = store.feePeriods.find((p) => p.id === data.feePeriodId);
        if (!period) {
          return {
            success: false,
            error: 'Fee period not found.',
            summary: { totalEligible: 0, createdCount: 0, alreadyExistedCount: 0, failedCount: 0 },
          };
        }
        const dueDate = data.dueDate || period.dueDate;

        // Find enrolled active students
        let eligibleEnrollments = store.studentEnrollments.filter(
          (e) => e.academicSessionId === data.academicSessionId && e.classId === data.classId && e.status === 'Active'
        );
        if (data.sectionId) {
          eligibleEnrollments = eligibleEnrollments.filter((e) => e.sectionId === data.sectionId);
        }

        const classStructures = store.feeStructures.filter(
          (s) => s.academicSessionId === data.academicSessionId && s.classId === data.classId && s.isActive
        );

        let createdCount = 0;
        let alreadyExistedCount = 0;
        const now = new Date().toISOString();

        for (const enroll of eligibleEnrollments) {
          const student = store.students.find((st) => st.id === enroll.studentId);
          if (!student) continue;

          for (const struct of classStructures) {
            const exists = store.feeRecords.some(
              (r) => r.studentId === enroll.studentId && r.feePeriodId === data.feePeriodId && r.feeTypeId === struct.feeTypeId
            );
            if (exists) {
              alreadyExistedCount++;
              continue;
            }

            const recId = store.feeRecords.length > 0 ? Math.max(...store.feeRecords.map((r) => r.id)) + 1 : 1;
            const originalAmount = struct.amount;
            const netAmount = originalAmount;
            const feeRec: FeeRecordItem = {
              id: recId,
              studentId: enroll.studentId,
              enrollmentId: enroll.id,
              systemStudentId: student.studentId,
              admissionNumber: student.admissionNumber,
              studentName: student.displayName,
              academicSessionId: enroll.academicSessionId,
              academicSessionName: enroll.academicSessionName || '',
              classId: enroll.classId,
              className: enroll.className || '',
              sectionId: enroll.sectionId,
              sectionName: enroll.sectionName || '',
              feePeriodId: period.id,
              feePeriodName: period.name,
              feeTypeId: struct.feeTypeId,
              feeTypeName: struct.feeTypeName || '',
              originalAmount,
              discount: 0,
              fine: 0,
              netAmount,
              paidAmount: 0,
              remainingBalance: netAmount,
              dueDate,
              status: 'Unpaid',
              remarks: 'Class-generated fee',
              createdAt: now,
              updatedAt: now,
            };
            store.feeRecords.push(feeRec);
            createdCount++;
          }
        }

        saveStore(store);
        return {
          success: true,
          summary: {
            totalEligible: eligibleEnrollments.length,
            createdCount,
            alreadyExistedCount,
            failedCount: 0,
          },
        };
      },
      getRecords: async (params?: { academicSessionId?: number; classId?: number; sectionId?: number; feePeriodId?: number; studentId?: number; status?: string; searchQuery?: string; page?: number; limit?: number }) => {
        const store = loadStore();
        let list = [...store.feeRecords];
        if (params?.academicSessionId) list = list.filter((r) => r.academicSessionId === params.academicSessionId);
        if (params?.classId) list = list.filter((r) => r.classId === params.classId);
        if (params?.sectionId) list = list.filter((r) => r.sectionId === params.sectionId);
        if (params?.feePeriodId) list = list.filter((r) => r.feePeriodId === params.feePeriodId);
        if (params?.studentId) list = list.filter((r) => r.studentId === params.studentId);
        if (params?.status && params.status !== 'All') list = list.filter((r) => r.status === params.status);
        if (params?.searchQuery) {
          const q = params.searchQuery.toLowerCase();
          list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.admissionNumber.toLowerCase().includes(q));
        }
        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const totalCount = list.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const paged = list.slice((page - 1) * limit, page * limit);
        return { success: true, records: paged, totalCount, page, totalPages };
      },
      getRecordById: async (id: number) => {
        const store = loadStore();
        const r = store.feeRecords.find((rec) => rec.id === id);
        if (!r) return { success: false, error: 'Fee record not found.' };
        return { success: true, record: r };
      },
      getDues: async (params?: { academicSessionId?: number; classId?: number; sectionId?: number; feePeriodId?: number; dueStatus?: string; searchQuery?: string; page?: number; limit?: number }) => {
        const store = loadStore();
        const today = new Date().toISOString().split('T')[0];
        let list = store.feeRecords.filter((r) => r.remainingBalance > 0 && r.status !== 'Cancelled' && r.status !== 'Waived');

        if (params?.academicSessionId) list = list.filter((r) => r.academicSessionId === params.academicSessionId);
        if (params?.classId) list = list.filter((r) => r.classId === params.classId);
        if (params?.sectionId) list = list.filter((r) => r.sectionId === params.sectionId);
        if (params?.feePeriodId) list = list.filter((r) => r.feePeriodId === params.feePeriodId);

        if (params?.dueStatus === 'Overdue') {
          list = list.filter((r) => r.dueDate < today);
        } else if (params?.dueStatus === 'Unpaid') {
          list = list.filter((r) => r.status === 'Unpaid');
        } else if (params?.dueStatus === 'Partially Paid') {
          list = list.filter((r) => r.status === 'Partially Paid');
        }

        if (params?.searchQuery) {
          const q = params.searchQuery.toLowerCase();
          list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.admissionNumber.toLowerCase().includes(q));
        }

        const totalOutstandingAmount = list.reduce((sum, r) => sum + r.remainingBalance, 0);
        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const totalCount = list.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const paged = list.slice((page - 1) * limit, page * limit);

        return { success: true, records: paged, totalOutstandingAmount, totalCount, page, totalPages };
      },
      recordPayment: async (data: { sessionToken: string; feeRecordId: number; amount: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNotes?: string }) => {
        const store = loadStore();
        const record = store.feeRecords.find((r) => r.id === data.feeRecordId);
        if (!record) return { success: false, error: 'Fee record not found.' };

        const paymentAmount = Math.round(data.amount);
        if (paymentAmount <= 0) return { success: false, error: 'Payment amount must be greater than zero.' };
        if (paymentAmount > record.remainingBalance) {
          return { success: false, error: 'Payment amount cannot be greater than the remaining balance.' };
        }

        const now = new Date().toISOString();
        const year = data.paymentDate ? data.paymentDate.substring(0, 4) : new Date().getFullYear().toString();
        const seq = (store.feePayments.length + 1).toString().padStart(6, '0');
        const receiptNumber = `REC-${year}-${seq}`;

        const newPaymentId = store.feePayments.length > 0 ? Math.max(...store.feePayments.map((p) => p.id)) + 1 : 1;
        const newPaidAmount = record.paidAmount + paymentAmount;
        const newRemaining = record.netAmount - newPaidAmount;

        record.paidAmount = newPaidAmount;
        record.remainingBalance = newRemaining;
        record.status = newRemaining === 0 ? 'Paid' : 'Partially Paid';
        record.updatedAt = now;

        const payment: FeePaymentItem = {
          id: newPaymentId,
          receiptNumber,
          studentId: record.studentId,
          enrollmentId: record.enrollmentId,
          feeRecordId: record.id,
          paymentDate: data.paymentDate || now.split('T')[0],
          amount: paymentAmount,
          paymentMethod: data.paymentMethod,
          referenceNotes: data.referenceNotes?.trim() || '',
          receivedByUserId: 1,
          receivedByUsername: 'admin',
          createdAt: now,
          systemStudentId: record.systemStudentId,
          admissionNumber: record.admissionNumber,
          studentName: record.studentName,
          className: record.className,
          sectionName: record.sectionName,
          academicSessionName: record.academicSessionName,
          feeTypeName: record.feeTypeName,
          feePeriodName: record.feePeriodName,
          originalAmount: record.originalAmount,
          discount: record.discount,
          fine: record.fine,
          netAmount: record.netAmount,
          remainingBalanceAfterPayment: newRemaining,
        };

        store.feePayments.push(payment);
        saveStore(store);

        return {
          success: true,
          payment,
          receiptNumber,
          remainingBalance: newRemaining,
        };
      },
      getPaymentById: async (id: number) => {
        const store = loadStore();
        const p = store.feePayments.find((item) => item.id === id);
        if (!p) return { success: false, error: 'Payment not found.' };
        return { success: true, payment: p };
      },
      getReceiptByNumber: async (receiptNumber: string) => {
        const store = loadStore();
        const p = store.feePayments.find((item) => item.receiptNumber.toUpperCase() === receiptNumber.trim().toUpperCase());
        if (!p) return { success: false, error: 'Receipt not found.' };
        return { success: true, receipt: p };
      },
      searchPayments: async (params?: { searchQuery?: string; academicSessionId?: number; classId?: number; sectionId?: number; paymentMethod?: PaymentMethod; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => {
        const store = loadStore();
        let list = [...store.feePayments];

        if (params?.paymentMethod) list = list.filter((p) => p.paymentMethod === params.paymentMethod);
        if (params?.dateFrom) list = list.filter((p) => p.paymentDate >= params.dateFrom!);
        if (params?.dateTo) list = list.filter((p) => p.paymentDate <= params.dateTo!);
        if (params?.searchQuery) {
          const q = params.searchQuery.toLowerCase();
          list = list.filter(
            (p) =>
              p.receiptNumber.toLowerCase().includes(q) ||
              (p.studentName && p.studentName.toLowerCase().includes(q)) ||
              (p.admissionNumber && p.admissionNumber.toLowerCase().includes(q))
          );
        }

        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const totalCount = list.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const paged = list.slice((page - 1) * limit, page * limit);

        return { success: true, payments: paged, totalCount, page, totalPages };
      },
      getStudentFeeSummary: async (studentId: number) => {
        const store = loadStore();
        const records = store.feeRecords.filter((r) => r.studentId === studentId);
        const payments = store.feePayments.filter((p) => p.studentId === studentId);

        let totalBilled = 0;
        let totalDiscount = 0;
        let totalFine = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;

        for (const r of records) {
          totalBilled += r.originalAmount;
          totalDiscount += r.discount;
          totalFine += r.fine;
          totalPaid += r.paidAmount;
          totalOutstanding += r.remainingBalance;
        }

        return {
          success: true,
          summary: {
            studentId,
            totalBilled,
            totalDiscount,
            totalFine,
            totalPaid,
            totalOutstanding,
          },
          records,
          payments,
        };
      },
    },

    // Examinations, Marks, Results & DMC Mock API
    exams: {
      getTypes: async () => {
        const store = loadStore();
        return { success: true, types: store.examTypes };
      },
      createType: async (data) => {
        const store = loadStore();
        const id = store.examTypes.length > 0 ? Math.max(...store.examTypes.map((t) => t.id)) + 1 : 1;
        const now = new Date().toISOString();
        const newType: ExamTypeItem = {
          id,
          name: data.name,
          code: data.code,
          description: data.description || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        store.examTypes.push(newType);
        saveStore(store);
        return { success: true, examType: newType };
      },
      updateType: async (data) => {
        const store = loadStore();
        const idx = store.examTypes.findIndex((t) => t.id === data.id);
        if (idx === -1) return { success: false, error: 'Exam type not found.' };
        store.examTypes[idx] = {
          ...store.examTypes[idx],
          name: data.name,
          code: data.code,
          description: data.description ?? store.examTypes[idx].description,
          isActive: data.isActive !== undefined ? data.isActive : store.examTypes[idx].isActive,
          updatedAt: new Date().toISOString(),
        };
        saveStore(store);
        return { success: true, examType: store.examTypes[idx] };
      },
      toggleTypeStatus: async (_token, id, isActive) => {
        const store = loadStore();
        const idx = store.examTypes.findIndex((t) => t.id === id);
        if (idx === -1) return { success: false, error: 'Exam type not found.' };
        store.examTypes[idx].isActive = isActive;
        store.examTypes[idx].updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, examType: store.examTypes[idx] };
      },

      getAll: async (params) => {
        const store = loadStore();
        let list = store.examinations.map((e) => {
          const subs = (store.examSubjects || []).filter((es: ExaminationSubjectItem) => es.examinationId === e.id);
          const classIds = Array.from(new Set(subs.map((s: ExaminationSubjectItem) => s.classId)));
          const classNames = classIds.map((cid: number) => store.classes.find((c) => c.id === cid)?.name).filter(Boolean) as string[];
          return {
            ...e,
            participatingClasses: classNames.length > 0 ? classNames : e.participatingClasses || [],
            participatingClassNames: classNames.join(', '),
          };
        });
        if (params?.academicSessionId) list = list.filter((e) => e.academicSessionId === params.academicSessionId);
        if (params?.examTypeId) list = list.filter((e) => e.examTypeId === params.examTypeId);
        if (params?.status) list = list.filter((e) => e.status === params.status);
        return { success: true, examinations: list };
      },
      getById: async (id) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === id);
        return { success: true, examination: exam };
      },
      create: async (data) => {
        const store = loadStore();
        const id = store.examinations.length > 0 ? Math.max(...store.examinations.map((e) => e.id)) + 1 : 1;
        const now = new Date().toISOString();
        const sess = store.sessions.find((s) => s.id === data.academicSessionId);
        const type = store.examTypes.find((t) => t.id === data.examTypeId);
        const newExam: ExaminationItem = {
          id,
          academicSessionId: data.academicSessionId,
          academicSessionName: sess?.name,
          examTypeId: data.examTypeId,
          examTypeName: type?.name,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          status: 'Draft',
          description: data.description || '',
          subjectCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        store.examinations.push(newExam);
        saveStore(store);
        return { success: true, examination: newExam };
      },
      update: async (data) => {
        const store = loadStore();
        const idx = store.examinations.findIndex((e) => e.id === data.id);
        if (idx === -1) return { success: false, error: 'Examination not found.' };
        const sess = store.sessions.find((s) => s.id === data.academicSessionId);
        const type = store.examTypes.find((t) => t.id === data.examTypeId);
        store.examinations[idx] = {
          ...store.examinations[idx],
          academicSessionId: data.academicSessionId,
          academicSessionName: sess?.name,
          examTypeId: data.examTypeId,
          examTypeName: type?.name,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description ?? store.examinations[idx].description,
          updatedAt: new Date().toISOString(),
        };
        saveStore(store);
        return { success: true, examination: store.examinations[idx] };
      },
      updateStatus: async (_token, id, status) => {
        const store = loadStore();
        const idx = store.examinations.findIndex((e) => e.id === id);
        if (idx === -1) return { success: false, error: 'Examination not found.' };
        store.examinations[idx].status = status as ExamStatus;
        store.examinations[idx].updatedAt = new Date().toISOString();
        saveStore(store);
        return { success: true, examination: store.examinations[idx] };
      },
      delete: async (_token, id) => {
        const store = loadStore();
        const idx = store.examinations.findIndex((e) => e.id === id);
        if (idx === -1) return { success: false, error: 'Examination not found.' };
        store.examinations.splice(idx, 1);
        store.examSubjects = store.examSubjects.filter((es) => es.examinationId !== id);
        store.examMarks = store.examMarks.filter((m) => m.examinationId !== id);
        saveStore(store);
        return { success: true };
      },

      getSubjects: async (params) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === params.examinationId);
        let storeModified = false;

        // Auto-sync assigned class subjects into examSubjects if exam is active
        if (exam && exam.status !== 'Closed') {
          const classesToSync: number[] = [];
          if (params.classId) {
            classesToSync.push(params.classId);
          } else {
            const existingClasses = new Set(
              store.examSubjects.filter((es) => es.examinationId === params.examinationId).map((es) => es.classId)
            );
            for (const cid of existingClasses) {
              classesToSync.push(cid);
            }
          }

          const now = new Date().toISOString();
          for (const cid of classesToSync) {
            const assigned = store.classSubjects.filter((cs) => cs.classId === cid && cs.isActive !== false);
            const cls = store.classes.find((c) => c.id === cid);

            for (const a of assigned) {
              const exists = store.examSubjects.some(
                (es) => es.examinationId === params.examinationId && es.classId === cid && es.subjectId === a.subjectId
              );
              if (!exists) {
                const sub = store.subjects.find((s) => s.id === a.subjectId);
                const nextId = store.examSubjects.length > 0 ? Math.max(...store.examSubjects.map((x) => x.id)) + 1 : 1;
                store.examSubjects.push({
                  id: nextId,
                  examinationId: params.examinationId,
                  classId: cid,
                  className: cls?.name,
                  subjectId: a.subjectId,
                  subjectName: a.subjectName || sub?.name || 'Subject',
                  subjectCode: a.subjectCode || sub?.code || '',
                  maxMarks: 100,
                  passingMarks: 40,
                  displayOrder: a.displayOrder || store.examSubjects.length + 1,
                  examDate: null,
                  startTime: null,
                  durationMinutes: null,
                  isActive: true,
                  marksEnteredCount: 0,
                  totalStudentsCount: 0,
                  createdAt: now,
                  updatedAt: now,
                });
                storeModified = true;
              }
            }
          }

          if (storeModified) {
            saveStore(store);
          }
        }

        let list = store.examSubjects.filter((es) => es.examinationId === params.examinationId);
        if (params.classId) list = list.filter((es) => es.classId === params.classId);
        list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || (a.subjectName || '').localeCompare(b.subjectName || ''));
        return { success: true, subjects: list };
      },
      configureSubjects: async (data) => {
        const store = loadStore();
        const now = new Date().toISOString();
        // Remove existing subjects for this exam & class that are not in data.subjects
        const reqSubIds = new Set(data.subjects.map((s) => s.subjectId));
        store.examSubjects = store.examSubjects.filter(
          (es) => !(es.examinationId === data.examinationId && es.classId === data.classId && !reqSubIds.has(es.subjectId))
        );

        const cls = store.classes.find((c) => c.id === data.classId);
        for (let i = 0; i < data.subjects.length; i++) {
          const s = data.subjects[i];
          const sub = store.subjects.find((sub) => sub.id === s.subjectId);
          const existingIdx = store.examSubjects.findIndex(
            (es) => es.examinationId === data.examinationId && es.classId === data.classId && es.subjectId === s.subjectId
          );

          if (existingIdx >= 0) {
            store.examSubjects[existingIdx] = {
              ...store.examSubjects[existingIdx],
              maxMarks: s.maxMarks,
              passingMarks: s.passingMarks,
              displayOrder: s.displayOrder ?? i + 1,
              examDate: s.examDate || null,
              startTime: s.startTime || null,
              durationMinutes: s.durationMinutes || null,
              updatedAt: now,
            };
          } else {
            const nextId = store.examSubjects.length > 0 ? Math.max(...store.examSubjects.map((x) => x.id)) + 1 : 1;
            store.examSubjects.push({
              id: nextId,
              examinationId: data.examinationId,
              classId: data.classId,
              className: cls?.name,
              subjectId: s.subjectId,
              subjectName: sub?.name,
              subjectCode: sub?.code,
              maxMarks: s.maxMarks,
              passingMarks: s.passingMarks,
              displayOrder: s.displayOrder ?? i + 1,
              examDate: s.examDate || null,
              startTime: s.startTime || null,
              durationMinutes: s.durationMinutes || null,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
        saveStore(store);
        const configured = store.examSubjects.filter((es) => es.examinationId === data.examinationId && es.classId === data.classId);
        return { success: true, subjects: configured };
      },

      updateSubjectMarks: async (data) => {
        const store = loadStore();
        const target = store.examSubjects.find((es) => es.id === data.examinationSubjectId);
        if (!target) return { success: false, error: 'Examination subject not found.' };

        const exam = store.examinations.find((e) => e.id === target.examinationId);
        if (exam && exam.status === 'Closed') {
          return { success: false, error: 'Cannot modify subject configuration for a Closed examination.' };
        }

        const maxMarks = Number(data.maxMarks);
        const passingMarks = Number(data.passingMarks);

        if (isNaN(maxMarks) || maxMarks <= 0) {
          return { success: false, error: 'Maximum marks must be greater than zero.' };
        }
        if (isNaN(passingMarks) || passingMarks < 0 || passingMarks > maxMarks) {
          return { success: false, error: 'Passing marks must be between 0 and maximum marks.' };
        }

        target.maxMarks = maxMarks;
        target.passingMarks = passingMarks;
        target.updatedAt = new Date().toISOString();
        saveStore(store);

        return { success: true, examinationSubject: target };
      },

      getGradingRules: async () => {
        const store = loadStore();
        return { success: true, rules: store.gradingRules };
      },
      saveGradingRule: async (data) => {
        const store = loadStore();
        if (data.id) {
          const idx = store.gradingRules.findIndex((r) => r.id === data.id);
          if (idx >= 0) {
            store.gradingRules[idx] = {
              ...store.gradingRules[idx],
              name: data.name,
              minPercentage: data.minPercentage,
              maxPercentage: data.maxPercentage,
              grade: data.grade,
              gradePoint: data.gradePoint || 0,
              remarks: data.remarks || '',
              displayOrder: data.displayOrder || 0,
            };
            saveStore(store);
            return { success: true, rule: store.gradingRules[idx] };
          }
        }
        const nextId = store.gradingRules.length > 0 ? Math.max(...store.gradingRules.map((r) => r.id)) + 1 : 1;
        const newRule: GradingRuleItem = {
          id: nextId,
          name: data.name,
          minPercentage: data.minPercentage,
          maxPercentage: data.maxPercentage,
          grade: data.grade,
          gradePoint: data.gradePoint || 0,
          remarks: data.remarks || '',
          displayOrder: data.displayOrder || 0,
        };
        store.gradingRules.push(newRule);
        saveStore(store);
        return { success: true, rule: newRule };
      },
      deleteGradingRule: async (_token, id) => {
        const store = loadStore();
        store.gradingRules = store.gradingRules.filter((r) => r.id !== id);
        saveStore(store);
        return { success: true };
      },

      getStudentsForMarksEntry: async (params) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === params.examinationId);
        const examSub = store.examSubjects.find((es) => es.id === params.examinationSubjectId);

        let enrolled = store.students.filter((s) => s.currentEnrollment?.classId === params.classId);
        if (params.sectionId) {
          enrolled = enrolled.filter((s) => s.currentEnrollment?.sectionId === params.sectionId);
        }

        const students: StudentMarksEntryItem[] = enrolled.map((s) => {
          const mark = store.examMarks.find(
            (m) => m.examinationId === params.examinationId && m.examinationSubjectId === params.examinationSubjectId && m.studentId === s.id
          );
          return {
            studentId: s.id,
            enrollmentId: s.currentEnrollment?.id || 1,
            systemStudentId: s.studentId,
            admissionNumber: s.admissionNumber,
            displayName: s.displayName,
            gender: s.gender,
            fatherName: s.fatherName || '',
            rollNumber: s.currentEnrollment?.rollNumber || '',
            obtainedMarks: mark?.obtainedMarks !== undefined ? mark.obtainedMarks : null,
            status: mark?.status || 'Entered',
            remarks: mark?.remarks || '',
            markId: mark?.id,
          };
        });

        return {
          success: true,
          students,
          examinationSubject: examSub,
          examinationStatus: exam?.status,
        };
      },

      saveMarks: async (data) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === data.examinationId);
        if (exam && exam.status === 'Closed') {
          return { success: false, savedCount: 0, error: 'Cannot enter or modify marks for a Closed examination.' };
        }

        const examSub = store.examSubjects.find((es) => es.id === data.examinationSubjectId);
        const maxMarks = examSub?.maxMarks || 100;

        for (const m of data.marks) {
          if (m.status === 'Entered') {
            if (m.obtainedMarks === null || m.obtainedMarks === undefined || isNaN(m.obtainedMarks)) {
              return { success: false, savedCount: 0, error: `Valid marks are required for student ID ${m.studentId} when status is Entered.` };
            }
            if (m.obtainedMarks < 0 || m.obtainedMarks > maxMarks) {
              return {
                success: false,
                savedCount: 0,
                error: `Obtained marks (${m.obtainedMarks}) must be between 0 and maximum marks (${maxMarks}).`,
              };
            }
          }
        }

        const now = new Date().toISOString();
        for (const m of data.marks) {
          const idx = store.examMarks.findIndex(
            (x) => x.examinationId === data.examinationId && x.examinationSubjectId === data.examinationSubjectId && x.studentId === m.studentId
          );
          if (idx >= 0) {
            store.examMarks[idx] = {
              ...store.examMarks[idx],
              obtainedMarks: m.status === 'Absent' ? null : m.obtainedMarks,
              status: m.status,
              remarks: m.remarks || '',
              updatedAt: now,
            };
          } else {
            const nextId = store.examMarks.length > 0 ? Math.max(...store.examMarks.map((x) => x.id)) + 1 : 1;
            store.examMarks.push({
              id: nextId,
              examinationId: data.examinationId,
              examinationSubjectId: data.examinationSubjectId,
              studentId: m.studentId,
              enrollmentId: m.enrollmentId,
              obtainedMarks: m.status === 'Absent' ? null : m.obtainedMarks,
              status: m.status,
              remarks: m.remarks || '',
              createdAt: now,
              updatedAt: now,
            });
          }
        }
        saveStore(store);
        return { success: true, savedCount: data.marks.length };
      },

      calculateStudentResult: async (examinationId, studentId) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === studentId);
        if (!student) return { success: false, error: 'Student not found.' };

        const classId = student.currentEnrollment?.classId || 2;
        const examSubs = store.examSubjects.filter((es) => es.examinationId === examinationId && es.classId === classId);

        let totalMax = 0;
        let totalObtained = 0;
        let hasFailed = false;

        const subjects = examSubs.map((es) => {
          const m = store.examMarks.find((x) => x.examinationSubjectId === es.id && x.studentId === studentId);
          const status = m?.status || 'Entered';
          const obtained = status === 'Absent' ? null : (m?.obtainedMarks ?? null);
          const marksNum = status === 'Absent' ? 0 : (obtained ?? 0);
          totalMax += es.maxMarks;
          totalObtained += marksNum;

          const isPass = status !== 'Absent' && obtained !== null && obtained >= es.passingMarks;
          if (!isPass) hasFailed = true;

          return {
            examinationSubjectId: es.id,
            subjectId: es.subjectId,
            subjectName: es.subjectName || '',
            subjectCode: es.subjectCode || '',
            maxMarks: es.maxMarks,
            passingMarks: es.passingMarks,
            obtainedMarks: obtained,
            status,
            isPass,
            remarks: m?.remarks || '',
          };
        });

        const pct = totalMax > 0 ? Math.round(((totalObtained / totalMax) * 100) * 100) / 100 : 0;
        let grade = 'F';
        let gp = 0;
        let rem = 'Fail';
        for (const r of store.gradingRules) {
          if (pct >= r.minPercentage && pct <= r.maxPercentage) {
            grade = r.grade;
            gp = r.gradePoint;
            rem = r.remarks;
            break;
          }
        }

        const isPassed = !hasFailed;
        return {
          success: true,
          result: {
            studentId,
            systemStudentId: student.studentId,
            admissionNumber: student.admissionNumber,
            displayName: student.displayName,
            gender: student.gender,
            fatherName: student.fatherName,
            className: student.currentEnrollment?.className || 'Grade 9',
            sectionName: student.currentEnrollment?.sectionName || 'Section A',
            totalMaxMarks: totalMax,
            totalObtainedMarks: totalObtained,
            percentage: pct,
            grade: isPassed ? grade : 'F',
            gradePoint: isPassed ? gp : 0,
            isPassed,
            overallRemarks: isPassed ? rem : 'Failed',
            subjects,
          },
        };
      },

      getClassResults: async (params) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === params.examinationId);
        const cls = store.classes.find((c) => c.id === params.classId);
        let students = store.students.filter((s) => s.currentEnrollment?.classId === params.classId);
        if (params.sectionId) {
          students = students.filter((s) => s.currentEnrollment?.sectionId === params.sectionId);
        }

        const studentResults: StudentExamResult[] = [];
        for (const s of students) {
          const res = await mockAPI.exams.calculateStudentResult(params.examinationId, s.id);
          if (res.success && res.result) studentResults.push(res.result);
        }

        studentResults.sort((a, b) => {
          if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
          }
          return b.totalObtainedMarks - a.totalObtainedMarks;
        });

        let currentRank = 1;
        for (let i = 0; i < studentResults.length; i++) {
          if (i > 0) {
            const prev = studentResults[i - 1];
            const curr = studentResults[i];
            if (curr.percentage === prev.percentage && curr.totalObtainedMarks === prev.totalObtainedMarks) {
              curr.position = prev.position;
            } else {
              curr.position = currentRank;
            }
          } else {
            studentResults[0].position = 1;
          }
          currentRank++;
          studentResults[i].totalStudentsInClass = studentResults.length;
        }

        const totalStudents = studentResults.length;
        const passedStudents = studentResults.filter((r) => r.isPassed).length;
        const failedStudents = totalStudents - passedStudents;
        const passPercentage = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 10000) / 100 : 0;
        const highestPercentage = totalStudents > 0 ? studentResults[0].percentage : 0;
        const avg = totalStudents > 0 ? Math.round((studentResults.reduce((a, b) => a + b.percentage, 0) / totalStudents) * 100) / 100 : 0;

        const examSubs = store.examSubjects.filter((es) => es.examinationId === params.examinationId && es.classId === params.classId);
        const subjects = examSubs.map((es) => {
          const matching = studentResults.map((sr) => sr.subjects.find((x) => x.examinationSubjectId === es.id)).filter(Boolean);
          const pCount = matching.filter((m) => m?.isPass).length;
          const fCount = matching.length - pCount;
          const avgMarks = matching.length > 0 ? Math.round((matching.reduce((acc, curr) => acc + (curr?.obtainedMarks || 0), 0) / matching.length) * 100) / 100 : 0;
          return {
            id: es.id,
            subjectName: es.subjectName || '',
            maxMarks: es.maxMarks,
            passingMarks: es.passingMarks,
            averageMarks: avgMarks,
            passCount: pCount,
            failCount: fCount,
          };
        });

        return {
          success: true,
          results: {
            examinationId: params.examinationId,
            examinationName: exam?.name || '',
            academicSessionName: exam?.academicSessionName || '',
            classId: params.classId,
            className: cls?.name || '',
            sectionId: params.sectionId,
            totalStudents,
            passedStudents,
            failedStudents,
            passPercentage,
            highestPercentage,
            averagePercentage: avg,
            subjects,
            studentResults,
          },
        };
      },

      generateStudentDMC: async (examinationId, studentId) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === examinationId);
        const student = store.students.find((s) => s.id === studentId);
        if (!student || !exam) return { success: false, error: 'Student or Exam not found.' };

        const classRes = await mockAPI.exams.getClassResults({ examinationId, classId: student.currentEnrollment?.classId || 2 });
        const studentRes = await mockAPI.exams.calculateStudentResult(examinationId, studentId);
        if (!studentRes.success || !studentRes.result) return { success: false, error: 'Could not calculate result.' };

        const res = studentRes.result;
        const dmc: StudentDMCData = {
          school: {
            ...store.settings,
            logoPath: store.logoDataUrl || store.settings.logoPath,
            logoDataUrl: store.logoDataUrl || undefined,
          },
          examination: {
            id: exam.id,
            name: exam.name,
            examTypeName: exam.examTypeName || '',
            academicSessionName: exam.academicSessionName || '',
            startDate: exam.startDate,
            endDate: exam.endDate,
          },
          student: {
            id: student.id,
            systemStudentId: student.studentId, // Labeled "Student ID"
            admissionNumber: student.admissionNumber,
            displayName: student.displayName,
            fatherName: student.fatherName,
            className: res.className,
            sectionName: res.sectionName,
            rollNumber: res.rollNumber,
            dateOfBirth: student.dateOfBirth,
            photoDataUrl: student.photoDataUrl || null,
          },
          subjects: res.subjects.map((sub) => {
            const isAbsent = sub.status === 'Absent';
            const isMissing = sub.obtainedMarks === null || sub.obtainedMarks === undefined;
            const subPct = sub.maxMarks > 0 && !isMissing ? ((sub.obtainedMarks ?? 0) / sub.maxMarks) * 100 : 0;
            const evalRule = (store.gradingRules || []).find((r) => subPct >= r.minPercentage && subPct <= r.maxPercentage);
            const subGrade = isAbsent ? 'Absent' : isMissing ? 'Pending' : (evalRule?.grade || (sub.isPass ? 'Pass' : 'Fail'));
            return {
              subjectName: sub.subjectName,
              subjectCode: sub.subjectCode,
              maxMarks: sub.maxMarks,
              passingMarks: sub.passingMarks,
              obtainedMarks: sub.obtainedMarks,
              status: sub.status,
              grade: subGrade,
              remarks: sub.remarks || (isAbsent ? 'Absent' : isMissing ? 'Pending' : (sub.isPass ? 'Passed' : 'Failed')),
            };
          }),
          summary: (() => {
            const hasPending = res.subjects.some((s) => (s.obtainedMarks === null || s.obtainedMarks === undefined) && s.status !== 'Absent');
            return {
              totalMaxMarks: res.totalMaxMarks,
              totalObtainedMarks: res.totalObtainedMarks,
              percentage: res.percentage,
              grade: hasPending ? 'Pending' : res.grade,
              gradePoint: hasPending ? 0 : res.gradePoint,
              result: hasPending ? 'Pending' : (res.isPassed ? 'Pass' : 'Fail'),
              overallRemarks: hasPending ? 'Result Pending (Incomplete Marks)' : res.overallRemarks,
              position: hasPending ? undefined : classRes.results?.studentResults.find((r) => r.studentId === studentId)?.position,
              totalStudents: classRes.results?.totalStudents,
            };
          })(),
          gradingRules: store.gradingRules || [],
          issueDate: new Date().toISOString().split('T')[0],
        };

        return { success: true, dmc };
      },

      generateClassDMC: async (params) => {
        const classRes = await mockAPI.exams.getClassResults(params);
        if (!classRes.success || !classRes.results) return { success: false, error: 'Could not load class results.' };
        const dmcs: StudentDMCData[] = [];
        for (const sr of classRes.results.studentResults) {
          const dmcRes = await mockAPI.exams.generateStudentDMC(params.examinationId, sr.studentId);
          if (dmcRes.success && dmcRes.dmc) dmcs.push(dmcRes.dmc);
        }
        return { success: true, dmcs };
      },
    },

    dashboard: {
      getSummary: async (): Promise<{ success: boolean; summary: DashboardSummary }> => {
        const store = loadStore();
        const activeSession = store.sessions.find((s) => s.isActive)?.name || store.settings.academicSession || null;
        const activeClasses = store.classes.filter((c) => c.isActive).length;
        const activeSubjects = store.subjects.filter((s) => s.isActive).length;
        const activeStudents = store.students.filter((s) => s.isActive).length;
        const activeTeachers = store.teachers.filter((t) => t.isActive).length;

        // Financial metrics
        let totalFeesBilled = 0;
        let totalFeesCollected = 0;
        let totalFeesOutstanding = 0;
        for (const r of store.feeRecords) {
          if (r.status !== 'Cancelled' && r.status !== 'Waived') {
            totalFeesBilled += r.netAmount;
            totalFeesCollected += r.paidAmount;
            totalFeesOutstanding += r.remainingBalance;
          }
        }

        const today = new Date().toISOString().split('T')[0];
        let todayCollection = 0;
        for (const p of store.feePayments) {
          if (p.paymentDate === today) {
            todayCollection += p.amount;
          }
        }

        return {
          success: true,
          summary: {
            schoolName: store.settings.schoolName,
            schoolType: store.settings.schoolType,
            activeSession,
            activeClassesCount: activeClasses,
            activeSubjectsCount: activeSubjects,
            activeStudentsCount: activeStudents,
            activeTeachersCount: activeTeachers,
            hasLogo: Boolean(store.logoDataUrl),
            totalFeesBilled,
            totalFeesCollected,
            totalFeesOutstanding,
            todayCollection,
          },
        };
      },
    },

    // ─── Phase 8: Documents Mock ───────────────────────────────────────────
    documents: {
      generateNextNumber: async () => {
        const store = loadStore();
        const year = new Date().getFullYear();
        const nextSeq = (store.studentDocuments?.length || 0) + 1;
        return { success: true, documentNumber: `DOC-${year}-${nextSeq.toString().padStart(6, '0')}` };
      },

      getPreview: async (params) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === params.studentId);
        if (!student) return { success: false, error: 'Student not found.' };

        const enrollment = store.studentEnrollments
          .filter((e) => e.studentId === student.id)
          .sort((a, b) => (b.status === 'Active' ? 1 : 0) - (a.status === 'Active' ? 1 : 0))[0];

        const session = store.sessions.find((s) => s.id === (params.academicSessionId || enrollment?.academicSessionId));
        const cls = store.classes.find((c) => c.id === enrollment?.classId);
        const sec = store.sections.find((s) => s.id === enrollment?.sectionId);

        let title = (params.customTitle || '').trim();
        if (!title) {
          switch (params.documentType) {
            case 'Bonafide': title = 'BONAFIDE / STUDENT CERTIFICATE'; break;
            case 'Character': title = 'CHARACTER CERTIFICATE'; break;
            case 'Leaving': title = 'SCHOOL LEAVING / TRANSFER CERTIFICATE'; break;
            case 'General': default: title = 'STUDENT CERTIFICATE'; break;
          }
        }

        const year = new Date().getFullYear();
        const nextSeq = (store.studentDocuments?.length || 0) + 1;
        const documentNumber = `DOC-${year}-${nextSeq.toString().padStart(6, '0')}`;

        return {
          success: true,
          document: {
            documentNumber,
            documentType: params.documentType,
            title,
            issueDate: params.issueDate || new Date().toISOString().split('T')[0],
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            student: {
              id: student.id,
              studentId: student.studentId,
              admissionNumber: student.admissionNumber,
              displayName: student.displayName,
              fatherName: student.fatherName || '—',
              motherName: student.motherName || '—',
              dateOfBirth: student.dateOfBirth || '—',
              gender: student.gender,
              nationality: student.nationality || 'Pakistani',
              religion: student.religion || 'Islam',
              bloodGroup: student.bloodGroup || '—',
              phone: student.phone || '—',
              currentAddress: student.currentAddress || '—',
              admissionDate: enrollment?.admissionDate || student.createdAt?.split('T')[0] || '—',
              className: cls?.name || 'Class 9',
              sectionName: sec?.name || 'Section A',
              rollNumber: '',
              academicSessionName: session?.name || '2026-2027',
              academicSessionId: session?.id || 1,
              photoDataUrl: student.photoDataUrl,
            },
            details: {
              conduct: params.conduct || 'Good',
              reasonForLeaving: params.reasonForLeaving || "Parents' Request",
              duesCleared: params.duesCleared !== false,
              customContent: params.customContent || '',
              remarks: params.customRemarks || '',
            },
          },
        };
      },

      issue: async (params) => {
        const store = loadStore();
        const student = store.students.find((s) => s.id === params.studentId);
        if (!student) return { success: false, error: 'Student not found.' };

        const enrollment = store.studentEnrollments.find((e) => e.studentId === student.id && e.academicSessionId === params.academicSessionId);
        const cls = store.classes.find((c) => c.id === enrollment?.classId);
        const sec = store.sections.find((s) => s.id === enrollment?.sectionId);
        const session = store.sessions.find((s) => s.id === params.academicSessionId);

        const year = new Date().getFullYear();
        const nextSeq = (store.studentDocuments?.length || 0) + 1;
        const documentNumber = `DOC-${year}-${nextSeq.toString().padStart(6, '0')}`;
        const now = new Date().toISOString();

        const docRecord: StudentDocumentRecord = {
          id: nextSeq,
          documentNumber,
          studentId: student.id,
          studentSystemId: student.studentId,
          admissionNumber: student.admissionNumber,
          studentName: student.displayName,
          fatherName: student.fatherName || '',
          className: cls?.name || 'Class 9',
          sectionName: sec?.name || 'Section A',
          documentType: params.documentType,
          title: params.title,
          academicSessionId: params.academicSessionId,
          academicSessionName: session?.name || '2026-2027',
          issueDate: params.issueDate || now.split('T')[0],
          generatedByUserId: store.activeUser?.id || 1,
          generatedByUserName: store.activeUser?.displayName || 'Administrator',
          contentJson: JSON.stringify(params.details || {}),
          remarks: params.remarks || '',
          createdAt: now,
          updatedAt: now,
        };

        if (!store.studentDocuments) store.studentDocuments = [];
        store.studentDocuments.unshift(docRecord);
        saveStore(store);

        return { success: true, document: docRecord };
      },

      getHistory: async (params) => {
        const store = loadStore();
        let list = store.studentDocuments || [];

        if (params?.studentId) {
          list = list.filter((d) => d.studentId === params.studentId);
        }
        if (params?.documentType && params.documentType !== 'all') {
          list = list.filter((d) => d.documentType === params.documentType);
        }
        if (params?.academicSessionId) {
          list = list.filter((d) => d.academicSessionId === params.academicSessionId);
        }
        if (params?.searchQuery && params.searchQuery.trim()) {
          const q = params.searchQuery.trim().toLowerCase();
          list = list.filter(
            (d) =>
              d.documentNumber.toLowerCase().includes(q) ||
              d.studentName.toLowerCase().includes(q) ||
              d.studentSystemId.toLowerCase().includes(q) ||
              d.title.toLowerCase().includes(q)
          );
        }

        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const totalCount = list.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const offset = (page - 1) * limit;

        return {
          success: true,
          documents: list.slice(offset, offset + limit),
          totalCount,
          page,
          totalPages,
        };
      },

      getById: async (id) => {
        const store = loadStore();
        const found = store.studentDocuments?.find((d) => d.id === id);
        return { success: !!found, document: found };
      },
    },

    // ─── Phase 8: Promotions Mock ──────────────────────────────────────────
    promotions: {
      getCandidates: async (params) => {
        const store = loadStore();
        const fromSessionId = Number(params.fromSessionId);
        const fromClassId = Number(params.fromClassId);
        const fromSectionId = params.fromSectionId ? Number(params.fromSectionId) : undefined;
        const toSessionId = params.toSessionId ? Number(params.toSessionId) : undefined;

        if (!fromSessionId || !fromClassId) {
          return { success: false, candidates: [], error: 'Source session and class are required.' };
        }

        let enrollments = (store.studentEnrollments || []).filter(
          (e) =>
            Number(e.academicSessionId) === fromSessionId &&
            Number(e.classId) === fromClassId &&
            (!e.status || e.status.toLowerCase() === 'active')
        );

        if (fromSectionId && fromSectionId > 0) {
          enrollments = enrollments.filter((e) => Number(e.sectionId) === fromSectionId);
        }

        const candidates: PromotionCandidate[] = enrollments.map((e) => {
          const student = (store.students || []).find((s) => Number(s.id) === Number(e.studentId));
          const cls = (store.classes || []).find((c) => Number(c.id) === Number(e.classId));
          const sec = (store.sections || []).find((s) => Number(s.id) === Number(e.sectionId));

          const attRecords = (store.attendance || []).filter(
            (a) => Number(a.studentId) === Number(e.studentId) && Number(a.academicSessionId) === fromSessionId
          );
          const totalDays = attRecords.length;
          const presentDays = attRecords.filter((a) => a.status === 'Present').length;
          const lateDays = attRecords.filter((a) => a.status === 'Late').length;
          const attPct = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 10000) / 100 : null;

          const studentMarks = (store.examMarks || []).filter(
            (m) => Number(m.studentId) === Number(e.studentId) && (Number(m.enrollmentId) === Number(e.id) || !m.enrollmentId)
          );
          let examPct: number | null = null;
          let examGrade: string | null = null;
          let examResultStatus: 'Pass' | 'Fail' | 'N/A' = 'N/A';

          if (studentMarks.length > 0) {
            let totalMax = 0;
            let totalObt = 0;
            let passed = true;
            for (const sm of studentMarks) {
              const subj = (store.examSubjects || []).find((s) => Number(s.id) === Number(sm.examinationSubjectId));
              const max = subj?.maxMarks || 100;
              const pass = subj?.passingMarks || 40;
              totalMax += max;
              const obt = sm.status === 'Absent' ? 0 : (sm.obtainedMarks || 0);
              totalObt += obt;
              if (sm.status === 'Absent' || obt < pass) passed = false;
            }
            if (totalMax > 0) {
              examPct = Math.round((totalObt / totalMax) * 10000) / 100;
              examResultStatus = passed ? 'Pass' : 'Fail';
              examGrade = passed ? 'A' : 'F';
            }
          }

          const alreadyEnrolled = toSessionId
            ? (store.studentEnrollments || []).some(
                (x) =>
                  Number(x.studentId) === Number(e.studentId) &&
                  Number(x.academicSessionId) === toSessionId &&
                  (!x.status || x.status.toLowerCase() === 'active')
              )
            : false;

          return {
            studentId: e.studentId,
            systemStudentId: student?.studentId || `STD-2026-000${e.studentId}`,
            admissionNumber: student?.admissionNumber || '',
            displayName: student?.displayName || `Student ${e.studentId}`,
            fatherName: student?.fatherName || '—',
            gender: student?.gender || 'Male',
            currentEnrollmentId: e.id,
            currentClassId: e.classId,
            currentClassName: cls?.name || `Class ${e.classId}`,
            currentSectionId: e.sectionId,
            currentSectionName: sec?.name || 'All Sections',
            currentRollNumber: e.rollNumber || student?.currentEnrollment?.rollNumber || '',
            attendanceTotalDays: totalDays,
            attendancePresentDays: presentDays,
            attendancePercentage: attPct,
            examPercentage: examPct,
            examGrade,
            examResultStatus,
            alreadyEnrolledInDestination: alreadyEnrolled,
            recommendedAction: examResultStatus === 'Fail' ? 'Retain' : 'Promote',
          };
        });

        return { success: true, candidates };
      },

      execute: async (params) => {
        const store = loadStore();
        const { fromSessionId, toSessionId, toClassId, toSectionId, promotions } = params;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        for (const item of promotions) {
          const enroll = store.studentEnrollments.find(
            (e) => e.studentId === item.studentId && e.academicSessionId === fromSessionId && e.status === 'Active'
          );
          if (!enroll) continue;

          if (item.action === 'Promote' || item.action === 'Retain') {
            enroll.status = 'Inactive';
            (enroll as unknown as Record<string, unknown>).promotionStatus = item.action;
            (enroll as unknown as Record<string, unknown>).promotionDate = today;

            const targetClassId = item.toClassId || (item.action === 'Promote' ? toClassId! : enroll.classId);
            const targetSectionId = item.toSectionId || toSectionId!;

            const nextId = store.studentEnrollments.length + 1;
            const newEnroll: StudentEnrollmentItem = {
              id: nextId,
              studentId: item.studentId,
              academicSessionId: toSessionId!,
              classId: targetClassId,
              sectionId: targetSectionId,
              admissionDate: today,
              status: 'Active',
              createdAt: now,
              updatedAt: now,
            };
            store.studentEnrollments.push(newEnroll);
          } else if (item.action === 'Graduate') {
            enroll.status = 'Graduated';
            (enroll as unknown as Record<string, unknown>).promotionStatus = 'Graduated';
            (enroll as unknown as Record<string, unknown>).promotionDate = today;
          } else if (item.action === 'Transfer' || item.action === 'Left') {
            enroll.status = item.action === 'Transfer' ? 'Transferred' : 'Left';
            (enroll as unknown as Record<string, unknown>).promotionStatus = item.action;
            (enroll as unknown as Record<string, unknown>).promotionDate = today;
          }
        }

        saveStore(store);
        return { success: true, processedCount: promotions.length };
      },

      getAcademicHistory: async (studentId) => {
        const store = loadStore();
        const enrollments = store.studentEnrollments.filter((e) => e.studentId === studentId);

        const history: StudentAcademicHistoryEntry[] = enrollments.map((e) => {
          const sess = store.sessions.find((s) => s.id === e.academicSessionId);
          const cls = store.classes.find((c) => c.id === e.classId);
          const sec = store.sections.find((s) => s.id === e.sectionId);

          return {
            enrollmentId: e.id,
            academicSessionId: e.academicSessionId,
            academicSessionName: sess?.name || '2026-2027',
            classId: e.classId,
            className: cls?.name || 'Class 9',
            sectionId: e.sectionId,
            sectionName: sec?.name || 'Section A',
            rollNumber: '',
            admissionDate: e.admissionDate,
            status: e.status,
            promotionStatus: (e as unknown as Record<string, unknown>).promotionStatus as string || 'None',
            promotionDate: (e as unknown as Record<string, unknown>).promotionDate as string || null,
            remarks: '',
            attendancePercentage: 95.0,
            examGrade: 'A',
            examPercentage: 85.5,
          };
        });

        return { success: true, history };
      },

      getLogs: async () => {
        const store = loadStore();
        return { success: true, logs: store.promotionLogs || [], totalCount: store.promotionLogs?.length || 0, page: 1, totalPages: 1 };
      },
    },

    // ─── Phase 8: Reports Mock ─────────────────────────────────────────────
    reports: {
      getStudentList: async (filters) => {
        const store = loadStore();
        let enrolls = store.studentEnrollments.filter((e) => e.status === (filters?.status || 'Active'));
        if (filters?.academicSessionId) enrolls = enrolls.filter((e) => e.academicSessionId === filters.academicSessionId);
        if (filters?.classId) enrolls = enrolls.filter((e) => e.classId === filters.classId);
        if (filters?.sectionId) enrolls = enrolls.filter((e) => e.sectionId === filters.sectionId);

        const records: StudentListReportRow[] = enrolls.map((e) => {
          const s = store.students.find((x) => x.id === e.studentId);
          const c = store.classes.find((x) => x.id === e.classId);
          const sec = store.sections.find((x) => x.id === e.sectionId);
          return {
            studentId: s?.studentId || `STD-2026-000${e.studentId}`,
            admissionNumber: s?.admissionNumber || '—',
            displayName: s?.displayName || `Student ${e.studentId}`,
            fatherName: s?.fatherName || '—',
            className: c?.name || 'Class 9',
            sectionName: sec?.name || 'Section A',
            gender: s?.gender || 'Male',
            status: e.status,
            phone: s?.phone || '—',
            admissionDate: e.admissionDate,
          };
        });

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Student Directory Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalStudents: records.length,
        };
      },

      getAttendance: async (_filters) => {
        const store = loadStore();
        const records: AttendanceReportRow[] = store.students.map((s) => {
          const att = store.attendance.filter((a) => a.studentId === s.id);
          const total = att.length;
          const present = att.filter((a) => a.status === 'Present').length;
          const late = att.filter((a) => a.status === 'Late').length;
          const absent = att.filter((a) => a.status === 'Absent').length;
          const leave = att.filter((a) => a.status === 'Leave').length;
          const pct = total > 0 ? Math.round(((present + late) / total) * 10000) / 100 : null;

          return {
            studentId: s.studentId,
            admissionNumber: s.admissionNumber || '—',
            displayName: s.displayName,
            className: 'Class 9',
            sectionName: 'Section A',
            totalDays: total,
            presentCount: present,
            lateCount: late,
            absentCount: absent,
            leaveCount: leave,
            attendancePercentage: pct,
          };
        });

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Attendance Summary Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalRecordedDays: 20,
          classAveragePercentage: 90.0,
        };
      },

      getFeeCollection: async () => {
        const store = loadStore();
        const records: FeeCollectionReportRow[] = store.feePayments.map((p) => {
          const rec = store.feeRecords.find((r) => r.id === p.feeRecordId);
          const st = store.students.find((s) => s.id === rec?.studentId);
          const cls = store.classes.find((c) => c.id === rec?.classId);
          const per = store.feePeriods.find((x) => x.id === rec?.feePeriodId);
          const ft = store.feeTypes.find((x) => x.id === rec?.feeTypeId);

          return {
            receiptNumber: p.receiptNumber,
            paymentDate: p.paymentDate,
            studentId: st?.studentId || 'STD-2026-0001',
            admissionNumber: st?.admissionNumber || '—',
            displayName: st?.displayName || 'Student',
            className: cls?.name || 'Class 9',
            feePeriodName: per?.name || 'Term 1',
            feeTypeName: ft?.name || 'Tuition Fee',
            amountMinor: p.amount,
            amountFormatted: `Rs. ${(p.amount / 100).toFixed(2)}`,
            paymentMode: p.paymentMethod,
            receivedBy: 'Administrator',
          };
        });

        const totalMinor = records.reduce((sum, r) => sum + r.amountMinor, 0);

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Fee Collection Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalCollectedMinor: totalMinor,
          totalCollectedFormatted: `Rs. ${(totalMinor / 100).toFixed(2)}`,
          totalTransactions: records.length,
        };
      },

      getFeeOutstanding: async () => {
        const store = loadStore();
        const defaulters = store.feeRecords.filter((r) => r.remainingBalance > 0);

        const records: FeeOutstandingReportRow[] = defaulters.map((r) => {
          const st = store.students.find((s) => s.id === r.studentId);
          const cls = store.classes.find((c) => c.id === r.classId);
          const sec = store.sections.find((s) => s.id === r.sectionId);
          const per = store.feePeriods.find((x) => x.id === r.feePeriodId);
          const ft = store.feeTypes.find((x) => x.id === r.feeTypeId);

          return {
            studentId: st?.studentId || 'STD-2026-0001',
            admissionNumber: st?.admissionNumber || '—',
            displayName: st?.displayName || 'Student',
            fatherName: st?.fatherName || '—',
            className: cls?.name || 'Class 9',
            sectionName: sec?.name || 'Section A',
            feePeriodName: per?.name || 'Term 1',
            feeTypeName: ft?.name || 'Tuition Fee',
            dueDate: r.dueDate,
            netAmountFormatted: `Rs. ${(r.netAmount / 100).toFixed(2)}`,
            paidAmountFormatted: `Rs. ${(r.paidAmount / 100).toFixed(2)}`,
            remainingBalanceMinor: r.remainingBalance,
            remainingBalanceFormatted: `Rs. ${(r.remainingBalance / 100).toFixed(2)}`,
            status: r.status,
          };
        });

        const totalMinor = records.reduce((sum, r) => sum + r.remainingBalanceMinor, 0);

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Fee Outstanding & Dues Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalOutstandingMinor: totalMinor,
          totalOutstandingFormatted: `Rs. ${(totalMinor / 100).toFixed(2)}`,
          totalDefaulters: records.length,
        };
      },

      getExamMarks: async (filters) => {
        const store = loadStore();
        const records: ExamMarksReportRow[] = store.examMarks
          .filter((m) => m.examinationId === filters.examinationId)
          .map((m) => {
            const st = store.students.find((s) => s.id === m.studentId);
            const es = store.examSubjects.find((s) => s.id === m.examinationSubjectId);
            const sub = store.subjects.find((s) => s.id === es?.subjectId);
            const isAbsent = m.status === 'Absent';
            const obt = isAbsent ? null : m.obtainedMarks;
            const passMarks = es?.passingMarks || 40;
            const isPass = !isAbsent && (m.obtainedMarks || 0) >= passMarks;

            return {
              studentId: st?.studentId || 'STD-2026-0001',
              admissionNumber: st?.admissionNumber || '—',
              displayName: st?.displayName || 'Student',
              rollNumber: '—',
              subjectName: sub?.name || 'Subject',
              maxMarks: es?.maxMarks || 100,
              passingMarks: passMarks,
              obtainedMarks: obt,
              status: m.status,
              grade: isPass ? 'A' : 'F',
              isPass,
              remarks: m.remarks,
            };
          });

        const passCount = records.filter((r) => r.isPass).length;

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Examination Marks Sheet',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalEntered: records.length,
          passCount,
          failCount: records.length - passCount,
          passPercentage: records.length > 0 ? Math.round((passCount / records.length) * 10000) / 100 : 0,
        };
      },

      getClassResults: async (params) => {
        const store = loadStore();
        const exam = store.examinations.find((e) => e.id === params.examinationId);
        const cls = store.classes.find((c) => c.id === params.classId);

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Class Result & Merit List',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          results: {
            examinationId: params.examinationId,
            examinationName: exam?.name || 'Mid Term',
            academicSessionName: '2026-2027',
            classId: params.classId,
            className: cls?.name || 'Class 9',
            totalStudents: store.students.length,
            passedStudents: store.students.length,
            failedStudents: 0,
            passPercentage: 100,
            highestPercentage: 92.5,
            averagePercentage: 85.0,
            subjects: [],
            studentResults: [],
          },
        };
      },

      getClassStrength: async () => {
        const store = loadStore();
        const records: ClassStrengthRow[] = store.classes.map((c) => {
          const secs = store.sections.filter((s) => s.classId === c.id);
          const sec = secs[0] || { id: 1, name: 'A' };
          const stds = store.studentEnrollments.filter((e) => e.classId === c.id);

          return {
            classId: c.id,
            className: c.name,
            sectionId: sec.id,
            sectionName: sec.name,
            maleCount: stds.length,
            femaleCount: 0,
            otherCount: 0,
            activeCount: stds.length,
            inactiveCount: 0,
            totalCount: stds.length,
          };
        });

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Class Strength & Enrollment Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          grandTotal: store.students.length,
        };
      },

      getTeacher: async () => {
        const store = loadStore();
        const records: TeacherReportRow[] = store.teachers.map((t) => ({
          teacherId: t.teacherId,
          employeeId: t.employeeId || '—',
          displayName: t.displayName,
          gender: t.gender,
          designation: t.designation || 'Teacher',
          qualification: t.qualification || 'Master of Science',
          specialization: t.specialization || 'Mathematics',
          joiningDate: t.joiningDate || '2024-01-15',
          phone: t.phone || '—',
          email: t.email || '—',
          employmentStatus: t.employmentStatus,
        }));

        return {
          success: true,
          metadata: {
            school: store.settings,
            schoolLogoDataUrl: store.logoDataUrl,
            reportTitle: 'Faculty & Teacher Directory Report',
            generatedAt: new Date().toLocaleString(),
            filtersApplied: {},
          },
          records,
          totalTeachers: records.length,
        };
      },
    },

    backup: {
      create: async () => {
        return {
          success: true,
          backupPath: 'C:\\Users\\User\\Backups\\SchoolBackup_2026-10-05.smbak',
          manifest: {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            appVersion: '1.0.0',
            schemaVersion: 8,
            schoolName: 'Demo Model School',
            schoolCode: 'DMS001',
            installationId: 'INST-MOCK-BROWSER-1234',
            fileSize: 1048576,
            dbChecksumSha256: 'mock-sha256-checksum',
            assetFilesCount: 4,
          },
        };
      },
      validate: async () => {
        return {
          isValid: true,
          manifest: {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            appVersion: '1.0.0',
            schemaVersion: 8,
            schoolName: 'Demo Model School',
            schoolCode: 'DMS001',
            installationId: 'INST-MOCK-BROWSER-1234',
            fileSize: 1048576,
            dbChecksumSha256: 'mock-sha256-checksum',
            assetFilesCount: 4,
          },
          errors: [],
          warnings: [],
        };
      },
      restore: async () => {
        return {
          success: true,
          restoredAt: new Date().toISOString(),
          manifest: {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            appVersion: '1.0.0',
            schemaVersion: 8,
            schoolName: 'Demo Model School',
            schoolCode: 'DMS001',
            installationId: 'INST-MOCK-BROWSER-1234',
            fileSize: 1048576,
            dbChecksumSha256: 'mock-sha256-checksum',
            assetFilesCount: 4,
          },
        };
      },
      list: async () => {
        return {
          success: true,
          backups: [
            {
              fileName: 'SchoolBackup_2026-10-01.smbak',
              fullPath: 'C:\\Users\\User\\Backups\\SchoolBackup_2026-10-01.smbak',
              createdAt: '2026-10-01T10:00:00.000Z',
              sizeBytes: 1048576,
              schoolName: 'Demo Model School',
              appVersion: '1.0.0',
              schemaVersion: 8,
            },
          ],
        };
      },
      chooseFolder: async () => {
        return { success: true, folderPath: 'C:\\Users\\User\\Backups' };
      },
      chooseFile: async () => {
        return { success: true, filePath: 'C:\\Users\\User\\Backups\\SchoolBackup_2026-10-01.smbak' };
      },
      showInFolder: async () => {
        return { success: true };
      },
      openFolder: async () => {
        return { success: true };
      },
      getLastBackup: async () => {
        return {
          success: true,
          info: {
            lastBackupDate: '2026-10-01T10:00:00.000Z',
            backupName: 'SchoolBackup_2026-10-01.smbak',
            backupSizeBytes: 1048576,
          },
        };
      },
    },

    license: {
      getStatus: async () => {
        return {
          success: true,
          statusInfo: {
            status: 'Active',
            installationId: 'INST-MOCK-BROWSER-1234',
            isValid: true,
            isExpired: false,
            isInGracePeriod: false,
            daysRemaining: 365,
            customerName: 'Demo Model School',
            product: 'SMS-Enterprise',
            edition: 'Enterprise',
            licenseType: 'Perpetual',
            installationBinding: 'INST-MOCK-BROWSER-1234',
            issuedAt: '2026-01-01',
            startsAt: '2026-01-01',
            expiresAt: '2027-01-01',
            gracePeriodDays: 14,
            maxStudents: 5000,
            features: ['all'],
            machineMatches: true,
            details: 'Active Enterprise License in Browser Mock',
          },
        };
      },
      getInstallationId: async () => {
        return { success: true, installationId: 'INST-MOCK-BROWSER-1234' };
      },
      activate: async (_token: string) => {
        return {
          success: true,
          statusInfo: {
            status: 'Active',
            installationId: 'INST-MOCK-BROWSER-1234',
            isValid: true,
            isExpired: false,
            isInGracePeriod: false,
            daysRemaining: 365,
            customerName: 'Activated School',
            product: 'SMS-Enterprise',
            edition: 'Enterprise',
            licenseType: 'Annual',
            installationBinding: 'INST-MOCK-BROWSER-1234',
            issuedAt: new Date().toISOString().slice(0, 10),
            startsAt: new Date().toISOString().slice(0, 10),
            expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            gracePeriodDays: 14,
            features: ['all'],
            machineMatches: true,
            details: 'Successfully Activated in Browser Mock',
          },
        };
      },
      importFile: async () => {
        return {
          success: true,
          statusInfo: {
            status: 'Active',
            installationId: 'INST-MOCK-BROWSER-1234',
            isValid: true,
            isExpired: false,
            isInGracePeriod: false,
            daysRemaining: 365,
            customerName: 'Imported School',
            product: 'SMS-Enterprise',
            edition: 'Enterprise',
            licenseType: 'Annual',
            installationBinding: 'INST-MOCK-BROWSER-1234',
            issuedAt: new Date().toISOString().slice(0, 10),
            startsAt: new Date().toISOString().slice(0, 10),
            expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            gracePeriodDays: 14,
            features: ['all'],
            machineMatches: true,
            details: 'Imported successfully',
          },
        };
      },
      exportFile: async () => {
        return { success: true, filePath: 'C:\\Users\\User\\Desktop\\license.lic' };
      },
    },

    superAdmin: {
      isSetupRequired: async () => {
        return { success: true, isSetupRequired: false };
      },
      setup: async () => {
        return { success: true };
      },
      login: async (payload: { username?: string; password?: string }) => {
        return {
          success: true,
          token: 'sa_mock_token_123',
          superAdmin: { id: 1, username: payload.username || 'admin', displayName: 'Super Administrator' },
        };
      },
      logout: async () => {
        return { success: true };
      },
      verifySession: async () => {
        return {
          success: true,
          superAdmin: { id: 1, username: 'admin', displayName: 'Super Administrator' },
        };
      },
      generateLicense: async (params: Record<string, unknown>) => {
        return {
          success: true,
          licenseId: 'LIC-2026-MOCK-9999',
          signedToken: 'MOCK_BASE64_ED25519_SIGNED_LICENSE_TOKEN',
          payload: params,
        };
      },
      getGeneratedLicenses: async () => {
        return {
          success: true,
          records: [
            {
              id: 1,
              licenseId: 'LIC-2026-MOCK-0001',
              customerName: 'Demo Model School',
              contactPerson: 'Principal',
              contactPhone: '0300-1234567',
              contactEmail: 'info@school.edu',
              licenseType: 'Annual',
              edition: 'Enterprise',
              installationBinding: 'INST-MOCK-BROWSER-1234',
              startsAt: '2026-01-01',
              expiresAt: '2027-01-01',
              gracePeriodDays: 14,
              price: 50000,
              currency: 'PKR',
              paymentStatus: 'Paid',
              createdAt: '2026-01-01T00:00:00.000Z',
              signedToken: 'MOCK_TOKEN',
            },
          ],
          totalCount: 1,
        };
      },
      getDashboardStats: async () => {
        return {
          success: true,
          totalLicensesGenerated: 1,
          activeLicensesCount: 1,
          expiredLicensesCount: 0,
          licenseTypeDistribution: { Annual: 1 },
        };
      },
    },

    exportPDF: async () => {
      window.print();
      return { success: true };
    },

    invoke: async () => {
      return null;
    },
  };

  // Attach to window object
  window.electronAPI = mockAPI;
}
