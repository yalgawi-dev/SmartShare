/**
 * SmartCalendar Pure Engine (DRY & Headless — UI-agnostic)
 * Computes:
 * - Daily custody resolution (with per-child granularity!)
 * - One-time swaps (without breaking future weekend rhythm) vs Two-way swaps vs Shift-forward swaps
 * - Editable Israeli school vacations & holidays
 * - Emergency / Special Periods (war, reserve duty, quarantine, medical, travel)
 * - Automatic yearly birthdays (children & parents) with age calculation
 * - Monthly & yearly Custody Balance stats
 * - Kid-friendly daily transparency message builder (WhatsApp / Share)
 */

import {
  CalendarChild,
  CalendarEventItem,
  CustodyPattern,
  CustodyPresetId,
  DayCustodyResolution,
  ParentRole,
  SchoolBreakItem,
  SmartCalendarConfig,
  SpecialPeriodItem,
  SwapRequestItem,
} from '@/types/calendar';

export const HEBREW_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const HEBREW_DAYS_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const SPECIAL_PERIOD_META: Record<
  SpecialPeriodItem['category'],
  { label: string; icon: string; color: string; bg: string }
> = {
  war: { label: 'מלחמה / מצב ביטחוני', icon: '🛡️', color: '#991b1b', bg: '#fef2f2' },
  reserve_duty: { label: 'מילואים', icon: '🎖️', color: '#3f6212', bg: '#f7fee7' },
  quarantine: { label: 'קורונה / בידוד', icon: '😷', color: '#9a3412', bg: '#fff7ed' },
  medical: { label: 'אשפוז / רפואי', icon: '🏥', color: '#075985', bg: '#f0f9ff' },
  travel: { label: 'נסיעה / חו״ל', icon: '✈️', color: '#5b21b6', bg: '#f5f3ff' },
  other: { label: 'אירוע מיוחד', icon: '⚡', color: '#334155', bg: '#f1f5f9' },
};

export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the upcoming Saturday (or today if today is Saturday) in YYYY-MM-DD */
export function getNextSaturdayYMD(fromDate?: Date): string {
  const base = fromDate ? new Date(fromDate) : new Date();
  base.setHours(12, 0, 0, 0);
  const dow = base.getDay(); // 0=Sun..6=Sat
  const daysUntilSat = (6 - dow + 7) % 7;
  base.setDate(base.getDate() + daysUntilSat);
  return toYMD(base);
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function diffDays(ymdA: string, ymdB: string): number {
  const a = parseYMD(ymdA).getTime();
  const b = parseYMD(ymdB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

export function isDateInRange(ymd: string, startDate: string, endDate?: string): boolean {
  const end = endDate || startDate;
  return ymd >= startDate && ymd <= end;
}

/**
 * Pure Conflict Detector: finds overlapping or same-hour events on a given day
 * (works seamlessly across both Shared Space layer and Private Personal layer!).
 */
export function detectDayTimeConflicts(dayEvents: CalendarEventItem[]): Set<string> {
  const conflictingIds = new Set<string>();
  const timed = dayEvents
    .filter((ev) => ev.time && /^\d{1,2}:\d{2}$/.test(ev.time))
    .map((ev) => {
      const [h, m] = ev.time!.split(':').map(Number);
      const startMin = h * 60 + m;
      let endMin = startMin + 45; // Default 45-min slot if no endTime
      if (ev.endTime && /^\d{1,2}:\d{2}$/.test(ev.endTime)) {
        const [eh, em] = ev.endTime.split(':').map(Number);
        const parsedEnd = eh * 60 + em;
        if (parsedEnd > startMin) endMin = parsedEnd;
      }
      return { id: ev.id, startMin, endMin };
    });

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflictingIds.add(a.id);
        conflictingIds.add(b.id);
      }
    }
  }
  return conflictingIds;
}

/** Pre-seeded editable Israeli holidays & school breaks (2025-2027) */
export function getDefaultIsraeliSchoolBreaks(): SchoolBreakItem[] {
  return [
    { id: 'il_hanukkah_2026', title: 'חופשת חנוכה', startDate: '2026-12-06', endDate: '2026-12-13', assignedParent: 'regular' },
    { id: 'il_purim_2027', title: 'חופשת פורים', startDate: '2027-03-22', endDate: '2027-03-24', assignedParent: 'regular' },
    { id: 'il_pesach_2027', title: 'חופשת פסח', startDate: '2027-04-14', endDate: '2027-04-29', assignedParent: 'split' },
    { id: 'il_indep_2027', title: 'יום העצמאות', startDate: '2027-05-12', endDate: '2027-05-12', assignedParent: 'regular' },
    { id: 'il_shavuot_2027', title: 'חג שבועות', startDate: '2027-06-10', endDate: '2027-06-12', assignedParent: 'regular' },
    { id: 'il_summer_2027', title: 'חופש גדול (קיץ)', startDate: '2027-07-01', endDate: '2027-08-31', assignedParent: 'split' },
    { id: 'il_rosh_2026', title: 'ראש השנה', startDate: '2026-09-11', endDate: '2026-09-13', assignedParent: 'regular' },
    { id: 'il_kippur_2026', title: 'יום כיפור', startDate: '2026-09-20', endDate: '2026-09-21', assignedParent: 'regular' },
    { id: 'il_sukkot_2026', title: 'חופשת סוכות', startDate: '2026-09-25', endDate: '2026-10-04', assignedParent: 'split' },
  ];
}

export function buildCustodyPreset(preset: CustodyPresetId, anchorDate?: string): CustodyPattern {
  const anchor = anchorDate || getNextSaturdayYMD();
  switch (preset) {
    case 'primary_midweek_alt_wknd':
      return {
        preset,
        weekdayAssignments: { 0: 'parent_a', 1: 'parent_a', 2: 'parent_b', 3: 'parent_a', 4: 'parent_a', 5: 'parent_a', 6: 'parent_a' },
        weekendAlternating: true,
        weekendAnchorDate: anchor,
        weekendAnchorParent: 'parent_a',
        handoverTime: '16:00',
      };
    case 'primary_alt_wknd':
      return {
        preset,
        weekdayAssignments: { 0: 'parent_a', 1: 'parent_a', 2: 'parent_a', 3: 'parent_a', 4: 'parent_a', 5: 'parent_a', 6: 'parent_a' },
        weekendAlternating: true,
        weekendAnchorDate: anchor,
        weekendAnchorParent: 'parent_a',
        handoverTime: '16:00',
      };
    case 'equal_2_2_3':
    case 'equal_2_2_5_5':
      return {
        preset,
        weekdayAssignments: { 0: 'parent_a', 1: 'parent_a', 2: 'parent_b', 3: 'parent_b', 4: 'parent_a', 5: 'parent_a', 6: 'parent_a' },
        weekendAlternating: true,
        weekendAnchorDate: anchor,
        weekendAnchorParent: 'parent_a',
        handoverTime: '16:00',
      };
    case 'equal_alt_weeks':
      return {
        preset,
        weekdayAssignments: { 0: 'parent_a', 1: 'parent_a', 2: 'parent_a', 3: 'parent_a', 4: 'parent_a', 5: 'parent_a', 6: 'parent_a' },
        weekendAlternating: true,
        weekendAnchorDate: anchor,
        weekendAnchorParent: 'parent_a',
        handoverTime: '16:00',
      };
    default:
      return {
        preset: 'custom',
        weekdayAssignments: { 0: 'parent_a', 1: 'parent_b', 2: 'parent_a', 3: 'parent_b', 4: 'parent_a', 5: 'parent_a', 6: 'parent_a' },
        weekendAlternating: true,
        weekendAnchorDate: anchor,
        weekendAnchorParent: 'parent_a',
        handoverTime: '16:00',
      };
  }
}

export function createDefaultCalendarConfig(myName: string, myUserId?: string, partnerName?: string, partnerUserId?: string): SmartCalendarConfig {
  const hasPartner = Boolean(partnerUserId);
  return {
    mode: 'parenting',
    isSoloMode: !hasPartner,
    parents: {
      parent_a: {
        role: 'parent_a',
        name: myName || 'הורה א׳',
        userId: myUserId,
        color: '#2563eb',
      },
      parent_b: {
        role: 'parent_b',
        name: partnerName || 'הורה ב׳',
        userId: partnerUserId,
        color: '#9333ea',
      },
    },
    children: [],
    custodyPattern: buildCustodyPreset('primary_midweek_alt_wknd'),
    schoolBreaks: getDefaultIsraeliSchoolBreaks(),
    specialPeriods: [],
    activities: [],
    alimony: {
      enabled: false,
      payingParent: 'parent_b',
      dueDayOfMonth: 10,
      paidMonths: {},
    },
    handoverBag: [
      { id: 'bag_1', label: 'בגדים להחלפה ופיג׳מה', checked: false },
      { id: 'bag_2', label: 'תרופות / משאף (אם צריך)', checked: false },
      { id: 'bag_3', label: 'מטען לטלפון / שעון', checked: false },
      { id: 'bag_4', label: 'ציוד לחוגים / בית ספר', checked: false },
    ],
  };
}

function flipParent(role: ParentRole): ParentRole {
  return role === 'parent_a' ? 'parent_b' : 'parent_a';
}

function resolveCycleParent(
  weeksDiff: number,
  cycle: '1_1' | '1_2' | '2_1',
  anchorParent: ParentRole,
  shouldFlipCycle: boolean
): ParentRole {
  let base: ParentRole;
  if (cycle === '1_2') {
    const mod = ((weeksDiff % 3) + 3) % 3;
    base = mod === 0 ? anchorParent : flipParent(anchorParent);
  } else if (cycle === '2_1') {
    const mod = ((weeksDiff % 3) + 3) % 3;
    base = mod === 0 || mod === 1 ? anchorParent : flipParent(anchorParent);
  } else {
    const mod = ((weeksDiff % 2) + 2) % 2;
    base = mod === 0 ? anchorParent : flipParent(anchorParent);
  }
  return shouldFlipCycle ? flipParent(base) : base;
}

/**
 * Computes base parent from repeating custody pattern (accounting for any approved 'shift_forward' swaps up to this date)
 */
function resolveBasePatternParent(
  ymd: string,
  pattern: CustodyPattern,
  approvedShiftSwaps: SwapRequestItem[]
): ParentRole {
  const dateObj = parseYMD(ymd);
  const dow = dateObj.getDay(); // 0=Sun..6=Sat

  // Count how many shift_forward swaps took effect on or before this date
  const shiftFlips = approvedShiftSwaps.filter((s) => s.targetDate <= ymd).length;
  const shouldFlipCycle = shiftFlips % 2 === 1;

  const effectiveCycle: '1_1' | '1_2' | '2_1' | 'fixed' =
    pattern.weekendCycle || (pattern.weekendAlternating ? '1_1' : 'fixed');

  // Alternating full weeks preset (supports 1:1, 1:2, 2:1)
  if (pattern.preset === 'equal_alt_weeks') {
    const anchor = parseYMD(pattern.weekendAnchorDate || ymd);
    const anchorSun = new Date(anchor);
    anchorSun.setDate(anchor.getDate() - anchor.getDay());
    const curSun = new Date(dateObj);
    curSun.setDate(dateObj.getDate() - dow);
    const weeksDiff = Math.round((curSun.getTime() - anchorSun.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const cycleToUse = effectiveCycle === 'fixed' ? '1_1' : effectiveCycle;
    return resolveCycleParent(weeksDiff, cycleToUse, pattern.weekendAnchorParent, shouldFlipCycle);
  }

  // Alternating weekends (Friday = 5, Saturday = 6) with 1:1, 1:2, or 2:1 cycle
  if (effectiveCycle !== 'fixed' && (dow === 5 || dow === 6)) {
    const anchor = parseYMD(pattern.weekendAnchorDate || ymd);
    const anchorFri = new Date(anchor);
    anchorFri.setDate(anchor.getDate() - ((anchor.getDay() + 2) % 7));
    const curFri = new Date(dateObj);
    curFri.setDate(dateObj.getDate() - ((dow + 2) % 7));
    const weeksDiff = Math.round((curFri.getTime() - anchorFri.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return resolveCycleParent(weeksDiff, effectiveCycle, pattern.weekendAnchorParent, shouldFlipCycle);
  }

  // Regular weekday assignment
  return pattern.weekdayAssignments[dow] || 'parent_a';
}

/**
 * Resolves exact custody for a specific date (YYYY-MM-DD), supporting:
 * 1. Base custody pattern (+ shift_forward cycle shifts)
 * 2. School breaks / holidays (when explicitly assigned to parent_a or parent_b)
 * 3. Approved / solo-recorded swaps (one_time & two_way, per-child or all children)
 * 4. Emergency / special periods (highest priority override, per-child or all children)
 */
export function resolveDayCustody(
  ymd: string,
  config: SmartCalendarConfig,
  swaps: SwapRequestItem[]
): DayCustodyResolution {
  const activeSwaps = swaps.filter(
    (s) => s.status === 'approved' || s.status === 'recorded_solo'
  );
  const shiftSwaps = activeSwaps.filter((s) => s.type === 'shift_forward');
  const childKeys = config.children.length > 0 ? config.children.map((c) => c.id) : ['all'];

  // 1. Base pattern
  const baseParent = resolveBasePatternParent(ymd, config.custodyPattern, shiftSwaps);
  const byChild: Record<string, ParentRole> = {};
  childKeys.forEach((cid) => {
    byChild[cid] = baseParent;
  });
  let source: DayCustodyResolution['source'] = 'pattern';

  // 2. School Break / Holiday
  const activeSchoolBreak = (config.schoolBreaks || []).find((b) =>
    isDateInRange(ymd, b.startDate, b.endDate)
  );
  if (activeSchoolBreak && (activeSchoolBreak.assignedParent === 'parent_a' || activeSchoolBreak.assignedParent === 'parent_b')) {
    childKeys.forEach((cid) => {
      byChild[cid] = activeSchoolBreak.assignedParent as ParentRole;
    });
    source = 'school_break';
  }

  // 3. One-time & Two-way swaps (applied chronologically so newer swaps win)
  const appliedSwaps: SwapRequestItem[] = [];
  const sortedSwaps = [...activeSwaps].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const sw of sortedSwaps) {
    if (sw.type === 'shift_forward') continue;
    const targets = sw.childIds === 'all' ? childKeys : sw.childIds;

    if (isDateInRange(ymd, sw.targetDate, sw.endDate)) {
      targets.forEach((cid) => {
        if (byChild[cid] !== undefined) byChild[cid] = sw.toParent;
      });
      appliedSwaps.push(sw);
      source = 'swap';
    } else if (sw.type === 'two_way' && sw.returnDate && isDateInRange(ymd, sw.returnDate, sw.returnEndDate)) {
      targets.forEach((cid) => {
        if (byChild[cid] !== undefined) byChild[cid] = sw.fromParent;
      });
      appliedSwaps.push(sw);
      source = 'swap';
    }
  }

  // 4. Special / Emergency periods (highest priority)
  const activeSpecialPeriod = (config.specialPeriods || []).find((sp) =>
    isDateInRange(ymd, sp.startDate, sp.endDate)
  );
  if (activeSpecialPeriod && activeSpecialPeriod.overrideParent) {
    const targets = activeSpecialPeriod.childIds === 'all' ? childKeys : activeSpecialPeriod.childIds;
    targets.forEach((cid) => {
      if (byChild[cid] !== undefined) byChild[cid] = activeSpecialPeriod.overrideParent!;
    });
    source = 'special_period';
  }

  const uniqueParents = new Set(Object.values(byChild));
  const overallParent: ParentRole | 'split' =
    uniqueParents.size === 1 ? (Array.from(uniqueParents)[0] as ParentRole) : 'split';

  return {
    date: ymd,
    overallParent,
    byChild,
    source,
    activeSpecialPeriod,
    activeSchoolBreak,
    appliedSwaps,
  };
}

/** Finds all birthdays (children + parents) occurring on a given YYYY-MM-DD */
export function getBirthdaysForDate(
  ymd: string,
  config: SmartCalendarConfig
): Array<{ name: string; age: number | null; isChild: boolean; emoji: string }> {
  const [curY, curM, curD] = ymd.split('-').map(Number);
  const results: Array<{ name: string; age: number | null; isChild: boolean; emoji: string }> = [];

  const checkPerson = (name: string, birthDate: string | undefined, isChild: boolean, emoji: string) => {
    if (!birthDate) return;
    const [bY, bM, bD] = birthDate.split('-').map(Number);
    if (bM === curM && bD === curD) {
      const age = bY && curY >= bY ? curY - bY : null;
      results.push({ name, age, isChild, emoji });
    }
  };

  (config.children || []).forEach((c) => checkPerson(c.name, c.birthDate, true, c.emoji || '🎂'));
  checkPerson(config.parents.parent_a.name, config.parents.parent_a.birthDate, false, '🎉');
  checkPerson(config.parents.parent_b.name, config.parents.parent_b.birthDate, false, '🎉');

  return results;
}

/** Computes monthly custody balance stats (number of days for Parent A, Parent B, and Split) */
export function computeMonthlyCustodyStats(
  year: number,
  monthIndex: number, // 0..11
  config: SmartCalendarConfig,
  swaps: SwapRequestItem[]
): { parentADays: number; parentBDays: number; splitDays: number; totalDays: number } {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let parentADays = 0;
  let parentBDays = 0;
  let splitDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = toYMD(new Date(year, monthIndex, d, 12));
    const res = resolveDayCustody(ymd, config, swaps);
    if (res.overallParent === 'parent_a') parentADays++;
    else if (res.overallParent === 'parent_b') parentBDays++;
    else splitDays++;
  }

  return { parentADays, parentBDays, splitDays, totalDays: daysInMonth };
}

/**
 * Builds a warm, calm, kid-safe daily schedule message for WhatsApp / SMS transparency!
 * Never exposes alimony, finances, or parent disputes.
 */
export function buildKidDailyMessage(
  child: CalendarChild | null,
  ymd: string,
  resolution: DayCustodyResolution,
  config: SmartCalendarConfig,
  dayEvents: CalendarEventItem[]
): string {
  const dateObj = parseYMD(ymd);
  const dayName = HEBREW_DAYS_FULL[dateObj.getDay()];
  const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}`;
  const targetKey = child ? child.id : 'all';
  const hostRole = resolution.byChild[targetKey] || (resolution.overallParent === 'split' ? 'parent_a' : resolution.overallParent);
  const hostName = config.parents[hostRole]?.name || 'ההורה';
  const handoverTime = config.custodyPattern.handoverTime;

  const lines: string[] = [];
  lines.push(child ? `היי ${child.name} 💙` : 'היי ילדים אהובים 💙');
  lines.push(
    `היום (יום ${dayName}, ${formattedDate}) ${child ? 'את/ה' : 'אתם'} אצל ${hostName}${
      handoverTime ? ` (מעבר/איסוף בסביבות ${handoverTime})` : ''
    }.`
  );

  // Relevant activities for this day of week
  const dow = dateObj.getDay();
  const kidActivities = (config.activities || []).filter(
    (act) => act.daysOfWeek.includes(dow) && (!child || act.childId === child.id)
  );
  if (kidActivities.length > 0) {
    const actText = kidActivities
      .map((a) => `${a.title}${a.time ? ` ב-${a.time}` : ''}${a.location ? ` (${a.location})` : ''}`)
      .join(', ');
    lines.push(`🏅 חוגים היום: ${actText}`);
  }

  // Relevant events/appointments
  const relevantEvents = dayEvents.filter(
    (ev) => ev.childIds === 'all' || !child || ev.childIds.includes(child.id)
  );
  if (relevantEvents.length > 0) {
    const evText = relevantEvents
      .map((e) => `${e.title}${e.time ? ` ב-${e.time}` : ''}`)
      .join(', ');
    lines.push(`📌 תורים ואירועים: ${evText}`);
  }

  // Handover bag reminder (only items not yet checked)
  const bagItems = (config.handoverBag || []).filter((b) => !b.childId || !child || b.childId === child.id);
  if (bagItems.length > 0) {
    lines.push(`🎒 לא לשכוח בתיק: ${bagItems.slice(0, 4).map((b) => b.label).join(', ')}`);
  }

  lines.push('יום מקסים! ✨');
  return lines.join('\n');
}

export function buildWhatsAppLink(phone: string | undefined, text: string): string {
  const encoded = encodeURIComponent(text);
  if (!phone) return `https://wa.me/?text=${encoded}`;
  const digits = phone.replace(/[^\d]/g, '');
  const intl = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encoded}`;
}
