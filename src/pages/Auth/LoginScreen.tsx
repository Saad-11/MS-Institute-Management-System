/**
 * Administrator Login Screen
 * 
 * Secure, clean login interface for local administrators.
 * Prevents account enumeration by displaying unified error messages on failure.
 */

import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/auth.css';

export const LoginScreen: React.FC = () => {
  const { login, schoolSettings } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please enter your username.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login(cleanUsername, password);
      if (!res.success) {
        setError(res.error || 'Username or password is incorrect.');
      }
    } catch (err) {
      setError('An unexpected error occurred during login.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const schoolTitle = schoolSettings?.schoolName || 'MS Institute Management System';

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <InstitutionLogo size={52} schoolName={schoolTitle} framed />
          </div>
          <h1 className="auth-title">{schoolTitle}</h1>
          <p className="auth-subtitle">Administrator Portal • Sign in to continue</p>
        </div>

        {/* ─── Error Alert ─────────────────────────────────────────────────── */}
        {error && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* ─── Form ────────────────────────────────────────────────────────── */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field-group">
            <label className="auth-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              className="auth-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="login-password">
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-with-toggle"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            <LogIn size={18} />
            {isSubmitting ? 'Verifying...' : 'Sign In'}
          </button>

          {window.location.protocol.startsWith('http') && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('AdminPassword123!');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary-600)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Auto-fill Demo Credentials (admin / AdminPassword123!)
              </button>
            </div>
          )}
        </form>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="auth-footer">
          <span className="auth-badge-offline">
            {window.location.protocol.startsWith('http')
              ? '🌐 Browser Preview Mode (localhost:5173)'
              : '🔒 Local Application • Offline Session'}
          </span>
        </div>
      </div>
    </div>
  );
};
