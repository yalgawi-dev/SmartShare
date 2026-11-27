'use client';

import React, { useState } from 'react';
import {
  CalendarEventCategory,
  CalendarEventItem,
  CalendarEventVisibility,
  CustomCalendarCategory,
  ParentRole,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  buildKidDailyMessage,
  buildWhatsAppLink,
  detectDayTimeConflicts,
  getBirthdaysForDate,
  HEBREW_DAYS_FULL,
  HEBREW_MONTHS,
  parseYMD,
  resolveDayCustody,
  SPECIAL_PERIOD_META,
} from '@/utils/calendarCustodyEngine';
import { HebrewTimeSelect } from './HebrewTimeSelect';

interface CalendarDayDrawerProps {
  selectedDate: string;
  config: SmartCalendarConfig;
  events: CalendarEventItem[];
  swaps: SwapRequestItem[];
  currentUserId: string;
  defaultVisibility?: CalendarEventVisibility;
  initialShowAddForm?: boolean;
  onAddEvent: (ev: Omit<CalendarEventItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateEvent?: (ev: CalendarEventItem, patch: Partial<Omit<CalendarEventItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteEvent: (ev: CalendarEventItem) => Promise<void>;
  onToggleComplete?: (ev: CalendarEventItem, completed: boolean) => Promise<void>;
  onOpenSwapModal: (defaultFrom: ParentRole) => void;
  onToggleBagItem: (bagId: string) => Promise<void>;
  onAddBagItem?: (label: string) => Promise<void>;
  onRemoveBagItem?: (bagId: string) => Promise<void>;
}

const CUSTOM_CATS_KEY = 'smartshare_calendar_custom_cats_v1';
const CUSTOM_EMOJIS = ['✨', '🏗️', '🚗', '🏋️', '💼', '🏠', '📞', '🎉'];

const EVENT_CAT_META: Record<CalendarEventCategory, { label: string; icon: string; color: string }> = {
  task: { label: 'משימה', icon: '✅', color: '#059669' },
  meeting: { label: 'פגישה', icon: '🤝', color: '#4f46e5' },
  note: { label: 'הערה', icon: '📝', color: '#d97706' },
  doctor: { label: 'רופא / תור', icon: '🩺', color: '#dc2626' },
  school: { label: 'בית ספר / גן', icon: '🏫', color: '#2563eb' },
  activity: { label: 'חוג / פעילות', icon: '🏅', color: '#7c3aed' },
  general: { label: 'כללי', icon: '📌', color: '#0f766e' },
};

function loadSavedCustomCategories(): CustomCalendarCategory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const CalendarDayDrawer: React.FC<CalendarDayDrawerProps> = ({
  selectedDate,
  config,
  events,
  swaps,
  currentUserId,
  defaultVisibility = 'shared',
  initialShowAddForm = false,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onToggleComplete,
  onOpenSwapModal,
  onToggleBagItem,
  onAddBagItem,
  onRemoveBagItem,
}) => {
  const [showAddForm, setShowAddForm] = useState(initialShowAddForm);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [title, setTitle] = useState('');
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState('16:00');
  const [category, setCategory] = useState<CalendarEventCategory>('task');
  const [selectedCustomCat, setSelectedCustomCat] = useState<CustomCalendarCategory | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCalendarCategory[]>(() =>
    loadSavedCustomCategories()
  );
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('✨');

  const [visibility, setVisibility] = useState<CalendarEventVisibility>(defaultVisibility);
  const [childScope, setChildScope] = useState<string>('all');
  const [location, setLocation] = useState('');
  const [driverParent, setDriverParent] = useState<ParentRole | 'both' | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBag, setShowBag] = useState(false);
  const [showKidsNotify, setShowKidsNotify] = useState(false);
  const [newBagItemLabel, setNewBagItemLabel] = useState('');

  const dateObj = parseYMD(selectedDate);
  const dayName = HEBREW_DAYS_FULL[dateObj.getDay()];
  const monthName = HEBREW_MONTHS[dateObj.getMonth()];
  const dayNum = dateObj.getDate();
  const formattedDate = `${dayNum}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;
  const dow = dateObj.getDay();

  const resolution =
    config.mode === 'parenting'
      ? resolveDayCustody(selectedDate, config, swaps)
      : null;
  const birthdays = getBirthdaysForDate(selectedDate, config);
  const dayEvents = events.filter((e) => e.date === selectedDate);
  const conflictIds = detectDayTimeConflicts(dayEvents);
  const dayActivities = (config.activities || []).filter((a) => a.daysOfWeek.includes(dow));

  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;

  const handleAddCustomCategory = () => {
    const lbl = newCatLabel.trim();
    if (!lbl) return;
    const item: CustomCalendarCategory = {
      id: `cc_${Date.now()}`,
      label: lbl,
      icon: newCatEmoji,
      color: '#0f766e',
    };
    const next = [...customCategories, item];
    setCustomCategories(next);
    try {
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next));
    } catch {}
    setCategory('general');
    setSelectedCustomCat(item);
    setNewCatLabel('');
    setShowNewCatForm(false);
  };

  const handleRemoveCustomCategory = (id: string) => {
    const next = customCategories.filter((c) => c.id !== id);
    setCustomCategories(next);
    if (selectedCustomCat?.id === id) setSelectedCustomCat(null);
    try {
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleStartEditEvent = (ev: CalendarEventItem) => {
    setEditingEvent(ev);
    setTitle(ev.title || '');
    setHasTime(Boolean(ev.time));
    setTime(ev.time || '16:00');
    setCategory(ev.category || 'task');
    setSelectedCustomCat(
      ev.customCategoryLabel
        ? { id: `edit_${ev.id}`, label: ev.customCategoryLabel, icon: ev.customCategoryIcon || '✨', color: '#0f766e' }
        : null
    );
    setVisibility(ev.visibility || defaultVisibility);
    setLocation(ev.location || '');
    setDriverParent(ev.driverParent || '');
    setNotes(ev.notes || '');
    setShowAddForm(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        date: selectedDate,
        time: hasTime ? time : '',
        category,
        ...(selectedCustomCat
          ? {
              customCategoryLabel: selectedCustomCat.label,
              customCategoryIcon: selectedCustomCat.icon,
            }
          : {}),
        visibility,
        childIds: (visibility === 'private' || childScope === 'all' ? 'all' : [childScope]) as 'all' | string[],
        location: location.trim() || undefined,
        driverParent: visibility === 'private' ? undefined : (driverParent || undefined),
        notes: notes.trim() || undefined,
      };
      if (editingEvent && onUpdateEvent) {
        await onUpdateEvent(editingEvent, payload);
      } else {
        await onAddEvent({
          ...payload,
          time: hasTime ? time : undefined,
          completed: false,
          createdBy: currentUserId,
        });
      }
      setEditingEvent(null);
      setTitle('');
      setHasTime(false);
      setLocation('');
      setNotes('');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBag = async () => {
    const lbl = newBagItemLabel.trim();
    if (!lbl || !onAddBagItem) return;
    setNewBagItemLabel('');
    await onAddBagItem(lbl);
  };

  const handleNotifyChild = (child: SmartCalendarConfig['children'][number] | null) => {
    if (!resolution) return;
    const msg = buildKidDailyMessage(child, selectedDate, resolution, config, dayEvents);
    const url = buildWhatsAppLink(child?.phone, msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const cubeColor = !resolution
    ? '#4f46e5'
    : resolution.overallParent === 'parent_a'
      ? pA.color
      : resolution.overallParent === 'parent_b'
        ? pB.color
        : '#7c3aed';

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '18px',
        border: `1.5px solid ${cubeColor}33`,
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.68rem',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* VISUAL HERO HEADER: Info + Actions on Right, Vivid Apple-Style Calendar Day Cube on Left! */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div>
            <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0f172a' }}>
              יום {dayName}, {dayNum} ב{monthName}
            </div>
            {resolution && (
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                {resolution.overallParent === 'split' ? (
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, background: '#f5f3ff', color: '#6d28d9', padding: '2px 9px', borderRadius: '999px', border: '1px solid #ddd6fe' }}>
                    ⚖️ הילדים מפוצלים היום
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      background: `${cubeColor}18`,
                      color: cubeColor,
                      border: `1px solid ${cubeColor}44`,
                      padding: '2px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    🏠 אצל {config.parents[resolution.overallParent].name}
                    {resolution.source === 'swap' ? ' • 🔄 החלפה' : ''}
                    {resolution.source === 'special_period' ? ' • 🛡️ מיוחד' : ''}
                    {resolution.source === 'school_break' ? ' • 🏖️ חופשה' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.38rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              style={{
                padding: '0.38rem 0.72rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {showAddForm ? '✕ סגור טופס' : '➕ הוסף ליום'}
            </button>
            {config.mode === 'parenting' && resolution && (
              <button
                type="button"
                onClick={() =>
                  onOpenSwapModal(
                    resolution.overallParent === 'parent_b' ? 'parent_b' : 'parent_a'
                  )
                }
                style={{
                  padding: '0.38rem 0.65rem',
                  borderRadius: '10px',
                  border: `1px solid ${cubeColor}44`,
                  background: `${cubeColor}12`,
                  color: cubeColor,
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🔄 {config.isSoloMode ? 'החלף יום' : 'בקש החלפה'}
              </button>
            )}
          </div>
        </div>

        {/* VIVID VISUAL DAY CUBE (Instant visual glance of Day + Date + Layer Color!) */}
        <div
          style={{
            width: '72px',
            minHeight: '78px',
            borderRadius: '16px',
            border: `2px solid ${cubeColor}`,
            background: '#ffffff',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: `0 6px 16px ${cubeColor}28`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '100%',
              background: cubeColor,
              color: '#ffffff',
              fontSize: '0.66rem',
              fontWeight: 900,
              textAlign: 'center',
              padding: '3px 2px',
              letterSpacing: '0.01em',
            }}
          >
            {monthName}
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 2px 5px',
            }}
          >
            <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
              {dayNum}
            </span>
            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: cubeColor, marginTop: '2px' }}>
              {dayName}
            </span>
          </div>
        </div>
      </div>

      {/* ADD FORM SITS IMMEDIATELY AT TOP WHEN OPEN (Zero scrolling!) */}
      {showAddForm && (
        <form
          onSubmit={handleSaveEvent}
          style={{
            background: visibility === 'private' ? '#faf5ff' : '#f8fafc',
            borderRadius: '14px',
            border: visibility === 'private' ? '1.5px solid #c084fc' : '1.5px solid #cbd5e1',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.52rem',
          }}
        >
          {/* Privacy Layer Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setVisibility('shared')}
              style={{
                padding: '0.42rem 0.35rem',
                borderRadius: '10px',
                border: visibility === 'shared' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: visibility === 'shared' ? '#eff6ff' : '#ffffff',
                color: visibility === 'shared' ? '#1d4ed8' : '#475569',
                fontWeight: 900,
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              🌐 משותף במרחב
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              style={{
                padding: '0.42rem 0.35rem',
                borderRadius: '10px',
                border: visibility === 'private' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                background: visibility === 'private' ? '#f3e8ff' : '#ffffff',
                color: visibility === 'private' ? '#6d28d9' : '#475569',
                fontWeight: 900,
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              🔒 אישי שלי בלבד
            </button>
          </div>

          {/* Open-Ended Categories: Built-in + Saved Custom Categories + "➕ קטגוריה חדשה" */}
          <div style={{ display: 'flex', gap: '0.32rem', flexWrap: 'wrap' }}>
            {(['task', 'meeting', 'note', 'doctor', 'school', 'activity'] as CalendarEventCategory[]).map((cat) => {
              const m = EVENT_CAT_META[cat];
              const active = !selectedCustomCat && category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setSelectedCustomCat(null);
                  }}
                  style={{
                    padding: '0.26rem 0.52rem',
                    borderRadius: '999px',
                    border: active ? `2px solid ${m.color}` : '1px solid #cbd5e1',
                    background: active ? `${m.color}18` : '#ffffff',
                    color: active ? m.color : '#475569',
                    fontSize: '0.71rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}

            {customCategories.map((cc) => {
              const active = selectedCustomCat?.id === cc.id;
              return (
                <span key={cc.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('general');
                      setSelectedCustomCat(cc);
                    }}
                    style={{
                      padding: '0.26rem 0.52rem',
                      borderRadius: '999px',
                      border: active ? `2px solid ${cc.color}` : '1px solid #cbd5e1',
                      background: active ? `${cc.color}18` : '#ffffff',
                      color: active ? cc.color : '#334155',
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {cc.icon} {cc.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomCategory(cc.id)}
                    style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer', padding: '0 2px' }}
                    title="הסר קטגוריה"
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            <button
              type="button"
              onClick={() => setShowNewCatForm((v) => !v)}
              style={{
                padding: '0.26rem 0.55rem',
                borderRadius: '999px',
                border: '1.5px dashed #6366f1',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: '0.71rem',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              ➕ קטגוריה חדשה
            </button>
          </div>

          {/* Inline Custom Category Creator */}
          {showNewCatForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: '#ffffff', padding: '0.5rem', borderRadius: '10px', border: '1px solid #c7d2fe' }}>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {CUSTOM_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewCatEmoji(em)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: newCatEmoji === em ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      background: newCatEmoji === em ? '#eef2ff' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <input
                  type="text"
                  placeholder="שם הקטגוריה (למשל: קבלן, מוסך, אימון)..."
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCategory();
                    }
                  }}
                  style={{ flex: 1, padding: '0.42rem 0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  style={{ padding: '0.42rem 0.7rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  הוסף
                </button>
              </div>
            </div>
          )}

          <input
            type="text"
            required
            placeholder={
              selectedCustomCat
                ? `כותרת (${selectedCustomCat.label})...`
                : category === 'task'
                  ? 'מה המשימה? (למשל: לשלוח אישור, לקנות ציוד)'
                  : category === 'meeting'
                    ? 'עם מי הפגישה? (למשל: פגישה עם קבלן / רו״ח)'
                    : category === 'note'
                      ? 'כתוב הערה ליום זה...'
                      : 'כותרת (למשל: רופא שיניים, אסיפת הורים)'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '0.52rem 0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />

          {/* Clean Optional Time Toggle + Location (replaces confusing empty [ v : v ]!) */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!hasTime ? (
              <button
                type="button"
                onClick={() => setHasTime(true)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '10px',
                  border: '1px dashed #94a3b8',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🕒 הוסף שעה
              </button>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', padding: '0.25rem 0.45rem', borderRadius: '10px', border: '1px solid #c7d2fe' }}>
                <HebrewTimeSelect value={time} onChange={setTime} compact />
                <button
                  type="button"
                  onClick={() => setHasTime(false)}
                  style={{ border: 'none', background: '#fee2e2', color: '#dc2626', width: '22px', height: '22px', borderRadius: '50%', fontSize: '0.68rem', cursor: 'pointer' }}
                  title="הסר שעה"
                >
                  ✕
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="מיקום / הערה נוספת (אופציונלי)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ flex: 1, minWidth: '140px', padding: '0.46rem 0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>

          {visibility === 'shared' && config.mode === 'parenting' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {config.children.length > 0 && (
                <select
                  value={childScope}
                  onChange={(e) => setChildScope(e.target.value)}
                  style={{ padding: '0.45rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem' }}
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
                style={{ padding: '0.45rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem' }}
              >
                <option value="">🚗 מי מסיע/מלווה? (אופציונלי)</option>
                <option value="parent_a">{pA.name}</option>
                <option value="parent_b">{pB.name}</option>
                <option value="both">שני ההורים</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.6rem',
              borderRadius: '10px',
              border: 'none',
              background: visibility === 'private' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
              color: '#ffffff',
              fontWeight: 900,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving
              ? 'שומר...'
              : editingEvent
                ? '💾 שמור שינויים'
                : visibility === 'private'
                  ? '🔒 שמור ביומן האישי שלי בלבד'
                  : '🌐 שמור ביומן המשותף'}
          </button>
        </form>
      )}

      {/* Time Conflict Warning Banner */}
      {conflictIds.size > 0 && (
        <div
          style={{
            padding: '0.52rem 0.72rem',
            borderRadius: '12px',
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            color: '#991b1b',
            fontSize: '0.78rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>⚠️</span>
          <span>שים לב! ישנה התנגשות שעות בין {conflictIds.size} פריטים ביום זה.</span>
        </div>
      )}

      {/* Special / Emergency Period Banner */}
      {resolution?.activeSpecialPeriod && (
        <div
          style={{
            padding: '0.55rem 0.72rem',
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
        <div style={{ padding: '0.48rem 0.72rem', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.78rem', fontWeight: 800 }}>
          🏖️ {resolution.activeSchoolBreak.title}
        </div>
      )}

      {/* Birthdays Banner */}
      {birthdays.length > 0 && (
        <div style={{ padding: '0.52rem 0.72rem', borderRadius: '12px', background: 'linear-gradient(135deg, #fdf2f8, #fef3c7)', border: '1px solid #fbcfe8', color: '#9d174d', fontSize: '0.82rem', fontWeight: 800 }}>
          {birthdays.map((b, i) => (
            <div key={i}>
              {b.emoji} יום הולדת שמח ל<strong>{b.name}</strong>
              {b.age !== null ? ` (גיל ${b.age})` : ''}!
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Activities for this day of week */}
      {dayActivities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#6d28d9' }}>🏅 חוגים קבועים היום:</div>
          {dayActivities.map((act) => {
            const child = config.children.find((c) => c.id === act.childId);
            return (
              <div key={act.id} style={{ padding: '0.5rem 0.7rem', borderRadius: '10px', background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* Day Tasks, Meetings, Notes & Events List */}
      {dayEvents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>
            📋 משימות, פגישות, הערות ותורים ({dayEvents.length}):
          </div>
          {dayEvents.map((ev) => {
            const meta = EVENT_CAT_META[ev.category] || EVENT_CAT_META.general;
            const displayIcon = ev.customCategoryIcon || meta.icon;
            const displayCatLabel = ev.customCategoryLabel || meta.label;
            const isPrivate = ev.visibility === 'private';
            const hasConflict = conflictIds.has(ev.id);
            const isTask = ev.category === 'task';
            return (
              <div
                key={ev.id}
                style={{
                  padding: '0.55rem 0.7rem',
                  borderRadius: '12px',
                  background: hasConflict ? '#fef2f2' : isPrivate ? '#faf5ff' : '#ffffff',
                  border: hasConflict ? '1.5px solid #ef4444' : isPrivate ? '1px solid #d8b4fe' : '1px solid #e2e8f0',
                  borderRight: `4px solid ${hasConflict ? '#ef4444' : meta.color}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: ev.completed ? 0.65 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.48rem', flex: 1, minWidth: 0 }}>
                  {isTask && onToggleComplete && (
                    <input
                      type="checkbox"
                      checked={Boolean(ev.completed)}
                      onChange={(e) => onToggleComplete(ev, e.target.checked)}
                      style={{ accentColor: '#059669', width: '17px', height: '17px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ fontSize: '0.82rem', minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', textDecoration: ev.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.32rem', flexWrap: 'wrap' }}>
                      <span>{displayIcon} {ev.title}</span>
                      {ev.customCategoryLabel && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '999px' }}>
                          {displayCatLabel}
                        </span>
                      )}
                      {ev.time && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 900, color: hasConflict ? '#dc2626' : '#4338ca', background: hasConflict ? '#fee2e2' : '#eef2ff', padding: '1px 6px', borderRadius: '6px' }}>
                          🕒 {ev.time}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: isPrivate ? '#ede9fe' : '#e0f2fe',
                          color: isPrivate ? '#6d28d9' : '#0369a1',
                        }}
                      >
                        {isPrivate ? '🔒 אישי שלי' : '🌐 משותף'}
                      </span>
                      {hasConflict && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 900, padding: '1px 6px', borderRadius: '999px', background: '#ef4444', color: '#ffffff' }}>
                          ⚠️ התנגשות
                        </span>
                      )}
                    </div>
                    {(ev.location || ev.driverParent) && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        {ev.location ? `📍 ${ev.location} ` : ''}
                        {ev.driverParent
                          ? `• 🚗 ${ev.driverParent === 'both' ? 'שני ההורים' : config.parents[ev.driverParent]?.name}`
                          : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem', flexShrink: 0 }}>
                  {onUpdateEvent && (
                    <button
                      type="button"
                      onClick={() => handleStartEditEvent(ev)}
                      aria-label={`ערוך ${ev.title}`}
                      style={{ border: 'none', background: '#eef2ff', color: '#4338ca', borderRadius: '8px', padding: '0.26rem 0.48rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                    >
                      ✏️ ערוך
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(ev)}
                    style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', padding: '0.26rem 0.48rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !showAddForm &&
        dayActivities.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '0.35rem 0' }}>
            אין משימות, פגישות או הערות ליום זה — לחץ למעלה כדי להוסיף.
          </div>
        )
      )}

      {/* Compact Collapsible Bottom Tools: Kids WhatsApp Update + Editable Handover Bag Checklist */}
      {config.mode === 'parenting' && resolution && (
        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowKidsNotify((p) => !p)}
              style={{
                flex: 1,
                padding: '0.38rem 0.55rem',
                borderRadius: '10px',
                border: showKidsNotify ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                background: showKidsNotify ? '#f0fdf4' : '#f8fafc',
                color: showKidsNotify ? '#15803d' : '#475569',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              📲 עדכון לילדים {showKidsNotify ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={() => setShowBag((p) => !p)}
              style={{
                flex: 1,
                padding: '0.38rem 0.55rem',
                borderRadius: '10px',
                border: showBag ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                background: showBag ? '#eef2ff' : '#f8fafc',
                color: showBag ? '#3730a3' : '#475569',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🎒 תיק מעבר ({(config.handoverBag || []).filter((b) => b.checked).length}/{(config.handoverBag || []).length}) {showBag ? '▲' : '▼'}
            </button>
          </div>

          {showKidsNotify && (
            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => handleNotifyChild(null)}
                style={{ padding: '0.32rem 0.6rem', borderRadius: '9px', border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
              >
                💬 שלח עדכון כללי בוואטסאפ
              </button>
              {config.children.map((child) => {
                const role = resolution.byChild[child.id] || 'parent_a';
                const host = config.parents[role];
                return (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '9px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>{child.emoji || '🧒'}</span>
                      <strong>{child.name}</strong>
                      <span style={{ color: host.color, fontWeight: 800 }}>({host.name})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNotifyChild(child)}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '7px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#166534', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      📲 שלח
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showBag && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0.55rem' }}>
              {(config.handoverBag || []).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.8rem',
                      color: item.checked ? '#94a3b8' : '#0f172a',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      cursor: 'pointer',
                      flex: 1,
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
                  {onRemoveBagItem && (
                    <button
                      type="button"
                      onClick={() => onRemoveBagItem(item.id)}
                      style={{ border: 'none', background: '#fef2f2', color: '#dc2626', width: '22px', height: '22px', borderRadius: '6px', fontSize: '0.68rem', cursor: 'pointer', flexShrink: 0 }}
                      title="הסר פריט"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {onAddBagItem && (
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <input
                    type="text"
                    placeholder="הוסף פריט חדש לצ׳קליסט..."
                    value={newBagItemLabel}
                    onChange={(e) => setNewBagItemLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBag();
                      }
                    }}
                    style={{ flex: 1, padding: '0.4rem 0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                  />
                  <button
                    type="button"
                    disabled={!newBagItemLabel.trim()}
                    onClick={handleAddBag}
                    style={{
                      padding: '0.4rem 0.7rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: newBagItemLabel.trim() ? '#059669' : '#cbd5e1',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: newBagItemLabel.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    + הוסף
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
