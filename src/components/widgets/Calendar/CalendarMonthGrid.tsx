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

interface CalendarMonthGridProps {
  year: number;
  monthIndex: number; // 0..11
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {/* Vibrant Month Navigator */}
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
          onClick={onPrevMonth}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="חודש קודם"
        >
          ◀
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {HEBREW_MONTHS[monthIndex]} {year}
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
          onClick={onNextMonth}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#1e293b',
            fontWeight: 900,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="חודש הבא"
        >
          ▶
        </button>
      </div>

      {/* Live Visual Balance Bar (Parent A vs Parent B) */}
      {config.mode === 'parenting' && (
        <div
          style={{
            background: '#ffffff',
            padding: '0.5rem 0.75rem',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 800 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: pA.color }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: pA.color, boxShadow: `0 0 6px ${pA.color}88` }} />
              {pA.name}: <strong>{stats.parentADays}</strong> ימים
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: pB.color }}>
              {pB.name}: <strong>{stats.parentBDays}</strong> ימים
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: pB.color, boxShadow: `0 0 6px ${pB.color}88` }} />
            </span>
          </div>
          {/* Vivid Split Progress Bar */}
          <div style={{ height: '6px', borderRadius: '999px', background: `${pB.color}40`, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pAPct}%`, background: pA.color, transition: 'width 0.3s ease' }} />
            <div style={{ flex: 1, background: pB.color }} />
          </div>
        </div>
      )}

      {/* Weekday Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '5px',
          textAlign: 'center',
          fontSize: '0.78rem',
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

      {/* Vibrant Interactive Month Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '5px',
        }}
      >
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty_${idx}`} style={{ minHeight: '64px' }} />;

          const isSelected = !visualSwapMode && cell.ymd === selectedDate;
          const isSwapFirst = visualSwapMode && cell.ymd === swapFirstDate;
          const isSwapSecond = visualSwapMode && cell.ymd === swapSecondDate;
          const isToday = cell.ymd === todayYMD;
          const isShabbat = cell.dow === 6;

          const resolution =
            config.mode === 'parenting'
              ? resolveDayCustody(cell.ymd, config, swaps)
              : null;
          const dayEvents = eventsByDate[cell.ymd] || [];
          const hasPrivateEvent = dayEvents.some((ev) => ev.visibility === 'private');
          const hasSharedEvent = dayEvents.some((ev) => ev.visibility !== 'private');
          const hasConflict = detectDayTimeConflicts(dayEvents).size > 0;
          const birthdays = getBirthdaysForDate(cell.ymd, config);
          const hasActivity = (config.activities || []).some((a) => a.daysOfWeek.includes(cell.dow));

          // Vivid, alive color fills based on host parent
          let bg = '#ffffff';
          let topStrip = 'transparent';
          let parentShort = '';
          let parentColor = '#334155';

          if (resolution) {
            if (resolution.overallParent === 'parent_a') {
              bg = `linear-gradient(180deg, ${pA.color}26 0%, ${pA.color}10 100%)`;
              topStrip = pA.color;
              parentShort = pA.name.slice(0, 4);
              parentColor = pA.color;
            } else if (resolution.overallParent === 'parent_b') {
              bg = `linear-gradient(180deg, ${pB.color}26 0%, ${pB.color}10 100%)`;
              topStrip = pB.color;
              parentShort = pB.name.slice(0, 4);
              parentColor = pB.color;
            } else {
              bg = `linear-gradient(135deg, ${pA.color}28 50%, ${pB.color}28 50%)`;
              topStrip = `linear-gradient(90deg, ${pA.color} 50%, ${pB.color} 50%)`;
              parentShort = 'מפוצל';
              parentColor = '#6d28d9';
            }
          }

          let borderStyle = `1px solid ${parentColor}33`;
          let boxShadowStyle = '0 2px 6px rgba(15,23,42,0.04)';
          if (isSwapFirst) {
            borderStyle = '2.5px solid #4f46e5';
            boxShadowStyle = '0 0 0 3px rgba(79,70,229,0.28), 0 6px 14px rgba(79,70,229,0.22)';
          } else if (isSwapSecond) {
            borderStyle = '2.5px solid #059669';
            boxShadowStyle = '0 0 0 3px rgba(5,150,105,0.28), 0 6px 14px rgba(5,150,105,0.22)';
          } else if (isSelected) {
            borderStyle = '2.5px solid #0f172a';
            boxShadowStyle = '0 6px 16px rgba(15,23,42,0.18)';
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
                minHeight: '66px',
                padding: '7px 2px 4px',
                borderRadius: '13px',
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
                transition: 'transform 0.14s ease, box-shadow 0.14s ease',
              }}
            >
              {/* Vivid Top Host Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '5px',
                  background: topStrip,
                }}
              />

              {/* Swap Selection Badge */}
              {(isSwapFirst || isSwapSecond) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '3px',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    background: isSwapFirst ? '#4f46e5' : '#059669',
                    color: '#ffffff',
                    borderRadius: '5px',
                    padding: '0 4px',
                    lineHeight: '14px',
                  }}
                >
                  {isSwapFirst ? '1' : '2'}
                </span>
              )}

              {/* Day Number */}
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: isToday || isSelected ? 900 : 800,
                  color: isToday ? '#ffffff' : isShabbat ? '#92400e' : '#0f172a',
                  background: isToday ? '#2563eb' : 'transparent',
                  borderRadius: isToday ? '999px' : undefined,
                  padding: isToday ? '1px 7px' : '1px 3px',
                  lineHeight: 1.2,
                  marginTop: '1px',
                }}
              >
                {cell.day}
              </span>

              {/* Badges Row (Events, Swaps, Birthdays, Activities, Holidays — ZERO Alimony!) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  flexWrap: 'wrap',
                  fontSize: '0.62rem',
                  lineHeight: 1,
                  minHeight: '12px',
                }}
              >
                {hasConflict && <span title="התנגשות שעות">⚠️</span>}
                {resolution?.source === 'swap' && <span title="החלפה">🔄</span>}
                {resolution?.activeSpecialPeriod && (
                  <span title={resolution.activeSpecialPeriod.title}>
                    {SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category].icon}
                  </span>
                )}
                {resolution?.activeSchoolBreak && <span title={resolution.activeSchoolBreak.title}>🏖️</span>}
                {birthdays.length > 0 && <span title="יום הולדת">🎂</span>}
                {hasPrivateEvent && <span title="פריט אישי שלי">🔒</span>}
                {hasSharedEvent && <span title="אירוע/משימה במרחב">📌</span>}
                {hasActivity && <span title="חוג">🏅</span>}
              </div>

              {/* Tiny Vivid Parent Name Tag */}
              {parentShort && (
                <span
                  style={{
                    fontSize: '0.56rem',
                    fontWeight: 800,
                    color: parentColor,
                    opacity: 0.92,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.1,
                  }}
                >
                  {parentShort}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
