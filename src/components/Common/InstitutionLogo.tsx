import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface InstitutionLogoProps {
  /** Logo source (data URL, blob, or file path). If omitted, resolves from context/electronAPI */
  src?: string | null;
  /** Institution name for fallback initial. If omitted, resolves from context */
  schoolName?: string | null;
  /** Size in pixels (width & height). Defaults to 40px */
  size?: number;
  /** Optional custom CSS class */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Optional alt text for the image */
  alt?: string;
  /** If true, wraps in a subtle bordered container (ideal for headers/certificates) */
  framed?: boolean;
}

/**
 * Extracts the primary uppercase initial letter from an institution name.
 * Examples:
 *  - "Iqra" -> "I"
 *  - "MCA Education System" -> "M"
 *  - "Oxford Model High School" -> "O"
 */
export function getInstitutionInitial(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'S';
  const trimmed = name.trim();
  if (!trimmed) return 'S';
  const match = trimmed.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : trimmed.charAt(0).toUpperCase();
}

export const InstitutionLogo: React.FC<InstitutionLogoProps> = ({
  src,
  schoolName: propSchoolName,
  size = 40,
  className = '',
  style = {},
  alt,
  framed = false,
}) => {
  const { schoolSettings } = useAuth();
  const [hasError, setHasError] = useState(false);
  const [internalLogo, setInternalLogo] = useState<string | null>(null);

  const institutionName = (propSchoolName || schoolSettings?.schoolName || 'MS Institute Management System').trim();
  const initialLetter = getInstitutionInitial(institutionName);

  // Active logo source: prefer prop, then context logoDataUrl, then internal fetched logo, then dedicated local storage
  const effectiveSrc =
    src ??
    schoolSettings?.logoDataUrl ??
    internalLogo ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem('sms_school_logo_data_url') : null);

  // Reset error state if effective source changes
  useEffect(() => {
    setHasError(false);
  }, [effectiveSrc]);

  // Fetch logo dynamically ONLY if not provided via props and schoolSettings not yet loaded
  useEffect(() => {
    let isMounted = true;
    if (src !== undefined || schoolSettings !== null) return;

    const fetchLogo = async () => {
      try {
        if (window.electronAPI?.school?.getSettings) {
          const sRes = await window.electronAPI.school.getSettings();
          if (isMounted && sRes.success) {
            const logo = sRes.logoDataUrl || sRes.settings?.logoDataUrl;
            if (logo) setInternalLogo(logo);
          }
        }
      } catch {
        // Fallback to initial box on error
      }
    };

    fetchLogo();
    return () => {
      isMounted = false;
    };
  }, [src, schoolSettings]);

  const borderRadius = Math.max(4, Math.round(size * 0.16));
  const fontSize = Math.max(12, Math.round(size * 0.52));

  // Square Fallback Box containing the first letter of the institution
  const renderFallbackBox = () => (
    <div
      className="institution-logo-fallback"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
        background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
        backgroundColor: '#047857',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: `${fontSize}px`,
        fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
        lineHeight: 1,
        letterSpacing: '0.02em',
        boxShadow: '0 2px 5px rgba(4, 120, 87, 0.25)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        userSelect: 'none',
        flexShrink: 0,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
      title={institutionName}
      aria-label={`Logo of ${institutionName}`}
    >
      <span>{initialLetter}</span>
    </div>
  );

  const content = (
    <>
      {!hasError && effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={alt || `${institutionName} Logo`}
          onError={() => setHasError(true)}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            objectFit: 'contain',
            display: 'block',
            borderRadius: `${borderRadius}px`,
            flexShrink: 0,
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        />
      ) : (
        renderFallbackBox()
      )}
    </>
  );

  if (framed) {
    return (
      <div
        className={`institution-logo-frame ${className}`}
        style={{
          width: `${size + 8}px`,
          height: `${size + 8}px`,
          padding: '3px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: `${borderRadius + 2}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          flexShrink: 0,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          ...style,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`institution-logo-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {content}
    </div>
  );
};
