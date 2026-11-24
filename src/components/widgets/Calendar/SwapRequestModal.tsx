'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ParentRole,
  SmartCalendarConfig,
  SwapRequestItem,
  SwapRequestType,
} from '@/types/calendar';

interface SwapRequestModalProps {
  initialDate: string;
  config: SmartCalendarConfig;
  defaultFromParent: ParentRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onSubmit: (payload: Omit<SwapRequestItem, 'id' | 'createdAt'>) => Promise<void>;
}

export const SwapRequestModal: React.FC<SwapRequestModalProps> = ({
  initialDate,
  config,
  defaultFromParent,
  currentUserId,
  currentUserName,
  onClose,
  onSubmit,
}) => {
  const [swapType, setSwapType] = useState<SwapRequestType>('one_time');
  const [targetDate, setTargetDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [returnDate, setReturnDate] = useState('');
  const [returnEndDate, setReturnEndDate] = useState('');
  const [fromParent, setFromParent] = useState<ParentRole>(defaultFromParent);
  const [toParent, setToParent] = useState<ParentRole>(
    defaultFromParent === 'parent_a' ? 'parent_b' : 'parent_a'
  );
  const [allChildren, setAllChildren] = useState(true);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>(
    config.children.map((c) => c.id)
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;

  const toggleChild = (cid: string) => {
    setSelectedChildIds((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) return;
    if (swapType === 'two_way' && !returnDate) {
      alert('בהחלפה דו-כיוונית (תן וקח) יש לבחור גם תאריך תמורה.');
      return;
    }
    if (!allChildren && selectedChildIds.length === 0) {
      alert('נא לבחור לפחות ילד אחד.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        type: swapType,
        targetDate,
        endDate: endDate && endDate >= targetDate ? endDate : targetDate,
        ...(swapType === 'two_way'
          ? {
              returnDate,
              returnEndDate:
                returnEndDate && returnEndDate >= returnDate ? returnEndDate : returnDate,
            }
          : {}),
        fromParent,
        toParent,
        childIds: allChildren || config.children.length === 0 ? 'all' : selectedChildIds,
        reason: reason.trim() || undefined,
        status: config.isSoloMode ? 'recorded_solo' : 'pending',
        requestedBy: currentUserId,
        requestedByName: currentUserName,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
        onSubmit={handleSave}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
            🔄 {config.isSoloMode ? 'תיעוד החלפת יום / שבת' : 'בקשת החלפת יום / שבת'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* 3 Swap Modes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
            איך ההחלפה תשפיע על הלוח?
          </label>
          {[
            {
              id: 'one_time' as SwapRequestType,
              title: 'החלפה חד-פעמית בלבד (לא מזיזה את הרצף קדימה)',
              desc: 'שומר על רצף השבתות הרגיל (למשל: מאפשר 2 שבתות ברצף בלי לשנות את שאר השנה)',
            },
            {
              id: 'two_way' as SwapRequestType,
              title: 'החלפה דו-כיוונית (תן וקח — תאריך מול תאריך)',
              desc: 'מעביר תאריך/סופ״ש אחד ומקבל תאריך/סופ״ש חלופי בתמורה בבקשה אחת',
            },
            {
              id: 'shift_forward' as SwapRequestType,
              title: 'הזזת הרצף קדימה (היפוך מחזור מכאן והלאה)',
              desc: 'הופך את סדר השבתות/השבועות מתאריך זה קדימה',
            },
          ].map((opt) => (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.55rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '12px',
                border: swapType === opt.id ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                background: swapType === opt.id ? '#eef2ff' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="swapType"
                checked={swapType === opt.id}
                onChange={() => setSwapType(opt.id)}
                style={{ marginTop: '3px', accentColor: '#4f46e5' }}
              />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{opt.title}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Target Date Range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 700 }}>
            מתאריך
            <input
              type="date"
              required
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </label>
          {swapType !== 'shift_forward' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 700 }}>
              עד תאריך (כולל)
              <input
                type="date"
                value={endDate}
                min={targetDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
              />
            </label>
          )}
        </div>

        {/* Who takes these dates */}
        {swapType !== 'shift_forward' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 700 }}>
              היה אמור להיות אצל:
              <select
                value={fromParent}
                onChange={(e) => {
                  const val = e.target.value as ParentRole;
                  setFromParent(val);
                  setToParent(val === 'parent_a' ? 'parent_b' : 'parent_a');
                }}
                style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="parent_a">{pA.name}</option>
                <option value="parent_b">{pB.name}</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 700 }}>
              עובר להיות אצל:
              <select
                value={toParent}
                onChange={(e) => setToParent(e.target.value as ParentRole)}
                style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="parent_a">{pA.name}</option>
                <option value="parent_b">{pB.name}</option>
              </select>
            </label>
          </div>
        )}

        {/* Two-way Return Date */}
        {swapType === 'two_way' && (
          <div
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: '12px',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#5b21b6' }}>
              🔁 בתמורה — התאריכים שיעברו ל-{fromParent === 'parent_a' ? pA.name : pB.name}:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => {
                  setReturnDate(e.target.value);
                  if (!returnEndDate || returnEndDate < e.target.value) setReturnEndDate(e.target.value);
                }}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #c4b5fd' }}
              />
              <input
                type="date"
                value={returnEndDate}
                min={returnDate}
                onChange={(e) => setReturnEndDate(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #c4b5fd' }}
              />
            </div>
          </div>
        )}

        {/* Per-Child Scope */}
        {config.children.length > 0 && swapType !== 'shift_forward' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>
              על אילו ילדים ההחלפה חלה?
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAllChildren(true)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  border: allChildren ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: allChildren ? '#eff6ff' : '#ffffff',
                  color: allChildren ? '#1d4ed8' : '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                👨‍👩‍👧‍👦 כל הילדים
              </button>
              <button
                type="button"
                onClick={() => setAllChildren(false)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  border: !allChildren ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: !allChildren ? '#f5f3ff' : '#ffffff',
                  color: !allChildren ? '#6d28d9' : '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🎯 ילדים ספציפיים בלבד
              </button>
            </div>
            {!allChildren && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                {config.children.map((c) => {
                  const checked = selectedChildIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChild(c.id)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '10px',
                        border: checked ? `2px solid ${c.color}` : '1px solid #cbd5e1',
                        background: checked ? `${c.color}18` : '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {checked ? '✓ ' : ''}{c.emoji || '🧒'} {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <input
          type="text"
          placeholder="סיבה / הערה לתיעוד (אופציונלי, למשל: אירוע משפחתי / מילואים)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              padding: '0.72rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'שומר...' : config.isSoloMode ? '✅ שמור ותעד בלוח' : '📩 שלח בקשת החלפה'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.72rem 1rem',
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
