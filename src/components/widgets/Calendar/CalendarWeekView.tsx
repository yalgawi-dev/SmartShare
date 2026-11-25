'use client';

import React, { useMemo } from 'react';
import {
  CalendarEventItem,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  getBirthdaysForDate,
  HEBREW_DAYS_FULL,
  HEBREW_MONTHS,
  parseYMD,
  resolveDayCustody,
  SPECIAL_PERIOD_META,
  toYMD,
} from '@/utils/calendarCustodyEngine';

interface CalendarWeekViewProps {
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
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
  onPrevWeek,
  onNextWeek,
  onToday,
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
      : `${first.dayNum} ${HEBREW_MONTHS[first.monthIdx]} – ${last.dayNum} ${HEBREW_MONTHS[last.monthIdx]}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {/* Week Navigator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '0.55rem 0.75rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
        }}
      >
        <button
          type="button"
          onClick={onPrevWeek}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            cursor: 'pointer',
          }}
          title="שבוע קודם"
        >
          ◀
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
            {headerRangeLabel}
          </h3>
          <button
            type="button"
            onClick={onToday}
            style={{
              padding: '0.22rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            היום
          </button>
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            cursor: 'pointer',
          }}
          title="שבוע הבא"
        >
          ▶
        </button>
      </div>

      {/* 7 Vibrant Day Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {weekDays.map((day) => {
          const resolution = resolveDayCustody(day.ymd, config, swaps);
          const dayEvents = events.filter((e) => e.date === day.ymd);
          const dayActivities = (config.activities || []).filter((a) => a.daysOfWeek.includes(day.dow));
          const birthdays = getBirthdaysForDate(day.ymd, config);

          const isToday = day.ymd === todayYMD;
          const isSelected = !visualSwapMode && day.ymd === selectedDate;
          const isSwapFirst = visualSwapMode && day.ymd === swapFirstDate;
          const isSwapSecond = visualSwapMode && day.ymd === swapSecondDate;

          const ownerColor =
            resolution.overallParent === 'parent_a'
              ? pA.color
              : resolution.overallParent === 'parent_b'
                ? pB.color
                : '#7c3aed';
          const ownerName =
            resolution.overallParent === 'parent_a'
              ? pA.name
              : resolution.overallParent === 'parent_b'
                ? pB.name
                : 'מפוצל';

          return (
            <button
              key={day.ymd}
              type="button"
              onClick={() => onSelectDate(day.ymd)}
              style={{
                width: '100%',
                textAlign: 'right',
                padding: '0.65rem 0.85rem',
                borderRadius: '14px',
                border: isSwapFirst
                  ? '2.5px solid #4f46e5'
                  : isSwapSecond
                    ? '2.5px solid #059669'
                    : isSelected
                      ? `2px solid ${ownerColor}`
                      : `1px solid ${ownerColor}38`,
                borderRight: `6px solid ${ownerColor}`,
                background: isSwapFirst
                  ? '#eef2ff'
                  : isSwapSecond
                    ? '#ecfdf5'
                    : `linear-gradient(90deg, #ffffff 0%, ${ownerColor}14 100%)`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.32rem',
                boxShadow: isSelected ? '0 4px 12px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 900,
                      color: isToday ? '#ffffff' : '#0f172a',
                      background: isToday ? '#2563eb' : 'transparent',
                      padding: isToday ? '1px 8px' : 0,
                      borderRadius: '999px',
                    }}
                  >
                    יום {HEBREW_DAYS_FULL[day.dow]} {day.dayNum}.{day.monthIdx + 1}
                  </span>
                  {isSwapFirst && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, background: '#4f46e5', color: '#fff', padding: '1px 7px', borderRadius: '999px' }}>
                      1️⃣ יום למסירה
                    </span>
                  )}
                  {isSwapSecond && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, background: '#059669', color: '#fff', padding: '1px 7px', borderRadius: '999px' }}>
                      2️⃣ יום בתמורה
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    color: '#ffffff',
                    background: ownerColor,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ownerName}
                  {resolution.source === 'swap' ? ' 🔄' : ''}
                </span>
              </div>

              {/* Events, Activities, Birthdays, Breaks Row */}
              {(dayEvents.length > 0 || dayActivities.length > 0 || birthdays.length > 0 || resolution.activeSchoolBreak || resolution.activeSpecialPeriod) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '2px' }}>
                  {resolution.activeSpecialPeriod && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].bg, color: SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].color }}>
                      {SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].icon} {resolution.activeSpecialPeriod.title}
                    </span>
                  )}
                  {resolution.activeSchoolBreak && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: '#fffbeb', color: '#92400e' }}>
                      🏖️ {resolution.activeSchoolBreak.title}
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
                  {dayEvents.map((ev) => (
                    <span key={ev.id} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', background: '#f0f9ff', color: '#0369a1' }}>
                      📌 {ev.title}{ev.time ? ` (${ev.time})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
