'use client';

import React, { useMemo } from 'react';
import {
  CalendarEventItem,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  computeMonthlyCustodyStats,
  detectDayTimeConflicts,
  getBirthdaysForDate,
  HEBREW_DAYS_SHORT,
  HEBREW_MONTHS,
  resolveDayCustody,
  SPECIAL_PERIOD_META,
  toYMD,
} from '@/utils/calendarCustodyEngine';
import { CalendarUnifiedHeader } from './CalendarUnifiedHeader';

interface CalendarMonthGridProps {
  year: number;
  monthIndex: number; // 0..11
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
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

export const CalendarMonthGrid: React.FC<CalendarMonthGridProps> = ({
  year,
  monthIndex,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
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

  const stats = useMemo(
    () => computeMonthlyCustodyStats(year, monthIndex, config, swaps),
    [year, monthIndex, config, swaps]
  );

  const cells = useMemo(() => {
    const firstDay = new Date(year, monthIndex, 1);
    const startDow = firstDay.getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const grid: Array<{ ymd: string; day: number; dow: number } | null> = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, monthIndex, d, 12);
      grid.push({ ymd: toYMD(dt), day: d, dow: dt.getDay() });
    }
    return grid;
  }, [year, monthIndex]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    events.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;
  const totalDays = Math.max(1, stats.parentADays + stats.parentBDays + stats.splitDays);
  const pAPct = Math.round((stats.parentADays / totalDays) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {/* DRY Unified 2-Row Header (Identical eye-line across Month / Week / Day — ZERO truncation!) */}
      <CalendarUnifiedHeader
        resolution={resolution}
        onChangeResolution={onChangeResolution}
        title={`${HEBREW_MONTHS[monthIndex]} ${year}`}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onToday={onToday}
        prevLabel="חודש קודם"
        nextLabel="חודש הבא"
      />

      {/* Weekday Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          textAlign: 'center',
          fontSize: '0.74rem',
          fontWeight: 900,
          color: '#475569',
          padding: '0 2px',
        }}
      >
        {HEBREW_DAYS_SHORT.map((d, i) => (
          <div key={d} style={{ color: i === 6 ? '#b45309' : '#475569' }}>
            {d}
          </div>
        ))}
      </div>

      {/* CLEAN COMPACT MONTH GRID — ALL 5–6 WEEKS FIT ON ONE SCREEN! */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
        }}
      >
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty_${idx}`} style={{ minHeight: '50px' }} />;

          const isSelected = !visualSwapMode && cell.ymd === selectedDate;
          const isSwapFirst = visualSwapMode && cell.ymd === swapFirstDate;
          const isSwapSecond = visualSwapMode && cell.ymd === swapSecondDate;
          const isToday = cell.ymd === todayYMD;
          const isShabbat = cell.dow === 6;

          const resolutionDay =
            config.mode === 'parenting'
              ? resolveDayCustody(cell.ymd, config, swaps)
              : null;
          const dayEvents = eventsByDate[cell.ymd] || [];
          const hasPrivateEvent = dayEvents.some((ev) => ev.visibility === 'private');
          const hasSharedEvent = dayEvents.some((ev) => ev.visibility !== 'private');
          const hasConflict = detectDayTimeConflicts(dayEvents).size > 0;
          const birthdays = getBirthdaysForDate(cell.ymd, config);
          const hasActivity = (config.activities || []).some((a) => a.daysOfWeek.includes(cell.dow));

          // Vivid, alive parent color fills (zero cut-off text!)
          let bg = '#ffffff';
          let topStrip = 'transparent';
          let parentColor = '#94a3b8';

          if (resolutionDay) {
            if (resolutionDay.overallParent === 'parent_a') {
              bg = `linear-gradient(180deg, ${pA.color}28 0%, ${pA.color}12 100%)`;
              topStrip = pA.color;
              parentColor = pA.color;
            } else if (resolutionDay.overallParent === 'parent_b') {
              bg = `linear-gradient(180deg, ${pB.color}28 0%, ${pB.color}12 100%)`;
              topStrip = pB.color;
              parentColor = pB.color;
            } else {
              bg = `linear-gradient(135deg, ${pA.color}28 50%, ${pB.color}28 50%)`;
              topStrip = `linear-gradient(90deg, ${pA.color} 50%, ${pB.color} 50%)`;
              parentColor = '#6d28d9';
            }
          }

          let borderStyle = `1px solid ${parentColor}38`;
          let boxShadowStyle = '0 1px 4px rgba(15,23,42,0.04)';
          if (isSwapFirst) {
            borderStyle = '2.5px solid #4f46e5';
            boxShadowStyle = '0 0 0 2.5px rgba(79,70,229,0.28)';
          } else if (isSwapSecond) {
            borderStyle = '2.5px solid #059669';
            boxShadowStyle = '0 0 0 2.5px rgba(5,150,105,0.28)';
          } else if (isSelected) {
            borderStyle = '2px solid #0f172a';
            boxShadowStyle = '0 4px 10px rgba(15,23,42,0.16)';
          } else if (isToday) {
            borderStyle = '2px solid #2563eb';
            boxShadowStyle = '0 0 0 2px rgba(37,99,235,0.2)';
          }

          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => onSelectDate(cell.ymd)}
              style={{
                position: 'relative',
                minHeight: '50px',
                padding: '6px 2px 3px',
                borderRadius: '11px',
                border: borderStyle,
                background: bg,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                overflow: 'hidden',
                boxShadow: boxShadowStyle,
                transform: isSelected || isSwapFirst || isSwapSecond ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 0.12s ease',
              }}
            >
              {/* Vivid Top Host Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: topStrip,
                }}
              />

              {/* Swap Selection Badge */}
              {(isSwapFirst || isSwapSecond) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '5px',
                    left: '2px',
                    fontSize: '0.58rem',
                    fontWeight: 900,
                    background: isSwapFirst ? '#4f46e5' : '#059669',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '0 3px',
                    lineHeight: '13px',
                  }}
                >
                  {isSwapFirst ? '1' : '2'}
                </span>
              )}

              {/* Day Number */}
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: isToday || isSelected ? 900 : 800,
                  color: isToday ? '#ffffff' : isShabbat ? '#92400e' : '#0f172a',
                  background: isToday ? '#2563eb' : 'transparent',
                  borderRadius: isToday ? '999px' : undefined,
                  padding: isToday ? '1px 6px' : '1px 2px',
                  lineHeight: 1.15,
                  marginTop: '1px',
                }}
              >
                {cell.day}
              </span>

              {/* Clean Badges Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  flexWrap: 'wrap',
                  fontSize: '0.62rem',
                  lineHeight: 1,
                  minHeight: '13px',
                }}
              >
                {hasConflict && <span title="התנגשות שעות">⚠️</span>}
                {resolutionDay?.source === 'swap' && <span title="החלפה">🔄</span>}
                {resolutionDay?.activeSpecialPeriod && (
                  <span title={resolutionDay.activeSpecialPeriod.title}>
                    {SPECIAL_PERIOD_META[resolutionDay.activeSpecialPeriod.category].icon}
                  </span>
                )}
                {resolutionDay?.activeSchoolBreak && <span title={resolutionDay.activeSchoolBreak.title}>🏖️</span>}
                {birthdays.length > 0 && <span title="יום הולדת">🎂</span>}
                {hasPrivateEvent && <span title="פריט אישי שלי">🔒</span>}
                {hasSharedEvent && <span title="אירוע/משימה במרחב">📌</span>}
                {hasActivity && <span title="חוג">🏅</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* CUSTODY BALANCE & LEGEND BAR — Positioned cleanly BELOW the Month Grid! */}
      {config.mode === 'parenting' && (
        <div
          style={{
            background: '#ffffff',
            padding: '0.45rem 0.7rem',
            borderRadius: '13px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            marginTop: '0.15rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: pA.color }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: pA.color }} />
              {pA.name}: <strong>{stats.parentADays}</strong> ימים
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: pB.color }}>
              {pB.name}: <strong>{stats.parentBDays}</strong> ימים
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: pB.color }} />
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '999px', background: `${pB.color}40`, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pAPct}%`, background: pA.color, transition: 'width 0.3s ease' }} />
            <div style={{ flex: 1, background: pB.color }} />
          </div>
        </div>
      )}
    </div>
  );
};
