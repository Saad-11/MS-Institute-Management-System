import React, { useState, useEffect } from 'react';
import { CalendarCheck, History, Users, AlertCircle } from 'lucide-react';
import type { AcademicSession, ClassItem } from '../../types/electron';
import { AttendanceEntryTab } from './AttendanceEntryTab';
import { AttendanceHistoryTab } from './AttendanceHistoryTab';

export const AttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions and classes on mount
  useEffect(() => {
    const loadPrerequisites = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (window.electronAPI) {
          // Load sessions and classes in parallel
          const [sessionsRes, classesRes] = await Promise.all([
            window.electronAPI.sessions?.getAll ? window.electronAPI.sessions.getAll() : Promise.resolve(null),
            window.electronAPI.classes?.getAll ? window.electronAPI.classes.getAll() : Promise.resolve(null),
          ]);

          if (sessionsRes?.success && sessionsRes.sessions) {
            setSessions(sessionsRes.sessions);
          }
          if (classesRes?.success && classesRes.classes) {
            setClasses(classesRes.classes.filter((c: ClassItem) => c.isActive));
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load initial attendance data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPrerequisites();
  }, []);

  return (
    <div className="attendance-page-container">
      {/* Institutional Top Header matching Students & Teachers */}
      <div className="attendance-header">
        <div className="attendance-header-left">
          <div className="attendance-header-icon">
            <CalendarCheck size={24} />
          </div>
          <div className="attendance-header-title">
            <h1>Attendance</h1>
            <p>Mark and manage daily student attendance and inspect attendance history records.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="attendance-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            className={`attendance-tab-btn ${activeTab === 'entry' ? 'active' : ''}`}
          >
            <Users size={15} />
            Daily Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`attendance-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History size={15} />
            Attendance History
          </button>
        </div>
      </div>

      {error && (
        <div className="attendance-alert error">
          <AlertCircle size={16} className="attendance-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="attendance-control-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="attendance-empty-icon" style={{ margin: '0 auto 12px' }}>
            <CalendarCheck size={24} />
          </div>
          <div className="attendance-empty-title">Loading Attendance System...</div>
          <div className="attendance-empty-subtitle">Retrieving academic sessions and class structure...</div>
        </div>
      ) : (
        <>
          {activeTab === 'entry' && (
            <AttendanceEntryTab sessions={sessions} classes={classes} />
          )}

          {activeTab === 'history' && (
            <AttendanceHistoryTab sessions={sessions} classes={classes} />
          )}
        </>
      )}
    </div>
  );
};
