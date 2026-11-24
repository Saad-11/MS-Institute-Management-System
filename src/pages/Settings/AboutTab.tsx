/**
 * About Software Tab
 *
 * Displays application identity, dynamically loaded version,
 * and verified developer contact information for MS Institute Management System.
 * Fully offline – zero external CDN, fonts, or network APIs.
 */

import React, { useState, useEffect } from 'react';
import {
  Code2,
  Mail,
  Phone,
  Info,
  Heart,
  Shield,
  Cpu,
} from 'lucide-react';
import './AboutTab.css';

const DEVELOPER = {
  name: 'Muhammad Saad',
  designation: 'Software Developer',
  initials: 'MS',
  phone: '03159928851',
  email: 'ms.muhammadsaad1999@gamil.com',
};

const APP = {
  name: 'MS Institute Management System',
  description: 'A complete offline solution for modern educational institutions.',
  year: new Date().getFullYear(),
};

export const AboutTab: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>('1.0.0');

  useEffect(() => {
    let isMounted = true;
    if (window.electronAPI?.getAppInfo) {
      window.electronAPI
        .getAppInfo()
        .then((info) => {
          if (isMounted && info?.version) {
            setAppVersion(info.version);
          }
        })
        .catch(() => {
          // Fall back gracefully to default initial version if IPC is unreachable
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="about-tab">
      {/* ── 1. Software Information Header ──────────────────────────────── */}
      <div className="about-header-card">
        <div className="about-header-left">
          <div className="about-header-icon">
            <Cpu size={26} strokeWidth={1.8} />
          </div>
          <div className="about-header-text">
            <div className="about-title-row">
              <h3 className="about-app-name">{APP.name}</h3>
              <span className="about-version-badge">v{appVersion}</span>
            </div>
            <p className="about-app-description">{APP.description}</p>
          </div>
        </div>

        <div className="about-header-right">
          <span className="about-edition-badge">
            <span className="about-edition-dot"></span>
            Offline Desktop Edition
          </span>
        </div>
      </div>

      {/* ── 2. Developer Information Card ───────────────────────────────── */}
      <div className="about-card">
        <div className="about-card-header">
          <Code2 size={16} className="about-header-svg" />
          <h4 className="about-card-title">Developer Information</h4>
        </div>

        <div className="about-developer-body">
          {/* Developer identity row */}
          <div className="about-dev-profile">
            <div className="about-dev-avatar" aria-label={DEVELOPER.name}>
              {DEVELOPER.initials}
            </div>
            <div className="about-dev-meta">
              <h5 className="about-dev-name">{DEVELOPER.name}</h5>
              <span className="about-dev-designation">{DEVELOPER.designation}</span>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="about-contact-grid">
            {/* Mobile Contact */}
            <div className="about-contact-card">
              <div className="about-contact-icon about-contact-icon--phone">
                <Phone size={16} />
              </div>
              <div className="about-contact-info">
                <span className="about-contact-label">Mobile</span>
                <span className="about-contact-val">{DEVELOPER.phone}</span>
              </div>
            </div>

            {/* Email Contact (Single, corrected email) */}
            <div className="about-contact-card">
              <div className="about-contact-icon about-contact-icon--email">
                <Mail size={16} />
              </div>
              <div className="about-contact-info">
                <span className="about-contact-label">Email</span>
                <span className="about-contact-val">{DEVELOPER.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Software Notes Card ──────────────────────────────────────── */}
      <div className="about-card">
        <div className="about-card-header">
          <Info size={16} className="about-header-svg" />
          <h4 className="about-card-title">Software Notes</h4>
        </div>

        <div className="about-notes-body">
          <div className="about-notes-grid">
            <div className="about-note-item">
              <div className="about-note-icon about-note-icon--shield">
                <Shield size={16} />
              </div>
              <div className="about-note-content">
                <span className="about-note-title">100% Local Data Storage</span>
                <p className="about-note-text">
                  All data is stored locally — no internet connection required.
                </p>
              </div>
            </div>

            <div className="about-note-item">
              <div className="about-note-icon about-note-icon--heart">
                <Heart size={16} />
              </div>
              <div className="about-note-content">
                <span className="about-note-title">User-Centric Design</span>
                <p className="about-note-text">
                  Designed for ease of use by school administrators and staff.
                </p>
              </div>
            </div>

            <div className="about-note-item">
              <div className="about-note-icon about-note-icon--code">
                <Code2 size={16} />
              </div>
              <div className="about-note-content">
                <span className="about-note-title">Dedicated Support</span>
                <p className="about-note-text">
                  For support or customisation requests, contact the developer above.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Clean Footer Strip ────────────────────────────────────────── */}
      <div className="about-footer">
        <span>
          © {APP.year} {APP.name} — Developed with <span className="about-heart">♥</span> by{' '}
          {DEVELOPER.name}
        </span>
      </div>
    </div>
  );
};
