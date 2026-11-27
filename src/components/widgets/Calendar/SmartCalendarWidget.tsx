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
  HEBREW_DAYS_FULL,
  HEBREW_MONTHS,
  parseYMD,
  resolveDayCustody,
  toYMD,
} from '@/utils/calendarCustodyEngine';
import { CalendarUnifiedHeader } from './CalendarUnifiedHeader';
import {
  createCalendarEvent,
  createPersonalCalendarEvent,
  deleteCalendarEvent,
  deletePersonalCalendarEvent,
  deleteSwapRequest,
  requestCustodySwap,
  respondToCustodySwap,
  saveCalendarConfig,
  subscribeCalendarConfig,
  subscribeCalendarEvents,
  subscribeCalendarSwaps,
  subscribePersonalCalendarEvents,
  toggleCalendarEventCompleted,
} from '@/services/calendarService';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayDrawer } from './CalendarDayDrawer';
import { SwapRequestModal } from './SwapRequestModal';
import { FamilySetupModal } from './FamilySetupModal';
import { ActivitiesAndAlimonyTab } from './ActivitiesAndAlimonyTab';
import { CalendarLayersDrawer, CalendarLayerDescriptor } from './CalendarLayersDrawer';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';

type CalendarResolution = 'month' | 'week' | 'day';

const LAYER_COLORS = ['#2563eb', '#059669', '#ea580c', '#0891b2', '#ec4899', '#d97706'];

interface SmartCalendarWidgetProps {
  /** Optional: omitted when opened from standalone `/calendar` page (works even with ZERO spaces!) */
  space?: any;
  /** Optional list of all user spaces with smart_calendar enabled for multi-layer viewing (keeps widget 100% decoupled from SpacesContext!) */
  allCalendarSpaces?: any[];
  onOpenFinanceTab?: () => void;
}

export const SmartCalendarWidget: React.FC<SmartCalendarWidgetProps> = ({
  space,
  allCalendarSpaces,
}) => {
  const { user } = useAuth();
  const [resolution, setResolution] = useState<CalendarResolution>('month');
  const [config, setConfig] = useState<SmartCalendarConfig | null>(null);
  const [eventsBySpaceId, setEventsBySpaceId] = useState<Record<string, CalendarEventItem[]>>({});
  const [personalEvents, setPersonalEvents] = useState<CalendarEventItem[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Normalized list of all available Calendar Spaces (current space always first if provided)
  const calendarSpaces = useMemo(() => {
    const raw = Array.isArray(allCalendarSpaces) ? allCalendarSpaces : [];
    const seen = new Set<string>();
    const list: any[] = [];
    if (space?.id) {
      seen.add(space.id);
      list.push(space);
    }
    raw.forEach((sp) => {
      if (sp?.id && !seen.has(sp.id)) {
        seen.add(sp.id);
        list.push(sp);
      }
    });
    return list;
  }, [allCalendarSpaces, space]);

  // Multi-Select Calendar Layers:
  // - Inside a Space: defaults to Personal + Current Space
  // - From Standalone `/calendar`: defaults to ALL layers (Master Calendar!)
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(() => {
    if (space?.id) return ['personal', space.id];
    const spaceIds = (Array.isArray(allCalendarSpaces) ? allCalendarSpaces : [])
      .map((s: any) => s?.id)
      .filter(Boolean);
    return ['personal', ...spaceIds];
  });

  // Auto-sync layers when spaces finish loading on standalone `/calendar` or when switching spaces
  const initializedStandaloneRef = React.useRef(false);
  useEffect(() => {
    if (space?.id) {
      setSelectedLayerIds((prev) => (prev.includes(space.id) ? prev : [...prev, space.id]));
    } else if (!initializedStandaloneRef.current && calendarSpaces.length > 0) {
      initializedStandaloneRef.current = true;
      setSelectedLayerIds(['personal', ...calendarSpaces.map((s) => s.id)]);
    }
  }, [space?.id, calendarSpaces]);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(now));
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [daySheetAutoAdd, setDaySheetAutoAdd] = useState(false);

  // Drawers triggered cleanly from the Bottom Floating Bar!
  const [showLayersDrawer, setShowLayersDrawer] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showSwapsDrawer, setShowSwapsDrawer] = useState(false);
  const [showLifeDrawer, setShowLifeDrawer] = useState(false);

  // Manual Swap Modal state
  const [swapModalState, setSwapModalState] = useState<{
    fromParent: ParentRole;
    initialDate: string;
    initialReturnDate?: string;
  } | null>(null);

  // Visual Interactive Swap Mode directly on the Calendar!
  const [visualSwapMode, setVisualSwapMode] = useState(false);
  const [swapFirstDate, setSwapFirstDate] = useState<string | null>(null);
  const [swapSecondDate, setSwapSecondDate] = useState<string | null>(null);
  const [visualSwapSaving, setVisualSwapSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3200);
  };

  // Active space layer driving custody coloring / swaps / settings (works identically from `/calendar` AND `/space/[id]`!)
  const activeSpaceLayerIds = useMemo(
    () => selectedLayerIds.filter((id) => id !== 'personal'),
    [selectedLayerIds]
  );

  const activeHostSpace = useMemo(() => {
    if (space?.id && activeSpaceLayerIds.includes(space.id)) return space;
    const firstCheckedId = activeSpaceLayerIds[0];
    if (!firstCheckedId) return null;
    return calendarSpaces.find((s) => s.id === firstCheckedId) || null;
  }, [space, activeSpaceLayerIds, calendarSpaces]);

  const activeHostSpaceId = activeHostSpace?.id || null;

  // 3-Month Sliding Window around current viewMonth (saves 90%+ Firestore reads, slides seamlessly to any month/year!)
  const slidingDateRange = useMemo(() => {
    const startDt = new Date(viewYear, viewMonth - 1, 1, 12);
    const endDt = new Date(viewYear, viewMonth + 2, 0, 12);
    return {
      startDate: toYMD(startDt),
      endDate: toYMD(endDt),
    };
  }, [viewYear, viewMonth]);

  const firstPartner = useMemo(() => {
    const members = (activeHostSpace?.members || []).filter(
      (m: any) => m && m.userId && m.userId !== user?.id && m.isActive !== false && m.status !== 'removed'
    );
    return members[0] || null;
  }, [activeHostSpace?.members, user?.id]);

  const effectiveConfig: SmartCalendarConfig = useMemo(() => {
    if (!activeHostSpaceId) {
      // Pure Personal Calendar Mode (no space layer selected -> clean calendar without parent coloring!)
      return {
        ...createDefaultCalendarConfig(user?.realName || 'אני', user?.id),
        mode: 'general',
      };
    }
    if (config) return config;
    return createDefaultCalendarConfig(
      user?.realName || 'אני',
      user?.id,
      firstPartner?.name || 'הורה ב׳',
      firstPartner?.userId
    );
  }, [activeHostSpaceId, config, user?.realName, user?.id, firstPartner?.name, firstPartner?.userId]);

  // Subscribe to active host space config + swaps
  useEffect(() => {
    if (!activeHostSpaceId) {
      setConfig(null);
      setSwaps([]);
      setLoaded(true);
      return;
    }
    const unsubConfig = subscribeCalendarConfig(activeHostSpaceId, (cfg) => {
      setConfig(cfg);
      setLoaded(true);
    });
    const unsubSwaps = subscribeCalendarSwaps(activeHostSpaceId, setSwaps);
    return () => {
      unsubConfig();
      unsubSwaps();
    };
  }, [activeHostSpaceId]);

  // Subscribe to events for EVERY checked space layer (3-month sliding window!)
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    activeSpaceLayerIds.forEach((spId) => {
      const unsub = subscribeCalendarEvents(
        spId,
        (evList) => {
          setEventsBySpaceId((prev) => ({ ...prev, [spId]: evList }));
        },
        slidingDateRange
      );
      unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [activeSpaceLayerIds.join(','), slidingDateRange.startDate, slidingDateRange.endDate]);

  // Subscribe to Private Personal Calendar Layer (`users/{uid}/personalCalendarEvents`, 3-month sliding window!)
  useEffect(() => {
    if (!user?.id) {
      setPersonalEvents([]);
      return;
    }
    const unsubPersonal = subscribePersonalCalendarEvents(
      user.id,
      setPersonalEvents,
      slidingDateRange
    );
    return () => unsubPersonal();
  }, [user?.id, slidingDateRange.startDate, slidingDateRange.endDate]);

  // Listen to decoupled Bottom Floating Bar events (Rule 16!)
  useEffect(() => {
    const onQuickAdd = () => {
      setVisualSwapMode(false);
      setDaySheetAutoAdd(true);
      setShowDaySheet(true);
    };
    const onOpenLayers = () => setShowLayersDrawer(true);
    const onToggleSwap = () => {
      setVisualSwapMode((prev) => {
        if (prev) {
          setSwapFirstDate(null);
          setSwapSecondDate(null);
          return false;
        }
        setSwapFirstDate(null);
        setSwapSecondDate(null);
        if (resolution === 'day') setResolution('month');
        return true;
      });
    };
    const onOpenSettings = () => setShowSettingsSheet(true);

    window.addEventListener('smartshare:calendar_quick_add', onQuickAdd);
    window.addEventListener('smartshare:calendar_open_layers', onOpenLayers);
    window.addEventListener('smartshare:calendar_toggle_swap', onToggleSwap);
    window.addEventListener('smartshare:calendar_open_settings', onOpenSettings);
    return () => {
      window.removeEventListener('smartshare:calendar_quick_add', onQuickAdd);
      window.removeEventListener('smartshare:calendar_open_layers', onOpenLayers);
      window.removeEventListener('smartshare:calendar_toggle_swap', onToggleSwap);
      window.removeEventListener('smartshare:calendar_open_settings', onOpenSettings);
    };
  }, [resolution]);

  // Build Layer Descriptors for CalendarLayersDrawer
  const layerDescriptors: CalendarLayerDescriptor[] = useMemo(() => {
    const list: CalendarLayerDescriptor[] = [
      {
        id: 'personal',
        title: 'היומן האישי שלי',
        color: '#7c3aed',
        icon: '🔒',
        isPersonal: true,
        partnerNames: [],
        eventCount: personalEvents.length,
      },
    ];
    calendarSpaces.forEach((sp, idx) => {
      const partners = (sp.members || [])
        .filter((m: any) => m && m.isActive !== false && m.status !== 'removed')
        .map((m: any) => m.name || m.realName)
        .filter(Boolean);
      list.push({
        id: sp.id,
        title: sp.title || 'מרחב',
        color: LAYER_COLORS[idx % LAYER_COLORS.length],
        icon: sp.icon || '📅',
        isCurrentSpace: sp.id === space?.id,
        partnerNames: partners,
        eventCount: (eventsBySpaceId[sp.id] || []).length,
      });
    });
    return list;
  }, [calendarSpaces, eventsBySpaceId, personalEvents.length, space?.id]);

  // Merged visible events across ALL selected layers!
  const events = useMemo(() => {
    const merged: CalendarEventItem[] = [];
    if (selectedLayerIds.includes('personal')) {
      merged.push(...personalEvents);
    }
    activeSpaceLayerIds.forEach((spId) => {
      const spEvents = eventsBySpaceId[spId] || [];
      merged.push(...spEvents);
    });
    return merged.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  }, [selectedLayerIds, personalEvents, activeSpaceLayerIds, eventsBySpaceId]);

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
    if (!activeHostSpaceId) {
      showToast('במצב אישי טהור אין צורך בהגדרת הורות — כדי להוסיף שכבת הורות/מרחב פתח מרחב עם לוח שנה.');
      return;
    }
    await saveCalendarConfig(activeHostSpaceId, next);
    showToast('✅ הגדרות לוח השנה נשמרו והלוח עודכן!');
  };

  const handleToggleBagItem = async (bagId: string) => {
    if (!activeHostSpaceId) return;
    const nextBag = (effectiveConfig.handoverBag || []).map((b) =>
      b.id === bagId ? { ...b, checked: !b.checked } : b
    );
    await saveCalendarConfig(activeHostSpaceId, { ...effectiveConfig, handoverBag: nextBag });
  };

  const handleAddBagItem = async (label: string) => {
    if (!activeHostSpaceId) return;
    const nextBag = [
      ...(effectiveConfig.handoverBag || []),
      { id: `bag_${Date.now()}`, label, checked: false },
    ];
    await saveCalendarConfig(activeHostSpaceId, { ...effectiveConfig, handoverBag: nextBag });
  };

  const handleRemoveBagItem = async (bagId: string) => {
    if (!activeHostSpaceId) return;
    const nextBag = (effectiveConfig.handoverBag || []).filter((b) => b.id !== bagId);
    await saveCalendarConfig(activeHostSpaceId, { ...effectiveConfig, handoverBag: nextBag });
  };

  // Horizontal Swipe Gesture for Month / Week / Day navigation (RTL natural swipe!)
  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (resolution === 'month') handleNextMonth();
      else if (resolution === 'week') shiftSelectedDateBy(7);
      else shiftSelectedDateBy(1);
    },
    onSwipeRight: () => {
      if (resolution === 'month') handlePrevMonth();
      else if (resolution === 'week') shiftSelectedDateBy(-7);
      else shiftSelectedDateBy(-1);
    },
  });

  const handleCalendarDateTap = (ymd: string) => {
    if (!visualSwapMode) {
      setSelectedDate(ymd);
      const dt = parseYMD(ymd);
      setViewYear(dt.getFullYear());
      setViewMonth(dt.getMonth());
      setDaySheetAutoAdd(false);
      setShowDaySheet(true);
      return;
    }
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
    if (!swapFirstDate || !activeHostSpaceId) {
      showToast('כדי לבצע החלפת ימים יש לסמן שכבת מרחב הורות ב-📚 שכבות.');
      return;
    }
    setVisualSwapSaving(true);
    try {
      const firstRes = resolveDayCustody(swapFirstDate, effectiveConfig, swaps);
      const fromParent: ParentRole = firstRes.overallParent === 'parent_b' ? 'parent_b' : 'parent_a';
      const toParent: ParentRole = fromParent === 'parent_a' ? 'parent_b' : 'parent_a';
      const isTwoWay = Boolean(swapSecondDate);

      await requestCustodySwap(activeHostSpaceId, {
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

  const handleAddCalendarEvent = async (ev: Omit<CalendarEventItem, 'id' | 'createdAt'>) => {
    if ((ev.visibility === 'private' || !activeHostSpaceId) && user?.id) {
      await createPersonalCalendarEvent(user.id, { ...ev, visibility: 'private' });
      showToast('🔒 נשמר ביומן האישי שלך בלבד!');
    } else if (activeHostSpaceId) {
      await createCalendarEvent(activeHostSpaceId, ev);
      showToast('🌐 נשמר ביומן המשותף של המרחב!');
    }
  };

  const handleDeleteCalendarEvent = async (ev: CalendarEventItem) => {
    if (ev.visibility === 'private' && user?.id) {
      await deletePersonalCalendarEvent(user.id, ev.id);
    } else if (activeHostSpaceId) {
      await deleteCalendarEvent(activeHostSpaceId, ev.id);
    }
  };

  const handleToggleEventCompleted = async (ev: CalendarEventItem, completed: boolean) => {
    await toggleCalendarEventCompleted(activeHostSpaceId || '', user?.id || 'me', ev, completed);
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

  const onlyPersonalSelected = selectedLayerIds.length === 1 && selectedLayerIds[0] === 'personal';

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        padding: '0.45rem',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '18px',
        border: '1px solid #e2e8f0',
        marginBottom: '5.5rem',
        position: 'relative',
      }}
    >
      {/* Floating Feedback Toast */}
      {toastMsg && (
        <div
          style={{
            padding: '0.45rem 0.75rem',
            borderRadius: '11px',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 800,
            textAlign: 'center',
            boxShadow: '0 6px 16px rgba(15,23,42,0.2)',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Subtle 1-Line First-Time Setup Nudge (only if activeHostSpaceId exists and is unconfigured) */}
      {loaded && activeHostSpaceId && !config && (
        <button
          type="button"
          onClick={() => setShowSetupModal(true)}
          style={{
            padding: '0.38rem 0.7rem',
            borderRadius: '10px',
            border: '1.5px solid #c7d2fe',
            background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
            color: '#312e81',
            fontSize: '0.74rem',
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

      {/* VISUAL INTERACTIVE SWAP BANNER (only visible when Swap Mode is active!) */}
      {visualSwapMode && (
        <div
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ecfdf5 100%)',
            border: '2px solid #818cf8',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            boxShadow: '0 6px 16px rgba(79,70,229,0.14)',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1e1b4b' }}>
            {!swapFirstDate
              ? '1️⃣ לחץ על היום הראשון על הלוח שרוצים להעביר/להחליף'
              : !swapSecondDate
                ? `1️⃣ נבחר ${formatShortDate(swapFirstDate)} — עכשיו לחץ על יום תמורה (או אשר העברה חד-פעמית)`
                : `🔄 החלפה בין ${formatShortDate(swapFirstDate)} לבין ${formatShortDate(swapSecondDate)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {swapFirstDate && (
              <button
                type="button"
                disabled={visualSwapSaving}
                onClick={handleConfirmVisualSwap}
                style={{
                  padding: '0.38rem 0.8rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
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
                padding: '0.38rem 0.65rem',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.72rem',
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
                padding: '0.38rem 0.6rem',
                borderRadius: '9px',
                border: 'none',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* RESOLUTION 1: COMPACT FULL-MONTH GRID (Swipe Left/Right supported!) */}
      {resolution === 'month' && (
        <div {...swipeHandlers}>
          <CalendarMonthGrid
            year={viewYear}
            monthIndex={viewMonth}
            selectedDate={selectedDate}
            onSelectDate={handleCalendarDateTap}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            resolution={resolution}
            onChangeResolution={setResolution}
            config={effectiveConfig}
            events={events}
            swaps={swaps}
            visualSwapMode={visualSwapMode}
            swapFirstDate={swapFirstDate}
            swapSecondDate={swapSecondDate}
          />
        </div>
      )}

      {/* RESOLUTION 2: WEEKLY VIEW (Unified Header + 7-Day Strip + Live Selected Day Card right below — zero 7 empty rows!) */}
      {resolution === 'week' && (
        <div {...swipeHandlers} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <CalendarWeekView
            selectedDate={selectedDate}
            onSelectDate={(ymd) => {
              if (visualSwapMode) {
                handleCalendarDateTap(ymd);
              } else {
                setSelectedDate(ymd);
                const dt = parseYMD(ymd);
                setViewYear(dt.getFullYear());
                setViewMonth(dt.getMonth());
              }
            }}
            onPrevWeek={() => shiftSelectedDateBy(-7)}
            onNextWeek={() => shiftSelectedDateBy(7)}
            onToday={handleToday}
            resolution={resolution}
            onChangeResolution={setResolution}
            config={effectiveConfig}
            events={events}
            swaps={swaps}
            visualSwapMode={visualSwapMode}
            swapFirstDate={swapFirstDate}
            swapSecondDate={swapSecondDate}
          />
          <CalendarDayDrawer
            key={`week_day_${selectedDate}`}
            selectedDate={selectedDate}
            config={effectiveConfig}
            events={events}
            swaps={swaps}
            currentUserId={user?.id || 'me'}
            defaultVisibility={onlyPersonalSelected ? 'private' : 'shared'}
            onAddEvent={handleAddCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            onToggleComplete={handleToggleEventCompleted}
            onOpenSwapModal={(from) =>
              setSwapModalState({ fromParent: from, initialDate: selectedDate })
            }
            onToggleBagItem={handleToggleBagItem}
            onAddBagItem={handleAddBagItem}
            onRemoveBagItem={handleRemoveBagItem}
          />
        </div>
      )}

      {/* RESOLUTION 3: DAILY VIEW (DRY Unified Header + Visual Day Cube Card!) */}
      {resolution === 'day' && (() => {
        const dt = parseYMD(selectedDate);
        const dailyTitle = `יום ${HEBREW_DAYS_FULL[dt.getDay()]}, ${dt.getDate()} ב${HEBREW_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
        return (
          <div {...swipeHandlers} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <CalendarUnifiedHeader
              resolution={resolution}
              onChangeResolution={setResolution}
              title={dailyTitle}
              onPrev={() => shiftSelectedDateBy(-1)}
              onNext={() => shiftSelectedDateBy(1)}
              onToday={handleToday}
              prevLabel="יום קודם"
              nextLabel="יום הבא"
            />
            <CalendarDayDrawer
              key={`day_view_${selectedDate}`}
              selectedDate={selectedDate}
              config={effectiveConfig}
              events={events}
              swaps={swaps}
              currentUserId={user?.id || 'me'}
              defaultVisibility={onlyPersonalSelected ? 'private' : 'shared'}
              onAddEvent={handleAddCalendarEvent}
              onDeleteEvent={handleDeleteCalendarEvent}
              onToggleComplete={handleToggleEventCompleted}
              onOpenSwapModal={(from) =>
                setSwapModalState({ fromParent: from, initialDate: selectedDate })
              }
              onToggleBagItem={handleToggleBagItem}
              onAddBagItem={handleAddBagItem}
              onRemoveBagItem={handleRemoveBagItem}
            />
          </div>
        );
      })()}

      {/* DAY DETAIL SHEET MODAL — Opens immediately when tapping ANY day or tapping center ➕ FAB! */}
      {showDaySheet &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999990,
              background: 'rgba(15, 23, 42, 0.56)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '0.5rem',
            }}
            onClick={() => setShowDaySheet(false)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '520px',
                maxHeight: '88dvh',
                overflowY: 'auto',
                background: '#f8fafc',
                borderRadius: '22px',
                padding: '0.65rem',
                boxShadow: '0 24px 60px rgba(15,23,42,0.38)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.15rem 0.35rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#475569' }}>
                  📅 פירוט יום מלא
                </span>
                <button
                  type="button"
                  onClick={() => setShowDaySheet(false)}
                  style={{ border: 'none', background: '#e2e8f0', color: '#0f172a', width: '30px', height: '30px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <CalendarDayDrawer
                key={`${selectedDate}_${daySheetAutoAdd ? 'add' : 'view'}`}
                selectedDate={selectedDate}
                config={effectiveConfig}
                events={events}
                swaps={swaps}
                currentUserId={user?.id || 'me'}
                defaultVisibility={onlyPersonalSelected ? 'private' : 'shared'}
                initialShowAddForm={daySheetAutoAdd}
                onAddEvent={handleAddCalendarEvent}
                onDeleteEvent={handleDeleteCalendarEvent}
                onToggleComplete={handleToggleEventCompleted}
                onOpenSwapModal={(from) => {
                  setShowDaySheet(false);
                  setSwapModalState({ fromParent: from, initialDate: selectedDate });
                }}
                onToggleBagItem={handleToggleBagItem}
                onAddBagItem={handleAddBagItem}
                onRemoveBagItem={handleRemoveBagItem}
              />
            </div>
          </div>,
          document.body
        )}

      {/* MULTI-SELECT CALENDAR LAYERS DRAWER (opened from Bottom Bar 📚 שכבות) */}
      {showLayersDrawer && (
        <CalendarLayersDrawer
          layers={layerDescriptors}
          selectedLayerIds={selectedLayerIds}
          onToggleLayer={(layerId) =>
            setSelectedLayerIds((prev) =>
              prev.includes(layerId)
                ? prev.length > 1
                  ? prev.filter((id) => id !== layerId)
                  : prev
                : [...prev, layerId]
            )
          }
          onSelectAll={() => setSelectedLayerIds(layerDescriptors.map((l) => l.id))}
          onSelectOnlyCurrent={() => setSelectedLayerIds(space?.id ? [space.id] : ['personal'])}
          onClose={() => setShowLayersDrawer(false)}
        />
      )}

      {/* SETTINGS & MANAGEMENT ACTION SHEET (opened from Bottom Bar ⚙️ הגדרות) */}
      {showSettingsSheet &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999995,
              background: 'rgba(15, 23, 42, 0.52)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '0.6rem',
            }}
            onClick={() => setShowSettingsSheet(false)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#ffffff',
                borderRadius: '22px',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                boxShadow: '0 24px 60px rgba(15,23,42,0.34)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>⚙️ ניהול והגדרות לוח השנה</span>
                  <span style={{ fontSize: '0.65rem', background: '#eef2ff', color: '#4338ca', borderRadius: '5px', padding: '1px 6px', fontWeight: 800 }}>
                    {APP_VERSION}
                  </span>
                </div>
                <button type="button" onClick={() => setShowSettingsSheet(false)} style={{ border: 'none', background: '#f1f5f9', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
              </div>
              {[
                { icon: '⚙️', label: 'הגדרות משפחה, ילדים וימים קבועים', onClick: () => { setShowSettingsSheet(false); setShowSetupModal(true); } },
                { icon: '🔄', label: `יומן החלפות ותיעוד${pendingSwapsCount > 0 ? ` (${pendingSwapsCount})` : ''}`, onClick: () => { setShowSettingsSheet(false); setShowSwapsDrawer(true); } },
                { icon: '🏅', label: 'חוגים, חופשות ותקופות מיוחדות', onClick: () => { setShowSettingsSheet(false); setShowLifeDrawer(true); } },
                {
                  icon: '📅',
                  label: 'החלפה לפי תאריכים (ידני / טווח)',
                  onClick: () => {
                    setShowSettingsSheet(false);
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
                    padding: '0.68rem 0.8rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    textAlign: 'right',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

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
            if (!activeHostSpaceId) return;
            await requestCustodySwap(activeHostSpaceId, payload);
            showToast('🔄 ההחלפה נשמרה ועודכנה בלוח!');
          }}
        />
      )}

      {/* MODAL 3: SWAPS AUDIT LOG DRAWER */}
      {showSwapsDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
            onClick={() => setShowSwapsDrawer(false)}
          >
            <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', maxHeight: '88dvh', background: '#f8fafc', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.32)' }}>
              <div style={{ padding: '0.9rem 1.1rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>🔄 יומן החלפות ותיעוד</h3>
                <button type="button" onClick={() => setShowSwapsDrawer(false)} style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => { setShowSwapsDrawer(false); setVisualSwapMode(true); }} style={{ padding: '0.48rem 0.85rem', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>👆 החלף ויזואלית על הלוח</button>
                  <button type="button" onClick={() => { setShowSwapsDrawer(false); setSwapModalState({ fromParent: 'parent_a', initialDate: selectedDate }); }} style={{ padding: '0.48rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>📅 לפי תאריכים ידנית</button>
                  {swaps.length > 0 && (
                    <button type="button" onClick={handleShareSwapLogWhatsApp} style={{ padding: '0.48rem 0.8rem', borderRadius: '10px', border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer' }}>📤 שתף בוואטסאפ</button>
                  )}
                </div>
                {swaps.length === 0 ? (
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>אין עדיין החלפות רשומות.</div>
                ) : (
                  swaps.map((sw) => {
                    const fromName = effectiveConfig.parents[sw.fromParent]?.name || sw.fromParent;
                    const toName = effectiveConfig.parents[sw.toParent]?.name || sw.toParent;
                    return (
                      <div key={sw.id} style={{ background: '#ffffff', borderRadius: '14px', border: sw.status === 'pending' ? '2px solid #f59e0b' : '1px solid #cbd5e1', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>📅 {sw.targetDate}{sw.endDate && sw.endDate !== sw.targetDate ? ` → ${sw.endDate}` : ''}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: sw.status === 'declined' ? '#dc2626' : '#059669' }}>
                            {sw.status === 'approved' ? '✅ אושר' : sw.status === 'recorded_solo' ? '📌 מתועד' : sw.status === 'declined' ? '❌ נדחה' : '⏳ ממתין'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>
                          {sw.type === 'shift_forward' ? '🔁 היפוך רצף מכאן והלאה' : `עובר מ-${fromName} אל ${toName}`}
                          {sw.type === 'two_way' && sw.returnDate ? ` • בתמורה: ${sw.returnDate}` : ''}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          {sw.status === 'pending' && (
                            <>
                              <button type="button" onClick={() => activeHostSpaceId && respondToCustodySwap(activeHostSpaceId, sw.id, 'approved', user?.id || 'me')} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>✅ אשר</button>
                              <button type="button" onClick={() => activeHostSpaceId && respondToCustodySwap(activeHostSpaceId, sw.id, 'declined', user?.id || 'me')} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>❌ סרב</button>
                            </>
                          )}
                          <button type="button" onClick={() => activeHostSpaceId && deleteSwapRequest(activeHostSpaceId, sw.id)} style={{ padding: '0.28rem 0.55rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer' }}>מחק</button>
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

      {/* MODAL 4: ACTIVITIES, HOLIDAYS & SPECIAL PERIODS DRAWER */}
      {showLifeDrawer &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
            onClick={() => setShowLifeDrawer(false)}
          >
            <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', maxHeight: '90dvh', background: '#f8fafc', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.32)' }}>
              <div style={{ padding: '0.9rem 1.1rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>🏅 חוגים, חופשות ותקופות מיוחדות</h3>
                <button type="button" onClick={() => setShowLifeDrawer(false)} style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
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
