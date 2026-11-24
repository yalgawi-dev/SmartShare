'use client';

import React, { useState } from 'react';
import {
  CalendarChild,
  CustodyPresetId,
  ParentRole,
  SmartCalendarConfig,
} from '@/types/calendar';
import { buildCustodyPreset, HEBREW_DAYS_SHORT } from '@/utils/calendarCustodyEngine';

interface FamilySetupModalProps {
  config: SmartCalendarConfig;
  onClose: () => void;
  onSave: (next: SmartCalendarConfig) => Promise<void>;
}

const CHILD_COLORS = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
const CHILD_EMOJIS = ['🧒', '👧', '👦', '👶', '🌟'];

export const FamilySetupModal: React.FC<FamilySetupModalProps> = ({
  config,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<SmartCalendarConfig>(() =>
    JSON.parse(JSON.stringify(config))
  );
  const [newChildName, setNewChildName] = useState('');
  const [newChildBirth, setNewChildBirth] = useState('');
  const [newChildPhone, setNewChildPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePresetChange = (preset: CustodyPresetId) => {
    const built = buildCustodyPreset(preset, draft.custodyPattern.weekendAnchorDate);
    setDraft((prev) => ({
      ...prev,
      custodyPattern: {
        ...built,
        weekendAnchorParent: prev.custodyPattern.weekendAnchorParent,
        handoverTime: prev.custodyPattern.handoverTime || '16:00',
      },
    }));
  };

  const toggleWeekday = (dow: number) => {
    setDraft((prev) => ({
      ...prev,
      custodyPattern: {
        ...prev.custodyPattern,
        preset: 'custom',
        weekdayAssignments: {
          ...prev.custodyPattern.weekdayAssignments,
          [dow]:
            prev.custodyPattern.weekdayAssignments[dow] === 'parent_a'
              ? 'parent_b'
              : 'parent_a',
        },
      },
    }));
  };

  const addChild = () => {
    if (!newChildName.trim()) return;
    const idx = draft.children.length;
    const child: CalendarChild = {
      id: `child_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: newChildName.trim(),
      birthDate: newChildBirth || undefined,
      phone: newChildPhone.trim() || undefined,
      color: CHILD_COLORS[idx % CHILD_COLORS.length],
      emoji: CHILD_EMOJIS[idx % CHILD_EMOJIS.length],
      notifyEnabled: Boolean(newChildPhone.trim()),
    };
    setDraft((prev) => ({ ...prev, children: [...prev.children, child] }));
    setNewChildName('');
    setNewChildBirth('');
    setNewChildPhone('');
  };

  const removeChild = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      children: prev.children.filter((c) => c.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <form
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
            ⚙️ הגדרות משפחה, ילדים וזמני שהות
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Solo vs Shared Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>אופן ניהול היומן:</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, isSoloMode: true }))}
              style={{
                padding: '0.55rem',
                borderRadius: '12px',
                border: draft.isSoloMode ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: draft.isSoloMode ? '#eff6ff' : '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔒 ניהול אישי שקט
              <div style={{ fontSize: '0.67rem', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
                הורה אחד — ללא צורך שההורה השני יצטרף
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, isSoloMode: false }))}
              style={{
                padding: '0.55rem',
                borderRadius: '12px',
                border: !draft.isSoloMode ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                background: !draft.isSoloMode ? '#f5f3ff' : '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🤝 משותף לשני ההורים
              <div style={{ fontSize: '0.67rem', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
                כולל בקשות החלפה ואישור דו-צדדי
              </div>
            </button>
          </div>
        </div>

        {/* Parents Profiles & Birthdates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          {(['parent_a', 'parent_b'] as ParentRole[]).map((role) => {
            const p = draft.parents[role];
            return (
              <div
                key={role}
                style={{
                  background: '#f8fafc',
                  border: `1.5px solid ${p.color}55`,
                  borderRadius: '12px',
                  padding: '0.6rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: p.color }}>
                  {role === 'parent_a' ? 'הורה א׳' : 'הורה ב׳'}
                </div>
                <input
                  type="text"
                  value={p.name}
                  placeholder="שם (למשל: אבא / אמא)"
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      parents: {
                        ...prev.parents,
                        [role]: { ...prev.parents[role], name: e.target.value },
                      },
                    }))
                  }
                  style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
                <label style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  🎂 תאריך לידה:
                  <input
                    type="date"
                    value={p.birthDate || ''}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        parents: {
                          ...prev.parents,
                          [role]: { ...prev.parents[role], birthDate: e.target.value || undefined },
                        },
                      }))
                    }
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.76rem', marginTop: '2px' }}
                  />
                </label>
              </div>
            );
          })}
        </div>

        {/* Children Profiles (with BirthDate + Phone for Kid Transparency!) */}
        <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>
            👨‍👩‍👧‍👦 ילדים (תאריכי לידה + טלפון לעדכונים לילד)
          </div>
          {draft.children.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#ffffff',
                padding: '0.45rem 0.65rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <strong>{c.emoji} {c.name}</strong>
                {c.birthDate && <span style={{ color: '#64748b' }}> • 🎂 {c.birthDate}</span>}
                {c.phone && <span style={{ color: '#15803d' }}> • 📱 {c.phone}</span>}
              </div>
              <button
                type="button"
                onClick={() => removeChild(c.id)}
                style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                הסר
              </button>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="שם הילד/ה"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
            <input
              type="tel"
              placeholder="טלפון הילד (לעדכון וואטסאפ)"
              value={newChildPhone}
              onChange={(e) => setNewChildPhone(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="date"
              value={newChildBirth}
              onChange={(e) => setNewChildBirth(e.target.value)}
              style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
            <button
              type="button"
              onClick={addChild}
              style={{
                padding: '0.48rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: '#0ea5e9',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ➕ הוסף ילד
            </button>
          </div>
        </div>

        {/* Custody Pattern Setup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>
            📅 הסדר זמני שהות בסיסי:
          </label>
          <select
            value={draft.custodyPattern.preset}
            onChange={(e) => handlePresetChange(e.target.value as CustodyPresetId)}
            style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <option value="primary_midweek_alt_wknd">משמורת עיקרית + יום באמצע שבוע וסופ״ש לסירוגין</option>
            <option value="primary_alt_wknd">משמורת עיקרית + סופ״ש לסירוגין בלבד</option>
            <option value="equal_2_2_3">הורות משותפת (2-2-3 / חלוקה שווה)</option>
            <option value="equal_alt_weeks">שבוע-שבוע (שבוע אצל כל הורה)</option>
            <option value="custom">התאמה אישית מלאה לפי ימי השבוע</option>
          </select>

          {/* Clickable Weekday Chips */}
          {draft.custodyPattern.preset !== 'equal_alt_weeks' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {HEBREW_DAYS_SHORT.map((lbl, dow) => {
                const role = draft.custodyPattern.weekdayAssignments[dow] || 'parent_a';
                const p = draft.parents[role];
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleWeekday(dow)}
                    style={{
                      padding: '0.45rem 0.2rem',
                      borderRadius: '10px',
                      border: `2px solid ${p.color}`,
                      background: `${p.color}18`,
                      color: p.color,
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span>{lbl}</span>
                    <span style={{ fontSize: '0.62rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {p.name.slice(0, 5)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Alternating Weekends + Anchor */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={draft.custodyPattern.weekendAlternating}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  custodyPattern: { ...prev.custodyPattern, weekendAlternating: e.target.checked },
                }))
              }
              style={{ accentColor: '#4f46e5', width: '16px', height: '16px' }}
            />
            <span>סופי שבוע (שישי-שבת) מתחלפים לסירוגין</span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>
              תאריך עוגן (שבת):
              <input
                type="date"
                value={draft.custodyPattern.weekendAnchorDate}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    custodyPattern: { ...prev.custodyPattern, weekendAnchorDate: e.target.value },
                  }))
                }
                style={{ width: '100%', padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', marginTop: '2px' }}
              />
            </label>
            <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>
              מי בשבת העוגן?
              <select
                value={draft.custodyPattern.weekendAnchorParent}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    custodyPattern: { ...prev.custodyPattern, weekendAnchorParent: e.target.value as ParentRole },
                  }))
                }
                style={{ width: '100%', padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.75rem', marginTop: '2px' }}
              >
                <option value="parent_a">{draft.parents.parent_a.name}</option>
                <option value="parent_b">{draft.parents.parent_b.name}</option>
              </select>
            </label>
            <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>
              שעת מעבר רגילה:
              <input
                type="time"
                value={draft.custodyPattern.handoverTime || '16:00'}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    custodyPattern: { ...prev.custodyPattern, handoverTime: e.target.value },
                  }))
                }
                style={{ width: '100%', padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', marginTop: '2px' }}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.75rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '0.92rem',
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'שומר הגדרות...' : '💾 שמור הגדרות משפחה'}
        </button>
      </form>
    </div>
  );
};
