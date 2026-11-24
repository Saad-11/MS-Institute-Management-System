import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderOpen,
  FileCheck,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Archive,
  Folder,
} from 'lucide-react';
import type { BackupListItem, BackupManifest, BackupValidationResult } from '../../types/electron';

export const BackupPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    filePath?: string;
  } | null>(null);

  // Backup creation state
  const [isCreating, setIsCreating] = useState(false);
  const [customBackupFolder, setCustomBackupFolder] = useState<string>('');
  const [lastCreatedManifest, setLastCreatedManifest] = useState<BackupManifest | null>(null);
  const [lastCreatedBackupPath, setLastCreatedBackupPath] = useState<string | null>(null);

  // Validation state
  const [validatingPath, setValidatingPath] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ path: string; result: BackupValidationResult } | null>(null);

  // Restore state & Safety confirmation
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [restoreCandidateManifest, setRestoreCandidateManifest] = useState<BackupManifest | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; text: string; safetyPath?: string } | null>(null);

  // Quick stats
  const [lastBackupInfo, setLastBackupInfo] = useState<{
    lastBackupDate: string | null;
    backupName: string | null;
    backupSizeBytes: number | null;
  } | null>(null);

  useEffect(() => {
    loadBackupsList();
    loadLastBackupInfo();
  }, []);

  const loadBackupsList = async () => {
    try {
      setLoading(true);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.list();
      if (res.success) {
        setBackups(res.backups || []);
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to load backups list.' });
    } finally {
      setLoading(false);
    }
  };

  const loadLastBackupInfo = async () => {
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.getLastBackup();
      if (res.success) {
        setLastBackupInfo(res.info);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.chooseFolder();
      if (res.success && res.folderPath) {
        setCustomBackupFolder(res.folderPath);
        setStatusMessage(null);
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error selecting backup folder.' });
    }
  };

  const handleShowInFolder = async (filePath: string) => {
    try {
      if (!window.electronAPI?.backup?.showInFolder) return;
      const res = await window.electronAPI.backup.showInFolder(filePath);
      if (!res.success && res.error) {
        setStatusMessage({ type: 'error', text: res.error });
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleOpenFolder = async (folderPath: string) => {
    try {
      if (!window.electronAPI?.backup?.openFolder) return;
      const res = await window.electronAPI.backup.openFolder(folderPath);
      if (!res.success && res.error) {
        setStatusMessage({ type: 'error', text: res.error });
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsCreating(true);
      setStatusMessage(null);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.create(customBackupFolder || undefined);
      if (res.success && res.manifest && res.backupPath) {
        setLastCreatedManifest(res.manifest);
        setLastCreatedBackupPath(res.backupPath);
        setStatusMessage({
          type: 'success',
          text: `Backup successfully created and verified on disk!`,
          filePath: res.backupPath,
        });
        await loadBackupsList();
        await loadLastBackupInfo();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to generate database backup.',
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error during backup creation.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectFileToValidate = async () => {
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.chooseFile();
      if (res.success && res.filePath) {
        await handleValidateFile(res.filePath);
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error selecting backup file.' });
    }
  };

  const handleSelectFileToRestore = async () => {
    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.chooseFile();
      if (res.success && res.filePath) {
        await handleInitiateRestore(res.filePath);
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error selecting backup file for restore.' });
    }
  };

  const handleValidateFile = async (filePath: string) => {
    try {
      setValidatingPath(filePath);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.validate(filePath);
      setValidationResult({ path: filePath, result: res });
      const isValid = res.valid ?? res.isValid;
      if (isValid) {
        setStatusMessage({ type: 'success', text: `Backup file is valid and verified: ${filePath}`, filePath });
      } else {
        const errs = res.errors?.join('; ') || res.error || 'Integrity check failed';
        setStatusMessage({ type: 'error', text: `Backup validation failed: ${errs}` });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error validating backup package.' });
    } finally {
      setValidatingPath(null);
    }
  };

  const handleInitiateRestore = async (filePath: string) => {
    setRestoreCandidate(filePath);
    setRestoreConfirmed(false);
    setRestoreResult(null);
    // Validate candidate first
    try {
      if (!window.electronAPI) return;
      const val = await window.electronAPI.backup.validate(filePath);
      const isValid = val.valid ?? val.isValid;
      if (isValid && val.manifest) {
        setRestoreCandidateManifest(val.manifest);
      } else {
        setRestoreCandidateManifest(null);
        const errs = val.errors?.join('; ') || val.error || 'Invalid backup';
        setStatusMessage({
          type: 'error',
          text: `Cannot restore invalid backup package: ${errs}`,
        });
      }
    } catch {
      setRestoreCandidateManifest(null);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreCandidate || !restoreConfirmed) return;
    try {
      setIsRestoring(true);
      setStatusMessage(null);
      if (!window.electronAPI) return;
      const res = await window.electronAPI.backup.restore(restoreCandidate);
      if (res.success) {
        setRestoreResult({
          success: true,
          text: `Database and media assets restored successfully from backup package. A safety snapshot was archived before the restore operation.`,
        });
        setStatusMessage({
          type: 'success',
          text: 'Restore complete. Recommended: Restart the application or refresh sections to view restored data.',
        });
        setRestoreCandidate(null);
        await loadBackupsList();
        await loadLastBackupInfo();
      } else {
        setRestoreResult({
          success: false,
          text: res.error || 'Failed to restore database.',
        });
        setStatusMessage({
          type: 'error',
          text: res.error || 'Restore failed. The system rolled back to the safety snapshot.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown restore error';
      setRestoreResult({ success: false, text: msg });
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Backup & Data Safety
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Standalone offline backups, cryptographic validation, and safe point-in-time recovery.
          </p>
        </div>
        <button
          onClick={loadBackupsList}
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
          Refresh Backups
        </button>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            backgroundColor:
              statusMessage.type === 'success' ? '#ECFDF5' : statusMessage.type === 'error' ? '#FEF2F2' : '#EFF6FF',
            color:
              statusMessage.type === 'success' ? '#065F46' : statusMessage.type === 'error' ? '#991B1B' : '#1E40AF',
            border: `1px solid ${
              statusMessage.type === 'success' ? '#A7F3D0' : statusMessage.type === 'error' ? '#FECACA' : '#BFDBFE'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle size={18} />
            ) : (
              <Clock size={18} />
            )}
            <span>{statusMessage.text}</span>
          </div>

          {statusMessage.filePath && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => handleShowInFolder(statusMessage.filePath!)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid currentColor',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  color: 'inherit',
                }}
              >
                <Folder size={13} />
                Show in Explorer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#EFF6FF', color: '#2563EB' }}>
              <HardDrive size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Last Offline Backup
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {lastBackupInfo?.lastBackupDate ? new Date(lastBackupInfo.lastBackupDate).toLocaleDateString() : 'None Yet'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            {lastBackupInfo?.backupName ? (
              <span>File: {lastBackupInfo.backupName} ({lastBackupInfo.backupSizeBytes ? formatBytes(lastBackupInfo.backupSizeBytes) : '—'})</span>
            ) : (
              <span>No backup recorded yet in this instance</span>
            )}
          </div>
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#F0FDF4', color: '#16A34A' }}>
              <Archive size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Total Available Backups
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {backups.length} Files
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            Includes SQLite transactions, manifests, logos & uploaded photos
          </div>
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Safety Guarantee
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Pre-Restore Snapshots
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            Automatic safety backup created before any restore; rollbacks on failure.
          </div>
        </div>
      </div>

      {/* Create Backup Section */}
      <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
          Create New Backup Package (.smbak)
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Generates an offline, compressed package bundling the SQLite database, uploaded assets (school logos, student photos, teacher photos), and cryptographic SHA-256 integrity checksums.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              readOnly
              placeholder="Default Backup Directory (AppData/backups)"
              value={customBackupFolder}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-app)',
                fontSize: '0.875rem',
              }}
            />
            <button
              onClick={handleSelectFolder}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
              }}
            >
              <FolderOpen size={16} />
              Browse...
            </button>
            {customBackupFolder && (
              <button
                onClick={() => setCustomBackupFolder('')}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reset
              </button>
            )}
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--color-primary-600, #2563EB)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <Archive size={16} className={isCreating ? 'animate-spin' : ''} />
            {isCreating ? 'Creating Backup...' : 'Create Backup Now'}
          </button>
        </div>

        {customBackupFolder ? (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#047857' }}>
            ✓ Selected Destination: <strong>{customBackupFolder}</strong> (Backup will be saved as <code>MSIMS_Backup_YYYY-MM-DD_HHmmss.smbak</code>)
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Default Destination: <code>AppData\Roaming\MS Institute Management System\backups</code>
          </div>
        )}

        {lastCreatedManifest && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '0.375rem', border: '1px solid #E2E8F0', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Last Created Backup Details:</div>
            {lastCreatedBackupPath && (
              <div style={{ marginBottom: '0.375rem', wordBreak: 'break-all' }}>
                Saved File: <strong>{lastCreatedBackupPath}</strong>
              </div>
            )}
            <div>School: <strong>{lastCreatedManifest.schoolName}</strong> {lastCreatedManifest.schoolCode ? `(${lastCreatedManifest.schoolCode})` : ''}</div>
            <div>Created: <strong>{new Date(lastCreatedManifest.createdAt).toLocaleString()}</strong></div>
            <div>Database Checksum: <code style={{ backgroundColor: '#E2E8F0', padding: '1px 4px', borderRadius: '2px' }}>{(lastCreatedManifest.databaseChecksum || lastCreatedManifest.dbChecksumSha256 || '').substring(0, 16)}...</code></div>
            <div>Asset Files: <strong>{lastCreatedManifest.assetCount ?? lastCreatedManifest.assetFilesCount ?? 0} files</strong></div>
            <div>File Size: <strong>{formatBytes(lastCreatedManifest.databaseSize ?? lastCreatedManifest.fileSize ?? 0)}</strong></div>

            {lastCreatedBackupPath && (
              <div style={{ marginTop: '0.625rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleShowInFolder(lastCreatedBackupPath)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.3rem 0.6rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1E293B',
                  }}
                >
                  <Folder size={14} />
                  Show in Explorer
                </button>
                <button
                  onClick={() => {
                    const idx = Math.max(lastCreatedBackupPath.lastIndexOf('/'), lastCreatedBackupPath.lastIndexOf('\\'));
                    if (idx > 0) {
                      handleOpenFolder(lastCreatedBackupPath.substring(0, idx));
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.3rem 0.6rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1E293B',
                  }}
                >
                  <FolderOpen size={14} />
                  Open Destination Folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validate & Restore External File */}
      <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
          Inspect & Validate External Backup File
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Select any .smbak file from USB drives, local folders, or network shares to verify its cryptographic SHA-256 integrity, schema version, and metadata before restoring.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleSelectFileToValidate}
            disabled={validatingPath !== null}
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
              fontWeight: 500,
            }}
          >
            <FileCheck size={16} />
            Choose .smbak File & Verify
          </button>

          <button
            onClick={handleSelectFileToRestore}
            disabled={isRestoring}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={16} />
            Restore Backup from File (.smbak)...
          </button>
        </div>

        {validationResult && (() => {
          const isVal = validationResult.result.valid ?? validationResult.result.isValid ?? false;
          return (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '0.375rem',
                backgroundColor: isVal ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${isVal ? '#BBF7D0' : '#FECACA'}`,
                fontSize: '0.875rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: isVal ? '#166534' : '#991B1B' }}>
                {isVal ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{isVal ? 'Backup Package Integrity Verified' : 'Validation Failed'}</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Path: {validationResult.path}
              </div>
              {validationResult.result.manifest && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                  <div>School: <strong>{validationResult.result.manifest.schoolName}</strong></div>
                  <div>Created: <strong>{new Date(validationResult.result.manifest.createdAt).toLocaleString()}</strong></div>
                  <div>Schema Version: <strong>{validationResult.result.manifest.schemaVersion}</strong></div>
                  <div>Assets Packaged: <strong>{validationResult.result.manifest.assetCount ?? validationResult.result.manifest.assetFilesCount ?? 0}</strong></div>
                </div>
              )}
              {validationResult.result.error && (
                <div style={{ marginTop: '0.5rem', color: '#991B1B' }}>
                  <strong>Error:</strong> {validationResult.result.error}
                </div>
              )}
              {validationResult.result.errors && validationResult.result.errors.length > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#991B1B' }}>
                  <strong>Errors:</strong>
                  <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
                    {validationResult.result.errors.map((e: string, idx: number) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.result.warnings && validationResult.result.warnings.length > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#854D0E' }}>
                  <strong>Warnings:</strong>
                  <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
                    {validationResult.result.warnings.map((w: string, idx: number) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {isVal && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    onClick={() => handleInitiateRestore(validationResult.path)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    <RotateCcw size={14} />
                    Proceed to Restore from this File
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Restore Safety Modal / Confirmation Overlay */}
      {restoreCandidate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#DC2626', marginBottom: '1rem' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Confirm Point-in-Time Database Restore
              </h3>
            </div>

            <div style={{ fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '1rem' }}>
              Restoring this backup will replace current operational data with the contents of this backup package.
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', color: '#991B1B' }}>
                <strong>Automatic Safety Snapshot:</strong> Before replacing any data, the system will automatically create a full safety backup of your current database in <code style={{ backgroundColor: '#FEE2E2', padding: '1px 4px', borderRadius: '2px' }}>backups/safety/</code>. If any integrity check fails, changes will be rolled back automatically.
              </div>
            </div>

            {restoreCandidateManifest && (
              <div style={{ fontSize: '0.8125rem', backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', border: '1px solid #E5E7EB' }}>
                <div><strong>Target School:</strong> {restoreCandidateManifest.schoolName} ({restoreCandidateManifest.schoolCode})</div>
                <div><strong>Backup Created:</strong> {new Date(restoreCandidateManifest.createdAt).toLocaleString()}</div>
                <div><strong>App / Schema:</strong> {restoreCandidateManifest.appVersion} / v{restoreCandidateManifest.schemaVersion}</div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '1.25rem', color: '#1F2937' }}>
              <input
                type="checkbox"
                checked={restoreConfirmed}
                onChange={(e) => setRestoreConfirmed(e.target.checked)}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                I understand this operation replaces current database records with the snapshot from this backup file.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setRestoreCandidate(null)}
                disabled={isRestoring}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={!restoreConfirmed || isRestoring}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  backgroundColor: restoreConfirmed && !isRestoring ? '#DC2626' : '#9CA3AF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: restoreConfirmed && !isRestoring ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                <RotateCcw size={16} className={isRestoring ? 'animate-spin' : ''} />
                {isRestoring ? 'Restoring Database...' : 'Restore Database Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Result Notification */}
      {restoreResult && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem',
            backgroundColor: restoreResult.success ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${restoreResult.success ? '#A7F3D0' : '#FECACA'}`,
            color: restoreResult.success ? '#065F46' : '#991B1B',
            fontSize: '0.875rem',
          }}
        >
          <strong>{restoreResult.success ? 'Restore Succeeded' : 'Restore Failed'}</strong>
          <p style={{ margin: '0.25rem 0 0' }}>{restoreResult.text}</p>
        </div>
      )}

      {/* Backups List Table */}
      <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: '0.5rem', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Stored Backup Files
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {backups.length} available
          </span>
        </div>

        {backups.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <HardDrive size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontWeight: 500 }}>No backup files found</div>
            <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Create your first offline backup using the button above.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>File Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Created At</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Size</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>School</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Version</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const bPath = b.filePath || b.fullPath || b.fileName;
                  const bSize = b.fileSizeBytes ?? b.sizeBytes ?? 0;
                  return (
                    <tr key={b.fileName} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {b.fileName}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)' }}>
                        {formatBytes(bSize)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)' }}>
                        {b.schoolName || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)' }}>
                        v{b.schemaVersion} {b.appVersion ? `(${b.appVersion})` : ''}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleShowInFolder(bPath)}
                            title="Show in Windows File Explorer"
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--color-bg-app)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <Folder size={12} />
                            Folder
                          </button>
                          <button
                            onClick={() => handleValidateFile(bPath)}
                            disabled={validatingPath === bPath}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--color-bg-app)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <FileCheck size={12} />
                            {validatingPath === bPath ? 'Verifying...' : 'Validate'}
                          </button>
                          <button
                            onClick={() => handleInitiateRestore(bPath)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#FEE2E2',
                              color: '#991B1B',
                              border: '1px solid #FECACA',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontWeight: 500,
                            }}
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
