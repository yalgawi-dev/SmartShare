'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/app/context/AuthContext';
import { APP_VERSION } from '@/constants/version';
import {
  CalendarEventItem,
  ParentRole,
  SmartCalendarConfig,
  SwapRequestItem,
} from '@/types/calendar';
import {
  buildWhatsAppLink,
  createDefaultCalendarConfig,
  parseYMD,
  resolveDayCustody,
  toYMD,
} from '@/utils/calendarCustodyEngine';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  deleteSwapRequest,
  requestCustodySwap,
  respondToCustodySwap,
  saveCalendarConfig,
  subscribeCalendarConfig,
  subscribeCalendarEvents,
  subscribeCalendarSwaps,
} from '@/services/calendarService';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayDrawer } from './CalendarDayDrawer';
import { SwapRequestModal } from './SwapRequestModal';
import { FamilySetupModal } from './FamilySetupModal';
import { ActivitiesAndAlimonyTab } from './ActivitiesAndAlimonyTab';

type CalendarResolution = 'month' | 'week' | 'day';

interface SmartCalendarWidgetProps {
  space: any;
  onOpenFinanceTab?: () => void;
}

export const SmartCalendarWidget: React.FC<SmartCalendarWidgetProps> = ({
  space,
}) => {
  const { user } = useAuth();
  const [resolution, setResolution] = useState<CalendarResolution>('month');
  const [config, setConfig] = useState<SmartCalendarConfig | null>(null);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(now));

  // Settings & Management Popover + Drawers (keeps Calendar Desktop 100% clean!)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showSwapsDrawer, setShowSwapsDrawer] = useState(false);
  const [showLifeDrawer, setShowLifeDrawer] = useState(false);

  // Manual Swap Modal state (always available alongside Visual Swap!)
  const [swapModalState, setSwapModalState] = useState<{
    fromParent: ParentRole;
    initialDate: string;
    initialReturnDate?: string;
  } | null>(null);

  // Visual Interactive Swap Mode directly on the Calendar Grid/Week!
  const [visualSwapMode, setVisualSwapMode] = useState(false);
  const [swapFirstDate, setSwapFirstDate] = useState<string | null>(null);
  const [swapSecondDate, setSwapSecondDate] = useState<string | null>(null);
  const [visualSwapSaving, setVisualSwapSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3200);
  };

  const firstPartner = useMemo(() => {
    const members = (space?.members || []).filter(
      (m: any) => m && m.userId && m.userId !== user?.id && m.isActive !== false && m.status !== 'removed'
    );
    return members[0] || null;
  }, [space?.members, user?.id]);

  const effectiveConfig: SmartCalendarConfig = useMemo(() => {
    if (config) return config;
    return createDefaultCalendarConfig(
      user?.realName || 'אני',
      user?.id,
      firstPartner?.name || 'הורה ב׳',
      firstPartner?.userId
    );
  }, [config, user?.realName, user?.id, firstPartner?.name, firstPartner?.userId]);

  useEffect(() => {
    if (!space?.id) return;
    const unsubConfig = subscribeCalendarConfig(space.id, (cfg) => {
      setConfig(cfg);
      setLoaded(true);
    });
    const unsubEvents = subscribeCalendarEvents(space.id, setEvents);
    const unsubSwaps = subscribeCalendarSwaps(space.id, setSwaps);
    return () => {
      unsubConfig();
      unsubEvents();
      unsubSwaps();
    };
  }, [space?.id]);

  const pendingSwapsCount = swaps.filter((s) => s.status === 'pending').length;

  const shiftSelectedDateBy = (deltaDays: number) => {
    const dt = parseYMD(selectedDate);
    dt.setDate(dt.getDate() + deltaDays);
    setSelectedDate(toYMD(dt));
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(toYMD(d));
  };

  const handleSaveConfig = async (next: SmartCalendarConfig) => {
    await saveCalendarConfig(space.id, next);
    showToast('✅ הגדרות לוח השנה נשמרו והלוח עודכן!');
  };

  const handleToggleBagItem = async (bagId: string) => {
    const nextBag = (effectiveConfig.handoverBag || []).map((b) =>
      b.id === bagId ? { ...b, checked: !b.checked } : b
    );
    await saveCalendarConfig(space.id, { ...effectiveConfig, handoverBag: nextBag });
  };

  const handleCalendarDateTap = (ymd: string) => {
    if (!visualSwapMode) {
      setSelectedDate(ymd);
      const dt = parseYMD(ymd);
      setViewYear(dt.getFullYear());
      setViewMonth(dt.getMonth());
      return;
    }
    // Visual Swap Mode: pick Day 1 -> pick Day 2
    if (!swapFirstDate) {
      setSwapFirstDate(ymd);
      return;
    }
    if (swapFirstDate === ymd) {
      setSwapFirstDate(null);
      setSwapSecondDate(null);
      return;
    }
    if (swapSecondDate === ymd) {
      setSwapSecondDate(null);
      return;
    }
    setSwapSecondDate(ymd);
  };

  const exitVisualSwap = () => {
    setVisualSwapMode(false);
    setSwapFirstDate(null);
    setSwapSecondDate(null);
  };

  const handleConfirmVisualSwap = async () => {
    if (!swapFirstDate) return;
    setVisualSwapSaving(true);
    try {
      const firstRes = resolveDayCustody(swapFirstDate, effectiveConfig, swaps);
      const fromParent: ParentRole = firstRes.overallParent === 'parent_b' ? 'parent_b' : 'parent_a';
      const toParent: ParentRole = fromParent === 'parent_a' ? 'parent_b' : 'parent_a';
      const isTwoWay = Boolean(swapSecondDate);

      await requestCustodySwap(space.id, {
        type: isTwoWay ? 'two_way' : 'one_time',
        targetDate: swapFirstDate,
        endDate: swapFirstDate,
        ...(isTwoWay && swapSecondDate
          ? { returnDate: swapSecondDate, returnEndDate: swapSecondDate }
          : {}),
        fromParent,
        toParent,
        childIds: 'all',
        status: effectiveConfig.isSoloMode ? 'recorded_solo' : 'pending',
        requestedBy: user?.id || 'me',
        requestedByName: user?.realName || 'הורה',
      });
      showToast(
        isTwoWay
          ? '🔄 ההחלפה בין שני הימים בוצעה ועודכנה בלוח!'
          : '🔄 העברת היום בוצעה ועודכנה בלוח!'
      );
      exitVisualSwap();
    } finally {
      setVisualSwapSaving(false);
    }
  };

  const handleShareSwapLogWhatsApp = () => {
    const lines = ['📋 סיכום החלפות ותיעוד יומן (MySpace):'];
    swaps.slice(0, 12).forEach((s) => {
      const fromName = effectiveConfig.parents[s.fromParent]?.name || s.fromParent;
      const toName = effectiveConfig.parents[s.toParent]?.name || s.toParent;
      const statusLabel =
        s.status === 'approved'
          ? '✅ אושר'
          : s.status === 'recorded_solo'
            ? '📌 תועד'
            : s.status === 'declined'
              ? '❌ נדחה'
              : '⏳ ממתין';
      lines.push(
        `• ${s.targetDate}${s.endDate && s.endDate !== s.targetDate ? `–${s.endDate}` : ''}: ${fromName} → ${toName} (${statusLabel})${s.reason ? ` — ${s.reason}` : ''}`
      );
    });
    window.open(buildWhatsAppLink(undefined, lines.join('\n')), '_blank', 'noopener,noreferrer');
  };

  const formatShortDate = (ymd: string) => {
    const d = parseYMD(ymd);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        padding: '0.65rem',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '22px',
        border: '1px solid #e2e8f0',
        marginBottom: '5.5rem',
        position: 'relative',
      }}
    >
      {/* Floating Feedback Toast */}
      {toastMsg && (
        <div
          style={{
            padding: '0.55rem 0.85rem',
            borderRadius: '12px',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 800,
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(15,23,42,0.2)',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* RAZOR-CLEAN SINGLE-ROW TOP TOOLBAR — Calendar stays front & center! */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.45rem',
          flexWrap: 'wrap',
        }}
      >
        {/* 3-Resolution Segmented Switcher: Monthly | Weekly | Daily */}
        <div
          style={{
            display: 'inline-flex',
            background: '#e2e8f0',
            padding: '3px',
            borderRadius: '12px',
            gap: '2px',
          }}
        >
          {(
            [
              { id: 'month', label: 'חודשי' },
              { id: 'week', label: 'שבועי' },
              { id: 'day', label: 'יומי' },
            ] as const
          ).map((r) => {
            const active = resolution === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setResolution(r.id)}
                style={{
                  padding: '0.35rem 0.72rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#1e293b' : '#64748b',
                  fontWeight: active ? 900 : 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: active ? '0 2px 6px rgba(15,23,42,0.1)' : 'none',
                  transition: 'all 0.14s ease',
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Right Actions: Visual Swap Toggle + Settings Drawer Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              if (visualSwapMode) {
                exitVisualSwap();
              } else {
                setVisualSwapMode(true);
                setSwapFirstDate(null);
                setSwapSecondDate(null);
                if (resolution === 'day') setResolution('month');
              }
            }}
            style={{
              padding: '0.38rem 0.72rem',
              borderRadius: '11px',
              border: visualSwapMode ? '1.5px solid #4f46e5' : '1px solid #c7d2fe',
              background: visualSwapMode ? 'linear-gradient(135deg, #4f46e5, #2563eb)' : '#eef2ff',
              color: visualSwapMode ? '#ffffff' : '#4338ca',
              fontSize: '0.76rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              boxShadow: visualSwapMode ? '0 3px 10px rgba(79,70,229,0.28)' : 'none',
            }}
            title="החלפת ימים ויזואלית ישירות על הלוח"
          >
            <span>🔄</span>
            <span>{visualSwapMode ? 'מצב החלפה פעיל' : 'החלף יום'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsMenu((v) => !v)}
            style={{
              position: 'relative',
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '1.02rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(15,23,42,0.05)',
            }}
            title="הגדרות לוח השנה ותפריט ניהול"
          >
            ⚙️
            {(pendingSwapsCount > 0 || (loaded && !config)) && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  left: '-3px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid #ffffff',
                }}
              />
            )}
          </button>

          {/* Clean Settings & Management Popover Menu */}
          {showSettingsMenu && (
            <>
              <div
                onClick={() => setShowSettingsMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '42px',
                  left: 0,
                  zIndex: 9999,
                  width: '245px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 18px 42px rgba(15,23,42,0.2)',
                  padding: '0.45rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.35rem 0.55rem',
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: '2px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#334155' }}>
                    ניהול לוח השנה
                  </span>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      background: '#eef2ff',
                      color: '#4338ca',
                      borderRadius: '5px',
                      padding: '1px 5px',
                      fontWeight: 800,
                    }}
                  >
                    {APP_VERSION}
                  </span>
                </div>

                {[
                  {
                    icon: '⚙️',
                    label: 'הגדרות משפחה וימים קבועים',
                    onClick: () => {
                      setShowSettingsMenu(false);
                      setShowSetupModal(true);
                    },
                  },
                  {
                    icon: '🔄',
                    label: `יומן החלפות ותיעוד${pendingSwapsCount > 0 ? ` (${pendingSwapsCount})` : ''}`,
                    onClick: () => {
                      setShowSettingsMenu(false);
                      setShowSwapsDrawer(true);
                    },
                  },
                  {
                    icon: '🏅',
                    label: 'חוגים, חופשות ותקופות מיוחדות',
                    onClick: () => {
                      setShowSettingsMenu(false);
                      setShowLifeDrawer(true);
                    },
                  },
                  {
                    icon: '📅',
                    label: 'החלפה לפי תאריכים (ידני)',
                    onClick: () => {
                      setShowSettingsMenu(false);
                      const res = resolveDayCustody(selectedDate, effectiveConfig, swaps);
                      setSwapModalState({
                        fromParent: res.overallParent === 'parent_b' ? 'parent_b' : 'parent_a',
                        initialDate: selectedDate,
                      });
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    style={{
                      padding: '0.55rem 0.65rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'transparent',
                      color: '#0f172a',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      textAlign: 'right',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subtle 1-Line First-Time Setup Nudge (only if unconfigured — never blocks calendar!) */}
      {loaded && !config && (
        <button
          type="button"
          onClick={() => setShowSetupModal(true)}
          style={{
            padding: '0.48rem 0.8rem',
            borderRadius: '12px',
            border: '1.5px solid #c7d2fe',
            background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
            color: '#312e81',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✨ הגדר הורים, ילדים וימים קבועים ב-30 שניות</span>
          <span style={{ fontWeight: 900 }}>הגדר ←</span>
        </button>
      )}

      {/* VISUAL INTERACTIVE SWAP BANNER (Appears right above the calendar when active!) */}
      {visualSwapMode && (
        <div
          style={{
            padding: '0.7rem 0.85rem',
            borderRadius: '15px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ecfdf5 100%)',
            border: '2px solid #818cf8',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            boxShadow: '0 6px 18px rgba(79,70,229,0.14)',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1e1b4b' }}>
            {!swapFirstDate
              ? '1️⃣ לחץ על היום הראשון על הלוח שרוצים להעביר/להחליף'
              : !swapSecondDate
                ? `1️⃣ נבחר ${formatShortDate(swapFirstDate)} — עכשיו לחץ על יום תמורה (או אשר העברה חד-פעמית)`
                : `🔄 החלפה בין ${formatShortDate(swapFirstDate)} לבין ${formatShortDate(swapSecondDate)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {swapFirstDate && (
              <button
                type="button"
                disabled={visualSwapSaving}
                onClick={handleConfirmVisualSwap}
                style={{
                  padding: '0.42rem 0.85rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: visualSwapSaving ? 'wait' : 'pointer',
                }}
              >
                {visualSwapSaving
                  ? 'מעדכן...'
                  : swapSecondDate
                    ? '✅ אשר החלפת ימים'
                    : '✅ אשר העברה חד-פעמית'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const target = swapFirstDate || selectedDate;
                const res = resolveDayCustody(target, effectiveConfig, swaps);
                setSwapModalState({
                  fromParent: res.overallParent === 'parent_b' ? 'parent_b' : 'parent_a',
                  initialDate: target,
                  initialReturnDate: swapSecondDate || undefined,
                });
                exitVisualSwap();
              }}
              style={{
                padding: '0.42rem 0.72rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              📅 בחירת תאריכים ידנית / טווח
            </button>
            <button
              type="button"
              onClick={exitVisualSwap}
              style={{
                padding: '0.42rem 0.65rem',
                borderRadius: '10px',
                border: 'none',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* RESOLUTION 1: MONTHLY VIEW */}
      {resolution === 'month' && (
        <CalendarMonthGrid
          year={viewYear}
          monthIndex={viewMonth}
          selectedDate={selectedDate}
          onSelectDate={handleCalendarDateTap}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          config={effectiveConfig}
          events={events}
          swaps={swaps}
          visualSwapMode={visualSwapMode}
          swapFirstDate={swapFirstDate}
          swapSecondDate={swapSecondDate}
        />
      )}

      {/* RESOLUTION 2: WEEKLY VIEW */}
      {resolution === 'week' && (
        <CalendarWeekView
          selectedDate={selectedDate}
          onSelectDate={handleCalendarDateTap}
          onPrevWeek={() => shiftSelectedDateBy(-7)}
          onNextWeek={() => shiftSelectedDateBy(7)}
          onToday={handleToday}
          config={effectiveConfig}
          events={events}
          swaps={swaps}
          visualSwapMode={visualSwapMode}
          swapFirstDate={swapFirstDate}
          swapSecondDate={swapSecondDate}
        />
      )}

      {/* RESOLUTION 3: DAILY NAVIGATOR */}
      {resolution === 'day' && (
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
            onClick={() => shiftSelectedDateBy(-1)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#1e293b',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            ◀ יום קודם
          </button>
          <button
            type="button"
            onClick={handleToday}
            style={{
              padding: '0.28rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: '0.76rem',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            היום
          </button>
          <button
            type="button"
            onClick={() => shiftSelectedDateBy(1)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#1e293b',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            יום הבא ▶
          </button>
        </div>
      )}

      {/* SELECTED DAY AGENDA CARD (always visible below Month/Week, or hero in Daily!) */}
      <CalendarDayDrawer
        selectedDate={selectedDate}
        config={effectiveConfig}
        events={events}
        swaps={swaps}
        currentUserId={user?.id || 'me'}
        onAddEvent={async (ev) => {
          await createCalendarEvent(space.id, ev);
        }}
        onDeleteEvent={async (id) => {
          await deleteCalendarEvent(space.id, id);
        }}
        onOpenSwapModal={(from) =>
          setSwapModalState({ fromParent: from, initialDate: selectedDate })
        }
        onToggleBagItem={handleToggleBagItem}
      />

      {/* MODAL 1: FAMILY & VISUAL SCHEDULE SETUP */}
      {showSetupModal && (
        <FamilySetupModal
          config={effectiveConfig}
          onClose={() => setShowSetupModal(false)}
          onSave={handleSaveConfig}
        />
      )}

      {/* MODAL 2: MANUAL / ADVANCED SWAP REQUEST */}
      {swapModalState && (
        <SwapRequestModal
          initialDate={swapModalState.initialDate}
          initialReturnDate={swapModalState.initialReturnDate}
          config={effectiveConfig}
          defaultFromParent={swapModalState.fromParent}
          currentUserId={user?.id || 'me'}
          currentUserName={user?.realName || 'הורה'}
          onClose={() => setSwapModalState(null)}
          onSubmit={async (payload) => {
            await requestCustodySwap(space.id, payload);
            showToast('🔄 ההחלפה נשמרה ועודכנה בלוח!');
          }}
        />
      )}

      {/* MODAL 3: SWAPS AUDIT LOG DRAWER (opened from ⚙️ menu) */}
      {showSwapsDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(15,23,42,0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem',
            }}
            onClick={() => setShowSwapsDrawer(false)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '480px',
                maxHeight: '88dvh',
                background: '#f8fafc',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
              }}
            >
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  background: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                  🔄 יומן החלפות ותיעוד
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSwapsDrawer(false)}
                  style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSwapsDrawer(false);
                      setVisualSwapMode(true);
                    }}
                    style={{ padding: '0.48rem 0.85rem', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    👆 החלף ויזואלית על הלוח
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSwapsDrawer(false);
                      setSwapModalState({ fromParent: 'parent_a', initialDate: selectedDate });
                    }}
                    style={{ padding: '0.48rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    📅 לפי תאריכים ידנית
                  </button>
                  {swaps.length > 0 && (
                    <button
                      type="button"
                      onClick={handleShareSwapLogWhatsApp}
                      style={{ padding: '0.48rem 0.8rem', borderRadius: '10px', border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      📤 שתף בוואטסאפ
                    </button>
                  )}
                </div>

                {swaps.length === 0 ? (
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                    אין עדיין החלפות רשומות.
                  </div>
                ) : (
                  swaps.map((sw) => {
                    const fromName = effectiveConfig.parents[sw.fromParent]?.name || sw.fromParent;
                    const toName = effectiveConfig.parents[sw.toParent]?.name || sw.toParent;
                    return (
                      <div
                        key={sw.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '14px',
                          border: sw.status === 'pending' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                          padding: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                            📅 {sw.targetDate}{sw.endDate && sw.endDate !== sw.targetDate ? ` → ${sw.endDate}` : ''}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: sw.status === 'declined' ? '#dc2626' : '#059669' }}>
                            {sw.status === 'approved' ? '✅ אושר' : sw.status === 'recorded_solo' ? '📌 מתועד' : sw.status === 'declined' ? '❌ נדחה' : '⏳ ממתין'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>
                          {sw.type === 'shift_forward'
                            ? '🔁 היפוך רצף מכאן והלאה'
                            : `עובר מ-${fromName} אל ${toName}`}
                          {sw.type === 'two_way' && sw.returnDate ? ` • בתמורה: ${sw.returnDate}` : ''}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          {sw.status === 'pending' && (
                            <>
                              <button type="button" onClick={() => respondToCustodySwap(space.id, sw.id, 'approved', user?.id || 'me')} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>✅ אשר</button>
                              <button type="button" onClick={() => respondToCustodySwap(space.id, sw.id, 'declined', user?.id || 'me')} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>❌ סרב</button>
                            </>
                          )}
                          <button type="button" onClick={() => deleteSwapRequest(space.id, sw.id)} style={{ padding: '0.28rem 0.55rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer' }}>מחק</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: ACTIVITIES, HOLIDAYS & SPECIAL PERIODS DRAWER (opened from ⚙️ menu — zero alimony/expenses!) */}
      {showLifeDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(15,23,42,0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem',
            }}
            onClick={() => setShowLifeDrawer(false)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90dvh',
                background: '#f8fafc',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
              }}
            >
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  background: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                  🏅 חוגים, חופשות ותקופות מיוחדות
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLifeDrawer(false)}
                  style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem' }}>
                <ActivitiesAndAlimonyTab
                  config={effectiveConfig}
                  currentUserId={user?.id || 'me'}
                  currentUserName={user?.realName || 'אני'}
                  onSaveConfig={handleSaveConfig}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
