import React, { useState, useEffect } from 'react';
import {
  Receipt,
  LayoutDashboard,
  CreditCard,
  AlertCircle,
  History,
  Tag,
  Layers,
  Calendar,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import type {
  AcademicSession,
  ClassItem,
  FeeTypeItem,
  FeePeriodItem,
  DashboardSummary,
  SchoolSettings,
  FeeRecordItem,
} from '../../types/electron';
import { FeeDashboardTab } from './FeeDashboardTab';
import { FeeCollectTab } from './FeeCollectTab';
import { FeeDuesTab } from './FeeDuesTab';
import { PaymentHistoryTab } from './PaymentHistoryTab';
import { FeeTypesTab } from './FeeTypesTab';
import { FeeStructuresTab } from './FeeStructuresTab';
import { FeePeriodsTab } from './FeePeriodsTab';
import { FeeGenerationTab } from './FeeGenerationTab';

type FeeTabKey =
  | 'dashboard'
  | 'collect'
  | 'dues'
  | 'history'
  | 'generate'
  | 'structures'
  | 'types'
  | 'periods';

export const FeesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeeTabKey>('dashboard');

  // Shared application states
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
  const [periods, setPeriods] = useState<FeePeriodItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        // Parallelize initial fee data loading
        const [sRes, cRes, tRes, pRes, dRes, setRes] = await Promise.all([
          window.electronAPI.sessions ? window.electronAPI.sessions.getAll() : Promise.resolve(null),
          window.electronAPI.classes ? window.electronAPI.classes.getAll() : Promise.resolve(null),
          window.electronAPI.fees ? window.electronAPI.fees.getTypes() : Promise.resolve(null),
          window.electronAPI.fees ? window.electronAPI.fees.getPeriods() : Promise.resolve(null),
          window.electronAPI.dashboard ? window.electronAPI.dashboard.getSummary() : Promise.resolve(null),
          window.electronAPI.school ? window.electronAPI.school.getSettings() : Promise.resolve(null),
        ]);

        if (sRes?.success && sRes.sessions) setSessions(sRes.sessions);
        if (cRes?.success && cRes.classes) setClasses(cRes.classes.filter((c: ClassItem) => c.isActive));
        if (tRes?.success && tRes.types) setFeeTypes(tRes.types);
        if (pRes?.success && pRes.periods) setPeriods(pRes.periods);
        if (dRes?.success && dRes.summary) setSummary(dRes.summary);
        if (setRes?.success && setRes.settings) {
          setSchoolSettings({
            ...setRes.settings,
            logoDataUrl: setRes.logoDataUrl || setRes.settings.logoDataUrl || null,
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load initial fee data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePayRecordFromDues = (_record: FeeRecordItem) => {
    setActiveTab('collect');
  };

  return (
    <div className="fees-page-container">
      {/* Top Header matching Students, Teachers & Attendance */}
      <div className="fees-header">
        <div className="fees-header-left">
          <div className="fees-header-icon">
            <Receipt size={24} />
          </div>
          <div className="fees-header-title">
            <h1>Fees</h1>
            <p>Manage student fees, payments, dues and fee records.</p>
          </div>
        </div>

        <div className="fees-header-actions">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="btn-fees-secondary"
            style={{ height: '36px', fontSize: '11px' }}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', color: '#991b1b', fontSize: '12px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Tab Navigation */}
      <div className="fees-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`fees-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard size={14} />
          Dashboard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collect')}
          className={`fees-tab-btn ${activeTab === 'collect' ? 'active' : ''}`}
        >
          <CreditCard size={14} />
          Record Payment
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dues')}
          className={`fees-tab-btn ${activeTab === 'dues' ? 'active' : ''}`}
        >
          <AlertCircle size={14} />
          Fee Dues
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`fees-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          <History size={14} />
          Payment History
        </button>

        <div style={{ width: '1px', background: 'var(--color-neutral-300)', margin: '4px 2px' }} />

        <button
          type="button"
          onClick={() => setActiveTab('generate')}
          className={`fees-tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
        >
          <PlayCircle size={14} />
          Generate Fees
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('structures')}
          className={`fees-tab-btn ${activeTab === 'structures' ? 'active' : ''}`}
        >
          <Layers size={14} />
          Fee Structures
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('types')}
          className={`fees-tab-btn ${activeTab === 'types' ? 'active' : ''}`}
        >
          <Tag size={14} />
          Fee Types
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('periods')}
          className={`fees-tab-btn ${activeTab === 'periods' ? 'active' : ''}`}
        >
          <Calendar size={14} />
          Billing Periods
        </button>
      </div>

      {/* Main Tab Content */}
      {isLoading ? (
        <div className="fees-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="fees-empty-icon" style={{ margin: '0 auto 12px' }}>
            <Receipt size={24} />
          </div>
          <div className="fees-empty-title">Loading Fee System...</div>
          <div className="fees-empty-subtitle">Retrieving financial records, fee structures and billing periods...</div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <FeeDashboardTab
              summary={summary}
              onNavigateTab={(tab) => {
                if (tab === 'collect') setActiveTab('collect');
                else if (tab === 'dues') setActiveTab('dues');
                else if (tab === 'generate') setActiveTab('generate');
                else if (tab === 'history') setActiveTab('history');
                else if (tab === 'structures') setActiveTab('structures');
              }}
            />
          )}

          {activeTab === 'collect' && (
            <FeeCollectTab schoolSettings={schoolSettings} />
          )}

          {activeTab === 'dues' && (
            <FeeDuesTab
              sessions={sessions}
              classes={classes}
              periods={periods}
              onPayRecord={handlePayRecordFromDues}
            />
          )}

          {activeTab === 'history' && (
            <PaymentHistoryTab schoolSettings={schoolSettings} />
          )}

          {activeTab === 'generate' && (
            <FeeGenerationTab
              sessions={sessions}
              classes={classes}
              periods={periods}
              onFeeGenerated={loadData}
              onRefreshPeriods={loadData}
            />
          )}

          {activeTab === 'structures' && (
            <FeeStructuresTab sessions={sessions} classes={classes} feeTypes={feeTypes} />
          )}

          {activeTab === 'types' && (
            <FeeTypesTab />
          )}

          {activeTab === 'periods' && (
            <FeePeriodsTab sessions={sessions} onRefreshPeriods={loadData} />
          )}
        </>
      )}
    </div>
  );
};
