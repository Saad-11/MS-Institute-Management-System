/**
 * Dashboard Page
 * 
 * Main landing overview for authenticated school administrators.
 * Displays welcome banner, module quick access, quick actions,
 * and live system/database diagnostics.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import {
  Users,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Receipt,
  BarChart3,
  FileText,
  FolderOpen,
  PieChart,
  HardDrive,
  Settings,
  Monitor,
  Database as DbIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { AppInfo, SystemInfo, DashboardSummary } from '../../types/electron';
import { Layers, BookMarked, LucideIcon } from 'lucide-react';
import '../../styles/dashboard.css';

interface ModuleCardConfig {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  path: string;
  isImplemented: boolean;
  phaseLabel: string;
}

const moduleCards: ModuleCardConfig[] = [
  { id: 'settings', label: 'School Settings', desc: 'Profile, logo & sessions', icon: Settings, color: 'blue', path: '/settings', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'classes', label: 'Classes & Subjects', desc: 'Sections & curriculum', icon: BookOpen, color: 'purple', path: '/classes', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'students', label: 'Students', desc: 'Registration & records', icon: Users, color: 'blue', path: '/students', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'teachers', label: 'Teachers', desc: 'Staff management', icon: GraduationCap, color: 'teal', path: '/teachers', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'attendance', label: 'Attendance', desc: 'Daily tracking', icon: ClipboardCheck, color: 'green', path: '/attendance', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'fees', label: 'Fees', desc: 'Collection & tracking', icon: Receipt, color: 'amber', path: '/fees', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'results', label: 'Results', desc: 'Marks & grading', icon: BarChart3, color: 'blue', path: '/results', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'dmc', label: 'DMC', desc: 'Marks certificates', icon: FileText, color: 'purple', path: '/dmc', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'documents', label: 'Documents', desc: 'Templates & certificates', icon: FolderOpen, color: 'teal', path: '/documents', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'reports', label: 'Reports', desc: 'Analytics & printing', icon: PieChart, color: 'amber', path: '/reports', isImplemented: true, phaseLabel: 'Ready' },
  { id: 'backup', label: 'Backup & Restore', desc: 'Data safety & restore', icon: HardDrive, color: 'red', path: '/backup', isImplemented: true, phaseLabel: 'Ready' },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, schoolSettings } = useAuth();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        if (window.electronAPI) {
          const [app, sys, sumRes] = await Promise.all([
            window.electronAPI.getAppInfo(),
            window.electronAPI.getSystemInfo(),
            window.electronAPI.dashboard ? window.electronAPI.dashboard.getSummary() : Promise.resolve(null),
          ]);
          setAppInfo(app);
          setSystemInfo(sys);
          if (sumRes?.success && sumRes.summary) {
            setSummary(sumRes.summary);
          }
        }
      } catch (err) {
        console.warn('Could not load dashboard info:', err);
      }
    }
    loadInfo();
  }, []);

  const schoolName = summary?.schoolName || schoolSettings?.schoolName || 'MS Institute Management System';
  const schoolType = summary?.schoolType || schoolSettings?.schoolType || 'School';
  const adminName = user?.displayName || 'Administrator';
  const activeSession = summary?.activeSession || schoolSettings?.academicSession || 'Not Configured';

  return (
    <div className="dashboard">
      {/* ─── Welcome Banner ───────────────────────────────────────────────── */}
      <section className="dashboard-welcome" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1>Welcome, {adminName}!</h1>
          <p>
            Managing <strong>{schoolName}</strong> ({schoolType}) for Session <strong>{activeSession}</strong> completely offline. All institutional records and
            settings are stored securely on this computer.
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <InstitutionLogo size={60} schoolName={schoolName} framed />
        </div>
      </section>

      {/* ─── Live Academic Metrics ─────────────────────────────────────────── */}
      <section>
        <h2 className="dashboard-section-title">Institutional Overview</h2>
        <div className="dashboard-stats-grid">
          <div className="stat-card" onClick={() => navigate('/students')} role="button" tabIndex={0}>
            <div className="stat-card-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Users size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">
                {summary?.activeStudentsCount ?? 0}
              </span>
              <span className="stat-card-label">Active Students</span>
              <span className="stat-card-sub">Enrolled & registered</span>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/teachers')} role="button" tabIndex={0}>
            <div className="stat-card-icon-wrapper" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <GraduationCap size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">
                {summary?.activeTeachersCount ?? 0}
              </span>
              <span className="stat-card-label">Active Teachers</span>
              <span className="stat-card-sub">Faculty members</span>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/classes')} role="button" tabIndex={0}>
            <div className="stat-card-icon-wrapper" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <Layers size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">
                {summary?.activeClassesCount ?? 0}
              </span>
              <span className="stat-card-label">Active Classes</span>
              <span className="stat-card-sub">Grades & sections setup</span>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/classes')} role="button" tabIndex={0}>
            <div className="stat-card-icon-wrapper" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <BookMarked size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">
                {summary?.activeSubjectsCount ?? 0}
              </span>
              <span className="stat-card-label">Active Subjects</span>
              <span className="stat-card-sub">Curriculum subjects</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Module Cards ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="dashboard-section-title">Modules</h2>
        <div className="dashboard-modules">
          {moduleCards.map((mod) => {
            const IconComp = mod.icon;
            return (
              <div
                key={mod.id}
                className={`module-card ${!mod.isImplemented ? 'module-unavailable' : ''}`}
                onClick={() => navigate(mod.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(mod.path);
                }}
              >
                <div className={`module-card-icon icon-${mod.color}`}>
                  <IconComp size={22} />
                </div>
                <h3>{mod.label}</h3>
                <p>{mod.desc}</p>
                <span className={`module-card-badge ${mod.isImplemented ? 'badge-ready' : 'badge-upcoming'}`}>
                  {mod.phaseLabel}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <section>
        <h2 className="dashboard-section-title">Quick Actions</h2>
        <div className="dashboard-quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/students')}>
            <Users size={16} />
            New Student Admission
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/teachers')}>
            <GraduationCap size={16} />
            Register Teacher
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/classes')}>
            <Layers size={16} />
            Manage Classes & Sections
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/settings')}>
            <Settings size={16} />
            School Settings & Logo
          </button>
        </div>
      </section>

      {/* ─── System & Database Information ─────────────────────────────────── */}
      <section className="dashboard-system-info">
        <h2 className="dashboard-section-title" style={{ marginBottom: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={18} />
            System & Database Information
          </span>
        </h2>
        <div className="system-info-grid">
          <div className="system-info-item">
            <span className="system-info-label">Application</span>
            <span className="system-info-value">
              {appInfo?.name ?? 'MS Institute Management System'}
            </span>
          </div>
          <div className="system-info-item">
            <span className="system-info-label">Version</span>
            <span className="system-info-value">
              {appInfo?.version ?? '1.0.0-phase2'}
            </span>
          </div>
          <div className="system-info-item">
            <span className="system-info-label">Database Status</span>
            <span className="system-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success-600)' }}>
              <DbIcon size={14} />
              Connected (Local SQLite)
            </span>
          </div>
          <div className="system-info-item">
            <span className="system-info-label">Active Administrator</span>
            <span className="system-info-value">{adminName} ({user?.username})</span>
          </div>
          {systemInfo && (
            <>
              <div className="system-info-item">
                <span className="system-info-label">Computer</span>
                <span className="system-info-value">{systemInfo.hostname}</span>
              </div>
              <div className="system-info-item">
                <span className="system-info-label">OS Platform</span>
                <span className="system-info-value">
                  {systemInfo.osType} {systemInfo.osRelease}
                </span>
              </div>
              <div className="system-info-item">
                <span className="system-info-label">Memory</span>
                <span className="system-info-value">{systemInfo.totalMemoryGB} GB</span>
              </div>
              <div className="system-info-item">
                <span className="system-info-label">CPU Cores</span>
                <span className="system-info-value">{systemInfo.cpuCores} Cores</span>
              </div>
            </>
          )}
          {appInfo?.databasePath && (
            <div className="system-info-item" style={{ gridColumn: 'span 2' }}>
              <span className="system-info-label">Database File Location</span>
              <span className="system-info-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {appInfo.databasePath}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
