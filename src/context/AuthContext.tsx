/**
 * Authentication & School Settings React Context
 * 
 * Provides global state for user authentication, current session,
 * first-run setup detection, and school profile metadata.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SafeUser, SchoolSettings } from '../types/electron';

interface AuthContextType {
  user: SafeUser | null;
  sessionToken: string | null;
  isSetupRequired: boolean;
  isLoading: boolean;
  schoolSettings: SchoolSettings | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  createInitialAdmin: (data: {
    username: string;
    displayName: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSchoolSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'sms_active_session_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);

  const refreshSchoolSettings = useCallback(async () => {
    try {
      if (window.electronAPI?.school) {
        const res = await window.electronAPI.school.getSettings();
        if (res.success && res.settings) {
          const logoDataUrl = res.logoDataUrl || res.settings.logoDataUrl || null;
          const signatureDataUrl = res.signatureDataUrl || res.settings.signatureDataUrl || null;
          setSchoolSettings({
            ...res.settings,
            logoDataUrl,
            signatureDataUrl,
          });
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to load school settings:', err);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.auth) {
        const savedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);

        // Fetch setup status, school settings, and current session concurrently in parallel
        const [setupRes, settingsRes, userRes] = await Promise.all([
          window.electronAPI.auth.getSetupStatus(),
          window.electronAPI.school ? window.electronAPI.school.getSettings() : Promise.resolve(null),
          savedToken && window.electronAPI.auth.getCurrentUser
            ? window.electronAPI.auth.getCurrentUser(savedToken)
            : Promise.resolve(null),
        ]);

        if (setupRes.success && setupRes.isSetupRequired) {
          setIsSetupRequired(true);
          setUser(null);
          setSessionToken(null);
          setIsLoading(false);
          return;
        }

        setIsSetupRequired(false);

        if (settingsRes?.success && settingsRes.settings) {
          const logoDataUrl = settingsRes.logoDataUrl || settingsRes.settings.logoDataUrl || null;
          const signatureDataUrl = settingsRes.signatureDataUrl || settingsRes.settings.signatureDataUrl || null;
          setSchoolSettings({
            ...settingsRes.settings,
            logoDataUrl,
            signatureDataUrl,
          });
        }

        if (userRes?.success && userRes.user && savedToken) {
          setUser(userRes.user);
          setSessionToken(savedToken);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setUser(null);
          setSessionToken(null);
        }
      } else {
        // In browser mock / dev fallback
        setIsSetupRequired(false);
      }
    } catch (err) {
      console.error('[AuthContext] Initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleLogin = async (username: string, password: string) => {
    if (!window.electronAPI?.auth) {
      return { success: false, error: 'Electron API is not available.' };
    }

    try {
      const res = await window.electronAPI.auth.login({ username, password });
      if (res.success && res.sessionToken && res.user) {
        setUser(res.user);
        setSessionToken(res.sessionToken);
        sessionStorage.setItem(SESSION_STORAGE_KEY, res.sessionToken);
        await refreshSchoolSettings();
        return { success: true };
      }
      return { success: false, error: res.error || 'Invalid credentials.' };
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: 'An unexpected error occurred during login.' };
    }
  };

  const handleCreateInitialAdmin = async (data: {
    username: string;
    displayName: string;
    password: string;
  }) => {
    if (!window.electronAPI?.auth) {
      return { success: false, error: 'Electron API is not available.' };
    }

    try {
      const res = await window.electronAPI.auth.createInitialAdmin(data);
      if (res.success) {
        setIsSetupRequired(false);
        // Automatically log in the newly created administrator
        const loginRes = await handleLogin(data.username, data.password);
        return loginRes;
      }
      return { success: false, error: res.error || 'Failed to create administrator account.' };
    } catch (err) {
      console.error('[AuthContext] Initial admin creation error:', err);
      return { success: false, error: 'An unexpected error occurred.' };
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken && window.electronAPI?.auth) {
        await window.electronAPI.auth.logout(sessionToken);
      }
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    } finally {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      setSessionToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isSetupRequired,
        isLoading,
        schoolSettings,
        login: handleLogin,
        createInitialAdmin: handleCreateInitialAdmin,
        logout: handleLogout,
        refreshSchoolSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
