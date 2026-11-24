import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  CheckCircle,
  Receipt,
  Check,
} from 'lucide-react';
import type { FeePaymentItem, SchoolSettings } from '../../types/electron';
import { formatMoney, amountToWords } from '../../utils/money';
import { InstitutionLogo } from '../../components/Common/InstitutionLogo';
import '../../styles/receipt.css';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: FeePaymentItem | null;
  schoolSettings?: SchoolSettings | null;
}

type CopyMode = 'student' | 'office' | 'both';

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  schoolSettings,
}) => {
  const [copyMode, setCopyMode] = useState<CopyMode>('both');

  // Authoritative school logo resolution
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sms_school_logo_data_url');
      if (stored && stored.startsWith('data:')) {
        return stored;
      }
    }
    const rawLogo = schoolSettings?.logoDataUrl;
    if (rawLogo && typeof rawLogo === 'string' && rawLogo.startsWith('data:')) {
      return rawLogo;
    }
    if (
      schoolSettings?.logoPath &&
      typeof schoolSettings.logoPath === 'string' &&
      (schoolSettings.logoPath.startsWith('data:') ||
        schoolSettings.logoPath.startsWith('blob:') ||
        schoolSettings.logoPath.startsWith('http'))
    ) {
      return schoolSettings.logoPath;
    }
    return null;
  });

  // Fetch authoritative logo dynamically if not already available in props
  useEffect(() => {
    let isMounted = true;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sms_school_logo_data_url');
      if (stored && stored.startsWith('data:')) {
        setResolvedLogo(stored);
        return;
      }
    }

    if (schoolSettings?.logoDataUrl) {
      setResolvedLogo(schoolSettings.logoDataUrl);
      return;
    }

    const fetchLogo = async () => {
      try {
        if (window.electronAPI?.school?.getLogoDataUrl) {
          const res = await window.electronAPI.school.getLogoDataUrl();
          if (isMounted && res.success && res.dataUrl) {
            setResolvedLogo(res.dataUrl);
            return;
          }
        }
        if (window.electronAPI?.school?.getSettings) {
          const sRes = await window.electronAPI.school.getSettings();
          if (isMounted && sRes.success) {
            const logo = sRes.logoDataUrl || sRes.settings?.logoDataUrl || null;
            if (logo) {
              setResolvedLogo(logo);
            }
          }
        }
      } catch (err) {
        console.warn('Could not retrieve school logo for receipt:', err);
      }
    };

    fetchLogo();
    return () => {
      isMounted = false;
    };
  }, [schoolSettings?.logoDataUrl, schoolSettings?.logoPath, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-receipt');

    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // Ensure layout and styles are computed before opening the print dialog
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 2000);
      }, 80);
    });
  };

  const schoolName = (schoolSettings?.schoolName || 'MS Institute Management System').trim();
  const schoolAddressParts = [
    schoolSettings?.address,
    schoolSettings?.city,
    schoolSettings?.province,
  ].filter(Boolean);
  const schoolAddress = schoolAddressParts.join(', ');
  const schoolPhone = schoolSettings?.phone || '';
  const schoolEmail = schoolSettings?.email || '';
  const schoolCode = schoolSettings?.schoolCode || '';

  // Formatted date string
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formattedPaymentDate = formatDate(payment.paymentDate);

  // Single Slip Rendering Function
  const renderReceiptSlip = (
    copyType: 'Office Copy' | 'Student Copy' | 'Original',
    isCompact: boolean = false
  ) => {
    const isFullSettled =
      payment.remainingBalanceAfterPayment === 0 ||
      (payment.remainingBalanceAfterPayment !== undefined && payment.remainingBalanceAfterPayment <= 0);

    return (
      <div
        className={`fee-receipt-paper ${isCompact ? 'receipt-compact-slip' : ''}`}
        key={copyType}
      >
        {/* ─── Institutional Header ─── */}
        <div className="receipt-header-row">
          {/* Left: School Crest / Logo */}
          <div className="receipt-header-logo-col">
            <InstitutionLogo
              size={isCompact ? 50 : 64}
              src={resolvedLogo}
              schoolName={schoolName}
            />
          </div>

          {/* Center: Institution Details */}
          <div className="receipt-header-center">
            <h1 className="receipt-institution-name">{schoolName}</h1>
            {schoolAddress && (
              <p className="receipt-institution-address">{schoolAddress}</p>
            )}
            <div className="receipt-institution-contact">
              {schoolPhone && <span>Tel: {schoolPhone}</span>}
              {schoolPhone && (schoolEmail || schoolCode) && (
                <span className="receipt-contact-sep">•</span>
              )}
              {schoolEmail && <span>Email: {schoolEmail}</span>}
              {schoolEmail && schoolCode && (
                <span className="receipt-contact-sep">•</span>
              )}
              {schoolCode && <span>Code: {schoolCode}</span>}
            </div>
          </div>

          {/* Right: Status Stamp & Copy Indicator */}
          <div className="receipt-header-right-col">
            <span className="receipt-badge-status-paid">
              <Check size={12} strokeWidth={3} /> Paid
            </span>
            <span className="receipt-copy-pill">{copyType}</span>
          </div>
        </div>

        {/* ─── Document Title Ribbon ─── */}
        <div className="receipt-title-ribbon">
          <span className="receipt-title-text">Official Fee Payment Receipt</span>
          {payment.academicSessionName && (
            <span className="receipt-session-badge">
              Session: <strong>{payment.academicSessionName}</strong>
            </span>
          )}
        </div>

        {/* ─── Student & Receipt Meta Grid ─── */}
        <div className="receipt-meta-box">
          <div className="receipt-meta-group">
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Receipt No:</span>
              <span className="receipt-meta-value receipt-meta-mono">
                {payment.receiptNumber}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Payment Date:</span>
              <span className="receipt-meta-value">{formattedPaymentDate}</span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Payment Mode:</span>
              <span className="receipt-meta-value">
                <span className="receipt-mode-pill">{payment.paymentMethod}</span>
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Student Unique ID:</span>
              <span className="receipt-meta-value receipt-meta-mono">
                {payment.systemStudentId || (payment.studentId ? `STU-${payment.studentId}` : '—')}
              </span>
            </div>
          </div>

          <div className="receipt-meta-group">
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Student Name:</span>
              <span className="receipt-meta-value">{payment.studentName || '—'}</span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Father's Name:</span>
              <span className="receipt-meta-value">{payment.fatherName || '—'}</span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Admission / Roll No:</span>
              <span className="receipt-meta-value receipt-meta-mono">
                {payment.admissionNumber || payment.systemStudentId || '—'}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Class & Section:</span>
              <span className="receipt-meta-value">
                {payment.className || '—'}{' '}
                {payment.sectionName ? `(${payment.sectionName})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Fee Itemized Table ─── */}
        <div className="receipt-table-frame">
          <table className="receipt-table">
            <thead>
              <tr>
                <th className="text-left" style={{ width: '40%' }}>
                  Fee Description
                </th>
                <th className="text-left" style={{ width: '20%' }}>
                  Period / Term
                </th>
                <th className="text-right" style={{ width: '18%' }}>
                  Net Billed
                </th>
                <th className="text-right" style={{ width: '22%' }}>
                  Amount Paid
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-left" style={{ fontWeight: 600 }}>
                  {payment.feeTypeName || 'Academic Fee'}
                </td>
                <td className="text-left" style={{ color: '#475569' }}>
                  {payment.feePeriodName || 'Standard Term'}
                </td>
                <td className="text-right font-mono" style={{ color: '#475569' }}>
                  {payment.netAmount !== undefined
                    ? formatMoney(payment.netAmount)
                    : payment.originalAmount !== undefined
                    ? formatMoney(payment.originalAmount)
                    : '—'}
                </td>
                <td className="text-right font-mono receipt-amount-highlight">
                  {formatMoney(payment.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Financial Summary & Breakdown ─── */}
        <div className="receipt-summary-row">
          <div className="receipt-summary-left">
            <div className="receipt-words-box">
              <span className="receipt-words-label">Amount in Words:</span>
              <span className="receipt-words-text">
                {amountToWords(payment.amount)}
              </span>
            </div>

            {payment.referenceNotes ? (
              <div className="receipt-notes-callout">
                <strong>Reference / Note: </strong>
                {payment.referenceNotes}
              </div>
            ) : null}
          </div>

          <div className="receipt-summary-right">
            <div className="receipt-sum-line total-paid">
              <span>Paid Amount:</span>
              <span className="font-mono">{formatMoney(payment.amount)}</span>
            </div>

            {payment.remainingBalanceAfterPayment !== undefined && (
              <div className="receipt-sum-line balance-line">
                <span>Remaining Dues:</span>
                <span
                  className={`font-mono ${
                    isFullSettled
                      ? 'receipt-balance-cleared'
                      : 'receipt-balance-due'
                  }`}
                >
                  {isFullSettled ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle size={12} /> Nil (Cleared)
                    </span>
                  ) : (
                    formatMoney(payment.remainingBalanceAfterPayment)
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Verification & Signatures ─── */}
        <div className="receipt-signatures-grid">
          <div className="receipt-sig-col">
            <div className="receipt-sig-line">Cashier / Officer</div>
            <div className="receipt-sig-sub">
              {payment.receivedByUsername
                ? `User: ${payment.receivedByUsername}`
                : 'Authorized Signatory'}
            </div>
          </div>

          <div className="receipt-sig-col">
            <div className="receipt-seal-placeholder">
              Official<br />Seal
            </div>
          </div>

          <div className="receipt-sig-col">
            <div className="receipt-sig-line">Depositor / Student</div>
            <div className="receipt-sig-sub">Verified & Acknowledged</div>
          </div>
        </div>

        {/* ─── Footer Disclaimer ─── */}
        <div className="receipt-disclaimer-row">
          <span>
            This is a computer-generated official receipt. Valid without signature or physical seal unless required by administration.
          </span>
          <span className="receipt-meta-mono">
            Generated: {new Date().toLocaleDateString('en-US')}
          </span>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      className="receipt-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="receipt-modal-card">
        {/* Top Action Toolbar */}
        <div className="receipt-modal-toolbar no-print">
          <div className="receipt-toolbar-left">
            <div className="receipt-toolbar-icon">
              <Receipt size={20} />
            </div>
            <div className="receipt-toolbar-titles">
              <span className="receipt-toolbar-title">Fee Payment Receipt</span>
              <span className="receipt-toolbar-receipt-no">
                {payment.receiptNumber}
              </span>
            </div>
          </div>

          <div className="receipt-toolbar-right">
            {/* Segmented Copy Selector */}
            <div className="receipt-copy-selector">
              <button
                type="button"
                className={`receipt-copy-btn ${copyMode === 'both' ? 'active' : ''}`}
                onClick={() => setCopyMode('both')}
              >
                Both Copies (1 Page)
              </button>
              <button
                type="button"
                className={`receipt-copy-btn ${copyMode === 'office' ? 'active' : ''}`}
                onClick={() => setCopyMode('office')}
              >
                Office Copy
              </button>
              <button
                type="button"
                className={`receipt-copy-btn ${copyMode === 'student' ? 'active' : ''}`}
                onClick={() => setCopyMode('student')}
              >
                Student Copy
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="receipt-btn-print"
              title="Print Receipt (Ctrl+P)"
            >
              <Printer size={15} />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="receipt-btn-close"
              title="Close (Esc)"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Scroll Body / Paper Canvas */}
        <div className="receipt-modal-body">
          {copyMode === 'office' && renderReceiptSlip('Office Copy', false)}
          {copyMode === 'student' && renderReceiptSlip('Student Copy', false)}
          {copyMode === 'both' && (
            <>
              {renderReceiptSlip('Office Copy', true)}
              <div className="receipt-cut-line">
                <span>✂ Cut along the line</span>
              </div>
              {renderReceiptSlip('Student Copy', true)}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Render via portal to document.body so the modal is outside all page container hierarchies
  return createPortal(modalContent, document.body);
};
