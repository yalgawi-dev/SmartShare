'use client';

import React, { useState, useEffect } from 'react';
import {
  ASSISTANT_PERSONAS,
  type AssistantPersonaId,
} from './assistantPersonas';
import {
  loadLearnedPlaybooks,
  deleteLearnedPlaybook,
  clearLearnedPlaybooks,
} from './agentPlanOrchestrator';
import type { AgentPlaybook } from './agentManifest';

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
  const [activeTab, setActiveTab] = useState<'voices' | 'brain'>('voices');
  const [proNotice, setProNotice] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<AgentPlaybook[]>([]);

  useEffect(() => {
    setPlaybooks(loadLearnedPlaybooks('smartshare'));
  }, [activeTab]);

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
      {/* Top Bar: 2 Clean Tabs (Voices | Learned Brain) + Done */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '2px', borderRadius: '9px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('voices')}
            style={{
              padding: '3px 9px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'voices' ? '#ffffff' : 'transparent',
              color: activeTab === 'voices' ? '#4338ca' : '#475569',
              fontSize: '0.73rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🎙️ דובר
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brain')}
            style={{
              padding: '3px 9px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'brain' ? '#ffffff' : 'transparent',
              color: activeTab === 'brain' ? '#4338ca' : '#475569',
              fontSize: '0.73rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🧠 מה למדתי ({playbooks.length})
          </button>
        </div>

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

      {activeTab === 'voices' ? (
        <>
          {proNotice && (
            <div
              style={{
                padding: '5px 8px',
                borderRadius: '9px',
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                color: '#92400e',
                fontSize: '0.72rem',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {proNotice}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
            {ASSISTANT_PERSONAS.map((persona) => {
              const isSelected = persona.id === selectedPersonaId;
              const isLocked = Boolean(persona.isPremium);
              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    if (isLocked) {
                      setProNotice(`🔒 הקול של ${persona.name} יהיה זמין במסלול Pro בקרוב!`);
                      return;
                    }
                    setProNotice(null);
                    onSelectPersona(persona.id);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 6px',
                    borderRadius: '13px',
                    border: isSelected ? `2px solid ${persona.accentColor}` : '1.5px solid #cbd5e1',
                    background: isSelected ? '#eef2ff' : isLocked ? '#f1f5f9' : '#ffffff',
                    opacity: isLocked ? 0.78 : 1,
                    boxShadow: isSelected ? '0 4px 12px rgba(79,70,229,0.18)' : '0 1px 2px rgba(15,23,42,0.05)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && !isLocked && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '5px',
                        left: '6px',
                        fontSize: '0.66rem',
                        fontWeight: 900,
                        color: '#fff',
                        background: persona.accentColor,
                        borderRadius: '999px',
                        padding: '1px 6px',
                      }}
                    >
                      ✓ פעיל
                    </span>
                  )}
                  {isLocked && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '5px',
                        left: '6px',
                        fontSize: '0.64rem',
                        fontWeight: 900,
                        color: '#92400e',
                        background: '#fef3c7',
                        border: '1px solid #fcd34d',
                        borderRadius: '999px',
                        padding: '1px 6px',
                      }}
                    >
                      🔒 Pro
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
                      filter: isLocked ? 'grayscale(25%)' : 'none',
                      border: `2px solid ${isSelected ? persona.accentColor : '#e2e8f0'}`,
                    }}
                  />
                  <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#0f172a' }}>
                    {persona.name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>
                    {persona.voiceTagline}
                  </div>
                  {isLocked ? (
                    <span
                      style={{
                        marginTop: '2px',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        border: '1px solid #cbd5e1',
                        background: '#e2e8f0',
                        color: '#475569',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                      }}
                    >
                      🔒 במסלול Pro
                    </span>
                  ) : (
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
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
          {playbooks.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', padding: '12px 6px' }}>
              עדיין לא נלמדו תרחישים רב-שלביים. בכל פעם שאבצע מערכה בהצלחה — אשמור אותה כאן לשימוש מיידי בפעם הבאה!
            </div>
          ) : (
            <>
              {playbooks.map((pb) => (
                <div
                  key={pb.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🧠 {pb.title}
                    </div>
                    <div style={{ fontSize: '0.67rem', color: '#64748b' }}>
                      {pb.toolSequence.length} צעדים • {pb.uses} הצלחות • ציון {pb.score}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlaybooks(deleteLearnedPlaybook('smartshare', pb.id))}
                    title="מחק תבנית נלמדת"
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '7px',
                      color: '#dc2626',
                      padding: '3px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  clearLearnedPlaybooks('smartshare');
                  setPlaybooks([]);
                }}
                style={{
                  alignSelf: 'flex-end',
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔄 נקה את כל התבניות שנלמדו
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
