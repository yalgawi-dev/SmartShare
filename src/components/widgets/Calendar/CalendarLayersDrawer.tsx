'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface CalendarLayerDescriptor {
  id: string; // 'personal' or spaceId
  title: string;
  color: string;
  icon: string;
  isPersonal?: boolean;
  isCurrentSpace?: boolean;
  partnerNames: string[];
  eventCount: number;
}

interface CalendarLayersDrawerProps {
  layers: CalendarLayerDescriptor[];
  selectedLayerIds: string[];
  onToggleLayer: (layerId: string) => void;
  onSelectAll: () => void;
  onSelectOnlyCurrent: () => void;
  onClose: () => void;
}

/**
 * Multi-Select Calendar Layers Picker (Membership = Access, zero per-event permission clutter).
 * Lets the user combine ANY subset of their calendars (Personal + any Space Calendars) or view all together.
 */
export const CalendarLayersDrawer: React.FC<CalendarLayersDrawerProps> = ({
  layers,
  selectedLayerIds,
  onToggleLayer,
  onSelectAll,
  onSelectOnlyCurrent,
  onClose,
}) => {
  if (typeof document === 'undefined') return null;

  const allSelected = layers.length > 0 && layers.every((l) => selectedLayerIds.includes(l.id));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.56)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0.6rem',
      }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '84dvh',
          background: '#ffffff',
          borderRadius: '22px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(15,23,42,0.34)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.9rem 1.05rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
              📚 שכבות היומן שלי
            </h3>
            <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
              סמן יומן אחד, כמה יחד או את כולם — כל שותף רואה רק את השכבה שהוא חבר בה
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#ffffff',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#475569',
              fontWeight: 900,
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick Select Buttons */}
        <div style={{ display: 'flex', gap: '0.45rem', padding: '0.7rem 1rem 0.2rem' }}>
          <button
            type="button"
            onClick={onSelectAll}
            style={{
              flex: 1,
              padding: '0.46rem 0.6rem',
              borderRadius: '10px',
              border: allSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
              background: allSelected ? '#eef2ff' : '#f8fafc',
              color: allSelected ? '#3730a3' : '#334155',
              fontSize: '0.76rem',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ✨ בחר הכל (יומן-על)
          </button>
          <button
            type="button"
            onClick={onSelectOnlyCurrent}
            style={{
              flex: 1,
              padding: '0.46rem 0.6rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🎯 התמקד במרחב זה בלבד
          </button>
        </div>

        {/* Layers Checklist */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.7rem 1rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {layers.map((layer) => {
            const checked = selectedLayerIds.includes(layer.id);
            return (
              <label
                key={layer.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '14px',
                  border: checked ? `2px solid ${layer.color}` : '1.5px solid #e2e8f0',
                  background: checked ? `${layer.color}10` : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleLayer(layer.id)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: layer.color,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: layer.color,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${layer.color}66`,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span>{layer.icon} {layer.title}</span>
                      {layer.isCurrentSpace && (
                        <span style={{ fontSize: '0.62rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '999px', fontWeight: 800 }}>
                          מרחב נוכחי
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.71rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                      {layer.isPersonal
                        ? '🔒 פרטי לחלוטין — רק אתה רואה'
                        : layer.partnerNames.length > 0
                          ? `👥 שותפים ביומן: ${layer.partnerNames.join(', ')}`
                          : '👤 מרחב אישי (ללא שותפים נוספים)'}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    color: checked ? layer.color : '#64748b',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    flexShrink: 0,
                  }}
                >
                  {layer.eventCount}
                </span>
              </label>
            );
          })}
        </div>

        {/* Done Button */}
        <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.68rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            ✓ הצג {selectedLayerIds.length} שכבות נבחרות
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
