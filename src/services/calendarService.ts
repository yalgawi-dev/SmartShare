/**
 * SmartCalendar Headless Service Layer (Firestore Subcollections + AI Assistant Ready)
 *
 * Stored cleanly under `spaces/{spaceId}/smartCalendar/*` so it NEVER bloats the main space document
 * and stays 100% decoupled from Finance / Vault / FileShare engines (Rule 16).
 *
 * All exported mutators are UI-agnostic Action Primitives so the Personal Assistant (Dana)
 * can invoke them directly in Phase 1.5 without duplicating logic (Rule 4 DRY).
 */

import { db } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  CalendarEventItem,
  SchoolBreakItem,
  SmartCalendarConfig,
  SpecialPeriodItem,
  SwapRequestItem,
} from '@/types/calendar';

function sanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function subscribeCalendarConfig(
  spaceId: string,
  onUpdate: (config: SmartCalendarConfig | null) => void
): () => void {
  const ref = doc(db, 'spaces', spaceId, 'smartCalendar', 'config');
  return onSnapshot(
    ref,
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as SmartCalendarConfig) : null);
    },
    (err) => {
      console.warn('[SmartCalendar] config listener warning:', err);
      onUpdate(null);
    }
  );
}

export function subscribeCalendarEvents(
  spaceId: string,
  onUpdate: (events: CalendarEventItem[]) => void
): () => void {
  const colRef = collection(db, 'spaces', spaceId, 'smartCalendarEvents');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: CalendarEventItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<CalendarEventItem, 'id'>) }));
      items.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      onUpdate(items);
    },
    (err) => {
      console.warn('[SmartCalendar] events listener warning:', err);
      onUpdate([]);
    }
  );
}

export function subscribeCalendarSwaps(
  spaceId: string,
  onUpdate: (swaps: SwapRequestItem[]) => void
): () => void {
  const colRef = collection(db, 'spaces', spaceId, 'smartCalendarSwaps');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: SwapRequestItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<SwapRequestItem, 'id'>) }));
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(items);
    },
    (err) => {
      console.warn('[SmartCalendar] swaps listener warning:', err);
      onUpdate([]);
    }
  );
}

// ============================================================
// Headless Action Primitives (UI + AI Assistant Ready)
// ============================================================

export async function saveCalendarConfig(
  spaceId: string,
  config: SmartCalendarConfig
): Promise<void> {
  const ref = doc(db, 'spaces', spaceId, 'smartCalendar', 'config');
  await setDoc(
    ref,
    sanitize({ ...config, updatedAt: new Date().toISOString() }),
    { merge: true }
  );
}

export async function createCalendarEvent(
  spaceId: string,
  eventInput: Omit<CalendarEventItem, 'id' | 'createdAt'>
): Promise<CalendarEventItem> {
  const id = `cal_ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item: CalendarEventItem = {
    ...eventInput,
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'spaces', spaceId, 'smartCalendarEvents', id), sanitize(item));
  return item;
}

export async function deleteCalendarEvent(spaceId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'spaces', spaceId, 'smartCalendarEvents', eventId));
}

export async function requestCustodySwap(
  spaceId: string,
  swapInput: Omit<SwapRequestItem, 'id' | 'createdAt'>
): Promise<SwapRequestItem> {
  const id = `cal_sw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item: SwapRequestItem = {
    ...swapInput,
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'spaces', spaceId, 'smartCalendarSwaps', id), sanitize(item));
  return item;
}

export async function respondToCustodySwap(
  spaceId: string,
  swapId: string,
  status: 'approved' | 'declined',
  respondedBy: string,
  responseNote?: string
): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId, 'smartCalendarSwaps', swapId), {
    status,
    respondedBy,
    respondedAt: new Date().toISOString(),
    ...(responseNote ? { responseNote } : {}),
  });
}

export async function deleteSwapRequest(spaceId: string, swapId: string): Promise<void> {
  await deleteDoc(doc(db, 'spaces', spaceId, 'smartCalendarSwaps', swapId));
}

export async function addSpecialPeriod(
  spaceId: string,
  currentConfig: SmartCalendarConfig,
  periodInput: Omit<SpecialPeriodItem, 'id' | 'createdAt'>
): Promise<SpecialPeriodItem> {
  const item: SpecialPeriodItem = {
    ...periodInput,
    id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  await saveCalendarConfig(spaceId, {
    ...currentConfig,
    specialPeriods: [item, ...(currentConfig.specialPeriods || [])],
  });
  return item;
}

export async function upsertSchoolBreak(
  spaceId: string,
  currentConfig: SmartCalendarConfig,
  breakItem: SchoolBreakItem
): Promise<void> {
  const existing = currentConfig.schoolBreaks || [];
  const idx = existing.findIndex((b) => b.id === breakItem.id);
  const next = idx >= 0
    ? existing.map((b, i) => (i === idx ? breakItem : b))
    : [...existing, breakItem];
  await saveCalendarConfig(spaceId, { ...currentConfig, schoolBreaks: next });
}

export async function markAlimonyPaid(
  spaceId: string,
  currentConfig: SmartCalendarConfig,
  yearMonth: string, // YYYY-MM
  markedBy: string,
  amount?: number,
  note?: string
): Promise<void> {
  const nextPaid = {
    ...(currentConfig.alimony.paidMonths || {}),
    [yearMonth]: {
      paidAt: new Date().toISOString(),
      amount: amount ?? currentConfig.alimony.monthlyAmount,
      markedBy,
      note,
    },
  };
  await saveCalendarConfig(spaceId, {
    ...currentConfig,
    alimony: { ...currentConfig.alimony, paidMonths: nextPaid },
  });
}
