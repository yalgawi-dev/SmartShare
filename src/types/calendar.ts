/**
 * SmartCalendar Standalone Add-on — Core Data Types
 * Supports:
 * - Phase 1: Parenting & Divorce Management (Solo or Shared mode) + General Calendar
 * - Phase 2 (Reserved): Pro Booking & Client Hub ('pro_booking')
 */

export type CalendarMode = 'parenting' | 'general' | 'pro_booking';

export type ParentRole = 'parent_a' | 'parent_b';

export interface CalendarParent {
  role: ParentRole;
  name: string;
  userId?: string;
  birthDate?: string; // YYYY-MM-DD
  color: string;
  phone?: string;
}

export interface CalendarChild {
  id: string;
  name: string;
  birthDate?: string; // YYYY-MM-DD
  color: string;
  emoji?: string;
  phone?: string; // For kid-friendly WhatsApp / SMS daily transparency updates
  notifyEnabled?: boolean;
}

export type CustodyPresetId =
  | 'primary_midweek_alt_wknd'
  | 'primary_alt_wknd'
  | 'equal_2_2_3'
  | 'equal_2_2_5_5'
  | 'equal_alt_weeks'
  | 'custom';

export type WeekendCycleType = '1_1' | '1_2' | '2_1' | 'fixed';

export interface CustodyPattern {
  preset: CustodyPresetId;
  /** Default weekday assignment (0 = Sunday .. 6 = Saturday) */
  weekdayAssignments: Record<number, ParentRole>;
  /** Whether weekends (Fri-Sat) alternate every week (legacy boolean kept for backwards compatibility) */
  weekendAlternating: boolean;
  /** Visual weekend cycle ratio: 1:1 (every other), 1:2 (1 week anchor / 2 weeks other), 2:1 (2 weeks anchor / 1 week other), or fixed */
  weekendCycle?: WeekendCycleType;
  /** Reference Friday/Saturday anchor date (YYYY-MM-DD) */
  weekendAnchorDate: string;
  /** Which parent has the weekend on weekendAnchorDate */
  weekendAnchorParent: ParentRole;
  /** Default handover time displayed in kid/parent summaries (e.g. "16:00") */
  handoverTime?: string;
}

export interface SchoolBreakItem {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  assignedParent: ParentRole | 'split' | 'regular';
  isCustom?: boolean;
  notes?: string;
}

export type SpecialPeriodCategory =
  | 'war'
  | 'reserve_duty'
  | 'quarantine'
  | 'medical'
  | 'travel'
  | 'other';

export interface SpecialPeriodItem {
  id: string;
  title: string;
  category: SpecialPeriodCategory;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  /** Optional temporary host parent override during the emergency/special period */
  overrideParent?: ParentRole;
  childIds: string[] | 'all';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type SwapRequestType = 'one_time' | 'two_way' | 'shift_forward';

export interface SwapRequestItem {
  id: string;
  type: SwapRequestType;
  targetDate: string;      // YYYY-MM-DD
  endDate?: string;        // Optional multi-day range (e.g. Fri-Sat weekend)
  returnDate?: string;     // For 'two_way' give-and-take swap
  returnEndDate?: string;
  fromParent: ParentRole;
  toParent: ParentRole;
  childIds: string[] | 'all';
  reason?: string;
  status: 'pending' | 'approved' | 'declined' | 'recorded_solo';
  requestedBy: string;
  requestedByName: string;
  respondedBy?: string;
  respondedAt?: string;
  responseNote?: string;
  createdAt: string;
}

export type CalendarEventCategory =
  | 'task'
  | 'meeting'
  | 'note'
  | 'doctor'
  | 'school'
  | 'activity'
  | 'general';

export type CalendarEventVisibility = 'shared' | 'private';

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:mm
  endTime?: string;   // HH:mm
  category: CalendarEventCategory;
  /** 'shared' = visible to space members; 'private' = stored in user's private collection (ONLY creator sees!) */
  visibility?: CalendarEventVisibility;
  /** Task completion checkbox state */
  completed?: boolean;
  childIds: string[] | 'all';
  location?: string;
  driverParent?: ParentRole | 'both';
  pickupParent?: ParentRole | 'both';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type ActivityPaymentArrangement =
  | 'split_50_50'
  | 'custom_percent'
  | 'parent_a_only'
  | 'parent_b_only'
  | 'alternating_activities';

export interface KidActivityItem {
  id: string;
  title: string;
  childId: string;
  daysOfWeek: number[]; // 0=Sun .. 6=Sat
  time?: string;
  location?: string;
  driverParent?: ParentRole | 'custody_parent';
  paymentArrangement: ActivityPaymentArrangement;
  monthlyCost?: number;
  parentAPercent?: number;
  notes?: string;
}

export interface AlimonyPaymentRecord {
  paidAt: string;
  amount?: number;
  markedBy: string;
  note?: string;
}

export interface AlimonyConfig {
  enabled: boolean;
  payingParent: ParentRole;
  monthlyAmount?: number;
  dueDayOfMonth: number; // 1..28
  notes?: string;
  /** Keyed by YYYY-MM */
  paidMonths: Record<string, AlimonyPaymentRecord>;
}

export interface HandoverBagItem {
  id: string;
  label: string;
  childId?: string;
  checked?: boolean;
}

export interface SmartCalendarConfig {
  mode: CalendarMode;
  /** Solo mode lets a single divorced parent record everything immediately without waiting for the other parent */
  isSoloMode: boolean;
  parents: {
    parent_a: CalendarParent;
    parent_b: CalendarParent;
  };
  children: CalendarChild[];
  custodyPattern: CustodyPattern;
  schoolBreaks: SchoolBreakItem[];
  specialPeriods: SpecialPeriodItem[];
  activities: KidActivityItem[];
  alimony: AlimonyConfig;
  handoverBag: HandoverBagItem[];
  updatedAt?: string;
}

export interface DayCustodyResolution {
  date: string;
  /** Dominant parent if all kids are together, or 'split' if kids are divided */
  overallParent: ParentRole | 'split';
  /** Per-child (or 'all') host parent resolution */
  byChild: Record<string, ParentRole>;
  /** Source of the custody assignment for transparency */
  source: 'pattern' | 'swap' | 'school_break' | 'special_period';
  activeSpecialPeriod?: SpecialPeriodItem;
  activeSchoolBreak?: SchoolBreakItem;
  appliedSwaps: SwapRequestItem[];
}
