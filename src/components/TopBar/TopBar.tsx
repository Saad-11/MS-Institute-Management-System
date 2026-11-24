/**
 * TopBar Component — Polished Modern Desktop Application Top Bar
 * 
 * Includes:
 * - Page Title + Breadcrumbs
 * - Database Connection Status Indicator (● SQLite Database Active)
 * - School Selector / Profile badge
 * - Logged-in Administrator Profile
 * - Clear Logout button
 */

import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { User, LogOut, ChevronRight, Database } from 'lucide-react';
import { navigationItems } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { InstitutionLogo } from '../Common/InstitutionLogo';
import '../../styles/topbar.css';

export const TopBar: React.FC = () => {
  const location = useLocation();
  const { user, schoolSettings, logout } = useAuth();

  // Find the current page title from navigation config
  const currentNav = navigationItems.find((item) => item.path === location.pathname);
  const pageTitle = currentNav?.label ?? (location.pathname === '/' ? 'Dashboard' : 'School Management');
  const schoolName = schoolSettings?.schoolName || 'My School';

  return (
    <header className="topbar">
      {/* ─── Left: Title & Breadcrumbs ─────────────────────────────────── */}
      <div className="topbar-left">
        <div>
          <div className="topbar-breadcrumb">
            <Link to="/" className="topbar-breadcrumb-item">Home</Link>
            {location.pathname !== '/' && (
              <>
                <ChevronRight size={12} className="topbar-breadcrumb-sep" />
                <span className="topbar-breadcrumb-current">{pageTitle}</span>
              </>
            )}
          </div>
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>
      </div>

      {/* ─── Right: Status, School, User Profile, Logout ──────────────── */}
      <div className="topbar-right">
        {/* Database Status Indicator */}
        <div className="topbar-status status-ready" title="Local SQLite Database Connected">
          <span className="topbar-status-dot" />
          <Database size={12} className="topbar-status-icon" />
          <span>SQLite Database Active</span>
        </div>

        {/* School Name Badge */}
        <Link to="/settings" className="topbar-school-name" title="School Settings & Profile">
          <InstitutionLogo size={20} schoolName={schoolName} />
          <span>{schoolName}</span>
        </Link>

        {/* User Profile Badge */}
        {user && (
          <div className="topbar-user-badge" title={`Signed in as ${user.displayName} (${user.role})`}>
            <div className="topbar-user-avatar">
              <User size={13} />
            </div>
            <span className="topbar-user-name">{user.displayName}</span>
          </div>
        )}

        {/* Logout Button */}
        <button
          className="topbar-logout-btn"
          onClick={logout}
          title="Sign Out"
          aria-label="Sign out of administration"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
