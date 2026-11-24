import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  Copy,
  Check,
  Download,
  Lock,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import type { SuperAdminLicenseRecordItem } from '../../types/electron';

export const SuperAdminPage: React.FC = () => {
  // Authentication & session
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('sa_session_token'));
  const [superAdminUser, setSuperAdminUser] = useState<{ id: number; username: string; displayName: string } | null>(null);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Setup / Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');

  // Dashboard Stats
  const [stats, setStats] = useState<{
    totalLicensesGenerated: number;
    activeLicensesCount: number;
    expiredLicensesCount: number;
    licenseTypeDistribution: Record<string, number>;
  } | null>(null);

  // Licenses records list
  const [licenses, setLicenses] = useState<SuperAdminLicenseRecordItem[]>([]);

  // Generator form
  const [customerName, setCustomerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [licenseType, setLicenseType] = useState<'Trial' | 'Monthly' | 'Annual' | 'Perpetual'>('Annual');
  const [edition, setEdition] = useState<'Standard' | 'Professional' | 'Enterprise'>('Enterprise');
  const [installationBinding, setInstallationBinding] = useState('');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState(365);
  const [gracePeriodDays, setGracePeriodDays] = useState(14);
  const [maxStudents, setMaxStudents] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>(50000);
  const [currency, setCurrency] = useState('PKR');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending' | 'Waived'>('Paid');
  const [notes, setNotes] = useState('');

  // Generated Result
  const [generatedResult, setGeneratedResult] = useState<{
    licenseId: string;
    signedToken: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [generatorMessage, setGeneratorMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      const setupRes = await window.electronAPI.superAdmin.isSetupRequired();
      if (setupRes.success && setupRes.isSetupRequired) {
        setIsSetupRequired(true);
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('sa_session_token');
      if (token) {
        const verifyRes = await window.electronAPI.superAdmin.verifySession(token);
        if (verifyRes.success && verifyRes.superAdmin) {
          setSessionToken(token);
          setSuperAdminUser(verifyRes.superAdmin);
          await loadDashboardData();
        } else {
          localStorage.removeItem('sa_session_token');
          setSessionToken(null);
          setSuperAdminUser(null);
        }
      }
    } catch {
      setAuthError('Error communicating with Super Admin service.');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      if (!window.electronAPI) return;
      const [statsRes, listRes] = await Promise.all([
        window.electronAPI.superAdmin.getDashboardStats(),
        window.electronAPI.superAdmin.getGeneratedLicenses(),
      ]);
      if (statsRes.success) {
        setStats(statsRes);
      }
      if (listRes.success) {
        setLicenses(listRes.records);
      }
    } catch {
      // Ignore background errors
    }
  };

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Username and password are required.');
      return;
    }
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.superAdmin.setup({
        username: usernameInput.trim(),
        password: passwordInput.trim(),
        displayName: displayNameInput.trim() || 'Super Administrator',
      });
      if (res.success) {
        setIsSetupRequired(false);
        // Automatically login
        await handleLogin(e);
      } else {
        setAuthError(res.error || 'Failed to setup Super Admin account.');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unknown error during setup.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.superAdmin.login({
        username: usernameInput.trim(),
        password: passwordInput.trim(),
      });
      if (res.success && res.token && res.superAdmin) {
        localStorage.setItem('sa_session_token', res.token);
        setSessionToken(res.token);
        setSuperAdminUser(res.superAdmin);
        setUsernameInput('');
        setPasswordInput('');
        await loadDashboardData();
      } else {
        setAuthError(res.error || 'Invalid Super Admin credentials.');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unknown error during login.');
    }
  };

  const handleLogout = async () => {
    if (sessionToken && window.electronAPI) {
      await window.electronAPI.superAdmin.logout(sessionToken);
    }
    localStorage.removeItem('sa_session_token');
    setSessionToken(null);
    setSuperAdminUser(null);
  };

  const handleTypeChange = (type: 'Trial' | 'Monthly' | 'Annual' | 'Perpetual') => {
    setLicenseType(type);
    if (type === 'Trial') {
      setDurationDays(14);
      setGracePeriodDays(7);
      setPrice(0);
      setPaymentStatus('Waived');
    } else if (type === 'Monthly') {
      setDurationDays(30);
      setGracePeriodDays(5);
      setPrice(5000);
      setPaymentStatus('Paid');
    } else if (type === 'Annual') {
      setDurationDays(365);
      setGracePeriodDays(14);
      setPrice(50000);
      setPaymentStatus('Paid');
    } else if (type === 'Perpetual') {
      setDurationDays(3650);
      setGracePeriodDays(30);
      setPrice(150000);
      setPaymentStatus('Paid');
    }
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !installationBinding.trim()) {
      setGeneratorMessage({ type: 'error', text: 'Customer / School Name and Installation ID are required.' });
      return;
    }
    try {
      setGenerating(true);
      setGeneratorMessage(null);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.superAdmin.generateLicense({
        customerName: customerName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        licenseType,
        edition,
        installationBinding: installationBinding.trim(),
        startsAt,
        durationDays,
        gracePeriodDays,
        maxStudents: maxStudents ? Number(maxStudents) : undefined,
        price: price ? Number(price) : undefined,
        currency,
        paymentStatus,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.licenseId && res.signedToken) {
        setGeneratedResult({
          licenseId: res.licenseId,
          signedToken: res.signedToken,
        });
        setGeneratorMessage({
          type: 'success',
          text: `License successfully generated and signed with vendor Ed25519 key! License ID: ${res.licenseId}`,
        });
        await loadDashboardData();
      } else {
        setGeneratorMessage({
          type: 'error',
          text: res.error || 'Failed to generate signed license.',
        });
      }
    } catch (err: unknown) {
      setGeneratorMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown generation error.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyGeneratedToken = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.signedToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleExportLicFile = async () => {
    if (!generatedResult) return;
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.license.exportFile(generatedResult.signedToken);
      if (res.success && res.filePath) {
        setGeneratorMessage({ type: 'success', text: `Saved license file to: ${res.filePath}` });
      }
    } catch {
      setGeneratorMessage({ type: 'error', text: 'Failed to export .lic file.' });
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
        <div>Authenticating Vendor Portal...</div>
      </div>
    );
  }

  // Setup Screen
  if (isSetupRequired) {
    return (
      <div style={{ maxWidth: '440px', margin: '4rem auto', padding: '2rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', marginBottom: '0.75rem' }}>
            <Shield size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Super Admin Portal Setup
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Create master vendor credentials for issuing offline licenses.
          </p>
        </div>

        {authError && (
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleFirstTimeSetup}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Display Name</label>
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g. Master Software Vendor"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Username</label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. superadmin"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Master Password</label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Strong password"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            style={{ width: '100%', padding: '0.625rem', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Initialize Vendor Super Admin
          </button>
        </form>
      </div>
    );
  }

  // Login Screen
  if (!sessionToken || !superAdminUser) {
    return (
      <div style={{ maxWidth: '440px', margin: '4rem auto', padding: '2rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', marginBottom: '0.75rem' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Super Admin Vendor Access
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Strictly isolated seller/developer portal for offline licensing.
          </p>
        </div>

        {authError && (
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Username</label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Username"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Password</label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            style={{ width: '100%', padding: '0.625rem', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign In to Vendor Console
          </button>
        </form>
      </div>
    );
  }

  // Authenticated Portal
  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={24} style={{ color: '#2563EB' }} />
            Vendor Licensing Console
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Logged in as <strong>{superAdminUser.displayName}</strong> ({superAdminUser.username})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={loadDashboardData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Issued</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>{stats.totalLicensesGenerated}</div>
          </div>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Active Licenses</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16A34A', marginTop: '0.25rem' }}>{stats.activeLicensesCount}</div>
          </div>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Expired</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626', marginTop: '0.25rem' }}>{stats.expiredLicensesCount}</div>
          </div>
        </div>
      )}

      {/* License Generator Form */}
      <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
          Generate Cryptographic Ed25519 Offline License
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Digitally signs license parameters with the vendor private key. Only usable on the specified hardware Installation ID.
        </p>

        {generatorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: generatorMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: generatorMessage.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${generatorMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            }}
          >
            {generatorMessage.text}
          </div>
        )}

        <form onSubmit={handleGenerateLicense}>
          {/* Quick License Type Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>Preset License Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['Trial', 'Monthly', 'Annual', 'Perpetual'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--color-border)',
                    backgroundColor: licenseType === t ? '#2563EB' : 'var(--color-bg-app)',
                    color: licenseType === t ? '#FFFFFF' : 'var(--color-text-primary)',
                    fontWeight: licenseType === t ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Customer / School Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Army Public School & College"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Client Hardware Installation ID *</label>
              <input
                type="text"
                required
                value={installationBinding}
                onChange={(e) => setInstallationBinding(e.target.value)}
                placeholder="e.g. INST-ABCD-1234-EF56"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Edition</label>
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value as 'Standard' | 'Professional' | 'Enterprise')}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              >
                <option value="Standard">Standard Edition</option>
                <option value="Professional">Professional Edition</option>
                <option value="Enterprise">Enterprise Edition</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Start Date</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Duration (Days)</label>
              <input
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sale Price & Currency</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Price"
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ width: '70px', padding: '0.5rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Principal / Accountant"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +92 300 1234567"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. principal@school.edu"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Student Capacity Limit</label>
              <input
                type="number"
                value={maxStudents}
                onChange={(e) => setMaxStudents(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Leave blank for unlimited"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Internal License Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or invoice reference"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={generating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.5rem',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <KeyRound size={16} />
            {generating ? 'Signing with Vendor Key...' : 'Sign & Generate Offline License'}
          </button>
        </form>

        {/* Generated Token Result Box */}
        {generatedResult && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '0.375rem', border: '1px solid #CBD5E1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.875rem' }}>
                Generated License Token ({generatedResult.licenseId})
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCopyGeneratedToken}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {copiedToken ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                  {copiedToken ? 'Copied' : 'Copy Token'}
                </button>
                <button
                  type="button"
                  onClick={handleExportLicFile}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <Download size={12} />
                  Export .lic
                </button>
              </div>
            </div>
            <textarea
              readOnly
              rows={3}
              value={generatedResult.signedToken}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                backgroundColor: '#FFFFFF',
                borderRadius: '0.25rem',
                border: '1px solid #CBD5E1',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </div>

      {/* Issued Licenses Registry */}
      <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Issued Licenses Registry
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {licenses.length} registered
          </span>
        </div>

        {licenses.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            No licenses issued yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>License ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Type / Edition</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Binding</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Validity</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Price</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => (
                  <tr key={lic.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#2563EB', fontFamily: 'monospace' }}>
                      {lic.licenseId}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                      {lic.customerName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {lic.licenseType} ({lic.edition})
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                      {lic.installationBinding.substring(0, 14)}...
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {lic.startsAt} to {lic.expiresAt}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {lic.price ? `${lic.currency || 'PKR'} ${lic.price.toLocaleString()}` : 'Free'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)' }}>
                      {new Date(lic.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
