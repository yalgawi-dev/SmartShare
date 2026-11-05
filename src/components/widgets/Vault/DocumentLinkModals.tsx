'use client';

import React, { useState, useEffect } from 'react';
import { SpaceDocument } from '@/app/context/SpacesContext';
import { formatFileSize } from '@/utils/documentUtils';

interface LinkDocumentsModalProps {
  isOpen: boolean;
  doc: SpaceDocument | null;
  allDocs: SpaceDocument[];
  onClose: () => void;
  onSave: (docId: string, linkedDocIds: string[]) => void;
}

export const LinkDocumentsModal: React.FC<LinkDocumentsModalProps> = ({
  isOpen,
  doc,
  allDocs,
  onClose,
  onSave
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (doc) {
      setSelectedIds(doc.linkedDocIds || []);
      setSearchTerm('');
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  // Filter candidates: exclude this document and deleted documents
  const candidateDocs = allDocs.filter(d => d.id !== doc.id && !d.deletedAt);
  const filteredCandidates = candidateDocs.filter(d => 
    !searchTerm.trim() || (d.title || '').toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredCandidates.map(d => d.id);
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleSave = () => {
    onSave(doc.id, selectedIds);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100030,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              💳
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                קישור חשבוניות ומסמכים
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                אישור תשלום / מסמך אב: <span style={{ fontWeight: 700, color: '#1e293b' }}>{doc.title}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.95rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Informative explanation */}
        <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
          💡 בחר את החשבוניות או המסמכים המשולמים באמצעות אישור זה. בלחיצה עליו, יוצגו החשבוניות המקושרות.
        </div>

        {/* Search & Bulk select */}
        <div style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 חפש חשבונית לפי שם..."
            style={{
              flex: 1,
              padding: '0.55rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
          {filteredCandidates.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {filteredCandidates.every(d => selectedIds.includes(d.id)) ? 'בטל הכל' : 'בחר הכל'}
            </button>
          )}
        </div>

        {/* Documents List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {filteredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              לא נמצאו מסמכים מתאימים במדף
            </div>
          ) : (
            filteredCandidates.map(d => {
              const isSelected = selectedIds.includes(d.id);
              return (
                <div
                  key={d.id}
                  onClick={() => toggleSelect(d.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                    background: isSelected ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #10b981' : '2px solid #cbd5e1', background: isSelected ? '#10b981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800 }}>
                      {isSelected ? '✓' : ''}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: isSelected ? 800 : 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.docNumber ? `#${d.docNumber} • ` : ''}{d.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                        <span>📅 {new Date(d.createdAt).toLocaleDateString('he-IL')}</span>
                        {d.fileSize && <span>⚖️ {formatFileSize(d.fileSize)}</span>}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px' }}>
                      מקושר
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem', background: '#ffffff' }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '0.75rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            שמור קישור ({selectedIds.length} נבחרו)
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer'
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

interface LinkedDocsPreviewModalProps {
  isOpen: boolean;
  parentDoc: SpaceDocument | null;
  allDocs: SpaceDocument[];
  onClose: () => void;
  onOpenDoc: (doc: SpaceDocument, allLinked: SpaceDocument[]) => void;
  onEditLinks: (doc: SpaceDocument) => void;
}

export const LinkedDocsPreviewModal: React.FC<LinkedDocsPreviewModalProps> = ({
  isOpen,
  parentDoc,
  allDocs,
  onClose,
  onOpenDoc,
  onEditLinks
}) => {
  if (!isOpen || !parentDoc) return null;

  const linkedIds = parentDoc.linkedDocIds || [];
  const linkedDocs = allDocs.filter(d => linkedIds.includes(d.id) && !d.deletedAt);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100030,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              💳
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                חשבוניות ומסמכים מקושרים
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                אישור: <span style={{ fontWeight: 700, color: '#1e293b' }}>{parentDoc.title}</span> ({linkedDocs.length} מקושרים)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.95rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {linkedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📎</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>אין חשבוניות מקושרות למסמך זה</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>לחץ על הכפתור למטה כדי לבחור חשבוניות לשיוך</div>
            </div>
          ) : (
            linkedDocs.map((doc, idx) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800 }}>
                    #{doc.docNumber || idx + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                      <span>📅 {new Date(doc.createdAt).toLocaleDateString('he-IL')}</span>
                      {doc.fileSize && <span>⚖️ {formatFileSize(doc.fileSize)}</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDoc(doc, linkedDocs)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  👁️ הצג מסמך
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem', background: '#ffffff' }}>
          <button
            type="button"
            onClick={() => onEditLinks(parentDoc)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1.5px solid #cbd5e1',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            ✏️ ערוך שיוך חשבוניות
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
