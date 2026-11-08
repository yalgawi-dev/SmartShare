'use client';

import React from 'react';

export interface BatchToolbarAction {
  id: string;
  label: string;
  icon: string | React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'info' | 'custom';
  customStyle?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
}

export interface BatchActionToolbarProps {
  /** How many items are currently checked */
  selectedCount: number;
  /** Total selectable items currently shown in the view */
  totalCount: number;
  /** Whether all current items are checked */
  isAllSelected: boolean;
  /** Toggled when user clicks 'Select All' */
  onToggleSelectAll: () => void;
  /** Toggled when user clicks 'Cancel' */
  onCancel: () => void;
  /** Dynamic action buttons */
  actions: BatchToolbarAction[];
  /** Optional sticky top coordinate (defaults to 115px) */
  topPosition?: string | number;
}

export const BatchActionToolbar: React.FC<BatchActionToolbarProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  onToggleSelectAll,
  onCancel,
  actions,
  topPosition = '115px'
}) => {
  return (
    <div
      style={{
        background: '#0f172a',
        color: 'white',
        borderRadius: '16px',
        padding: '0.75rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        boxShadow: '0 10px 25px -5px rgba(15,23,42,0.4)',
        position: 'sticky',
        top: topPosition,
        zIndex: 90,
        border: '1px solid #334155',
        direction: 'rtl'
      }}
    >
      {/* Top Row: Checkbox Select All, Selection Count Badge, Cancel Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.4rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onToggleSelectAll}
            style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#3b82f6' }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
            בחר הכל ({totalCount})
          </span>
        </label>

        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#93c5fd',
            background: 'rgba(59,130,246,0.18)',
            border: '1px solid rgba(59,130,246,0.3)',
            padding: '2px 8px',
            borderRadius: '12px'
          }}
        >
          נבחרו: {selectedCount}
        </div>

        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#cbd5e1',
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ✕ ביטול
        </button>
      </div>

      {/* Bottom Row: Symmetrical Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${actions.length}, 1fr)`,
          gap: '0.35rem',
          alignItems: 'center'
        }}
      >
        {actions.map(action => {
          const isDisabled = action.disabled || selectedCount === 0;

          let btnStyle: React.CSSProperties = {
            border: 'none',
            padding: '0.55rem 0.25rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.76rem',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.2rem',
            whiteSpace: 'nowrap',
            minWidth: 0,
            ...action.customStyle
          };

          if (!action.customStyle?.background) {
            switch (action.variant) {
              case 'primary':
                btnStyle.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
                btnStyle.color = 'white';
                btnStyle.boxShadow = isDisabled ? 'none' : '0 2px 8px rgba(99,102,241,0.35)';
                break;
              case 'info':
                btnStyle.background = '#0284c7';
                btnStyle.color = 'white';
                break;
              case 'secondary':
                btnStyle.background = '#10b981';
                btnStyle.color = 'white';
                break;
              case 'danger':
                btnStyle.background = 'rgba(239, 68, 68, 0.2)';
                btnStyle.color = '#fca5a5';
                btnStyle.border = '1px solid #ef4444';
                break;
              default:
                btnStyle.background = '#334155';
                btnStyle.color = 'white';
            }
          }

          return (
            <button
              key={action.id}
              type="button"
              disabled={isDisabled}
              onClick={action.onClick}
              style={btnStyle}
              title={action.title}
            >
              <span style={{ fontSize: '0.88rem' }}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BatchActionToolbar;
