'use client';

import React from 'react';

interface HebrewTimeSelectProps {
  value: string; // "HH:mm"
  onChange: (next: string) => void;
  quickPresets?: string[];
  compact?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/**
 * Reusable, mobile-friendly digital time picker (DRY Single Source of Truth).
 * Replaces Android's awkward analog clock <input type="time"> dial with clean hour:minute selects
 * and optional 1-tap preset chips.
 */
export const HebrewTimeSelect: React.FC<HebrewTimeSelectProps> = ({
  value,
  onChange,
  quickPresets,
  compact = false,
}) => {
  const [rawH, rawM] = (value || '16:00').split(':');
  const hour = HOURS.includes(rawH) ? rawH : '16';
  const minute = MINUTES.includes(rawM)
    ? rawM
    : String(Math.round((Number(rawM) || 0) / 5) * 5 % 60).padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', minWidth: 0 }}>
      <div
        dir="ltr"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <select
          aria-label="שעה"
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
          style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: compact ? '0.4rem 0.25rem' : '0.48rem 0.35rem',
            borderRadius: '9px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontWeight: 800,
            fontSize: compact ? '0.8rem' : '0.88rem',
            textAlign: 'center',
          }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span style={{ fontWeight: 900, color: '#475569', fontSize: '0.95rem' }}>:</span>

        <select
          aria-label="דקות"
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
          style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: compact ? '0.4rem 0.25rem' : '0.48rem 0.35rem',
            borderRadius: '9px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontWeight: 800,
            fontSize: compact ? '0.8rem' : '0.88rem',
            textAlign: 'center',
          }}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {quickPresets && quickPresets.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {quickPresets.map((preset) => {
            const active = `${hour}:${minute}` === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                style={{
                  padding: '2px 7px',
                  borderRadius: '7px',
                  border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                  background: active ? '#eef2ff' : '#ffffff',
                  color: active ? '#4338ca' : '#475569',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
