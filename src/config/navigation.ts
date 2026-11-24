/**
 * Navigation configuration — defines all sidebar items
 * 
 * `implemented: false` means the module is a placeholder.
 * This will be updated as each module is built in later phases.
 */

import type { NavItem } from '../types/navigation';

export const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: 'LayoutDashboard',
    implemented: true,
    description: 'Overview and quick access to all modules',
  },
  {
    id: 'students',
    label: 'Students',
    path: '/students',
    icon: 'Users',
    implemented: true,
    description: 'Student registration, records, and management',
  },
  {
    id: 'classes',
    label: 'Classes & Subjects',
    path: '/classes',
    icon: 'BookOpen',
    implemented: true,
    description: 'Class sections, subjects, and curriculum structure',
  },
  {
    id: 'teachers',
    label: 'Teachers',
    path: '/teachers',
    icon: 'GraduationCap',
    implemented: true,
    description: 'Teacher profiles, assignments, and management',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/attendance',
    icon: 'ClipboardCheck',
    implemented: true,
    description: 'Daily attendance tracking and reports',
  },
  {
    id: 'fees',
    label: 'Fees',
    path: '/fees',
    icon: 'Receipt',
    implemented: true,
    description: 'Fee structure, collection, and payment tracking',
  },
  {
    id: 'results',
    label: 'Results',
    path: '/results',
    icon: 'BarChart3',
    implemented: true,
    description: 'Examination marks, grading, and result sheets',
  },
  {
    id: 'dmc',
    label: 'DMC',
    path: '/dmc',
    icon: 'FileText',
    implemented: true,
    description: 'Detailed Marks Certificate generation',
  },
  {
    id: 'id-cards',
    label: 'ID Cards',
    path: '/id-cards',
    icon: 'IdCard',
    implemented: true,
    description: 'Student ID card generation and batch printing',
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: 'FolderOpen',
    implemented: true,
    description: 'Document templates and certificate management',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'PieChart',
    implemented: true,
    description: 'Analytics, statistics, and printable reports',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    path: '/backup',
    icon: 'HardDrive',
    implemented: true,
    description: 'Database backup, restore, and data safety',
  },
  {
    id: 'license',
    label: 'License & Activation',
    path: '/license',
    icon: 'ShieldCheck',
    implemented: true,
    description: 'Offline license status, installation binding, and activation',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    implemented: true,
    description: 'School profile, academic sessions, and system configuration',
  },
];
