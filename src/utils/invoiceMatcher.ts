/**
 * Invoice ↔ Expense matching engine (single source of truth).
 *
 * Bidirectional: the same scorer ranks expenses for a scanned invoice
 * AND scanned invoices for a given expense. Pure functions, no side effects.
 *
 * Design rules (agreed with the product owner):
 *  - The score is only a ranking / confidence hint. A human (and partners) always approve.
 *  - Date NEVER blocks or penalises a match (an invoice may arrive a year later).
 *    A close date only adds a small bonus.
 *  - Missing / unreadable OCR fields are treated as "unknown", never as a mismatch.
 *  - A close-but-not-equal amount (rounding) still matches, and exposes `amountDiff`
 *    so the UI can offer to correct the expense.
 */

export interface MatchableDoc {
  amount?: number | null;
  supplier?: string | null;
  date?: string | null;
  invoiceNumber?: string | null;
  vatNumber?: string | null;
}

export type MatchSignalStatus = 'match' | 'close' | 'diff' | 'unknown';

export interface MatchSignal {
  key: 'amount' | 'supplier' | 'date' | 'invoiceNumber' | 'vatNumber';
  label: string;
  status: MatchSignalStatus;
}

export type MatchLevel = 'high' | 'medium' | 'low';

export interface MatchResult<T> {
  item: T;
  /** 0-100 */
  score: number;
  level: MatchLevel;
  signals: MatchSignal[];
  /** invoice amount - expense amount, only when both known and different */
  amountDiff: number | null;
}

const WEIGHTS = { amount: 40, supplier: 30, invoiceNumber: 15, vatNumber: 10, date: 10 } as const;
/** Prevents a single weak signal from reaching a very high percentage. */
const MIN_DENOMINATOR = 60;

const COMPANY_NOISE = new Set([
  'בעמ', 'בע״מ', 'בע"מ', 'חברת', 'חב׳', 'ltd', 'inc', 'co', 'llc', 'the', 'עוסק', 'מורשה', 'סניף',
]);

export function normalizeSupplier(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .replace(/["'`׳״.,\-_/\\()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !COMPANY_NOISE.has(t));
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 0..1 – combines token overlap, containment and character-bigram Dice. */
export function supplierSimilarity(a?: string | null, b?: string | null): number {
  const ta = normalizeSupplier(a);
  const tb = normalizeSupplier(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const ja = ta.join(' ');
  const jb = tb.join(' ');
  if (ja === jb) return 1;
  if (ja.includes(jb) || jb.includes(ja)) return 0.9;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let inter = 0;
  setA.forEach((t) => { if (setB.has(t)) inter++; });
  const jaccard = inter / (setA.size + setB.size - inter);

  const ba = bigrams(ja.replace(/\s/g, ''));
  const bb = bigrams(jb.replace(/\s/g, ''));
  let dice = 0;
  if (ba.length && bb.length) {
    const counts = new Map<string, number>();
    ba.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    let common = 0;
    bb.forEach((g) => {
      const c = counts.get(g) || 0;
      if (c > 0) { common++; counts.set(g, c - 1); }
    });
    dice = (2 * common) / (ba.length + bb.length);
  }
  return Math.max(jaccard, dice * 0.9);
}

function amountSimilarity(a?: number | null, b?: number | null): { value: number; status: MatchSignalStatus; diff: number | null } {
  if (a == null || b == null || isNaN(a) || isNaN(b)) return { value: 0, status: 'unknown', diff: null };
  const diff = Math.round((a - b) * 100) / 100;
  const abs = Math.abs(diff);
  if (abs < 0.005) return { value: 1, status: 'match', diff: null };
  const rel = abs / Math.max(Math.abs(a), Math.abs(b), 1);
  if (abs <= 1 || rel <= 0.01) return { value: 0.85, status: 'close', diff };   // rounding
  if (rel <= 0.05) return { value: 0.4, status: 'close', diff };
  return { value: 0, status: 'diff', diff };
}

function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return null;
  return Math.abs(ta - tb) / 86400000;
}

const clean = (v?: string | null) => (v || '').replace(/\D/g, '');

/** Scores one (invoice, expense) pair. Order of arguments does not matter. */
export function scorePair(a: MatchableDoc, b: MatchableDoc): Omit<MatchResult<never>, 'item'> {
  const signals: MatchSignal[] = [];
  let earned = 0;
  let presentWeight = 0;

  const amt = amountSimilarity(a.amount, b.amount);
  signals.push({ key: 'amount', label: 'סכום', status: amt.status });
  if (amt.status !== 'unknown') {
    earned += WEIGHTS.amount * amt.value;
    presentWeight += WEIGHTS.amount;
  }

  const hasSupplier = normalizeSupplier(a.supplier).length > 0 && normalizeSupplier(b.supplier).length > 0;
  const sup = supplierSimilarity(a.supplier, b.supplier);
  signals.push({ key: 'supplier', label: 'ספק', status: !hasSupplier ? 'unknown' : sup >= 0.8 ? 'match' : sup >= 0.45 ? 'close' : 'diff' });
  if (hasSupplier) {
    earned += WEIGHTS.supplier * sup;
    presentWeight += WEIGHTS.supplier;
  }

  const numA = clean(a.invoiceNumber);
  const numB = clean(b.invoiceNumber);
  if (numA && numB) {
    const same = numA === numB;
    signals.push({ key: 'invoiceNumber', label: 'מספר חשבונית', status: same ? 'match' : 'diff' });
    // A different number is only a weak negative: OCR digits are unreliable.
    earned += same ? WEIGHTS.invoiceNumber : 0;
    presentWeight += same ? WEIGHTS.invoiceNumber : WEIGHTS.invoiceNumber * 0.3;
  } else {
    signals.push({ key: 'invoiceNumber', label: 'מספר חשבונית', status: 'unknown' });
  }

  const vatA = clean(a.vatNumber);
  const vatB = clean(b.vatNumber);
  if (vatA && vatB) {
    const same = vatA === vatB;
    signals.push({ key: 'vatNumber', label: 'עוסק מורשה', status: same ? 'match' : 'diff' });
    earned += same ? WEIGHTS.vatNumber : 0;
    presentWeight += same ? WEIGHTS.vatNumber : WEIGHTS.vatNumber * 0.3;
  } else {
    signals.push({ key: 'vatNumber', label: 'עוסק מורשה', status: 'unknown' });
  }

  // Date: bonus only. Never part of the denominator, never penalises.
  const days = daysBetween(a.date, b.date);
  let dateStatus: MatchSignalStatus = 'unknown';
  if (days != null) {
    if (days <= 3) { earned += WEIGHTS.date; dateStatus = 'match'; }
    else if (days <= 14) { earned += WEIGHTS.date * 0.6; dateStatus = 'close'; }
    else if (days <= 60) { earned += WEIGHTS.date * 0.3; dateStatus = 'close'; }
    // further apart: says nothing → stays 'unknown'
  }
  signals.push({ key: 'date', label: 'תאריך', status: dateStatus });

  const denominator = Math.max(presentWeight, MIN_DENOMINATOR);
  let score = Math.max(0, Math.min(100, Math.round((earned / denominator) * 100)));
  // Both suppliers are readable and clearly different: same amount alone must not look like a good match.
  const supplierSignal = signals.find((s) => s.key === 'supplier');
  if (supplierSignal?.status === 'diff') score = Math.min(score, 50);
  const level: MatchLevel = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';

  return { score, level, signals, amountDiff: amt.diff };
}

interface RankOptions {
  /** Hide candidates below this score (UI always offers a manual list as well). Default 35. */
  minScore?: number;
  limit?: number;
}

function rank<T>(source: MatchableDoc, candidates: T[], toDoc: (c: T) => MatchableDoc, opts: RankOptions = {}): MatchResult<T>[] {
  const { minScore = 35, limit = 5 } = opts;
  return candidates
    .map((item) => ({ item, ...scorePair(source, toDoc(item)) }))
    .filter((r) => r.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Direction 1: a scanned invoice → expenses that still have no attachment. */
export function matchInvoiceToExpenses<E extends MatchableDoc & { hasAttachment?: boolean }>(
  invoice: MatchableDoc,
  expenses: E[],
  opts?: RankOptions
): MatchResult<E>[] {
  return rank(invoice, expenses.filter((e) => !e.hasAttachment), (e) => e, opts);
}

/** Direction 2: an expense → waiting (unassigned) scanned invoices. */
export function matchExpenseToInvoices<I extends MatchableDoc>(
  expense: MatchableDoc,
  waitingInvoices: I[],
  opts?: RankOptions
): MatchResult<I>[] {
  return rank(expense, waitingInvoices, (i) => i, opts);
}
