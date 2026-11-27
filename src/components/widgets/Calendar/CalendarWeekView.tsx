'use client';

import React, { useMemo } from 'react';
import {
  CalendarEventItem,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  detectDayTimeConflicts,
  getBirthdaysForDate,
  HEBREW_DAYS_FULL,
  HEBREW_DAYS_SHORT,
  HEBREW_MONTHS,
  parseYMD,
  resolveDayCustody,
  SPECIAL_PERIOD_META,
  toYMD,
} from '@/utils/calendarCustodyEngine';

interface CalendarWeekViewProps {
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
  onQuickAddForDate?: (ymd: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  resolution: 'month' | 'week' | 'day';
  onChangeResolution: (res: 'month' | 'week' | 'day') => void;
  config: SmartCalendarConfig;
  events: CalendarEventItem[];
  swaps: SwapRequestItem[];
  visualSwapMode?: boolean;
  swapFirstDate?: string | null;
  swapSecondDate?: string | null;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  selectedDate,
  onSelectDate,
  onQuickAddForDate,
  onPrevWeek,
  onNextWeek,
  onToday,
  resolution,
  onChangeResolution,
  config,
  events,
  swaps,
  visualSwapMode = false,
  swapFirstDate = null,
  swapSecondDate = null,
}) => {
  const todayYMD = toYMD(new Date());
  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;
  const isParenting = config.mode === 'parenting';

  const weekDays = useMemo(() => {
    const base = parseYMD(selectedDate);
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - base.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        ymd: toYMD(d),
        dayNum: d.getDate(),
        monthIdx: d.getMonth(),
        dow: i,
      };
    });
  }, [selectedDate]);

  const first = weekDays[0];
  const last = weekDays[6];
  const headerRangeLabel =
    first.monthIdx === last.monthIdx
      ? `${first.dayNum}–${last.dayNum} ${HEBREW_MONTHS[first.monthIdx]}`
      : `${first.dayNum}.${first.monthIdx + 1}–${last.dayNum}.${last.monthIdx + 1}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* STRICT SINGLE-ROW COMPACT HEADER: Week Nav + Today + Resolution Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.25rem',
          background: '#ffffff',
          padding: '0.36rem 0.45rem',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          flexWrap: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', minWidth: 0 }}>
          <button
            type="button"
            onClick={onPrevWeek}
            style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}
            title="שבוע קודם"
          >
            ◀
          </button>
          <h3 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {headerRangeLabel}
          </h3>
          <button
            type="button"
            onClick={onNextWeek}
            style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}
            title="שבוע הבא"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={onToday}
            style={{ padding: '0.16rem 0.42rem', borderRadius: '999px', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
          >
            היום
          </button>
        </div>

        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '9px', gap: '2px', flexShrink: 0 }}>
          {([{ id: 'month', label: 'חודשי' }, { id: 'week', label: 'שבועי' }, { id: 'day', label: 'יומי' }] as const).map((r) => {
            const active = resolution === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onChangeResolution(r.id)}
                style={{
                  padding: '0.22rem 0.44rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#0f172a' : '#64748b',
                  fontWeight: active ? 900 : 700,
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 4px rgba(15,23,42,0.1)' : 'none',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FLAGSHIP 7-DAY HORIZONTAL OVERVIEW STRIP (See entire week at a glance!) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '4px',
          background: '#ffffff',
          padding: '0.4rem',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
        }}
      >
        {weekDays.map((day) => {
          const res = isParenting ? resolveDayCustody(day.ymd, config, swaps) : null;
          const dayEvents = events.filter((e) => e.date === day.ymd);
          const hasConf = detectDayTimeConflicts(dayEvents).size > 0;
          const isToday = day.ymd === todayYMD;
          const isSelected = !visualSwapMode && day.ymd === selectedDate;
          const isSwapFirst = visualSwapMode && day.ymd === swapFirstDate;
          const isSwapSecond = visualSwapMode && day.ymd === swapSecondDate;
          const stripColor = !res
            ? '#4f46e5'
            : res.overallParent === 'parent_a'
              ? pA.color
              : res.overallParent === 'parent_b'
                ? pB.color
                : '#7c3aed';

          return (
            <button
              key={`strip_${day.ymd}`}
              type="button"
              onClick={() => onSelectDate(day.ymd)}
              style={{
                padding: '0.36rem 0.1rem',
                borderRadius: '11px',
                border: isSwapFirst
                  ? '2px solid #4f46e5'
                  : isSwapSecond
                    ? '2px solid #059669'
                    : isSelected
                      ? `2px solid ${stripColor}`
                      : `1px solid ${stripColor}33`,
                background: isToday
                  ? stripColor
                  : `${stripColor}16`,
                color: isToday ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '0.64rem', fontWeight: 800, opacity: isToday ? 0.92 : 0.7 }}>
                {HEBREW_DAYS_SHORT[day.dow]}
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 900, lineHeight: 1.1 }}>
                {day.dayNum}
              </span>
              <div style={{ display: 'flex', gap: '2px', height: '6px', alignItems: 'center' }}>
                {hasConf && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />}
                {dayEvents.length > 0 && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isToday ? '#ffffff' : stripColor }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* RICH WEEKLY AGENDA CARDS WITH INLINE QUICK '+' BUTTON */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {weekDays.map((day) => {
          const res = isParenting ? resolveDayCustody(day.ymd, config, swaps) : null;
          const dayEvents = events.filter((e) => e.date === day.ymd);
          const conflictIds = detectDayTimeConflicts(dayEvents);
          const dayActivities = (config.activities || []).filter((a) => a.daysOfWeek.includes(day.dow));
          const birthdays = getBirthdaysForDate(day.ymd, config);

          const isToday = day.ymd === todayYMD;
          const isSelected = !visualSwapMode && day.ymd === selectedDate;
          const isSwapFirst = visualSwapMode && day.ymd === swapFirstDate;
          const isSwapSecond = visualSwapMode && day.ymd === swapSecondDate;

          const ownerColor = !res
            ? '#4f46e5'
            : res.overallParent === 'parent_a'
              ? pA.color
              : res.overallParent === 'parent_b'
                ? pB.color
                : '#7c3aed';
          const ownerName = !res
            ? ''
            : res.overallParent === 'parent_a'
              ? pA.name
              : res.overallParent === 'parent_b'
                ? pB.name
                : 'מפוצל';

          const hasContent =
            dayEvents.length > 0 ||
            dayActivities.length > 0 ||
            birthdays.length > 0 ||
            Boolean(res?.activeSchoolBreak) ||
            Boolean(res?.activeSpecialPeriod);

          return (
            <div
              key={day.ymd}
              onClick={() => onSelectDate(day.ymd)}
              style={{
                width: '100%',
                textAlign: 'right',
                padding: '0.55rem 0.72rem',
                borderRadius: '14px',
                border: isSwapFirst
                  ? '2.5px solid #4f46e5'
                  : isSwapSecond
                    ? '2.5px solid #059669'
                    : isSelected
                      ? `2px solid ${ownerColor}`
                      : `1px solid ${ownerColor}38`,
                borderRight: `5px solid ${ownerColor}`,
                background: isSwapFirst
                  ? '#eef2ff'
                  : isSwapSecond
                    ? '#ecfdf5'
                    : `linear-gradient(90deg, #ffffff 0%, ${ownerColor}12 100%)`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.32rem',
                boxShadow: isSelected ? '0 4px 12px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.03)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 900,
                      color: isToday ? '#ffffff' : '#0f172a',
                      background: isToday ? '#2563eb' : 'transparent',
                      padding: isToday ? '1px 8px' : 0,
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    יום {HEBREW_DAYS_FULL[day.dow]} {day.dayNum}.{day.monthIdx + 1}
                  </span>
                  {isSwapFirst && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 900, background: '#4f46e5', color: '#fff', padding: '1px 6px', borderRadius: '999px' }}>
                      1️⃣ למסירה
                    </span>
                  )}
                  {isSwapSecond && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 900, background: '#059669', color: '#fff', padding: '1px 6px', borderRadius: '999px' }}>
                      2️⃣ בתמורה
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {ownerName && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        background: ownerColor,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ownerName}
                      {res?.source === 'swap' ? ' 🔄' : ''}
                    </span>
                  )}
                  {!visualSwapMode && onQuickAddForDate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddForDate(day.ymd);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `1px solid ${ownerColor}55`,
                        background: '#ffffff',
                        color: ownerColor,
                        fontWeight: 900,
                        fontSize: '0.9rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                      title={`הוסף פריט ליום ${HEBREW_DAYS_FULL[day.dow]}`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* Events, Activities, Birthdays, Breaks Row */}
              {hasContent && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem', marginTop: '2px' }}>
                  {res?.activeSpecialPeriod && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: SPECIAL_PERIOD_META[res.activeSpecialPeriod.category].bg, color: SPECIAL_PERIOD_META[res.activeSpecialPeriod.category].color }}>
                      {SPECIAL_PERIOD_META[res.activeSpecialPeriod.category].icon} {res.activeSpecialPeriod.title}
                    </span>
                  )}
                  {res?.activeSchoolBreak && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: '#fffbeb', color: '#92400e' }}>
                      🏖️ {res.activeSchoolBreak.title}
                    </span>
                  )}
                  {birthdays.map((b, idx) => (
                    <span key={idx} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: '#fdf2f8', color: '#9d174d' }}>
                      🎂 {b.name}
                    </span>
                  ))}
                  {dayActivities.map((a) => (
                    <span key={a.id} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: '#f5f3ff', color: '#6d28d9' }}>
                      🏅 {a.title}{a.time ? ` (${a.time})` : ''}
                    </span>
                  ))}
                  {dayEvents.map((ev) => {
                    const isPriv = ev.visibility === 'private';
                    const isConf = conflictIds.has(ev.id);
                    const icon = ev.customCategoryIcon || (isConf ? '⚠️' : isPriv ? '🔒' : '📌');
                    return (
                      <span
                        key={ev.id}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '8px',
                          background: isConf ? '#fee2e2' : isPriv ? '#f3e8ff' : '#f0f9ff',
                          color: isConf ? '#dc2626' : isPriv ? '#6d28d9' : '#0369a1',
                          textDecoration: ev.completed ? 'line-through' : 'none',
                        }}
                      >
                        {icon} {ev.title}{ev.time ? ` (${ev.time})` : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
