'use client';

import React, { useMemo } from 'react';
import {
  CalendarEventItem,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  detectDayTimeConflicts,
  HEBREW_DAYS_SHORT,
  HEBREW_MONTHS,
  parseYMD,
  resolveDayCustody,
  toYMD,
} from '@/utils/calendarCustodyEngine';
import { CalendarUnifiedHeader } from './CalendarUnifiedHeader';

interface CalendarWeekViewProps {
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
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

/**
 * Clean Flagship Weekly View (Apple/Google Calendar style):
 * - Unified 2-Row Header (zero truncation!)
 * - Vivid 7-Day Interactive Strip (`א׳`–`ש׳`) colored by host parent with event/conflict dots
 * - Zero redundant 7 empty rows! The selected day's rich Visual Day Card sits directly underneath.
 */
export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  selectedDate,
  onSelectDate,
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
        year: d.getFullYear(),
        dow: i,
      };
    });
  }, [selectedDate]);

  const first = weekDays[0];
  const last = weekDays[6];
  const headerRangeLabel =
    first.monthIdx === last.monthIdx
      ? `${first.dayNum}–${last.dayNum} ב${HEBREW_MONTHS[first.monthIdx]} ${first.year}`
      : `${first.dayNum} ב${HEBREW_MONTHS[first.monthIdx]} – ${last.dayNum} ב${HEBREW_MONTHS[last.monthIdx]}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {/* DRY Unified 2-Row Header (Identical eye-line across Month / Week / Day — ZERO truncation!) */}
      <CalendarUnifiedHeader
        resolution={resolution}
        onChangeResolution={onChangeResolution}
        title={headerRangeLabel}
        onPrev={onPrevWeek}
        onNext={onNextWeek}
        onToday={onToday}
        prevLabel="שבוע קודם"
        nextLabel="שבוע הבא"
      />

      {/* VIVID 7-DAY INTERACTIVE STRIP (Tap any day to view/edit it immediately right below!) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '4px',
          background: '#ffffff',
          padding: '0.45rem',
          borderRadius: '15px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
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
                position: 'relative',
                padding: '0.45rem 0.1rem 0.35rem',
                borderRadius: '12px',
                border: isSwapFirst
                  ? '2.5px solid #4f46e5'
                  : isSwapSecond
                    ? '2.5px solid #059669'
                    : isSelected
                      ? `2.5px solid ${stripColor}`
                      : `1px solid ${stripColor}33`,
                background: isToday
                  ? stripColor
                  : isSelected
                    ? `${stripColor}26`
                    : `${stripColor}12`,
                color: isToday ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                overflow: 'hidden',
                boxShadow: isSelected ? `0 4px 12px ${stripColor}2e` : 'none',
                transform: isSelected || isSwapFirst || isSwapSecond ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.14s ease',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: stripColor }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, opacity: isToday ? 0.92 : 0.72 }}>
                {HEBREW_DAYS_SHORT[day.dow]}
              </span>
              <span style={{ fontSize: '0.94rem', fontWeight: 900, lineHeight: 1.15 }}>
                {day.dayNum}
              </span>
              <div style={{ display: 'flex', gap: '2px', height: '7px', alignItems: 'center' }}>
                {hasConf && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />}
                {dayEvents.length > 0 && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isToday ? '#ffffff' : stripColor }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
