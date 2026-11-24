'use client';

import React, { useMemo } from 'react';
import {
  CalendarEventItem,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  computeMonthlyCustodyStats,
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
    const grid: Array<{ ymd: string; day: number } | null> = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ ymd: toYMD(new Date(year, monthIndex, d, 12)), day: d });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Month Navigator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '0.65rem 0.85rem',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        <button
          type="button"
          onClick={onPrevMonth}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#0f172a',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="חודש קודם"
        >
          ◀
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
            {HEBREW_MONTHS[monthIndex]} {year}
          </h3>
          <button
            type="button"
            onClick={onToday}
            style={{
              padding: '0.22rem 0.55rem',
              borderRadius: '8px',
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
            padding: '0.4rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#0f172a',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="חודש הבא"
        >
          ▶
        </button>
      </div>

      {/* Quiet Custody Balance & Legend Bar */}
      {config.mode === 'parenting' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.45rem',
            background: '#f8fafc',
            padding: '0.55rem 0.8rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            fontSize: '0.76rem',
            fontWeight: 700,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0f172a' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: pA.color, display: 'inline-block' }} />
              {pA.name}: <strong>{stats.parentADays}</strong> ימים
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0f172a' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: pB.color, display: 'inline-block' }} />
              {pB.name}: <strong>{stats.parentBDays}</strong> ימים
            </span>
            {stats.splitDays > 0 && (
              <span style={{ color: '#6d28d9' }}>
                ⚖️ מפוצל: <strong>{stats.splitDays}</strong>
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
            {config.isSoloMode ? '🔒 ניהול אישי שקט' : '🤝 סנכרון משותף'}
          </span>
        </div>
      )}

      {/* Weekday Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          textAlign: 'center',
          fontSize: '0.76rem',
          fontWeight: 800,
          color: '#64748b',
          padding: '0 2px',
        }}
      >
        {HEBREW_DAYS_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Month Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '5px',
        }}
      >
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty_${idx}`} style={{ minHeight: '58px' }} />;

          const isSelected = cell.ymd === selectedDate;
          const isToday = cell.ymd === todayYMD;
          const resolution =
            config.mode === 'parenting'
              ? resolveDayCustody(cell.ymd, config, swaps)
              : null;
          const dayEvents = eventsByDate[cell.ymd] || [];
          const birthdays = getBirthdaysForDate(cell.ymd, config);
          const isAlimonyDay =
            config.mode === 'parenting' &&
            config.alimony.enabled &&
            cell.day === config.alimony.dueDayOfMonth;

          const dow = new Date(year, monthIndex, cell.day, 12).getDay();
          const hasActivity = (config.activities || []).some((a) => a.daysOfWeek.includes(dow));

          // Background styling based on host parent
          let bg = '#ffffff';
          let topStrip = 'transparent';
          if (resolution) {
            if (resolution.overallParent === 'parent_a') {
              bg = `${pA.color}14`;
              topStrip = pA.color;
            } else if (resolution.overallParent === 'parent_b') {
              bg = `${pB.color}14`;
              topStrip = pB.color;
            } else {
              bg = `linear-gradient(135deg, ${pA.color}20 50%, ${pB.color}20 50%)`;
              topStrip = `linear-gradient(90deg, ${pA.color} 50%, ${pB.color} 50%)`;
            }
          }

          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => onSelectDate(cell.ymd)}
              style={{
                position: 'relative',
                minHeight: '60px',
                padding: '6px 3px 4px',
                borderRadius: '11px',
                border: isSelected
                  ? '2px solid #0f172a'
                  : isToday
                    ? '2px solid #2563eb'
                    : '1px solid #e2e8f0',
                background: bg,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                overflow: 'hidden',
                boxShadow: isSelected ? '0 4px 12px rgba(15,23,42,0.14)' : 'none',
                transition: 'transform 0.12s ease',
              }}
            >
              {/* Top Host Color Bar */}
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

              {/* Day Number */}
              <span
                style={{
                  fontSize: '0.84rem',
                  fontWeight: isToday || isSelected ? 900 : 700,
                  color: isToday ? '#1d4ed8' : '#0f172a',
                  marginTop: '2px',
                }}
              >
                {cell.day}
              </span>

              {/* Badges Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  flexWrap: 'wrap',
                  fontSize: '0.66rem',
                  lineHeight: 1,
                }}
              >
                {resolution?.activeSpecialPeriod && (
                  <span title={resolution.activeSpecialPeriod.title}>
                    {SPECIAL_PERIOD_META[resolution.activeSpecialPeriod.category]?.icon || '🛡️'}
                  </span>
                )}
                {resolution?.activeSchoolBreak && (
                  <span title={resolution.activeSchoolBreak.title}>🏖️</span>
                )}
                {birthdays.length > 0 && <span title="יום הולדת">🎂</span>}
                {isAlimonyDay && <span title="יום תשלום מזונות">💳</span>}
                {resolution?.source === 'swap' && <span title="הוחלף">🔄</span>}
                {hasActivity && <span title="חוג">🏅</span>}
                {dayEvents.length > 0 && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#f59e0b',
                      display: 'inline-block',
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
