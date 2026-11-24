import React, { useState } from 'react';
import { Tag, Plus, Edit2, CheckCircle, Search, AlertCircle, X } from 'lucide-react';
import type { FeeTypeItem } from '../../types/electron';
import { useAuth } from '../../context/AuthContext';

export const FeeTypesTab: React.FC = () => {
  const { sessionToken } = useAuth();
  const [types, setTypes] = useState<FeeTypeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Friendly Modal state - NO code field required from user
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<FeeTypeItem | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFeeTypes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.fees.getTypes();
        if (res.success && res.types) {
          setTypes(res.types);
        } else {
          setError(res.error || 'Failed to load fee categories.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching fee categories.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadFeeTypes();
  }, []);

  const handleOpenAdd = () => {
    setEditingType(null);
    setTypeName('');
    setTypeDescription('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: FeeTypeItem) => {
    setEditingType(type);
    setTypeName(type.name);
    setTypeDescription(type.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Generate a clean internal alphanumeric code automatically from the name
  const generateAutoCode = (name: string): string => {
    const cleaned = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = cleaned.slice(0, 4) || 'FEE';
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}${rand}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) {
      setFormError('Please enter a Fee Type name (e.g. "Monthly Tuition Fee").');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingType) {
        // Keep existing internal code on edit
        const res = await window.electronAPI!.fees.updateType({
          sessionToken: sessionToken || '',
          id: editingType.id,
          name: typeName.trim(),
          code: editingType.code || generateAutoCode(typeName),
          description: typeDescription.trim(),
        });
        if (res.success) {
          setIsModalOpen(false);
          await loadFeeTypes();
        } else {
          setFormError(res.error || 'Failed to update fee type.');
        }
      } else {
        // Automatically create internal code for backend
        const autoCode = generateAutoCode(typeName);
        const res = await window.electronAPI!.fees.createType({
          sessionToken: sessionToken || '',
          name: typeName.trim(),
          code: autoCode,
          description: typeDescription.trim(),
        });
        if (res.success) {
          setIsModalOpen(false);
          await loadFeeTypes();
        } else {
          setFormError(res.error || 'Failed to create fee type.');
        }
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving fee type.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTypes = types.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header & Add Button */}
      <div className="fees-card">
        <div className="fees-card-header">
          <div className="fees-card-title">
            <Tag size={18} />
            <span>Fee Types</span>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn-fees-primary"
            style={{ height: '34px', fontSize: '11px', padding: '0 14px' }}
          >
            <Plus size={14} /> Add Fee Type
          </button>
        </div>

        <div className="fees-card-body" style={{ paddingBottom: '10px' }}>
          <div style={{ position: 'relative', maxWidth: '360px', display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', color: 'var(--color-neutral-400)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Search fee categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="fees-input"
              style={{ paddingLeft: '36px', height: '36px' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Fee Types Table */}
      <div className="fees-card">
        <div className="fees-table-container">
          <table className="fees-table">
            <thead>
              <tr>
                <th style={{ width: '260px' }}>Fee Type</th>
                <th>Description</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--color-neutral-400)' }}>
                    Loading fee categories...
                  </td>
                </tr>
              ) : filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="fees-empty-state">
                      <div className="fees-empty-icon">
                        <Tag size={26} />
                      </div>
                      <div className="fees-empty-title">No Fee Types Found</div>
                      <div className="fees-empty-subtitle">
                        Click <strong>"+ Add Fee Type"</strong> above to configure tuition, admission, exam or transport fees.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTypes.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontSize: '13px', color: 'var(--color-neutral-900)' }}>{t.name}</strong>
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-neutral-600)' }}>
                        {t.description || 'General fee category'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge-fee ${t.isActive ? 'paid' : 'waived'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(t)}
                        className="btn-fees-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Friendly Add / Edit Modal - Clean & Simple */}
      {isModalOpen && (
        <div className="fees-modal-overlay">
          <div className="fees-modal-card" style={{ maxWidth: '480px' }}>
            <div className="fees-modal-header">
              <div>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-neutral-900)' }}>
                  {editingType ? 'Edit Fee Type' : 'Add New Fee Type'}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
                  Define a category for student fees (e.g. Tuition, Admission, Exam, Transport).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="fees-modal-body">
                <div className="fees-form-group">
                  <label className="fees-form-label">Fee Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly Tuition Fee, Admission Fee, Exam Fee..."
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="fees-input"
                    autoFocus
                  />
                </div>

                <div className="fees-form-group">
                  <label className="fees-form-label">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Regular monthly tuition fee charged for classes"
                    value={typeDescription}
                    onChange={(e) => setTypeDescription(e.target.value)}
                    className="fees-input"
                  />
                </div>

                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '12px' }}>
                    {formError}
                  </div>
                )}
              </div>

              <div className="fees-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-fees-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-fees-primary"
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Saving...' : 'Save Fee Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
