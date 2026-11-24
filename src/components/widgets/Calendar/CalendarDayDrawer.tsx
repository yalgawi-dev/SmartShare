'use client';

import React, { useState } from 'react';
import {
  CalendarEventCategory,
  CalendarEventItem,
  ParentRole,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  buildKidDailyMessage,
  buildWhatsAppLink,
  getBirthdaysForDate,
  HEBREW_DAYS_FULL,
  parseYMD,
  resolveDayCustody,
  SPECIAL_PERIOD_META,
} from '@/utils/calendarCustodyEngine';

interface CalendarDayDrawerProps {
  selectedDate: string;
  config: SmartCalendarConfig;
  events: CalendarEventItem[];
  swaps: SwapRequestItem[];
  currentUserId: string;
  onAddEvent: (ev: Omit<CalendarEventItem, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onOpenSwapModal: (defaultFrom: ParentRole) => void;
  onToggleBagItem: (bagId: string) => Promise<void>;
}

const EVENT_CAT_META: Record<CalendarEventCategory, { label: string; icon: string; color: string }> = {
  doctor: { label: 'רופא / בדיקה', icon: '🩺', color: '#dc2626' },
  school: { label: 'בית ספר / גן', icon: '🏫', color: '#2563eb' },
  activity: { label: 'חוג / פעילות', icon: '🏅', color: '#7c3aed' },
  general: { label: 'אירוע כללי', icon: '📌', color: '#0f766e' },
};

export const CalendarDayDrawer: React.FC<CalendarDayDrawerProps> = ({
  selectedDate,
  config,
  events,
  swaps,
  currentUserId,
  onAddEvent,
  onDeleteEvent,
  onOpenSwapModal,
  onToggleBagItem,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('doctor');
  const [childScope, setChildScope] = useState<string>('all');
  const [location, setLocation] = useState('');
  const [driverParent, setDriverParent] = useState<ParentRole | 'both' | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBag, setShowBag] = useState(false);

  const dateObj = parseYMD(selectedDate);
  const dayName = HEBREW_DAYS_FULL[dateObj.getDay()];
  const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
  const dow = dateObj.getDay();

  const resolution =
    config.mode === 'parenting'
      ? resolveDayCustody(selectedDate, config, swaps)
      : null;
  const birthdays = getBirthdaysForDate(selectedDate, config);
  const dayEvents = events.filter((e) => e.date === selectedDate);
  const dayActivities = (config.activities || []).filter((a) => a.daysOfWeek.includes(dow));

  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAddEvent({
        title: title.trim(),
        date: selectedDate,
        time: time || undefined,
        category,
        childIds: childScope === 'all' ? 'all' : [childScope],
        location: location.trim() || undefined,
        driverParent: driverParent || undefined,
        notes: notes.trim() || undefined,
        createdBy: currentUserId,
      });
      setTitle('');
      setTime('');
      setLocation('');
      setNotes('');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleNotifyChild = (child: SmartCalendarConfig['children'][number] | null) => {
    if (!resolution) return;
    const msg = buildKidDailyMessage(child, selectedDate, resolution, config, dayEvents);
    const url = buildWhatsAppLink(child?.phone, msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '18px',
        border: '1px solid #e2e8f0',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Header: Date + Primary Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
            יום {dayName}, {formattedDate}
          </div>
          {resolution && (
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
              {resolution.overallParent === 'split' ? (
                <span>⚖️ הילדים מפוצלים היום בין ההורים</span>
              ) : (
                <span>
                  🏠 הילדים אצל{' '}
                  <strong style={{ color: config.parents[resolution.overallParent].color }}>
                    {config.parents[resolution.overallParent].name}
                  </strong>
                  {resolution.source === 'swap' && ' (החלפה מאושרת 🔄)'}
                  {resolution.source === 'special_period' && ' (מצב מיוחד 🛡️)'}
                  {resolution.source === 'school_break' && ' (חופשה/חג 🏖️)'}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {config.mode === 'parenting' && resolution && (
            <button
              type="button"
              onClick={() =>
                onOpenSwapModal(
                  resolution.overallParent === 'parent_b' ? 'parent_b' : 'parent_a'
                )
              }
              style={{
                padding: '0.42rem 0.72rem',
                borderRadius: '10px',
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔄 {config.isSoloMode ? 'תעד החלפה' : 'בקש החלפה'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            style={{
              padding: '0.42rem 0.72rem',
              borderRadius: '10px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {showAddForm ? '✕ סגור' : '➕ תור / אירוע'}
          </button>
        </div>
      </div>

      {/* Special / Emergency Period Banner */}
      {resolution?.activeSpecialPeriod && (
        <div
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '12px',
            background: SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].bg,
            color: SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].color,
            border: '1px solid currentColor',
            fontSize: '0.8rem',
            fontWeight: 800,
          }}
        >
          {SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].icon}{' '}
          {resolution.activeSpecialPeriod.title}
          {resolution.activeSpecialPeriod.notes ? ` — ${resolution.activeSpecialPeriod.notes}` : ''}
        </div>
      )}

      {/* School Break Banner */}
      {resolution?.activeSchoolBreak && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '10px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '0.78rem',
            fontWeight: 800,
          }}
        >
          🏖️ {resolution.activeSchoolBreak.title}
        </div>
      )}

      {/* Birthdays Banner */}
      {birthdays.length > 0 && (
        <div
          style={{
            padding: '0.55rem 0.75rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #fdf2f8, #fef3c7)',
            border: '1px solid #fbcfe8',
            color: '#9d174d',
            fontSize: '0.82rem',
            fontWeight: 800,
          }}
        >
          {birthdays.map((b, i) => (
            <div key={i}>
              {b.emoji} יום הולדת שמח ל<strong>{b.name}</strong>
              {b.age !== null ? ` (גיל ${b.age})` : ''}!
            </div>
          ))}
        </div>
      )}

      {/* Per-Child Breakdown + 1-Click Kid WhatsApp Transparency */}
      {config.mode === 'parenting' && resolution && (
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '13px',
            border: '1px solid #e2e8f0',
            padding: '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>
              📲 שקיפות ועדכון לילדים על היום:
            </span>
            <button
              type="button"
              onClick={() => handleNotifyChild(null)}
              style={{
                padding: '0.28rem 0.65rem',
                borderRadius: '999px',
                border: '1px solid #86efac',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              💬 שלח עדכון כללי לילדים
            </button>
          </div>

          {config.children.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {config.children.map((child) => {
                const role = resolution.byChild[child.id] || 'parent_a';
                const host = config.parents[role];
                return (
                  <div
                    key={child.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{child.emoji || '🧒'}</span>
                      <strong>{child.name}</strong>
                      <span style={{ color: '#64748b' }}>← אצל</span>
                      <span
                        style={{
                          padding: '1px 7px',
                          borderRadius: '999px',
                          background: `${host.color}18`,
                          color: host.color,
                          fontWeight: 800,
                        }}
                      >
                        {host.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNotifyChild(child)}
                      style={{
                        padding: '0.22rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        background: '#ecfdf5',
                        color: '#166534',
                        fontSize: '0.71rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                      title={child.phone ? `שלח ל-${child.phone}` : 'בחר איש קשר בוואטסאפ'}
                    >
                      📲 עדכן את {child.name}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inline Add Event Form */}
      {showAddForm && (
        <form
          onSubmit={handleSaveEvent}
          style={{
            background: '#f8fafc',
            borderRadius: '14px',
            border: '1.5px solid #cbd5e1',
            padding: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
          }}
        >
          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
            ➕ הוספת תור / אירוע ליום {dayName} ({formattedDate})
          </div>
          <input
            type="text"
            required
            placeholder="כותרת (למשל: רופא שיניים, אסיפת הורים, בדיקת דם)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '0.55rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CalendarEventCategory)}
              style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.82rem' }}
            >
              <option value="doctor">🩺 רופא / בדיקה</option>
              <option value="school">🏫 בית ספר / גן</option>
              <option value="activity">🏅 חוג / פעילות</option>
              <option value="general">📌 אירוע כללי</option>
            </select>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            {config.children.length > 0 && (
              <select
                value={childScope}
                onChange={(e) => setChildScope(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.82rem' }}
              >
                <option value="all">👨‍👩‍👧‍👦 כל הילדים</option>
                {config.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji || '🧒'} {c.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={driverParent}
              onChange={(e) => setDriverParent(e.target.value as any)}
              style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.82rem' }}
            >
              <option value="">🚗 מי מסיע/מלווה? (אופציונלי)</option>
              <option value="parent_a">{pA.name}</option>
              <option value="parent_b">{pB.name}</option>
              <option value="both">שני ההורים</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="מיקום / הערה (אופציונלי)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
          />
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.6rem',
              borderRadius: '10px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'שומר...' : 'שמור אירוע ביומן'}
          </button>
        </form>
      )}

      {/* Scheduled Activities for this day of week */}
      {dayActivities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#6d28d9' }}>🏅 חוגים קבועים היום:</div>
          {dayActivities.map((act) => {
            const child = config.children.find((c) => c.id === act.childId);
            return (
              <div
                key={act.id}
                style={{
                  padding: '0.5rem 0.7rem',
                  borderRadius: '10px',
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{act.title}</strong>
                  {child && <span style={{ color: '#6d28d9' }}> • {child.name}</span>}
                  {act.location && <span style={{ color: '#64748b' }}> ({act.location})</span>}
                </div>
                {act.time && <span style={{ fontWeight: 800, color: '#5b21b6' }}>🕒 {act.time}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Day Events List */}
      {dayEvents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>📌 תורים ואירועים היום:</div>
          {dayEvents.map((ev) => {
            const meta = EVENT_CAT_META[ev.category] || EVENT_CAT_META.general;
            return (
              <div
                key={ev.id}
                style={{
                  padding: '0.55rem 0.7rem',
                  borderRadius: '11px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRight: `4px solid ${meta.color}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    {meta.icon} {ev.title} {ev.time ? `• ${ev.time}` : ''}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {ev.location ? `📍 ${ev.location} ` : ''}
                    {ev.driverParent
                      ? `• 🚗 ${ev.driverParent === 'both' ? 'שני ההורים' : config.parents[ev.driverParent]?.name}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteEvent(ev.id)}
                  style={{
                    border: 'none',
                    background: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '8px',
                    padding: '0.28rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  מחק
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        dayActivities.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '0.4rem 0' }}>
            אין תורים או אירועים מיוחדים רשומים ליום זה.
          </div>
        )
      )}

      {/* Handover Bag Checklist (Collapsible) */}
      {config.mode === 'parenting' && (config.handoverBag || []).length > 0 && (
        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.55rem' }}>
          <button
            type="button"
            onClick={() => setShowBag((p) => !p)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              padding: '0.2rem 0',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <span>🎒 צ׳קליסט תיק מעבר בין הורים ({config.handoverBag.filter((b) => b.checked).length}/{config.handoverBag.length})</span>
            <span>{showBag ? '▲' : '▼'}</span>
          </button>
          {showBag && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
              {config.handoverBag.map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.8rem',
                    color: item.checked ? '#94a3b8' : '#0f172a',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.checked)}
                    onChange={() => onToggleBagItem(item.id)}
                    style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
