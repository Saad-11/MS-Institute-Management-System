import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import type { LicenseStatusInfo } from '../../types/electron';

export const LicensePage: React.FC = () => {
  const [installationId, setInstallationId] = useState<string>('');
  const [statusInfo, setStatusInfo] = useState<LicenseStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [licenseTokenInput, setLicenseTokenInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadLicenseData();
  }, []);

  const loadLicenseData = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      const [instRes, statusRes] = await Promise.all([
        window.electronAPI.license.getInstallationId(),
        window.electronAPI.license.getStatus(),
      ]);

      if (instRes.success) {
        setInstallationId(instRes.installationId);
      }
      if (statusRes.success) {
        setStatusInfo(statusRes.statusInfo);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to retrieve licensing status.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInstallationId = () => {
    if (!installationId) return;
    navigator.clipboard.writeText(installationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivateToken = async () => {
    if (!licenseTokenInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter or paste a valid license code.' });
      return;
    }
    try {
      setActivating(true);
      setMessage(null);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.license.activate(licenseTokenInput.trim());
      if (res.success && res.statusInfo) {
        setStatusInfo(res.statusInfo);
        setLicenseTokenInput('');
        setMessage({
          type: 'success',
          text: `License successfully activated! License Status: ${res.statusInfo.status}`,
        });
      } else {
        setMessage({
          type: 'error',
          text: res.error || 'Failed to activate license. Verify signature and machine binding.',
        });
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown activation error.',
      });
    } finally {
      setActivating(false);
    }
  };

  const handleImportLicenseFile = async () => {
    try {
      setLoading(true);
      setMessage(null);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.license.importFile();
      if (res.success && res.statusInfo) {
        setStatusInfo(res.statusInfo);
        setMessage({
          type: 'success',
          text: `License file imported and verified! License Status: ${res.statusInfo.status}`,
        });
      } else if (!res.canceled) {
        setMessage({
          type: 'error',
          text: res.error || 'Failed to import license file.',
        });
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error reading license file.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Active':
        return { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', label: 'Active & Licensed' };
      case 'Grace Period':
        return { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', label: 'In Grace Period' };
      case 'Expired':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'License Expired' };
      case 'Wrong Installation':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Machine Mismatch' };
      case 'Tampered':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Cryptographic Signature Invalid' };
      case 'Clock Tampered':
        return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'System Clock Tampered' };
      default:
        return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', label: 'Unlicensed / Trial Needed' };
    }
  };

  const badge = getStatusBadge(statusInfo?.status);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            License & Machine Activation
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Manage offline cryptographic Ed25519 licensing and machine hardware binding.
          </p>
        </div>
        <button
          onClick={loadLicenseData}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      {/* Global Status Message */}
      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            backgroundColor:
              message.type === 'success' ? '#ECFDF5' : message.type === 'error' ? '#FEF2F2' : '#EFF6FF',
            color:
              message.type === 'success' ? '#065F46' : message.type === 'error' ? '#991B1B' : '#1E40AF',
            border: `1px solid ${
              message.type === 'success' ? '#A7F3D0' : message.type === 'error' ? '#FECACA' : '#BFDBFE'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : message.type === 'error' ? (
            <AlertTriangle size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* License Status Card */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: statusInfo?.isValid ? '#ECFDF5' : '#FEF2F2',
                color: statusInfo?.isValid ? '#059669' : '#DC2626',
              }}
            >
              {statusInfo?.isValid ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {statusInfo?.customerName ? statusInfo.customerName : 'Unlicensed Installation'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                {statusInfo?.edition || 'Standard Edition'} — {statusInfo?.licenseType || 'Trial / Evaluation'}
              </div>
            </div>
          </div>

          <span
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: badge.bg,
              color: badge.text,
              border: `1px solid ${badge.border}`,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* License Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--color-bg-app)', borderRadius: '0.375rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Days Remaining
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: statusInfo?.daysRemaining && statusInfo.daysRemaining < 15 ? '#DC2626' : 'var(--color-text-primary)', marginTop: '0.25rem' }}>
              {statusInfo?.daysRemaining !== undefined && statusInfo.daysRemaining !== null
                ? `${statusInfo.daysRemaining} Days`
                : '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Expiry Date
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
              {statusInfo?.expiresAt ? statusInfo.expiresAt : 'No active license'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Grace Period
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
              {statusInfo?.gracePeriodDays ? `${statusInfo.gracePeriodDays} Days` : '0 Days'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Student Capacity
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
              {statusInfo?.maxStudents ? `${statusInfo.maxStudents} Students` : 'Unlimited'}
            </div>
          </div>
        </div>

        {statusInfo?.details && (
          <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <strong>System Telemetry:</strong> {statusInfo.details}
          </div>
        )}
      </div>

      {/* Machine / Installation Fingerprint */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Cpu size={18} style={{ color: 'var(--color-primary-600, #2563EB)' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Machine Hardware Binding ID
          </h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Give this unique Installation ID to your software provider / Super Admin to generate an offline cryptographic license key for this specific machine.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            readOnly
            value={installationId}
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '1rem',
              fontWeight: 700,
              padding: '0.625rem 0.875rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-app)',
              color: 'var(--color-primary-600, #2563EB)',
              letterSpacing: '0.05em',
            }}
          />
          <button
            onClick={handleCopyInstallationId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.625rem 1rem',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {copied ? <Check size={16} color="#16A34A" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy ID'}
          </button>
        </div>
      </div>

      {/* Activate License Section */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Lock size={18} style={{ color: 'var(--color-primary-600, #2563EB)' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Enter or Import License Key
          </h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Paste the base64-encoded signed license token provided by the seller, or load a <code style={{ backgroundColor: '#F1F5F9', padding: '1px 4px', borderRadius: '2px' }}>.lic</code> file.
        </p>

        <textarea
          rows={3}
          placeholder="Paste signed offline license token here (e.g. eyJsaWNlbnNlSWQiOi...)"
          value={licenseTokenInput}
          onChange={(e) => setLicenseTokenInput(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-app)',
            color: 'var(--color-text-primary)',
            boxSizing: 'border-box',
            marginBottom: '1rem',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleImportLicenseFile}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              <Upload size={16} />
              Import .lic File...
            </button>
          </div>

          <button
            onClick={handleActivateToken}
            disabled={activating || !licenseTokenInput.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.5rem',
              backgroundColor: 'var(--color-primary-600, #2563EB)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: activating || !licenseTokenInput.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <ShieldCheck size={16} className={activating ? 'animate-spin' : ''} />
            {activating ? 'Verifying Signature...' : 'Activate License'}
          </button>
        </div>
      </div>

      {/* Data Safety Notice */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '0.375rem',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E40AF',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
        }}
      >
        <strong>Data Safety Guarantee:</strong> License expiration never deletes or corrupts student, financial, exam, or academic records. All existing records remain stored safely on your machine.
      </div>
    </div>
  );
};
