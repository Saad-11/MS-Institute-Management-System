/**
 * First-Run Administrator Account Setup Screen
 * 
 * Displayed when no administrator account exists in the local SQLite database.
 * Prompts the user to securely create the initial administrative credentials.
 */

import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Info, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/auth.css';

export const SetupScreen: React.FC = () => {
  const { createInitialAdmin } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    const cleanName = displayName.trim();
    const cleanUsername = username.trim();

    if (!cleanName) {
      setError('Please enter your full name or display name.');
      return;
    }

    if (!cleanUsername) {
      setError('Please enter a username.');
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long for administrator security.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createInitialAdmin({
        displayName: cleanName,
        username: cleanUsername,
        password,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create administrator account.');
      }
    } catch (err) {
      setError('An unexpected error occurred during setup.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <ShieldCheck size={28} />
          </div>
          <h1 className="auth-title">Administrator Setup</h1>
          <p className="auth-subtitle">
            Create the primary administrator account for your offline school system.
          </p>
        </div>

        {/* ─── Info Banner ─────────────────────────────────────────────────── */}
        <div className="auth-alert-info">
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>
            This account is stored strictly on this computer. No internet connection is needed.
          </span>
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
            <label className="auth-label" htmlFor="displayName">
              Full Name / Display Name
            </label>
            <input
              id="displayName"
              type="text"
              className="auth-input"
              placeholder="e.g. Principal John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="auth-input"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="password">
              Password (minimum 12 characters)
            </label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-with-toggle"
                placeholder="Enter a secure password"
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
            <span className="auth-hint">Must contain at least 12 characters.</span>
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="auth-input auth-input-with-toggle"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            <Lock size={18} />
            {isSubmitting ? 'Creating Administrator...' : 'Create Account & Continue'}
          </button>
        </form>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="auth-footer">
          <span className="auth-badge-offline">
            🔒 Local SQLite Database • 100% Offline
          </span>
        </div>
      </div>
    </div>
  );
};
