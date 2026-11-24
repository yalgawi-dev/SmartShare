'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarChild,
  CustodyPresetId,
  ParentRole,
  SmartCalendarConfig,
} from '@/types/calendar';
import {
  buildCustodyPreset,
  getNextSaturdayYMD,
  HEBREW_DAYS_SHORT,
  parseYMD,
} from '@/utils/calendarCustodyEngine';
import { HebrewTimeSelect } from './HebrewTimeSelect';

interface FamilySetupModalProps {
  config: SmartCalendarConfig;
  onClose: () => void;
  onSave: (next: SmartCalendarConfig) => Promise<void>;
}

const CHILD_COLORS = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
const CHILD_EMOJIS = ['🧒', '👧', '👦', '👶', '🌟'];

const fullInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '0.5rem 0.6rem',
  borderRadius: '9px',
  border: '1px solid #cbd5e1',
  fontSize: '0.84rem',
  background: '#ffffff',
  color: '#0f172a',
};

export const FamilySetupModal: React.FC<FamilySetupModalProps> = ({
  config,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<SmartCalendarConfig>(() => {
    const cloned: SmartCalendarConfig = JSON.parse(JSON.stringify(config));
    // Auto-snap weekend anchor to upcoming Saturday if empty or not currently a Saturday
    const curAnchor = cloned.custodyPattern?.weekendAnchorDate;
    const isSat = curAnchor ? parseYMD(curAnchor).getDay() === 6 : false;
    if (!curAnchor || !isSat) {
      cloned.custodyPattern.weekendAnchorDate = getNextSaturdayYMD();
    }
    return cloned;
  });

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

  const buildChildObject = (idx: number): CalendarChild => ({
    id: `child_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: newChildName.trim(),
    birthDate: newChildBirth || undefined,
    phone: newChildPhone.trim() || undefined,
    color: CHILD_COLORS[idx % CHILD_COLORS.length],
    emoji: CHILD_EMOJIS[idx % CHILD_EMOJIS.length],
    notifyEnabled: Boolean(newChildPhone.trim()),
  });

  const addChild = () => {
    if (!newChildName.trim()) return;
    const child = buildChildObject(draft.children.length);
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
      // Safety net: if user typed a child name and clicked Save without clicking "+ אשר והוסף ילד", auto-include it!
      let finalDraft = draft;
      if (newChildName.trim()) {
        finalDraft = {
          ...draft,
          children: [...draft.children, buildChildObject(draft.children.length)],
        };
      }
      await onSave(finalDraft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const nextSatYMD = getNextSaturdayYMD();
  const anchorDisplay = (() => {
    if (!draft.custodyPattern.weekendAnchorDate) return '';
    const d = parseYMD(draft.custodyPattern.weekendAnchorDate);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  })();

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <form
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92dvh',
          background: '#ffffff',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          boxSizing: 'border-box',
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.95rem 1.15rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#0f172a' }}>
            ⚙️ הגדרות משפחה, ילדים וזמני שהות
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '1.05rem',
              cursor: 'pointer',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.95rem',
            boxSizing: 'border-box',
          }}
        >
          {/* Solo vs Shared Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>אופן ניהול היומן:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, isSoloMode: true }))}
                style={{
                  padding: '0.55rem 0.45rem',
                  borderRadius: '12px',
                  border: draft.isSoloMode ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: draft.isSoloMode ? '#eff6ff' : '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                🔒 ניהול אישי שקט
                <div style={{ fontSize: '0.67rem', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
                  הורה אחד — ללא צורך בהצטרפות הצד השני
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, isSoloMode: false }))}
                style={{
                  padding: '0.55rem 0.45rem',
                  borderRadius: '12px',
                  border: !draft.isSoloMode ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: !draft.isSoloMode ? '#f5f3ff' : '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'center',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.55rem' }}>
            {(['parent_a', 'parent_b'] as ParentRole[]).map((role) => {
              const p = draft.parents[role];
              return (
                <div
                  key={role}
                  style={{
                    minWidth: 0,
                    boxSizing: 'border-box',
                    background: '#f8fafc',
                    border: `1.5px solid ${p.color}55`,
                    borderRadius: '12px',
                    padding: '0.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: p.color }}>
                    {role === 'parent_a' ? 'הורה א׳' : 'הורה ב׳'}
                  </div>
                  <input
                    type="text"
                    value={p.name}
                    placeholder="שם (אבא / אמא)"
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        parents: {
                          ...prev.parents,
                          [role]: { ...prev.parents[role], name: e.target.value },
                        },
                      }))
                    }
                    style={fullInputStyle}
                  />
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>🎂 תאריך לידה:</span>
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
                      style={{ ...fullInputStyle, padding: '0.38rem 0.45rem', fontSize: '0.76rem' }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {/* Children Profiles (Zero Overflow + Clear Add Confirmation) */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              boxSizing: 'border-box',
            }}
          >
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
                  gap: '0.4rem',
                  background: '#ffffff',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>{c.emoji} {c.name}</strong>
                  {c.birthDate && <span style={{ color: '#64748b' }}> • 🎂 {c.birthDate}</span>}
                  {c.phone && <span style={{ color: '#15803d' }}> • 📱 {c.phone}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => removeChild(c.id)}
                  style={{
                    border: 'none',
                    background: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  הסר
                </button>
              </div>
            ))}

            {/* Clean Contained Add Child Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px dashed #94a3b8',
                borderRadius: '12px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span>שם הילד/ה</span>
                  <input
                    type="text"
                    placeholder="למשל: איתי"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    style={fullInputStyle}
                  />
                </label>
                <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span>טלפון הילד (אופציונלי)</span>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="050-0000000"
                    value={newChildPhone}
                    onChange={(e) => setNewChildPhone(e.target.value)}
                    style={{ ...fullInputStyle, textAlign: 'left' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.45rem', alignItems: 'end' }}>
                <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span>🎂 תאריך לידה (אופציונלי)</span>
                  <input
                    type="date"
                    value={newChildBirth}
                    onChange={(e) => setNewChildBirth(e.target.value)}
                    style={{ ...fullInputStyle, padding: '0.44rem 0.5rem' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={addChild}
                  disabled={!newChildName.trim()}
                  style={{
                    padding: '0.52rem 0.9rem',
                    borderRadius: '9px',
                    border: 'none',
                    background: newChildName.trim() ? '#0284c7' : '#cbd5e1',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: newChildName.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ אשר והוסף ילד
                </button>
              </div>
              {newChildName.trim() && (
                <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>
                  💡 לחץ "✓ אשר והוסף ילד" כדי להוסיף לרשימה (או לחץ שמור למטה והוא יתווסף אוטומטית).
                </div>
              )}
            </div>
          </div>

          {/* Custody Pattern Setup */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a' }}>
              📅 הסדר זמני שהות בסיסי:
            </label>
            <select
              value={draft.custodyPattern.preset}
              onChange={(e) => handlePresetChange(e.target.value as CustodyPresetId)}
              style={{ ...fullInputStyle, fontWeight: 700 }}
            >
              <option value="primary_midweek_alt_wknd">משמורת עיקרית + יום באמצע שבוע וסופ״ש לסירוגין</option>
              <option value="primary_alt_wknd">משמורת עיקרית + סופ״ש לסירוגין בלבד</option>
              <option value="equal_2_2_3">הורות משותפת (2-2-3 / חלוקה שווה)</option>
              <option value="equal_alt_weeks">שבוע-שבוע (שבוע אצל כל הורה)</option>
              <option value="custom">התאמה אישית מלאה לפי ימי השבוע</option>
            </select>

            {/* Clickable Weekday Chips */}
            {draft.custodyPattern.preset !== 'equal_alt_weeks' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
                {HEBREW_DAYS_SHORT.map((lbl, dow) => {
                  const role = draft.custodyPattern.weekdayAssignments[dow] || 'parent_a';
                  const p = draft.parents[role];
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => toggleWeekday(dow)}
                      style={{
                        padding: '0.45rem 0.15rem',
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
                        minWidth: 0,
                      }}
                    >
                      <span>{lbl}</span>
                      <span style={{ fontSize: '0.62rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', whiteSpace: 'nowrap' }}>
                        {p.name.slice(0, 5)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Alternating Weekends */}
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

            {/* Smart Next Saturday Anchor + Host */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>שבת עוגן (ברירת מחדל: הקרובה)</span>
                </span>
                <input
                  type="date"
                  value={draft.custodyPattern.weekendAnchorDate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      custodyPattern: { ...prev.custodyPattern, weekendAnchorDate: e.target.value },
                    }))
                  }
                  style={{ ...fullInputStyle, padding: '0.44rem 0.45rem', fontSize: '0.78rem' }}
                />
                {draft.custodyPattern.weekendAnchorDate !== nextSatYMD && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        custodyPattern: { ...prev.custodyPattern, weekendAnchorDate: nextSatYMD },
                      }))
                    }
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', textAlign: 'right', padding: 0 }}
                  >
                    ↩ החזר לשבת הקרובה ({nextSatYMD})
                  </button>
                )}
              </label>

              <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                <span>מי אצל הילדים בשבת {anchorDisplay}?</span>
                <select
                  value={draft.custodyPattern.weekendAnchorParent}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      custodyPattern: { ...prev.custodyPattern, weekendAnchorParent: e.target.value as ParentRole },
                    }))
                  }
                  style={{ ...fullInputStyle, padding: '0.46rem 0.45rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <option value="parent_a">{draft.parents.parent_a.name}</option>
                  <option value="parent_b">{draft.parents.parent_b.name}</option>
                </select>
              </label>
            </div>

            {/* Digital Hebrew Time Picker (Replaces clunky Android analog clock!) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 800 }}>
                🕒 שעת מעבר / איסוף רגילה:
              </span>
              <HebrewTimeSelect
                value={draft.custodyPattern.handoverTime || '16:00'}
                onChange={(t) =>
                  setDraft((prev) => ({
                    ...prev,
                    custodyPattern: { ...prev.custodyPattern, handoverTime: t },
                  }))
                }
                quickPresets={['15:00', '16:00', '17:00', '18:00', '20:00']}
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer Save Bar — ALWAYS visible above FloatingActionBar! */}
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            flexShrink: 0,
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
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
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
