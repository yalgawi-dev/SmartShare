'use client';

import React from 'react';
import {
  ASSISTANT_PERSONAS,
  type AssistantPersonaId,
} from './assistantPersonas';

interface AssistantPersonaPickerProps {
  selectedPersonaId: AssistantPersonaId;
  onSelectPersona: (id: AssistantPersonaId) => void;
  onPreviewPersona: (id: AssistantPersonaId) => void;
  onClose: () => void;
}

export function AssistantPersonaPicker({
  selectedPersonaId,
  onSelectPersona,
  onPreviewPersona,
  onClose,
}: AssistantPersonaPickerProps) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f8fafc',
        borderBottom: '1.5px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#0f172a' }}>
          🎙️ בחר דובר/ת ותמונה לסוכן שלך:
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#e2e8f0',
            border: 'none',
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          סיום ✓
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
        {ASSISTANT_PERSONAS.map((persona) => {
          const isSelected = persona.id === selectedPersonaId;
          return (
            <div
              key={persona.id}
              onClick={() => onSelectPersona(persona.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 6px',
                borderRadius: '13px',
                border: isSelected ? `2px solid ${persona.accentColor}` : '1.5px solid #cbd5e1',
                background: isSelected ? '#eef2ff' : '#ffffff',
                boxShadow: isSelected ? '0 4px 12px rgba(79,70,229,0.18)' : '0 1px 2px rgba(15,23,42,0.05)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelected && (
                <span
                  style={{
                    position: 'absolute',
                    top: '5px',
                    left: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    color: '#fff',
                    background: persona.accentColor,
                    borderRadius: '999px',
                    padding: '1px 5px',
                  }}
                >
                  ✓
                </span>
              )}
              <img
                src={persona.avatarUrl}
                alt={persona.name}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${isSelected ? persona.accentColor : '#e2e8f0'}`,
                }}
              />
              <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#0f172a' }}>
                {persona.name}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>
                {persona.voiceTagline}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPersona(persona.id);
                  onPreviewPersona(persona.id);
                }}
                style={{
                  marginTop: '2px',
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: `1px solid ${persona.accentColor}`,
                  background: '#ffffff',
                  color: persona.accentColor,
                  fontSize: '0.69rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ▶ השמע קול
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
