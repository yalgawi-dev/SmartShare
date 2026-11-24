'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  toYMD,
} from '@/utils/calendarCustodyEngine';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  deleteSwapRequest,
  markAlimonyPaid,
  requestCustodySwap,
  respondToCustodySwap,
  saveCalendarConfig,
  subscribeCalendarConfig,
  subscribeCalendarEvents,
  subscribeCalendarSwaps,
} from '@/services/calendarService';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { CalendarDayDrawer } from './CalendarDayDrawer';
import { SwapRequestModal } from './SwapRequestModal';
import { FamilySetupModal } from './FamilySetupModal';
import { ActivitiesAndAlimonyTab } from './ActivitiesAndAlimonyTab';

interface SmartCalendarWidgetProps {
  space: any;
  onOpenFinanceTab?: () => void;
}

export const SmartCalendarWidget: React.FC<SmartCalendarWidgetProps> = ({
  space,
  onOpenFinanceTab,
}) => {
  const { user } = useAuth();
  const [internalTab, setInternalTab] = useState<'month' | 'swaps' | 'life'>('month');
  const [config, setConfig] = useState<SmartCalendarConfig | null>(null);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(now));

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [swapModalFrom, setSwapModalFrom] = useState<ParentRole | null>(null);

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
  const hasFinanceEngine = Boolean(space?.features?.includes('finance'));

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
  };

  const handleToggleBagItem = async (bagId: string) => {
    const nextBag = (effectiveConfig.handoverBag || []).map((b) =>
      b.id === bagId ? { ...b, checked: !b.checked } : b
    );
    await saveCalendarConfig(space.id, { ...effectiveConfig, handoverBag: nextBag });
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

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        padding: '0.9rem',
        background: '#f8fafc',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        marginBottom: '5.5rem',
      }}
    >
      {/* Top Plugin Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.35rem' }}>📅</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                לוח שנה חכם ותיאומים
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  fontWeight: 800,
                }}
              >
                {APP_VERSION}
              </span>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
              ניהול הורות, זמני שהות, חופשות, תורים ומזונות בשקט ובשקיפות
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSetupModal(true)}
          style={{
            padding: '0.45rem 0.8rem',
            borderRadius: '11px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ⚙️ הגדרות משפחה
        </button>
      </div>

      {/* First-Time Quick Setup Callout */}
      {loaded && !config && (
        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)',
            border: '1.5px solid #c7d2fe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#1e3a8a', fontWeight: 700 }}>
            👋 התחלה מהירה: הגדר שמות הורים, ילדים (כולל תאריכי לידה וטלפון לעדכון) והסדר ימים — תוך דקה הלוח צבוע לכל השנה!
          </div>
          <button
            type="button"
            onClick={() => setShowSetupModal(true)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🚀 הגדר עכשיו
          </button>
        </div>
      )}

      {/* Internal 3-Tab Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.35rem',
          background: '#e2e8f0',
          padding: '4px',
          borderRadius: '13px',
        }}
      >
        {[
          { id: 'month' as const, label: '📅 לוח חודשי' },
          {
            id: 'swaps' as const,
            label: `🔄 החלפות ותיעוד${pendingSwapsCount > 0 ? ` (${pendingSwapsCount})` : ''}`,
          },
          { id: 'life' as const, label: '🏅 חוגים, חופשות ומזונות' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setInternalTab(t.id)}
            style={{
              padding: '0.52rem 0.35rem',
              borderRadius: '10px',
              border: 'none',
              background: internalTab === t.id ? '#ffffff' : 'transparent',
              color: internalTab === t.id ? '#0f172a' : '#475569',
              fontWeight: internalTab === t.id ? 900 : 700,
              fontSize: '0.76rem',
              cursor: 'pointer',
              boxShadow: internalTab === t.id ? '0 2px 6px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MONTH GRID + SELECTED DAY AGENDA */}
      {internalTab === 'month' && (
        <>
          <CalendarMonthGrid
            year={viewYear}
            monthIndex={viewMonth}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            config={effectiveConfig}
            events={events}
            swaps={swaps}
          />
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
            onOpenSwapModal={(from) => setSwapModalFrom(from)}
            onToggleBagItem={handleToggleBagItem}
          />
        </>
      )}

      {/* TAB 2: SWAPS & SIGNED AUDIT LOG */}
      {internalTab === 'swaps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSwapModalFrom('parent_a')}
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '11px',
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              ➕ {effectiveConfig.isSoloMode ? 'תעד החלפה חדשה' : 'בקשת החלפה חדשה'}
            </button>
            {swaps.length > 0 && (
              <button
                type="button"
                onClick={handleShareSwapLogWhatsApp}
                style={{
                  padding: '0.45rem 0.8rem',
                  borderRadius: '11px',
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                📤 שתף סיכום בוואטסאפ
              </button>
            )}
          </div>

          {swaps.length === 0 ? (
            <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              אין עדיין החלפות רשומות. כל החלפת יום, שבת או ילד ספציפי תישמר כאן ביומן מתועד עם תאריך ושעה.
            </div>
          ) : (
            swaps.map((sw) => {
              const fromName = effectiveConfig.parents[sw.fromParent]?.name || sw.fromParent;
              const toName = effectiveConfig.parents[sw.toParent]?.name || sw.toParent;
              const typeBadge =
                sw.type === 'one_time'
                  ? 'חד-פעמית (ללא שינוי רצף)'
                  : sw.type === 'two_way'
                    ? 'דו-כיוונית (תן וקח)'
                    : 'הזזת רצף קדימה';
              const childBadge =
                sw.childIds === 'all'
                  ? 'כל הילדים'
                  : sw.childIds
                      .map((cid) => effectiveConfig.children.find((c) => c.id === cid)?.name || 'ילד')
                      .join(', ');

              return (
                <div
                  key={sw.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border:
                      sw.status === 'pending'
                        ? '2px solid #f59e0b'
                        : sw.status === 'declined'
                          ? '1px solid #fecaca'
                          : '1px solid #cbd5e1',
                    padding: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                      📅 {sw.targetDate}
                      {sw.endDate && sw.endDate !== sw.targetDate ? ` → ${sw.endDate}` : ''}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background:
                          sw.status === 'approved' || sw.status === 'recorded_solo'
                            ? '#dcfce7'
                            : sw.status === 'declined'
                              ? '#fee2e2'
                              : '#fef3c7',
                        color:
                          sw.status === 'approved' || sw.status === 'recorded_solo'
                            ? '#166534'
                            : sw.status === 'declined'
                              ? '#991b1b'
                              : '#92400e',
                      }}
                    >
                      {sw.status === 'approved'
                        ? '✅ אושר'
                        : sw.status === 'recorded_solo'
                          ? '📌 מתועד בלוח'
                          : sw.status === 'declined'
                            ? '❌ נדחה'
                            : '⏳ ממתין לאישור'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>
                    {sw.type === 'shift_forward'
                      ? '🔁 היפוך רצף השבתות/שבועות מתאריך זה קדימה'
                      : `עובר מ-${fromName} אל ${toName}`}
                    {sw.type === 'two_way' && sw.returnDate
                      ? ` • בתמורה: ${sw.returnDate}${sw.returnEndDate && sw.returnEndDate !== sw.returnDate ? `→${sw.returnEndDate}` : ''} עובר ל-${fromName}`
                      : ''}
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {typeBadge} • 👧 {childBadge}
                    {sw.reason ? ` • "${sw.reason}"` : ''}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      תועד ע״י {sw.requestedByName} ב-{new Date(sw.createdAt).toLocaleString('he-IL')}
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {sw.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => respondToCustodySwap(space.id, sw.id, 'approved', user?.id || 'me')}
                            style={{ padding: '0.3rem 0.65rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            ✅ אשר
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToCustodySwap(space.id, sw.id, 'declined', user?.id || 'me')}
                            style={{ padding: '0.3rem 0.65rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            ❌ סרב
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSwapRequest(space.id, sw.id)}
                        style={{ padding: '0.3rem 0.55rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: ACTIVITIES, ALIMONY, SCHOOL BREAKS & SPECIAL PERIODS */}
      {internalTab === 'life' && (
        <ActivitiesAndAlimonyTab
          config={effectiveConfig}
          currentUserId={user?.id || 'me'}
          currentUserName={user?.realName || 'אני'}
          hasFinanceEngine={hasFinanceEngine}
          onSaveConfig={handleSaveConfig}
          onMarkAlimonyPaid={async (ym) => {
            await markAlimonyPaid(space.id, effectiveConfig, ym, user?.realName || user?.id || 'me');
          }}
          onOpenFinanceBridge={onOpenFinanceTab}
        />
      )}

      {/* Modals */}
      {showSetupModal && (
        <FamilySetupModal
          config={effectiveConfig}
          onClose={() => setShowSetupModal(false)}
          onSave={handleSaveConfig}
        />
      )}

      {swapModalFrom && (
        <SwapRequestModal
          initialDate={selectedDate}
          config={effectiveConfig}
          defaultFromParent={swapModalFrom}
          currentUserId={user?.id || 'me'}
          currentUserName={user?.realName || 'הורה'}
          onClose={() => setSwapModalFrom(null)}
          onSubmit={async (payload) => {
            await requestCustodySwap(space.id, payload);
          }}
        />
      )}
    </div>
  );
};
