/**
 * Sidebar Component — Redesigned Commercial Desktop Navigation
 * 
 * Dark navy sidebar, school branding, aligned modern icons,
 * subtle hover states, active blue rounded highlight, and user profile footer.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
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
  ShieldCheck,
  Settings,
  IdCard,
  type LucideIcon,
  User,
} from 'lucide-react';
import { navigationItems } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { InstitutionLogo } from '../Common/InstitutionLogo';
import '../../styles/sidebar.css';

// Map icon names (strings) to actual Lucide components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
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
  ShieldCheck,
  Settings,
  IdCard,
};

export function Sidebar() {
  const { user, schoolSettings } = useAuth();
  const schoolName = schoolSettings?.schoolName || 'MS Institute Management';

  return (
    <aside className="sidebar">
      {/* ─── Logo / Brand ─────────────────────────────────────────────────── */}
      <div className="sidebar-header">
        <InstitutionLogo size={38} schoolName={schoolName} />
        <div className="sidebar-logo-text">
          <h2>{schoolName}</h2>
          <span>Administration Portal</span>
        </div>
      </div>

      {/* ─── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sidebar-nav">
        <ul className="sidebar-nav-list">
          {navigationItems.map((item) => {
            const IconComponent = iconMap[item.icon] || BookOpen;
            return (
              <li key={item.id} className="sidebar-nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-nav-link${isActive ? ' active' : ''}`
                  }
                  end={item.path === '/'}
                >
                  <IconComponent size={18} className="sidebar-icon" />
                  <span className="sidebar-label">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ─── Profile / Footer ─────────────────────────────────────────────── */}
      <div className="sidebar-footer">
        {user ? (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              <User size={16} />
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={user.displayName}>
                {user.displayName}
              </div>
              <div className="sidebar-user-role">{user.role || 'Administrator'}</div>
            </div>
          </div>
        ) : (
          <div className="sidebar-footer-text">
            <strong>MS Institute Management System</strong>
            <span>Desktop Edition v1.0</span>
          </div>
        )}
      </div>
    </aside>
  );
}
