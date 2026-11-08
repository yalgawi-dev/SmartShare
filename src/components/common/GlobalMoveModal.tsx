'use client';

import React from 'react';

export interface FolderTargetItem {
  id: string;
  name: string;
  parentId?: string | null;
  shelfId?: string | null;
}

export interface GlobalMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  itemCount: number;
  currentFolderId?: string | null;
  folders: FolderTargetItem[];
  onConfirmMove: (targetFolderId: string | null) => void;
  rootLabel?: string;
  rootDescription?: string;
}

export const GlobalMoveModal: React.FC<GlobalMoveModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  itemCount,
  currentFolderId,
  folders,
  onConfirmMove,
  rootLabel = 'תיקייה ראשית (ללא תיקייה)',
  rootDescription = 'שכבת הבסיס הראשית'
}) => {
  if (!isOpen) return null;

  const normId = (id?: string | null) => (id && String(id).trim().length > 0 ? String(id).trim() : null);
  const activeCurrentFolderId = normId(currentFolderId);
  const isRootCurrent = !activeCurrentFolderId;

  // Current folder object
  const currentFolderObj = activeCurrentFolderId ? folders.find(f => normId(f.id) === activeCurrentFolderId) : null;
  const currentParentId = currentFolderObj ? normId(currentFolderObj.parentId) : null;

  // Sibling folders: share the exact same normalized parentId!
  const siblingFolders = folders.filter(f => {
    const fParentId = normId(f.parentId);
    return fParentId === currentParentId;
  });

  // Other folders: exist but have a different parentId
  const otherFolders = folders.filter(f => {
    const fParentId = normId(f.parentId);
    return fParentId !== currentParentId;
  });

  const modalTitle = title || (itemCount > 1 ? `העברת ${itemCount} פריטים לתיקייה` : 'העברה לתיקייה');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          padding: '1.5rem',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          direction: 'rtl'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              {modalTitle}
            </h3>
            {subtitle && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.75rem' }}>
          בחר תיקיית יעד:
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '0.5rem' }}>
          {/* Option 1: Root level */}
          <button
            type="button"
            disabled={isRootCurrent}
            onClick={() => onConfirmMove(null)}
            style={{
              padding: '0.85rem 1rem',
              background: isRootCurrent ? '#f1f5f9' : '#eff6ff',
              border: isRootCurrent ? '2px solid #94a3b8' : '2px solid #2563eb',
              borderRadius: '14px',
              cursor: isRootCurrent ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'right',
              boxShadow: isRootCurrent ? 'none' : '0 2px 6px rgba(37,99,235,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.35rem' }}>🏠</span>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isRootCurrent ? '#64748b' : '#1d4ed8' }}>
                  {rootLabel}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {rootDescription}
                </div>
              </div>
            </div>
            {isRootCurrent ? (
              <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                מיקום נוכחי
              </span>
            ) : (
              <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                העבר לכאן ←
              </span>
            )}
          </button>

          {/* Sibling Folders (Same Tier) */}
          {siblingFolders.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📁</span>
                <span>{currentFolderObj ? 'תיקיות מקבילות (באותה שכבה):' : 'תיקיות ברמה הראשית:'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {siblingFolders.map(f => {
                  const isCurrent = normId(f.id) === activeCurrentFolderId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onConfirmMove(f.id)}
                      style={{
                        padding: '0.85rem 1rem',
                        background: isCurrent ? '#f1f5f9' : '#ffffff',
                        border: isCurrent ? '2px solid #94a3b8' : '1px solid #bfdbfe',
                        borderRadius: '14px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'right',
                        boxShadow: isCurrent ? 'none' : '0 1px 4px rgba(37,99,235,0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.35rem' }}>📁</span>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isCurrent ? '#64748b' : '#0f172a' }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {isCurrent ? 'הפריט כבר נמצא בתיקייה זו' : (currentFolderObj ? 'תיקייה מקבילה באותה שכבה' : 'תיקייה ברמה הראשית')}
                          </div>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                          תיקייה נוכחית
                        </span>
                      ) : (
                        <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                          העבר לכאן ←
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Folders */}
          {otherFolders.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🗂️</span>
                <span>תיקיות בשכבות אחרות:</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {otherFolders.map(f => {
                  const isCurrent = normId(f.id) === activeCurrentFolderId;
                  const parentF = f.parentId ? folders.find(p => normId(p.id) === normId(f.parentId)) : null;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onConfirmMove(f.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        background: isCurrent ? '#f1f5f9' : '#f8fafc',
                        border: isCurrent ? '2px solid #94a3b8' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'right'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>📁</span>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isCurrent ? '#64748b' : '#334155' }}>
                            {f.name}
                          </div>
                          {parentF ? (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              בתוך: {parentF.name}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              ברמה הראשית
                            </div>
                          )}
                        </div>
                      </div>
                      {isCurrent ? (
                        <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                          תיקייה נוכחית
                        </span>
                      ) : (
                        <span style={{ color: '#2563eb', fontSize: '0.78rem', fontWeight: 700 }}>
                          העבר לכאן ←
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.75rem',
            background: '#f1f5f9',
            color: '#64748b',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
};

export default GlobalMoveModal;
