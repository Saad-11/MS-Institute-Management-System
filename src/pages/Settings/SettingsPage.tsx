/**
 * Settings Page
 *
 * Houses School Profile Settings, Academic Sessions, and About Software tabs.
 */

import React, { useState } from 'react';
import { Building2, Calendar, Info } from 'lucide-react';
import { SchoolSettingsTab } from './SchoolSettingsTab';
import { AcademicSessionsTab } from './AcademicSessionsTab';
import { AboutTab } from './AboutTab';
import '../../styles/shared-modules.css';

type TabKey = 'profile' | 'sessions' | 'about';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  return (
    <div className="module-page-container">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="module-header">
        <div className="module-header-title">
          <h2>School Configuration &amp; Settings</h2>
          <p>Configure institutional profile, official contact details, branding, and academic sessions.</p>
        </div>
      </div>

      {/* ─── Tabs Navigation ─────────────────────────────────────────────── */}
      <div className="module-tabs">
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Building2 size={16} />
          School Profile &amp; Branding
        </button>
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <Calendar size={16} />
          Academic Sessions
        </button>
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <Info size={16} />
          About Software
        </button>
      </div>

      {/* ─── Active Tab Content ──────────────────────────────────────────── */}
      {activeTab === 'profile' && <SchoolSettingsTab />}
      {activeTab === 'sessions' && <AcademicSessionsTab />}
      {activeTab === 'about' && <AboutTab />}
    </div>
  );
};
