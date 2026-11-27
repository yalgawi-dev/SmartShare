'use client';

import React from 'react';

interface CalendarUnifiedHeaderProps {
  resolution: 'month' | 'week' | 'day';
  onChangeResolution: (res: 'month' | 'week' | 'day') => void;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  prevLabel?: string;
  nextLabel?: string;
}

/**
 * DRY Single Source of Truth Calendar Header across ALL 3 views (Monthly / Weekly / Daily).
 * Guarantees identical eye-line alignment and ZERO text truncation on mobile!
 */
export const CalendarUnifiedHeader: React.FC<CalendarUnifiedHeaderProps> = ({
  resolution,
  onChangeResolution,
  title,
  onPrev,
  onNext,
  onToday,
  prevLabel = 'קודם',
  nextLabel = 'הבא',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        background: '#ffffff',
        padding: '0.42rem 0.5rem',
        borderRadius: '15px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      }}
    >
      {/* Row 1: Fixed-Position Resolution Switcher + Today */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            background: '#f1f5f9',
            padding: '2.5px',
            borderRadius: '10px',
            gap: '2px',
          }}
        >
          {(
            [
              { id: 'month', label: 'חודשי' },
              { id: 'week', label: 'שבועי' },
              { id: 'day', label: 'יומי' },
            ] as const
          ).map((r) => {
            const active = resolution === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onChangeResolution(r.id)}
                style={{
                  padding: '0.28rem 0.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#0f172a' : '#64748b',
                  fontWeight: active ? 900 : 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 4px rgba(15,23,42,0.1)' : 'none',
                  transition: 'all 0.14s ease',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToday}
          style={{
            padding: '0.3rem 0.65rem',
            borderRadius: '10px',
            border: '1px solid #c7d2fe',
            background: '#eef2ff',
            color: '#4338ca',
            fontSize: '0.74rem',
            fontWeight: 900,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          היום
        </button>
      </div>

      {/* Row 2: Full-Width Uncut Period Title + Natural RTL Prev/Next Arrows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <button
          type="button"
          onClick={onPrev}
          style={{
            width: '32px',
            height: '30px',
            borderRadius: '9px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title={prevLabel}
        >
          ▶
        </button>

        <h3
          style={{
            margin: 0,
            fontSize: '0.96rem',
            fontWeight: 900,
            color: '#0f172a',
            textAlign: 'center',
            flex: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h3>

        <button
          type="button"
          onClick={onNext}
          style={{
            width: '32px',
            height: '30px',
            borderRadius: '9px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title={nextLabel}
        >
          ◀
        </button>
      </div>
    </div>
  );
};
