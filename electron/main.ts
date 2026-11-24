/**
 * Electron Main Process
 * 
 * Backend process of the application with full Node.js access.
 * Security: The React UI cannot access Node.js or SQLite directly.
 * Communication happens strictly through validated IPC channels in the preload bridge.
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { initDatabase, closeDatabase, getDatabasePath, ensureUserDataMigrated } from './database/connection';
import { runMigrations } from './database/migrations';
import {
  isSetupRequired,
  createInitialAdmin,
  login,
  logout,
  verifySession,
  clearAllSessions,
} from './database/services/auth.service';
import {
  getSchoolSettings,
  updateSchoolSettings,
  saveSchoolLogo,
  removeSchoolLogo,
  getSchoolLogoDataUrl,
  savePrincipalSignature,
  removePrincipalSignature,
  getPrincipalSignatureDataUrl,
} from './database/services/school.service';
import {
  getAllSessions,
  createSession,
  updateSession,
  activateSession,
  deactivateSession,
} from './database/services/academic-session.service';
import {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  toggleClassStatus,
  getSectionsByClassId,
  createSection,
  updateSection,
  toggleSectionStatus,
} from './database/services/class.service';
import {
  getAllSubjects,
  createSubject,
  updateSubject,
  toggleSubjectStatus,
  getClassSubjects,
  assignSubjectToClass,
  removeClassSubject,
} from './database/services/subject.service';
import {
  getAllStudents,
  getStudentById,
  generateNextStudentId,
  createStudent,
  updateStudent,
  toggleStudentStatus,
  getStudentEnrollments,
  createEnrollment,
  saveStudentPhoto,
  removeStudentPhoto,
  getStudentStats,
  deleteStudent,
} from './database/services/student.service';
import {
  getAllTeachers,
  getTeacherById,
  generateNextTeacherId,
  createTeacher,
  updateTeacher,
  toggleTeacherStatus,
  saveTeacherPhoto,
  removeTeacherPhoto,
} from './database/services/teacher.service';
import {
  getEnrolledStudentsForAttendance,
  saveAttendance,
  getDailyAttendanceSummary,
  getAttendanceHistory,
  getStudentAttendanceHistory,
} from './database/services/attendance.service';
import {
  getAllFeeTypes,
  createFeeType,
  updateFeeType,
  toggleFeeTypeStatus,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  toggleFeeStructureStatus,
  getFeePeriods,
  createFeePeriod,
  updateFeePeriod,
  getStudentFeeAdjustments,
  createStudentFeeAdjustment,
  generateFeesForClass,
  getFeeRecords,
  getFeeDues,
  recordFeePayment,
  getFeePaymentById,
  getReceiptByNumber,
  searchPaymentHistory,
  getStudentFeeProfile,
} from './database/services/fee.service';
import {
  getAllExamTypes,
  createExamType,
  updateExamType,
  toggleExamTypeStatus,
  getAllExaminations,
  getExaminationById,
  createExamination,
  updateExamination,
  updateExaminationStatus,
  deleteExamination,
  getExaminationSubjects,
  configureExaminationSubjects,
  updateExaminationSubjectMarks,
  getAllGradingRules,
  saveGradingRule,
  deleteGradingRule,
  getStudentsForMarksEntry,
  saveMarks,
  calculateStudentExamResult,
  getClassExamResults,
  generateStudentDMC,
  generateClassDMC,
} from './database/services/exam.service';
import {
  generateNextDocumentNumber,
  getStudentDocumentPreview,
  issueStudentDocument,
  getDocumentById,
  getDocumentHistory,
} from './database/services/document.service';
import {
  getPromotionCandidates,
  executePromotion,
  getStudentAcademicHistory,
  getPromotionLogs,
} from './database/services/promotion.service';
import {
  getStudentListReport,
  getAttendanceReport,
  getFeeCollectionReport,
  getFeeOutstandingReport,
  getExamMarksReport,
  getClassResultsReport,
  getClassStrengthReport,
  getTeacherReport,
} from './database/services/report.service';
import { getDashboardSummary } from './database/services/dashboard.service';
import {
  createBackup,
  validateBackup,
  restoreBackup,
  listBackups,
  getLastBackupInfo,
} from './database/services/backup.service';
import {
  getLicenseStatus,
  getInstallationIdentity,
  activateLicense,
} from './database/services/license.service';
import {
  isSuperAdminSetupRequired,
  createSuperAdminAccount,
  loginSuperAdmin,
  logoutSuperAdmin,
  verifySuperAdminSession,
  generateLicense,
  getGeneratedLicenses,
  getSuperAdminDashboardStats,
} from './database/services/super-admin.service';

// ─── Constants & App Configuration ──────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const APP_NAME = 'MS Institute Management System';
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

// Configure canonical application name and userData directory
app.name = APP_NAME;
try {
  let appDataDir = '';
  try {
    appDataDir = app.getPath('appData');
  } catch {
    appDataDir = process.env.APPDATA || '';
  }
  if (appDataDir) {
    const canonicalUserData = path.join(appDataDir, APP_NAME);
    app.setPath('userData', canonicalUserData);
  }
} catch (err) {
  console.warn('[App] Warning configuring userData directory:', err);
}

function getAppDataPath(): string {
  return app.getPath('userData');
}

// ─── Window Creation ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  const iconPath = fs.existsSync(path.join(__dirname, '..', 'public', 'icon.png'))
    ? path.join(__dirname, '..', 'public', 'icon.png')
    : path.join(__dirname, '..', 'dist', 'icon.png');

  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    backgroundColor: '#f0f2f5',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: IS_DEV,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (IS_DEV) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (IS_DEV && parsedUrl.hostname === 'localhost') return;
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
    console.warn(`Blocked navigation to: ${url}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server:', err.message);
    });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load production build:', err.message);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ─── 1. Application & System Info ─────────────────────────────────────────
  ipcMain.handle('app:getInfo', () => {
    return {
      name: APP_NAME,
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      appDataPath: getAppDataPath(),
      databasePath: getDatabasePath(),
      isDev: IS_DEV,
    };
  });

  ipcMain.handle('app:getSystemInfo', () => {
    return {
      hostname: os.hostname(),
      osType: os.type(),
      osRelease: os.release(),
      totalMemoryGB: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
      cpuCores: os.cpus().length,
      userHome: os.homedir(),
    };
  });

  ipcMain.handle('app:getStatus', () => {
    return {
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
        backup: true,
        license: true,
        superAdmin: true,
        settings: true,
      },
    };
  });

  // ─── 2. Authentication ────────────────────────────────────────────────────
  ipcMain.handle('auth:getSetupStatus', () => {
    try {
      const needed = isSetupRequired();
      return { success: true, isSetupRequired: needed };
    } catch (err) {
      console.error('[IPC auth:getSetupStatus error]', err);
      return { success: false, isSetupRequired: false, error: 'Database check failed.' };
    }
  });

  ipcMain.handle('auth:createInitialAdmin', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid setup payload.' };
    }
    const data = payload as { username?: string; displayName?: string; password?: string };
    return createInitialAdmin({
      username: data.username || '',
      displayName: data.displayName || '',
      password: data.password || '',
    });
  });

  ipcMain.handle('auth:login', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid login payload.' };
    }
    const data = payload as { username?: string; password?: string };
    return login({
      username: data.username || '',
      password: data.password || '',
    });
  });

  ipcMain.handle('auth:logout', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string } | undefined;
    return logout(data?.sessionToken);
  });

  ipcMain.handle('auth:getCurrentUser', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string } | undefined;
    const result = verifySession(data?.sessionToken);
    return { success: result.isValid, user: result.user ?? null };
  });

  // ─── 3. School Settings & Logo ────────────────────────────────────────────
  ipcMain.handle('school:getSettings', () => {
    try {
      const settings = getSchoolSettings();
      const logoDataUrl = settings.logoDataUrl || getSchoolLogoDataUrl();
      return { success: true, settings, logoDataUrl };
    } catch (err) {
      console.error('[IPC school:getSettings error]', err);
      return { success: false, error: 'Failed to load school settings.' };
    }
  });

  ipcMain.handle('school:updateSettings', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid settings payload.' };
    }
    return updateSchoolSettings(payload as Parameters<typeof updateSchoolSettings>[0]);
  });

  ipcMain.handle('school:chooseLogoFile', async (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string } | undefined;
    const sessionCheck = verifySession(data?.sessionToken);
    if (!sessionCheck.isValid) {
      return { success: false, error: 'Unauthorized.' };
    }

    if (!mainWindow) {
      return { success: false, error: 'Application window not ready.' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select School Logo',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Images (*.png, *.jpg, *.jpeg)', extensions: ['png', 'jpg', 'jpeg'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return saveSchoolLogo({
      sessionToken: data?.sessionToken,
      sourceFilePath: filePaths[0],
    });
  });

  ipcMain.handle('school:uploadLogo', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid logo upload payload.' };
    }
    return saveSchoolLogo(payload as Parameters<typeof saveSchoolLogo>[0]);
  });

  ipcMain.handle('school:removeLogo', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string } | undefined;
    return removeSchoolLogo(data?.sessionToken);
  });

  ipcMain.handle('school:getLogoDataUrl', () => {
    return { success: true, dataUrl: getSchoolLogoDataUrl() };
  });

  ipcMain.handle('school:uploadSignature', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid signature upload payload.' };
    }
    return savePrincipalSignature(payload as Parameters<typeof savePrincipalSignature>[0]);
  });

  ipcMain.handle('school:removeSignature', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string } | undefined;
    return removePrincipalSignature(data?.sessionToken);
  });

  ipcMain.handle('school:getSignatureDataUrl', () => {
    return { success: true, dataUrl: getPrincipalSignatureDataUrl() };
  });

  // ─── 4. Academic Sessions ─────────────────────────────────────────────────
  ipcMain.handle('sessions:getAll', (_event, payload: unknown) => {
    const data = payload as { searchQuery?: string } | undefined;
    const list = getAllSessions(data?.searchQuery);
    return { success: true, sessions: list };
  });

  ipcMain.handle('sessions:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid session payload.' };
    }
    return createSession(payload as Parameters<typeof createSession>[0]);
  });

  ipcMain.handle('sessions:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid session payload.' };
    }
    return updateSession(payload as Parameters<typeof updateSession>[0]);
  });

  ipcMain.handle('sessions:activate', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid activation payload.' };
    }
    return activateSession(payload as Parameters<typeof activateSession>[0]);
  });

  ipcMain.handle('sessions:deactivate', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid deactivation payload.' };
    }
    return deactivateSession(payload as Parameters<typeof deactivateSession>[0]);
  });

  // ─── 5. Classes & Sections ────────────────────────────────────────────────
  ipcMain.handle('classes:getAll', (_event, payload: unknown) => {
    const data = payload as { searchQuery?: string; includeInactive?: boolean } | undefined;
    const list = getAllClasses(data?.searchQuery, data?.includeInactive ?? true);
    return { success: true, classes: list };
  });

  ipcMain.handle('classes:getById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    const item = getClassById(Number(data.id));
    return { success: true, classItem: item };
  });

  ipcMain.handle('classes:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid class payload.' };
    }
    return createClass(payload as Parameters<typeof createClass>[0]);
  });

  ipcMain.handle('classes:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid class payload.' };
    }
    return updateClass(payload as Parameters<typeof updateClass>[0]);
  });

  ipcMain.handle('classes:toggleStatus', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid status payload.' };
    }
    return toggleClassStatus(payload as Parameters<typeof toggleClassStatus>[0]);
  });

  ipcMain.handle('sections:getByClassId', (_event, payload: unknown) => {
    const data = payload as { classId: number; searchQuery?: string };
    const list = getSectionsByClassId(Number(data.classId), data.searchQuery);
    return { success: true, sections: list };
  });

  ipcMain.handle('sections:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid section payload.' };
    }
    return createSection(payload as Parameters<typeof createSection>[0]);
  });

  ipcMain.handle('sections:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid section payload.' };
    }
    return updateSection(payload as Parameters<typeof updateSection>[0]);
  });

  ipcMain.handle('sections:toggleStatus', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid status payload.' };
    }
    return toggleSectionStatus(payload as Parameters<typeof toggleSectionStatus>[0]);
  });

  // ─── 6. Subjects & Assignments ───────────────────────────────────────────
  ipcMain.handle('subjects:getAll', (_event, payload: unknown) => {
    const data = payload as { searchQuery?: string; includeInactive?: boolean } | undefined;
    const list = getAllSubjects(data?.searchQuery, data?.includeInactive ?? true);
    return { success: true, subjects: list };
  });

  ipcMain.handle('subjects:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid subject payload.' };
    }
    return createSubject(payload as Parameters<typeof createSubject>[0]);
  });

  ipcMain.handle('subjects:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid subject payload.' };
    }
    return updateSubject(payload as Parameters<typeof updateSubject>[0]);
  });

  ipcMain.handle('subjects:toggleStatus', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid status payload.' };
    }
    return toggleSubjectStatus(payload as Parameters<typeof toggleSubjectStatus>[0]);
  });

  ipcMain.handle('classSubjects:getByClassId', (_event, payload: unknown) => {
    const data = payload as { classId: number };
    const list = getClassSubjects(Number(data.classId));
    return { success: true, classSubjects: list };
  });

  ipcMain.handle('classSubjects:assign', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid assignment payload.' };
    }
    return assignSubjectToClass(payload as Parameters<typeof assignSubjectToClass>[0]);
  });

  ipcMain.handle('classSubjects:remove', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid remove assignment payload.' };
    }
    return removeClassSubject(payload as Parameters<typeof removeClassSubject>[0]);
  });

  // ─── 7. Students & Enrollments ───────────────────────────────────────────
  ipcMain.handle('students:getAll', (_event, payload: unknown) => {
    const data = (payload || {}) as Parameters<typeof getAllStudents>[0];
    return getAllStudents(data);
  });

  ipcMain.handle('students:getStats', (_event, payload: unknown) => {
    const data = (payload || {}) as { academicSessionId?: number };
    return { success: true, stats: getStudentStats(data?.academicSessionId) };
  });

  ipcMain.handle('students:getById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    const student = getStudentById(Number(data.id));
    return { success: true, student };
  });

  ipcMain.handle('students:generateNextId', (_event, payload: unknown) => {
    const data = payload as { year?: string } | undefined;
    const nextId = generateNextStudentId(data?.year);
    return { success: true, nextId };
  });

  ipcMain.handle('students:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid student create payload.' };
    }
    return createStudent(payload as Parameters<typeof createStudent>[0]);
  });

  ipcMain.handle('students:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid student update payload.' };
    }
    return updateStudent(payload as Parameters<typeof updateStudent>[0]);
  });

  ipcMain.handle('students:toggleStatus', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid status toggle payload.' };
    }
    return toggleStudentStatus(payload as Parameters<typeof toggleStudentStatus>[0]);
  });

  ipcMain.handle('students:delete', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid delete student payload.' };
    }
    return deleteStudent(payload as Parameters<typeof deleteStudent>[0]);
  });

  ipcMain.handle('students:getEnrollmentHistory', (_event, payload: unknown) => {
    const data = payload as { studentId: number };
    const history = getStudentEnrollments(Number(data.studentId));
    return { success: true, history };
  });

  ipcMain.handle('students:createEnrollment', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid enrollment payload.' };
    }
    return createEnrollment(payload as Parameters<typeof createEnrollment>[0]);
  });

  ipcMain.handle('students:choosePhoto', async (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string; studentId: number } | undefined;
    const sessionCheck = verifySession(data?.sessionToken);
    if (!sessionCheck.isValid) {
      return { success: false, error: 'Unauthorized.' };
    }

    if (!mainWindow) {
      return { success: false, error: 'Application window not ready.' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Student Profile Photo',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Images (*.png, *.jpg, *.jpeg)', extensions: ['png', 'jpg', 'jpeg'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return saveStudentPhoto({
      sessionToken: data?.sessionToken,
      studentId: data?.studentId ?? 0,
      sourceFilePath: filePaths[0],
    });
  });

  ipcMain.handle('students:uploadPhoto', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid photo payload.' };
    }
    return saveStudentPhoto(payload as Parameters<typeof saveStudentPhoto>[0]);
  });

  ipcMain.handle('students:removePhoto', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string; studentId: number } | undefined;
    return removeStudentPhoto({
      sessionToken: data?.sessionToken,
      studentId: Number(data?.studentId),
    });
  });

  // ─── 8. Teachers ─────────────────────────────────────────────────────────
  ipcMain.handle('teachers:getAll', (_event, payload: unknown) => {
    const data = (payload || {}) as Parameters<typeof getAllTeachers>[0];
    return getAllTeachers(data);
  });

  ipcMain.handle('teachers:getById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    const teacher = getTeacherById(Number(data.id));
    return { success: true, teacher };
  });

  ipcMain.handle('teachers:generateNextId', (_event, payload: unknown) => {
    const data = payload as { year?: string } | undefined;
    const nextId = generateNextTeacherId(data?.year);
    return { success: true, nextId };
  });

  ipcMain.handle('teachers:create', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid teacher create payload.' };
    }
    return createTeacher(payload as Parameters<typeof createTeacher>[0]);
  });

  ipcMain.handle('teachers:update', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid teacher update payload.' };
    }
    return updateTeacher(payload as Parameters<typeof updateTeacher>[0]);
  });

  ipcMain.handle('teachers:toggleStatus', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid status toggle payload.' };
    }
    return toggleTeacherStatus(payload as Parameters<typeof toggleTeacherStatus>[0]);
  });

  ipcMain.handle('teachers:choosePhoto', async (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string; teacherId: number } | undefined;
    const sessionCheck = verifySession(data?.sessionToken);
    if (!sessionCheck.isValid) {
      return { success: false, error: 'Unauthorized.' };
    }

    if (!mainWindow) {
      return { success: false, error: 'Application window not ready.' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Teacher Profile Photo',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Images (*.png, *.jpg, *.jpeg)', extensions: ['png', 'jpg', 'jpeg'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return saveTeacherPhoto({
      sessionToken: data?.sessionToken,
      teacherId: data?.teacherId ?? 0,
      sourceFilePath: filePaths[0],
    });
  });

  ipcMain.handle('teachers:uploadPhoto', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid photo payload.' };
    }
    return saveTeacherPhoto(payload as Parameters<typeof saveTeacherPhoto>[0]);
  });

  ipcMain.handle('teachers:removePhoto', (_event, payload: unknown) => {
    const data = payload as { sessionToken?: string; teacherId: number } | undefined;
    return removeTeacherPhoto({
      sessionToken: data?.sessionToken,
      teacherId: Number(data?.teacherId),
    });
  });

  // ─── 9. Attendance Management ────────────────────────────────────────────
  ipcMain.handle('attendance:getEnrolledStudents', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, students: [], isRecorded: false, error: 'Invalid parameters.' };
    }
    const data = payload as {
      academicSessionId: number;
      classId: number;
      sectionId: number;
      attendanceDate: string;
    };
    return getEnrolledStudentsForAttendance(data);
  });

  ipcMain.handle('attendance:save', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, savedCount: 0, error: 'Invalid attendance payload.' };
    }
    return saveAttendance(payload as Parameters<typeof saveAttendance>[0]);
  });

  ipcMain.handle('attendance:getDailySummary', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid parameters.' };
    }
    const data = payload as {
      academicSessionId: number;
      classId: number;
      sectionId: number;
      attendanceDate: string;
    };
    return getDailyAttendanceSummary(data);
  });

  ipcMain.handle('attendance:getHistory', (_event, payload: unknown) => {
    const params = (payload as Parameters<typeof getAttendanceHistory>[0]) || {};
    return getAttendanceHistory(params);
  });

  ipcMain.handle('attendance:getStudentHistory', (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        history: [],
        stats: {
          studentId: 0,
          totalDaysRecorded: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          leaveCount: 0,
          attendancePercentage: null,
        },
        error: 'Invalid student parameters.',
      };
    }
    return getStudentAttendanceHistory(payload as Parameters<typeof getStudentAttendanceHistory>[0]);
  });

  // ─── 10. Fees & Fee Slips Handlers ───────────────────────────────────────
  ipcMain.handle('fees:getTypes', () => {
    return getAllFeeTypes(true);
  });

  ipcMain.handle('fees:createType', (_event, payload: unknown) => {
    return createFeeType(payload as Parameters<typeof createFeeType>[0]);
  });

  ipcMain.handle('fees:updateType', (_event, payload: unknown) => {
    return updateFeeType(payload as Parameters<typeof updateFeeType>[0]);
  });

  ipcMain.handle('fees:toggleTypeStatus', (_event, payload: unknown) => {
    const data = payload as { sessionToken: string; id: number; isActive: boolean };
    return toggleFeeTypeStatus(data);
  });

  ipcMain.handle('fees:getStructures', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getFeeStructures>[0];
    return getFeeStructures(params);
  });

  ipcMain.handle('fees:createStructure', (_event, payload: unknown) => {
    return createFeeStructure(payload as Parameters<typeof createFeeStructure>[0]);
  });

  ipcMain.handle('fees:updateStructure', (_event, payload: unknown) => {
    return updateFeeStructure(payload as Parameters<typeof updateFeeStructure>[0]);
  });

  ipcMain.handle('fees:toggleStructureStatus', (_event, payload: unknown) => {
    const data = payload as { sessionToken: string; id: number; isActive: boolean };
    return toggleFeeStructureStatus(data);
  });

  ipcMain.handle('fees:getPeriods', (_event, payload: unknown) => {
    const params = payload as { academicSessionId?: number } | undefined;
    return getFeePeriods(params?.academicSessionId);
  });

  ipcMain.handle('fees:createPeriod', (_event, payload: unknown) => {
    return createFeePeriod(payload as Parameters<typeof createFeePeriod>[0]);
  });

  ipcMain.handle('fees:updatePeriod', (_event, payload: unknown) => {
    return updateFeePeriod(payload as Parameters<typeof updateFeePeriod>[0]);
  });

  ipcMain.handle('fees:getStudentAdjustments', (_event, payload: unknown) => {
    const data = payload as { studentId: number };
    return getStudentFeeAdjustments(data.studentId);
  });

  ipcMain.handle('fees:createStudentAdjustment', (_event, payload: unknown) => {
    return createStudentFeeAdjustment(payload as Parameters<typeof createStudentFeeAdjustment>[0]);
  });

  ipcMain.handle('fees:generateFees', (_event, payload: unknown) => {
    return generateFeesForClass(payload as Parameters<typeof generateFeesForClass>[0]);
  });

  ipcMain.handle('fees:getRecords', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getFeeRecords>[0];
    return getFeeRecords(params);
  });

  ipcMain.handle('fees:getRecordById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    const res = getFeeRecords({ limit: 1 }, undefined);
    const database = getDatabasePath(); // Ensure init
    const db = initDatabase();
    const row = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(data.id);
    if (!row) return { success: false, error: 'Fee record not found.' };
    const single = getFeeRecords(undefined, db).records.find((r) => r.id === data.id);
    return { success: true, record: single };
  });

  ipcMain.handle('fees:getDues', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getFeeDues>[0];
    return getFeeDues(params);
  });

  ipcMain.handle('fees:recordPayment', (_event, payload: unknown) => {
    return recordFeePayment(payload as Parameters<typeof recordFeePayment>[0]);
  });

  ipcMain.handle('fees:getPaymentById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    return getFeePaymentById(data.id);
  });

  ipcMain.handle('fees:getReceiptByNumber', (_event, payload: unknown) => {
    const data = payload as { receiptNumber: string };
    return getReceiptByNumber(data.receiptNumber);
  });

  ipcMain.handle('fees:searchPayments', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof searchPaymentHistory>[0];
    return searchPaymentHistory(params);
  });

  ipcMain.handle('fees:getStudentFeeSummary', (_event, payload: unknown) => {
    const data = payload as { studentId: number };
    return getStudentFeeProfile(data.studentId);
  });

  // ─── 11. Examinations, Marks, Results & DMC ───────────────────────────────
  ipcMain.handle('exams:getTypes', () => {
    try {
      const types = getAllExamTypes();
      return { success: true, types };
    } catch (err) {
      console.error('[IPC exams:getTypes error]', err);
      return { success: false, error: 'Failed to retrieve exam types.' };
    }
  });

  ipcMain.handle('exams:createType', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof createExamType>[0];
    return createExamType(data);
  });

  ipcMain.handle('exams:updateType', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof updateExamType>[0];
    return updateExamType(data);
  });

  ipcMain.handle('exams:toggleTypeStatus', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof toggleExamTypeStatus>[0];
    return toggleExamTypeStatus(data);
  });

  ipcMain.handle('exams:getAll', (_event, payload: unknown) => {
    try {
      const params = payload as Parameters<typeof getAllExaminations>[0];
      const examinations = getAllExaminations(params);
      return { success: true, examinations };
    } catch (err) {
      console.error('[IPC exams:getAll error]', err);
      return { success: false, error: 'Failed to retrieve examinations.' };
    }
  });

  ipcMain.handle('exams:getById', (_event, payload: unknown) => {
    const data = payload as { id: number };
    const examination = getExaminationById(data.id);
    return { success: true, examination: examination ?? undefined };
  });

  ipcMain.handle('exams:create', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof createExamination>[0];
    return createExamination(data);
  });

  ipcMain.handle('exams:update', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof updateExamination>[0];
    return updateExamination(data);
  });

  ipcMain.handle('exams:updateStatus', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof updateExaminationStatus>[0];
    return updateExaminationStatus(data);
  });

  ipcMain.handle('exams:delete', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof deleteExamination>[0];
    return deleteExamination(data);
  });

  ipcMain.handle('exams:getSubjects', (_event, payload: unknown) => {
    try {
      const params = payload as Parameters<typeof getExaminationSubjects>[0];
      const subjects = getExaminationSubjects(params);
      return { success: true, subjects };
    } catch (err) {
      console.error('[IPC exams:getSubjects error]', err);
      return { success: false, error: 'Failed to retrieve examination subjects.' };
    }
  });

  ipcMain.handle('exams:configureSubjects', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof configureExaminationSubjects>[0];
    return configureExaminationSubjects(data);
  });

  ipcMain.handle('exams:updateSubjectMarks', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof updateExaminationSubjectMarks>[0];
    return updateExaminationSubjectMarks(data);
  });

  ipcMain.handle('exams:getGradingRules', () => {
    try {
      const rules = getAllGradingRules();
      return { success: true, rules };
    } catch (err) {
      console.error('[IPC exams:getGradingRules error]', err);
      return { success: false, error: 'Failed to retrieve grading rules.' };
    }
  });

  ipcMain.handle('exams:saveGradingRule', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof saveGradingRule>[0];
    return saveGradingRule(data);
  });

  ipcMain.handle('exams:deleteGradingRule', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof deleteGradingRule>[0];
    return deleteGradingRule(data);
  });

  ipcMain.handle('exams:getStudentsForMarksEntry', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getStudentsForMarksEntry>[0];
    return getStudentsForMarksEntry(params);
  });

  ipcMain.handle('exams:saveMarks', (_event, payload: unknown) => {
    const data = payload as Parameters<typeof saveMarks>[0];
    return saveMarks(data);
  });

  ipcMain.handle('exams:calculateStudentResult', (_event, payload: unknown) => {
    const data = payload as { examinationId: number; studentId: number };
    return calculateStudentExamResult(data.examinationId, data.studentId);
  });

  ipcMain.handle('exams:getClassResults', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getClassExamResults>[0];
    return getClassExamResults(params);
  });

  ipcMain.handle('exams:generateStudentDMC', (_event, payload: unknown) => {
    const data = payload as { examinationId: number; studentId: number; classId?: number; targetClassId?: number };
    return generateStudentDMC(data.examinationId, data.studentId, undefined, data.classId || data.targetClassId);
  });

  ipcMain.handle('exams:generateClassDMC', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof generateClassDMC>[0];
    return generateClassDMC(params);
  });

  // ─── 12. Dashboard Live Metrics ──────────────────────────────────────────
  ipcMain.handle('dashboard:getSummary', () => {
    try {
      const summary = getDashboardSummary();
      return { success: true, summary };
    } catch (err) {
      console.error('[IPC dashboard:getSummary error]', err);
      return { success: false, error: 'Failed to compute dashboard metrics.' };
    }
  });

  // ─── 13. Student Documents ───────────────────────────────────────────────
  ipcMain.handle('documents:generateNextNumber', () => {
    try {
      const num = generateNextDocumentNumber();
      return { success: true, documentNumber: num };
    } catch (err) {
      console.error('[IPC documents:generateNextNumber error]', err);
      return { success: false, error: 'Failed to generate document number.' };
    }
  });

  ipcMain.handle('documents:getPreview', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getStudentDocumentPreview>[0];
    return getStudentDocumentPreview(params);
  });

  ipcMain.handle('documents:issue', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof issueStudentDocument>[0];
    return issueStudentDocument(params);
  });

  ipcMain.handle('documents:getHistory', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getDocumentHistory>[0];
    return getDocumentHistory(params);
  });

  ipcMain.handle('documents:getById', (_event, payload: unknown) => {
    const id = Number(payload);
    const doc = getDocumentById(id);
    return { success: !!doc, document: doc ?? undefined };
  });

  // ─── 14. Student Promotion & Academic History ─────────────────────────────
  ipcMain.handle('promotions:getCandidates', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getPromotionCandidates>[0];
    return getPromotionCandidates(params);
  });

  ipcMain.handle('promotions:execute', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof executePromotion>[0];
    return executePromotion(params);
  });

  ipcMain.handle('promotions:getAcademicHistory', (_event, payload: unknown) => {
    const studentId = Number(payload);
    return getStudentAcademicHistory(studentId);
  });

  ipcMain.handle('promotions:getLogs', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getPromotionLogs>[0];
    return getPromotionLogs(params);
  });

  // ─── 15. Reports ──────────────────────────────────────────────────────────
  ipcMain.handle('reports:getStudentList', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getStudentListReport>[0];
    return getStudentListReport(params);
  });

  ipcMain.handle('reports:getAttendance', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getAttendanceReport>[0];
    return getAttendanceReport(params);
  });

  ipcMain.handle('reports:getFeeCollection', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getFeeCollectionReport>[0];
    return getFeeCollectionReport(params);
  });

  ipcMain.handle('reports:getFeeOutstanding', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getFeeOutstandingReport>[0];
    return getFeeOutstandingReport(params);
  });

  ipcMain.handle('reports:getExamMarks', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getExamMarksReport>[0];
    return getExamMarksReport(params);
  });

  ipcMain.handle('reports:getClassResults', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getClassResultsReport>[0];
    return getClassResultsReport(params);
  });

  ipcMain.handle('reports:getClassStrength', (_event, payload: unknown) => {
    const academicSessionId = payload ? Number(payload) : undefined;
    return getClassStrengthReport(academicSessionId);
  });

  ipcMain.handle('reports:getTeacher', (_event, payload: unknown) => {
    const params = payload as Parameters<typeof getTeacherReport>[0];
    return getTeacherReport(params);
  });

  // ─── 16. Offline Native PDF Export ─────────────────────────────────────────
  ipcMain.handle('app:exportPDF', async (_event, payload: unknown) => {
    try {
      const options = (payload || {}) as { defaultFileName?: string };
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (!win) {
        return { success: false, error: 'No active window available for export.' };
      }

      const rawName = options.defaultFileName || 'Document.pdf';
      const safeName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      let defaultDir: string;
      try {
        defaultDir = app.getPath('documents');
      } catch {
        try {
          defaultDir = app.getPath('userData');
        } catch {
          defaultDir = process.cwd();
        }
      }

      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Export to PDF',
        defaultPath: path.join(defaultDir, safeName),
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
      });

      fs.writeFileSync(filePath, pdfBuffer);
      console.log(`[app:exportPDF] PDF successfully saved to: ${filePath}`);
      return { success: true, filePath };
    } catch (err: unknown) {
      console.error('[IPC app:exportPDF error]', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to export PDF.' };
    }
  });

  // ─── 14. Backup & Restore ────────────────────────────────────────────────
  ipcMain.handle('backup:create', async (_event, customPath?: string) => {
    return await createBackup({ customDestinationPath: customPath });
  });

  ipcMain.handle('backup:validate', (_event, filePath: string) => {
    return validateBackup(filePath);
  });

  ipcMain.handle('backup:restore', async (_event, filePath: string) => {
    return await restoreBackup(filePath);
  });

  ipcMain.handle('backup:list', () => {
    return { success: true, backups: listBackups() };
  });

  ipcMain.handle('backup:chooseFolder', async () => {
    if (!mainWindow) return { success: false, error: 'No active window.' };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Destination Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    return { success: true, folderPath: res.filePaths[0] };
  });

  ipcMain.handle('backup:chooseFile', async () => {
    if (!mainWindow) return { success: false, error: 'No active window.' };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select .smbak Backup File',
      filters: [{ name: 'School Backup (*.smbak)', extensions: ['smbak'] }],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    return { success: true, filePath: res.filePaths[0] };
  });

  ipcMain.handle('backup:getLastBackup', () => {
    return { success: true, info: getLastBackupInfo() };
  });

  ipcMain.handle('backup:showInFolder', (_event, filePath: unknown) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Valid file path is required.' };
    }
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(path.resolve(filePath));
        return { success: true };
      }
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        shell.openPath(path.resolve(dir));
        return { success: true };
      }
      return { success: false, error: 'Specified file or folder path does not exist on disk.' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to show file in folder.' };
    }
  });

  ipcMain.handle('backup:openFolder', async (_event, folderPath: unknown) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return { success: false, error: 'Valid folder path is required.' };
    }
    try {
      if (fs.existsSync(folderPath)) {
        const error = await shell.openPath(path.resolve(folderPath));
        if (error) {
          return { success: false, error };
        }
        return { success: true };
      }
      return { success: false, error: 'Specified destination folder does not exist on disk.' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to open folder.' };
    }
  });

  // ─── 15. Offline Licensing ───────────────────────────────────────────────
  ipcMain.handle('license:getStatus', () => {
    return { success: true, statusInfo: getLicenseStatus() };
  });

  ipcMain.handle('license:getInstallationId', () => {
    const identity = getInstallationIdentity();
    return { success: true, installationId: identity.installationId };
  });

  ipcMain.handle('license:activate', (_event, licenseToken: string) => {
    return activateLicense(licenseToken);
  });

  ipcMain.handle('license:importFile', async () => {
    if (!mainWindow) return { success: false, error: 'No active window.' };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select License File (*.lic, *.txt)',
      filters: [
        { name: 'License File (*.lic, *.txt)', extensions: ['lic', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    try {
      const fileContent = fs.readFileSync(res.filePaths[0], 'utf8');
      return activateLicense(fileContent.trim());
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to read license file.' };
    }
  });

  ipcMain.handle('license:exportFile', async (_event, licenseToken: string) => {
    if (!mainWindow) return { success: false, error: 'No active window.' };
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save License File',
      defaultPath: 'school_license.lic',
      filters: [{ name: 'License File (*.lic)', extensions: ['lic'] }],
    });
    if (res.canceled || !res.filePath) {
      return { success: false, canceled: true };
    }
    try {
      fs.writeFileSync(res.filePath, licenseToken, 'utf8');
      return { success: true, filePath: res.filePath };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save license file.' };
    }
  });

  // ─── 16. Super Admin / Seller Portal ──────────────────────────────────────
  ipcMain.handle('superAdmin:isSetupRequired', () => {
    return { success: true, isSetupRequired: isSuperAdminSetupRequired() };
  });

  ipcMain.handle('superAdmin:setup', (_event, payload: { username?: string; password?: string; displayName?: string }) => {
    return createSuperAdminAccount({
      username: payload.username || '',
      password: payload.password || '',
      displayName: payload.displayName || '',
    });
  });

  ipcMain.handle('superAdmin:login', (_event, payload: { username?: string; password?: string }) => {
    return loginSuperAdmin({
      username: payload.username || '',
      password: payload.password || '',
    });
  });

  ipcMain.handle('superAdmin:logout', (_event, token: string) => {
    logoutSuperAdmin(token);
    return { success: true };
  });

  ipcMain.handle('superAdmin:verifySession', (_event, token: string) => {
    const session = verifySuperAdminSession(token);
    return {
      success: !!session,
      superAdmin: session
        ? { id: session.id, username: session.username, displayName: session.displayName }
        : undefined,
    };
  });

  ipcMain.handle('superAdmin:generateLicense', (_event, params: any) => {
    return generateLicense(params);
  });

  ipcMain.handle('superAdmin:getGeneratedLicenses', (_event, params: any) => {
    return getGeneratedLicenses(params);
  });

  ipcMain.handle('superAdmin:getDashboardStats', () => {
    return getSuperAdminDashboardStats();
  });
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  try {
    app.name = APP_NAME;
    ensureUserDataMigrated();
    const db = initDatabase();
    runMigrations(db);
    console.log('[App] SQLite database initialized and ready.');
  } catch (err) {
    console.error('[App] Fatal error initializing database:', err);
  }

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  clearAllSessions();
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (IS_DEV && parsedUrl.hostname === 'localhost') return;
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
