'use client';

import React, { useState, useMemo } from 'react';

export interface TrashItem {
  id: string;
  name: string;
  type: 'document' | 'folder' | 'shelf' | 'file';
  originLocation: string; // e.g. 'כספת / מדף בית חולים', 'שיתוף קבצים / מסמכים', 'מחסן ראשי'
  deletedAt?: string;
  thumbnailUrl?: string;
  url?: string;
  pages?: string[];
  docCount?: number;
  itemCount?: number;
  rawItem?: any;
}

export interface GlobalRecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TrashItem[];
  onRestore: (item: TrashItem) => void;
  onPermanentDelete: (item: TrashItem) => void;
  onPreviewItem?: (item: TrashItem) => void;
  customTabs?: { id: string; label: string; icon: string; types: ('document' | 'folder' | 'shelf' | 'file')[] }[];
}

export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export const formatRemainingTrashTime = (deletedAt?: string): string => {
  if (!deletedAt) return '12 שעות';
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  const remaining = Math.max(0, TWELVE_HOURS_MS - elapsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} שעות ו-${minutes} דקות`;
  return `${minutes} דקות`;
};

export const GlobalRecycleBinModal: React.FC<GlobalRecycleBinModalProps> = ({
  isOpen,
  onClose,
  items,
  onRestore,
  onPermanentDelete,
  onPreviewItem,
  customTabs
}) => {
  if (!isOpen) return null;

  const tabs = customTabs || [
    { id: 'all', label: 'הכל', icon: '🗑️', types: ['document', 'folder', 'shelf', 'file'] as ('document' | 'folder' | 'shelf' | 'file')[] },
    { id: 'documents', label: 'מסמכים וקבצים', icon: '📄', types: ['document', 'file'] as ('document' | 'folder' | 'shelf' | 'file')[] },
    { id: 'folders', label: 'מדפים ותיקיות', icon: '🗂️', types: ['shelf', 'folder'] as ('document' | 'folder' | 'shelf' | 'file')[] }
  ];

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const filteredItems = useMemo(() => {
    return items.filter(it => currentTab.types.includes(it.type));
  }, [items, currentTab]);

  const getItemIcon = (it: TrashItem) => {
    if (it.type === 'shelf') return '🗂️';
    if (it.type === 'folder') return '📁';
    if (it.type === 'file') return '📄';
    return '📄';
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100005,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #fecdd3',
          overflow: 'hidden',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', borderBottom: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#9f1239', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🗑️</span> סל אשפה ({items.length})
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', color: '#be123c', fontSize: '0.78rem' }}>
              פריטים נשמרים למשך 12 שעות ולאחר מכן נמחקים אוטומטית לצמיתות
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid #fecdd3', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer', color: '#9f1239', fontWeight: 'bold' }}
            title="סגור (או לחץ על הרקע)"
          >
            ✕
          </button>
        </div>

        {/* Tabs Bar */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', background: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
            {tabs.map(tab => {
              const count = items.filter(it => tab.types.includes(it.type)).length;
              const isSelected = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? '#1e293b' : '#64748b',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.84rem',
                    boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>{tab.icon}</span> {tab.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗑️</div>
              <div style={{ fontWeight: 600 }}>אין פריטים בסל האשפה בלשונית זו</div>
            </div>
          ) : (
            filteredItems.map(item => {
              const timeLeft = formatRemainingTrashTime(item.deletedAt);
              const isVisual = item.type === 'document' || item.type === 'file';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div
                    onClick={() => {
                      if (onPreviewItem && isVisual) onPreviewItem(item);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      overflow: 'hidden',
                      cursor: isVisual && onPreviewItem ? 'pointer' : 'default',
                      flex: 1
                    }}
                    title={isVisual && onPreviewItem ? 'לחץ לצפייה מקדימה במסמך' : undefined}
                  >
                    {/* Visual Thumbnail */}
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#e2e8f0',
                        backgroundImage: item.thumbnailUrl ? `url(${item.thumbnailUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {!item.thumbnailUrl && getItemIcon(item)}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: '#1e293b',
                          fontSize: '0.9rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '190px'
                        }}
                      >
                        {item.name}
                      </div>

                      {/* Origin Location + Time left */}
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>📍 {item.originLocation}</span>
                        <span>&bull;</span>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>⏳ נותרו {timeLeft}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => onRestore(item)}
                      style={{
                        padding: '0.45rem 0.8rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      ↩️ שחזר
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDelete(item)}
                      style={{
                        padding: '0.45rem 0.65rem',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                      title="מחק לצמיתות מהענן"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.6rem 1.4rem',
              background: '#e2e8f0',
              color: '#334155',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem'
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalRecycleBinModal;
