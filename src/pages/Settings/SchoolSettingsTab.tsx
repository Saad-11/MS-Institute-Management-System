/**
 * School Settings & Profile Tab
 * 
 * Manages school identity, contact information, academic session reference,
 * and logo upload/preview/removal.
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  FileSignature,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import { resizeImageToMaxDimension } from '../../utils/image';
import type { SchoolSettings } from '../../types/electron';

export const SchoolSettingsTab: React.FC = () => {
  const { sessionToken, refreshSchoolSettings } = useAuth();

  const [formData, setFormData] = useState<Partial<SchoolSettings>>({
    schoolName: '',
    schoolCode: '',
    schoolType: 'School',
    principalName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    country: 'Pakistan',
    academicSession: '',
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteLogoConfirm, setShowDeleteLogoConfirm] = useState(false);
  const [showDeleteSignatureConfirm, setShowDeleteSignatureConfirm] = useState(false);

  // Load current settings and logo preview
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        if (window.electronAPI?.school) {
          const res = await window.electronAPI.school.getSettings();
          if (res.success && res.settings) {
            setFormData(res.settings);
            const logo =
              res.logoDataUrl ||
              res.settings.logoDataUrl ||
              localStorage.getItem('sms_school_logo_data_url') ||
              null;
            if (logo) {
              setLogoPreview(logo);
            }
            const signature =
              res.signatureDataUrl ||
              res.settings.signatureDataUrl ||
              localStorage.getItem('sms_school_signature_data_url') ||
              null;
            if (signature) {
              setSignaturePreview(signature);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load school settings:', err);
        setErrorMessage('Failed to load school settings.');
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    const name = (formData.schoolName || '').trim();
    if (!name) {
      setErrorMessage('School or College Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const activeLogo =
        logoPreview ||
        formData.logoDataUrl ||
        localStorage.getItem('sms_school_logo_data_url') ||
        null;
      const activeSignature =
        signaturePreview ||
        formData.signatureDataUrl ||
        localStorage.getItem('sms_school_signature_data_url') ||
        null;
      const payload = {
        ...formData,
        logoDataUrl: activeLogo,
        signatureDataUrl: activeSignature,
      };
      const res = await window.electronAPI?.school.updateSettings(sessionToken, payload);
      if (res?.success && res.settings) {
        setFormData(res.settings);
        if (activeLogo) {
          try {
            localStorage.setItem('sms_school_logo_data_url', activeLogo);
          } catch {}
          setLogoPreview(activeLogo);
        }
        if (activeSignature) {
          try {
            localStorage.setItem('sms_school_signature_data_url', activeSignature);
          } catch {}
          setSignaturePreview(activeSignature);
        }
        setSuccessMessage('School settings saved successfully.');
        await refreshSchoolSettings();
      } else {
        setErrorMessage(res?.error || 'Failed to save school settings.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChooseLogo = async () => {
    if (!sessionToken) return;
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Create hidden file input for offline universal compatibility
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/jpg';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
          // Optimize/compress image offline to 512px max dimension (~40KB instead of 5MB)
          const dataUrl = await resizeImageToMaxDimension(file, 512);

          // Save to local dedicated storage key immediately
          try {
            localStorage.setItem('sms_school_logo_data_url', dataUrl);
          } catch {}

          // Update backend if uploadLogo is available
          if (window.electronAPI?.school?.uploadLogo) {
            await window.electronAPI.school.uploadLogo({
              sessionToken,
              base64Data: dataUrl,
              fileExtension: 'png',
            });
          }

          setLogoPreview(dataUrl);
          setFormData((prev) => ({ ...prev, logoDataUrl: dataUrl }));
          setSuccessMessage('School logo updated successfully.');
          await refreshSchoolSettings();
        } catch (err) {
          console.error('Error processing logo image:', err);
          setErrorMessage('Failed to process image file.');
        }
      };
      input.click();
    } catch (err) {
      console.error('Failed to choose logo:', err);
      setErrorMessage('Failed to upload logo.');
    }
  };

  const handleRemoveLogo = async () => {
    if (!sessionToken) return;
    try {
      try {
        localStorage.removeItem('sms_school_logo_data_url');
      } catch {}
      if (window.electronAPI?.school?.removeLogo) {
        await window.electronAPI.school.removeLogo(sessionToken);
      }
      setLogoPreview(null);
      setFormData((prev) => ({ ...prev, logoDataUrl: null }));
      setShowDeleteLogoConfirm(false);
      setSuccessMessage('School logo removed.');
      await refreshSchoolSettings();
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to remove logo.');
    }
  };

  const handleChooseSignature = async () => {
    if (!sessionToken) return;
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/jpg';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
          // Optimize/compress image offline to 512px max dimension
          const dataUrl = await resizeImageToMaxDimension(file, 512);

          try {
            localStorage.setItem('sms_school_signature_data_url', dataUrl);
          } catch {}

          if (window.electronAPI?.school?.uploadSignature) {
            await window.electronAPI.school.uploadSignature({
              sessionToken,
              base64Data: dataUrl,
              fileExtension: 'png',
            });
          }

          setSignaturePreview(dataUrl);
          setFormData((prev) => ({ ...prev, signatureDataUrl: dataUrl }));
          setSuccessMessage('Principal signature picture updated successfully.');
          await refreshSchoolSettings();
        } catch (err) {
          console.error('Error processing signature image:', err);
          setErrorMessage('Failed to process signature image file.');
        }
      };
      input.click();
    } catch (err) {
      console.error('Failed to choose signature:', err);
      setErrorMessage('Failed to upload signature.');
    }
  };

  const handleRemoveSignature = async () => {
    if (!sessionToken) return;
    try {
      try {
        localStorage.removeItem('sms_school_signature_data_url');
      } catch {}
      if (window.electronAPI?.school?.removeSignature) {
        await window.electronAPI.school.removeSignature(sessionToken);
      }
      setSignaturePreview(null);
      setFormData((prev) => ({ ...prev, signatureDataUrl: null }));
      setShowDeleteSignatureConfirm(false);
      setSuccessMessage('Principal signature picture removed.');
      await refreshSchoolSettings();
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to remove signature.');
    }
  };

  if (isLoading) {
    return (
      <div className="empty-state">
        <p>Loading school settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ─── Feedback Alerts ──────────────────────────────────────────────── */}
      {successMessage && (
        <div className="alert-box alert-success" role="alert">
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert-box alert-error" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ─── 1. School Identity ───────────────────────────────────────────── */}
      <div className="data-table-card" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={18} color="var(--color-primary-600)" />
          Institution Identity
        </h3>

        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label" htmlFor="schoolName">
              School / College Name <span className="required-star">*</span>
            </label>
            <input
              id="schoolName"
              name="schoolName"
              type="text"
              className="form-control"
              placeholder="e.g. Islamabad Model College"
              value={formData.schoolName || ''}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="schoolType">
              Institution Type
            </label>
            <select
              id="schoolType"
              name="schoolType"
              className="form-control"
              value={formData.schoolType || 'School'}
              onChange={handleChange}
            >
              <option value="School">School</option>
              <option value="College">College</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="schoolCode">
              Registration / School Code
            </label>
            <input
              id="schoolCode"
              name="schoolCode"
              type="text"
              className="form-control"
              placeholder="e.g. REG-10928"
              value={formData.schoolCode || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="principalName">
              Principal / Head of Institution
            </label>
            <input
              id="principalName"
              name="principalName"
              type="text"
              className="form-control"
              placeholder="e.g. Prof. Muhammad Tariq"
              value={formData.principalName || ''}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* ─── 2. Contact Information ───────────────────────────────────────── */}
      <div className="data-table-card" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          Contact Information
        </h3>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Official Contact Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              className="form-control"
              placeholder="e.g. +92 51 9200000"
              value={formData.phone || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Official Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="e.g. admin@school.edu.pk"
              value={formData.email || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="address">
              Street / Campus Address
            </label>
            <textarea
              id="address"
              name="address"
              className="form-control"
              placeholder="Enter full campus street address"
              value={formData.address || ''}
              onChange={handleChange}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="city">
              City
            </label>
            <input
              id="city"
              name="city"
              type="text"
              className="form-control"
              placeholder="e.g. Islamabad"
              value={formData.city || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="province">
              Province / State
            </label>
            <input
              id="province"
              name="province"
              type="text"
              className="form-control"
              placeholder="e.g. Federal / Punjab"
              value={formData.province || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="country">
              Country
            </label>
            <input
              id="country"
              name="country"
              type="text"
              className="form-control"
              placeholder="e.g. Pakistan"
              value={formData.country || 'Pakistan'}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* ─── 3. School Logo & Branding ────────────────────────────────────── */}
      <div className="data-table-card" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={18} color="var(--color-primary-600)" />
          Institution Branding & Logo
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {/* Logo Preview Frame */}
          <div style={{
            width: '120px',
            height: '120px',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: 'var(--color-neutral-50)',
            position: 'relative',
          }}>
            <InstitutionLogo
              size={88}
              src={logoPreview}
              schoolName={formData.schoolName}
            />
          </div>

          {/* Logo Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '400px' }}>
              Upload your official school logo. Formats: <strong>PNG, JPG, JPEG</strong> (up to 5MB).
              The logo is automatically incorporated into report cards and certificates.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleChooseLogo}
              >
                <Upload size={16} />
                {logoPreview ? 'Replace Logo' : 'Select Logo File'}
              </button>

              {logoPreview && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowDeleteLogoConfirm(true)}
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. Signature Picture of Principal / Head of Institution ──────── */}
      <div className="data-table-card" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSignature size={18} color="var(--color-primary-600)" />
          Signature Picture of Principal / Head of Institution
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {/* Signature Preview Frame */}
          <div style={{
            width: '210px',
            height: '96px',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            position: 'relative',
            padding: '8px',
          }}>
            {signaturePreview ? (
              <img
                src={signaturePreview}
                alt="Signature of Principal / Head of Institution"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                <FileSignature size={24} style={{ margin: '0 auto 4px auto', opacity: 0.45, display: 'block' }} />
                <span>No signature uploaded</span>
              </div>
            )}
          </div>

          {/* Signature Actions & Guidance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px' }}>
              Upload the official signature picture of the Principal / Head of Institution.
              Formats: <strong>PNG, JPG, JPEG</strong> (up to 5MB).
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-700)', fontWeight: 500, margin: 0 }}>
              💡 Note: A transparent PNG image is recommended for the best, cleanest visual results on printed documents.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleChooseSignature}
              >
                <Upload size={16} />
                {signaturePreview ? 'Replace Signature' : 'Upload Signature Picture'}
              </button>

              {signaturePreview && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowDeleteSignatureConfirm(true)}
                >
                  <Trash2 size={16} />
                  Remove Signature
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Action Buttons ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.location.reload()}
          disabled={isSaving}
        >
          <RotateCcw size={16} />
          Reset Changes
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSaving}
        >
          <Save size={16} />
          {isSaving ? 'Saving Settings...' : 'Save School Settings'}
        </button>
      </div>

      {/* ─── Delete Logo Confirmation Modal ──────────────────────────────── */}
      {showDeleteLogoConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Remove School Logo</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove the school logo? This will delete the stored image file.</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteLogoConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRemoveLogo}
              >
                Yes, Remove Logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Signature Confirmation Modal ──────────────────────────── */}
      {showDeleteSignatureConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Remove Principal Signature</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to remove the Signature Picture of Principal / Head of Institution?
                This will delete the stored signature image and leave signature lines blank on documents.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteSignatureConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRemoveSignature}
              >
                Yes, Remove Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
