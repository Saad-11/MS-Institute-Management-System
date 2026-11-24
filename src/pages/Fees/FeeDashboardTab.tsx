import React from 'react';
import {
  FileText,
  DollarSign,
  AlertCircle,
  Clock,
  PlusCircle,
  Search,
  Receipt,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { DashboardSummary } from '../../types/electron';
import { formatMoney } from '../../utils/money';

interface FeeDashboardTabProps {
  summary: DashboardSummary | null;
  onNavigateTab: (tab: 'collect' | 'dues' | 'generate' | 'history' | 'structures') => void;
}

export const FeeDashboardTab: React.FC<FeeDashboardTabProps> = ({ summary, onNavigateTab }) => {
  const billed = summary?.totalFeesBilled || 0;
  const collected = summary?.totalFeesCollected || 0;
  const outstanding = summary?.totalFeesOutstanding || 0;
  const todayColl = summary?.todayCollection || 0;

  const collectionRate = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* 4 Metric Summary Cards */}
      <div className="fees-stats-grid">
        {/* Total Billed */}
        <div className="fees-stat-card">
          <div className="fees-stat-info">
            <span className="fees-stat-label">Total Invoiced</span>
            <span className="fees-stat-value">{formatMoney(billed)}</span>
            <span className="fees-stat-sub">Charged this session</span>
          </div>
          <div className="fees-stat-icon-wrap fees-stat-icon-blue">
            <FileText size={22} />
          </div>
        </div>

        {/* Total Collected */}
        <div className="fees-stat-card">
          <div className="fees-stat-info">
            <span className="fees-stat-label" style={{ color: '#059669' }}>Total Collected</span>
            <span className="fees-stat-value" style={{ color: '#059669' }}>{formatMoney(collected)}</span>
            <span className="fees-stat-sub" style={{ color: '#059669', fontWeight: '600' }}>
              {collectionRate}% recovery rate
            </span>
          </div>
          <div className="fees-stat-icon-wrap fees-stat-icon-green">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="fees-stat-card">
          <div className="fees-stat-info">
            <span className="fees-stat-label" style={{ color: '#d97706' }}>Pending Dues</span>
            <span className="fees-stat-value" style={{ color: '#d97706' }}>{formatMoney(outstanding)}</span>
            <span className="fees-stat-sub">Unpaid fee balances</span>
          </div>
          <div className="fees-stat-icon-wrap fees-stat-icon-amber">
            <AlertCircle size={22} />
          </div>
        </div>

        {/* Today's Collection */}
        <div className="fees-stat-card">
          <div className="fees-stat-info">
            <span className="fees-stat-label" style={{ color: '#7c3aed' }}>Today's Collection</span>
            <span className="fees-stat-value" style={{ color: '#7c3aed' }}>{formatMoney(todayColl)}</span>
            <span className="fees-stat-sub">Received today</span>
          </div>
          <div className="fees-stat-icon-wrap fees-stat-icon-purple">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Receipt size={18} />
            <span>Frequent Fee Actions</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-neutral-400)' }}>
            1-Click shortcuts for office staff
          </span>
        </div>

        <div className="fees-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Record Payment */}
            <div
              onClick={() => onNavigateTab('collect')}
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-neutral-200)',
                background: '#fafbfc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary-500)';
                e.currentTarget.style.background = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-neutral-200)';
                e.currentTarget.style.background = '#fafbfc';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlusCircle size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-900)' }}>Record Payment</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>Search student & enter payment</div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--color-neutral-400)" />
            </div>

            {/* Check Fee Dues */}
            <div
              onClick={() => onNavigateTab('dues')}
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-neutral-200)',
                background: '#fafbfc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary-500)';
                e.currentTarget.style.background = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-neutral-200)';
                e.currentTarget.style.background = '#fafbfc';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-900)' }}>Fee Dues & Defaulters</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>Filter outstanding dues by class</div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--color-neutral-400)" />
            </div>

            {/* Payment History */}
            <div
              onClick={() => onNavigateTab('history')}
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-neutral-200)',
                background: '#fafbfc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary-500)';
                e.currentTarget.style.background = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-neutral-200)';
                e.currentTarget.style.background = '#fafbfc';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-900)' }}>Payment History & Receipts</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>Lookup and reprint past fee slips</div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--color-neutral-400)" />
            </div>

            {/* Fee Structures */}
            <div
              onClick={() => onNavigateTab('structures')}
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-neutral-200)',
                background: '#fafbfc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary-500)';
                e.currentTarget.style.background = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-neutral-200)';
                e.currentTarget.style.background = '#fafbfc';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: '#faf5ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-900)' }}>Fee Structure Setup</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>Configure fees per class & session</div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--color-neutral-400)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
