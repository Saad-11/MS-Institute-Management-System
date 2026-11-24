/**
 * Academic Structure / Classes & Subjects Page
 * 
 * Top-level container managing:
 * 1. Classes & Sections
 * 2. Subjects
 * 3. Class-Subject Assignments
 */

import React, { useState } from 'react';
import { Layers, BookOpen, GitMerge } from 'lucide-react';
import { ClassesTab } from './ClassesTab';
import { SubjectsTab } from './SubjectsTab';
import { ClassSubjectsTab } from './ClassSubjectsTab';
import '../../styles/shared-modules.css';

export const ClassesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'classes' | 'subjects' | 'assignments'>('classes');

  return (
    <div className="module-page-container">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="module-header">
        <div className="module-header-title">
          <h2>Academic Structure: Classes & Subjects</h2>
          <p>
            Configure institutional grade levels, sections, curriculum subjects, and subject-class mappings.
          </p>
        </div>
      </div>

      {/* ─── Tabs Navigation ─────────────────────────────────────────────── */}
      <div className="module-tabs">
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          <Layers size={16} />
          Classes & Sections
        </button>
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'subjects' ? 'active' : ''}`}
          onClick={() => setActiveTab('subjects')}
        >
          <BookOpen size={16} />
          Subjects
        </button>
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          <GitMerge size={16} />
          Class-Subject Assignment
        </button>
      </div>

      {/* ─── Active Tab Content ──────────────────────────────────────────── */}
      {activeTab === 'classes' && <ClassesTab />}
      {activeTab === 'subjects' && <SubjectsTab />}
      {activeTab === 'assignments' && <ClassSubjectsTab />}
    </div>
  );
};
