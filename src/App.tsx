/**
 * Root Application Component
 * 
 * Manages top-level ErrorBoundary, AuthProvider, and conditional screen rendering:
 * 1. Initializing state -> Clean loading indicator
 * 2. Database has no admin -> SetupScreen (First-run wizard)
 * 3. Unauthenticated -> LoginScreen
 * 4. Authenticated -> MainLayout with HashRouter
 */

import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout/MainLayout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { StudentsPage } from './pages/Students/StudentsPage';
import { ClassesPage } from './pages/Classes/ClassesPage';
import { TeachersPage } from './pages/Teachers/TeachersPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { FeesPage } from './pages/Fees/FeesPage';
import { ResultsPage } from './pages/Results/ResultsPage';
import { DMCPage } from './pages/DMC/DMCPage';
import { IDCardsPage } from './pages/IDCards/IDCardsPage';
import { DocumentsPage } from './pages/Documents/DocumentsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { BackupPage } from './pages/Backup/BackupPage';
import { LicensePage } from './pages/License/LicensePage';
import { SuperAdminPage } from './pages/SuperAdmin/SuperAdminPage';
import { ToastProvider } from './context/ToastContext';
import { SetupScreen } from './pages/Auth/SetupScreen';
import { LoginScreen } from './pages/Auth/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

const AppNavigator: React.FC = () => {
  const { user, isSetupRequired, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--color-bg-app)',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family)',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--color-neutral-200)',
          borderTopColor: 'var(--color-primary-600)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem',
        }} />
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
          Loading MS Institute Management System...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 1. First-run: no administrator account exists in the local database
  if (isSetupRequired) {
    return <SetupScreen />;
  }

  // 2. Unauthenticated: prompt for administrator credentials
  if (!user) {
    return <LoginScreen />;
  }

  // 3. Authenticated: render desktop layout and navigation
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/dmc" element={<DMCPage />} />
          <Route path="/id-cards" element={<IDCardsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/license" element={<LicensePage />} />
          <Route path="/super-admin" element={<SuperAdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
