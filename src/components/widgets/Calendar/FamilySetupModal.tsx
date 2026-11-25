'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarChild,
  CustodyPresetId,
  ParentRole,
  SmartCalendarConfig,
  WeekendCycleType,
} from '@/types/calendar';
import {
  buildCustodyPreset,
  getNextSaturdayYMD,
  HEBREW_DAYS_FULL,
  HEBREW_DAYS_SHORT,
  parseYMD,
} from '@/utils/calendarCustodyEngine';
import { HebrewTimeSelect } from './HebrewTimeSelect';

interface FamilySetupModalProps {
  config: SmartCalendarConfig;
  onClose: () => void;
  onSave: (next: SmartCalendarConfig) => Promise<void>;
}

const PARENT_COLOR_PALETTE = [
  '#2563eb', // Royal Blue
  '#ec4899', // Vibrant Rose
  '#7c3aed', // Vivid Violet
  '#059669', // Emerald
  '#ea580c', // Warm Coral/Orange
  '#0891b2', // Ocean Teal
];

const CHILD_COLORS = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
const CHILD_EMOJIS = ['🧒', '👧', '👦', '🌟', '🎈'];

const fullInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '0.52rem 0.65rem',
  borderRadius: '10px',
  border: '1.5px solid #cbd5e1',
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
    const curAnchor = cloned.custodyPattern?.weekendAnchorDate;
    const isSat = curAnchor ? parseYMD(curAnchor).getDay() === 6 : false;
    if (!curAnchor || !isSat) {
      cloned.custodyPattern.weekendAnchorDate = getNextSaturdayYMD();
    }
    if (!cloned.custodyPattern.weekendCycle) {
      cloned.custodyPattern.weekendCycle = cloned.custodyPattern.weekendAlternating ? '1_1' : 'fixed';
    }
    return cloned;
  });

  const [newChildName, setNewChildName] = useState('');
  const [newChildBirth, setNewChildBirth] = useState('');
  const [newChildPhone, setNewChildPhone] = useState('');
  const [showChildExtras, setShowChildExtras] = useState(false);
  const [showManualAnchorDate, setShowManualAnchorDate] = useState(false);
  const [showAdvancedParents, setShowAdvancedParents] = useState(false);
  const [saving, setSaving] = useState(false);

  const pA = draft.parents.parent_a;
  const pB = draft.parents.parent_b;
  const effectiveCycle: WeekendCycleType =
    draft.custodyPattern.weekendCycle || (draft.custodyPattern.weekendAlternating ? '1_1' : 'fixed');

  const handlePresetChange = (preset: CustodyPresetId) => {
    const built = buildCustodyPreset(preset, draft.custodyPattern.weekendAnchorDate);
    setDraft((prev) => ({
      ...prev,
      custodyPattern: {
        ...built,
        weekendCycle: built.weekendAlternating ? (prev.custodyPattern.weekendCycle || '1_1') : 'fixed',
        weekendAnchorParent: prev.custodyPattern.weekendAnchorParent,
        handoverTime: prev.custodyPattern.handoverTime || '16:00',
      },
    }));
  };

  const setWeekendCycle = (cycle: WeekendCycleType) => {
    setDraft((prev) => ({
      ...prev,
      custodyPattern: {
        ...prev.custodyPattern,
        weekendCycle: cycle,
        weekendAlternating: cycle !== 'fixed',
      },
    }));
  };

  const toggleWeekday = (dow: number) => {
    setDraft((prev) => ({
      ...prev,
      custodyPattern: {
        ...prev.custodyPattern,
        preset: prev.custodyPattern.preset === 'equal_alt_weeks' ? 'custom' : 'custom',
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
    return `${d.getDate()}.${d.getMonth() + 1}`;
  })();

  const anchorParentName =
    draft.custodyPattern.weekendAnchorParent === 'parent_a' ? pA.name : pB.name;
  const otherParentName =
    draft.custodyPattern.weekendAnchorParent === 'parent_a' ? pB.name : pA.name;

  // Live visual summary of weekdays assigned to Parent B (days 0..4)
  const parentBWeekdays = [0, 1, 2, 3, 4]
    .filter((d) => draft.custodyPattern.weekdayAssignments[d] === 'parent_b')
    .map((d) => HEBREW_DAYS_FULL[d]);

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.65rem',
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
          maxWidth: '490px',
          maxHeight: '92dvh',
          background: '#ffffff',
          borderRadius: '22px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(15,23,42,0.35)',
          boxSizing: 'border-box',
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#0f172a' }}>
              ⚙️ הגדרת לוח השנה בקליק
            </h3>
            <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
              הורים, ילדים, ימים קבועים ומחזוריות שבתות — ויזואלי ומהיר
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '1.05rem',
              cursor: 'pointer',
              color: '#475569',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
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
            padding: '1rem 1.05rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxSizing: 'border-box',
          }}
        >
          {/* STEP 1: PARENTS & VIBRANT COLORS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                1. שמות וצבעי ההורים בלוח
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedParents((v) => !v)}
                style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
              >
                {showAdvancedParents ? 'הסתר ימי הולדת' : '+ תאריכי לידה ומצב סולו'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.55rem' }}>
              {(['parent_a', 'parent_b'] as ParentRole[]).map((role) => {
                const p = draft.parents[role];
                return (
                  <div
                    key={role}
                    style={{
                      minWidth: 0,
                      boxSizing: 'border-box',
                      background: `${p.color}0d`,
                      border: `2px solid ${p.color}55`,
                      borderRadius: '14px',
                      padding: '0.6rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                    }}
                  >
                    <input
                      type="text"
                      value={p.name}
                      placeholder={role === 'parent_a' ? 'אבא / אמא' : 'הורה שני'}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parents: {
                            ...prev.parents,
                            [role]: { ...prev.parents[role], name: e.target.value },
                          },
                        }))
                      }
                      style={{ ...fullInputStyle, fontWeight: 800, borderColor: `${p.color}66` }}
                    />
                    {/* Vibrant Color Swatches */}
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {PARENT_COLOR_PALETTE.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              parents: {
                                ...prev.parents,
                                [role]: { ...prev.parents[role], color: hex },
                              },
                            }))
                          }
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: hex,
                            border: p.color === hex ? '2.5px solid #0f172a' : '2px solid #ffffff',
                            boxShadow: p.color === hex ? '0 0 0 2px rgba(15,23,42,0.2)' : '0 1px 3px rgba(0,0,0,0.18)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          title="בחר צבע להורה בלוח"
                        />
                      ))}
                    </div>
                    {showAdvancedParents && (
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
                        style={{ ...fullInputStyle, padding: '0.35rem 0.45rem', fontSize: '0.75rem' }}
                        title="תאריך לידה"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {showAdvancedParents && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, isSoloMode: true }))}
                  style={{
                    padding: '0.48rem',
                    borderRadius: '10px',
                    border: draft.isSoloMode ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: draft.isSoloMode ? '#eff6ff' : '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🔒 ניהול אישי שקט
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, isSoloMode: false }))}
                  style={{
                    padding: '0.48rem',
                    borderRadius: '10px',
                    border: !draft.isSoloMode ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: !draft.isSoloMode ? '#f5f3ff' : '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🤝 משותף לשני ההורים
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: ULTRA-FAST 1-ROW KIDS ADDER */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                2. הילדים ({draft.children.length})
              </span>
              <button
                type="button"
                onClick={() => setShowChildExtras((v) => !v)}
                style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
              >
                {showChildExtras ? 'פשוט' : '+ תאריך לידה / טלפון לילד'}
              </button>
            </div>

            {draft.children.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {draft.children.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: '#ffffff',
                      border: `1.5px solid ${c.color}66`,
                      borderRadius: '999px',
                      padding: '0.28rem 0.6rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    <span>{c.emoji} {c.name}</span>
                    {c.birthDate && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>🎂</span>}
                    <button
                      type="button"
                      onClick={() => removeChild(c.id)}
                      style={{ border: 'none', background: '#fee2e2', color: '#dc2626', width: '18px', height: '18px', borderRadius: '50%', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      title="הסר"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick 1-Line Add */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder="הקלד שם ילד/ה (למשל: הילי, איתי)..."
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChild();
                  }
                }}
                style={{ ...fullInputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={addChild}
                disabled={!newChildName.trim()}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: newChildName.trim() ? '#0284c7' : '#cbd5e1',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: newChildName.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
              >
                + הוסף
              </button>
            </div>

            {showChildExtras && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <input
                  type="date"
                  value={newChildBirth}
                  onChange={(e) => setNewChildBirth(e.target.value)}
                  style={{ ...fullInputStyle, fontSize: '0.76rem' }}
                  title="תאריך לידה"
                />
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="טלפון הילד (אופציונלי)"
                  value={newChildPhone}
                  onChange={(e) => setNewChildPhone(e.target.value)}
                  style={{ ...fullInputStyle, fontSize: '0.76rem', textAlign: 'left' }}
                />
              </div>
            )}
          </div>

          {/* STEP 3: VISUAL 7-DAY FIXED SCHEDULE PICKER */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              padding: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                3. ימים קבועים בשבוע (לחיצה מחליפה הורה)
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'primary_midweek_alt_wknd' as CustodyPresetId, lbl: 'אמצע שבוע' },
                  { id: 'equal_2_2_3' as CustodyPresetId, lbl: '2-2-3' },
                  { id: 'equal_alt_weeks' as CustodyPresetId, lbl: 'שבוע-שבוע' },
                ].map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => handlePresetChange(pr.id)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '7px',
                      border: draft.custodyPattern.preset === pr.id ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                      background: draft.custodyPattern.preset === pr.id ? '#eef2ff' : '#f8fafc',
                      color: draft.custodyPattern.preset === pr.id ? '#4338ca' : '#475569',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {pr.lbl}
                  </button>
                ))}
              </div>
            </div>

            {draft.custodyPattern.preset === 'equal_alt_weeks' ? (
              <div
                style={{
                  padding: '0.65rem',
                  borderRadius: '11px',
                  background: '#eef2ff',
                  color: '#3730a3',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              >
                🔁 מצב שבוע שלם אצל כל הורה לפי המחזוריות למטה (לחץ "אמצע שבוע" כדי לבחור ימים בודדים)
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '5px' }}>
                  {HEBREW_DAYS_SHORT.map((lbl, dow) => {
                    const isWeekendControlled = effectiveCycle !== 'fixed' && (dow === 5 || dow === 6);
                    const role = draft.custodyPattern.weekdayAssignments[dow] || 'parent_a';
                    const p = draft.parents[role];
                    return (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => {
                          if (isWeekendControlled) {
                            setWeekendCycle('fixed');
                          }
                          toggleWeekday(dow);
                        }}
                        style={{
                          padding: '0.55rem 0.15rem',
                          borderRadius: '12px',
                          border: isWeekendControlled ? '2px dashed #94a3b8' : `2px solid ${p.color}`,
                          background: isWeekendControlled ? '#f1f5f9' : p.color,
                          color: isWeekendControlled ? '#475569' : '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: 0,
                          boxShadow: isWeekendControlled ? 'none' : `0 3px 8px ${p.color}44`,
                          transition: 'all 0.14s ease',
                        }}
                        title={isWeekendControlled ? 'סופ״ש מנוהל לפי מחזוריות שבתות למטה' : `לחץ להחלפת הורה ביום ${HEBREW_DAYS_FULL[dow]}`}
                      >
                        <span>{lbl}</span>
                        <span style={{ fontSize: '0.6rem', opacity: 0.95, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', whiteSpace: 'nowrap' }}>
                          {isWeekendControlled ? 'מחזורי' : p.name.slice(0, 5)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.73rem', color: '#475569', fontWeight: 700, textAlign: 'center' }}>
                  {parentBWeekdays.length > 0
                    ? `אמצע שבוע אצל ${pB.name}: ${parentBWeekdays.join(', ')} • שאר ימי החול אצל ${pA.name}`
                    : `כל ימי אמצע השבוע אצל ${pA.name} (לחץ על יום כמו ב׳ או ד׳ להעברה ל-${pB.name})`}
                </div>
              </>
            )}
          </div>

          {/* STEP 4: VISUAL UPCOMING SHABBAT & CYCLE RATIO (1:1 / 1:2 / 2:1) */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              padding: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                4. השבת הקרובה ({anchorDisplay}) אצל מי?
              </span>
              <button
                type="button"
                onClick={() => setShowManualAnchorDate((v) => !v)}
                style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
              >
                {showManualAnchorDate ? 'סגור תאריך' : '📅 שנה תאריך עוגן'}
              </button>
            </div>

            {/* Big Visual Parent Toggle for Upcoming Saturday */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {(['parent_a', 'parent_b'] as ParentRole[]).map((role) => {
                const p = draft.parents[role];
                const active = draft.custodyPattern.weekendAnchorParent === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        custodyPattern: { ...prev.custodyPattern, weekendAnchorParent: role },
                      }))
                    }
                    style={{
                      padding: '0.62rem 0.5rem',
                      borderRadius: '12px',
                      border: active ? `2.5px solid ${p.color}` : '1.5px solid #cbd5e1',
                      background: active ? p.color : '#ffffff',
                      color: active ? '#ffffff' : '#334155',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: active ? `0 4px 12px ${p.color}44` : 'none',
                      transition: 'all 0.14s ease',
                    }}
                  >
                    {active ? '✓ ' : ''}{p.name}
                  </button>
                );
              })}
            </div>

            {showManualAnchorDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="date"
                  value={draft.custodyPattern.weekendAnchorDate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      custodyPattern: { ...prev.custodyPattern, weekendAnchorDate: e.target.value },
                    }))
                  }
                  style={{ ...fullInputStyle, flex: 1 }}
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
                    style={{ border: 'none', background: '#eef2ff', color: '#4338ca', borderRadius: '8px', padding: '0.45rem 0.65rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    שבת קרובה
                  </button>
                )}
              </div>
            )}

            {/* Visual Cycle Ratio Cards (1:1, 1:2, 2:1, Fixed) */}
            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#334155', marginTop: '0.15rem' }}>
              מחזוריות שבתות:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {[
                {
                  id: '1_1' as WeekendCycleType,
                  title: '🔁 1:1 — שבוע-שבוע',
                  sub: 'שבת כן, שבת לא לסירוגין',
                },
                {
                  id: '1_2' as WeekendCycleType,
                  title: '📅 1:2 — שבוע / שבועיים',
                  sub: `שבת אצל ${anchorParentName}, שתיים אצל ${otherParentName}`,
                },
                {
                  id: '2_1' as WeekendCycleType,
                  title: '📅 2:1 — שבועיים / שבוע',
                  sub: `שתיים אצל ${anchorParentName}, שבת אצל ${otherParentName}`,
                },
                {
                  id: 'fixed' as WeekendCycleType,
                  title: '📌 קבוע ללא מחזוריות',
                  sub: 'לפי בחירת הימים למעלה בלבד',
                },
              ].map((opt) => {
                const active = effectiveCycle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWeekendCycle(opt.id)}
                    style={{
                      padding: '0.55rem 0.6rem',
                      borderRadius: '12px',
                      border: active ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                      background: active ? '#eef2ff' : '#ffffff',
                      color: active ? '#312e81' : '#334155',
                      textAlign: 'right',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 900 }}>{opt.title}</span>
                    <span style={{ fontSize: '0.66rem', color: active ? '#4338ca' : '#64748b', fontWeight: 600 }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Handover Time */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.35rem', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 800 }}>
                🕒 שעת מעבר רגילה:
              </span>
              <HebrewTimeSelect
                value={draft.custodyPattern.handoverTime || '16:00'}
                onChange={(t) =>
                  setDraft((prev) => ({
                    ...prev,
                    custodyPattern: { ...prev.custodyPattern, handoverTime: t },
                  }))
                }
                compact
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer Save Bar */}
        <div
          style={{
            padding: '0.8rem 1.05rem',
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
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.92rem',
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(79,70,229,0.32)',
            }}
          >
            {saving ? 'שומר וצובע את הלוח...' : '✨ שמור וצבע את הלוח'}
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
