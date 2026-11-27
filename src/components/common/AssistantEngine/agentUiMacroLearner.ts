'use client';

import type { LiveScreenDomInspection } from './assistantDomIntrospector';
import { normalizeRoutePattern } from './assistantUiMapLearner';

export interface LearnedUiMacro {
  id: string;
  startRoute: string;
  /** Ordered button/tab/link labels clicked in sequence (2..3 safe steps) */
  steps: string[];
  endHeading?: string;
  /** Normalized Hebrew/English phrasing tokens associated with this macro */
  keywords: string[];
  learnedFrom: 'passive_clicks' | 'ai_loop';
  successCount: number;
  lastUsedAt: number;
}

const STORAGE_KEY = 'agent_learned_ui_macros_v1';
const MAX_MACROS = 60;
const PASSIVE_CHAIN_WINDOW_MS = 14_000;

const DESTRUCTIVE_RE = /מחק|הסר|בטל|סגור חשבון|חסום|אפס|רוקן|delete|remove|destroy|reset|block|revoke/i;
const QUESTION_READ_RE = /מה\s+|כמה\s+|תגידי|תגיד|ספר|תקריא|האם\s+|איזה\s+|אילו\s+|רשימת|סיכום|what\s+|how\s+many|tell\s+me|read\s+/i;

const HEBREW_STOP_WORDS = new Set([
  'את', 'של', 'על', 'אל', 'עם', 'לי', 'אותי', 'בבקשה', 'תפתחי', 'תפתח', 'פתח', 'פתחי',
  'תביאי', 'תביא', 'לך', 'לעבור', 'לפתוח', 'עבור', 'כדי', 'הזה', 'הזו', 'באותו', 'שלי',
  'the', 'to', 'and', 'for', 'me', 'open', 'go', 'show', 'please',
]);

function normalizeLabel(raw: string): string {
  return String(raw || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(text: string): string[] {
  const clean = normalizeLabel(text)
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9\s]/gi, ' ');
  const tokens = clean
    .split(/\s+/)
    .map((t) => t.replace(/^[והבלמכש](?=[\u0590-\u05FF]{2,})/, ''))
    .filter((t) => t.length >= 2 && !HEBREW_STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

export function isSafeMacroLabel(label: string): boolean {
  const clean = normalizeLabel(label);
  if (clean.length < 2 || clean.length > 42) return false;
  if (DESTRUCTIVE_RE.test(clean)) return false;
  return true;
}

export function loadLearnedUiMacros(): LearnedUiMacro[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLearnedUiMacros(list: LearnedUiMacro[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...list]
      .sort((a, b) => b.successCount * 10 + (b.lastUsedAt > a.lastUsedAt ? 1 : 0) - a.successCount * 10)
      .slice(0, MAX_MACROS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage quota errors
  }
}

function upsertMacro(params: {
  startRoute: string;
  steps: string[];
  endHeading?: string;
  extraQueryText?: string;
  learnedFrom: 'passive_clicks' | 'ai_loop';
}): void {
  const cleanSteps = params.steps.map(normalizeLabel).filter(isSafeMacroLabel);
  if (cleanSteps.length < 2 || cleanSteps.length > 3) return;
  // Avoid duplicate consecutive identical clicks
  if (cleanSteps.some((s, i) => i > 0 && s === cleanSteps[i - 1])) return;

  const normRoute = normalizeRoutePattern(params.startRoute || '/');
  const id = `${normRoute}::${cleanSteps.map((s) => s.toLowerCase()).join('->')}`;
  const newKeywords = extractTokens(
    `${cleanSteps.join(' ')} ${params.endHeading || ''} ${params.extraQueryText || ''}`
  );

  const list = loadLearnedUiMacros();
  const existingIdx = list.findIndex((m) => m.id === id);
  const now = Date.now();

  if (existingIdx >= 0) {
    const prev = list[existingIdx];
    const mergedKw = Array.from(new Set([...prev.keywords, ...newKeywords])).slice(0, 24);
    list[existingIdx] = {
      ...prev,
      endHeading: params.endHeading || prev.endHeading,
      keywords: mergedKw,
      successCount: prev.successCount + 1,
      lastUsedAt: now,
    };
  } else {
    list.unshift({
      id,
      startRoute: normRoute,
      steps: cleanSteps,
      endHeading: params.endHeading || '',
      keywords: newKeywords.slice(0, 24),
      learnedFrom: params.learnedFrom,
      successCount: 1,
      lastUsedAt: now,
    });
  }

  saveLearnedUiMacros(list);
}

// Rolling passive click window (learns multi-step sequences from normal day-to-day user clicks!)
let passiveChain: Array<{ routePath: string; label: string; ts: number }> = [];

export function recordPassiveClickForMacro(params: {
  routePath: string;
  triggerLabel: string;
  opensTitle?: string;
}): void {
  if (!isSafeMacroLabel(params.triggerLabel)) {
    passiveChain = [];
    return;
  }
  const now = Date.now();
  // Drop stale clicks outside 14s rolling window
  passiveChain = passiveChain.filter((c) => now - c.ts <= PASSIVE_CHAIN_WINDOW_MS);
  const cleanLabel = normalizeLabel(params.triggerLabel);
  if (passiveChain.length > 0 && passiveChain[passiveChain.length - 1].label === cleanLabel) {
    return;
  }
  passiveChain.push({ routePath: params.routePath, label: cleanLabel, ts: now });
  if (passiveChain.length > 3) {
    passiveChain = passiveChain.slice(-3);
  }

  // Record 2-step macro (and 3-step if available) automatically!
  if (passiveChain.length >= 2) {
    const lastTwo = passiveChain.slice(-2);
    upsertMacro({
      startRoute: lastTwo[0].routePath,
      steps: lastTwo.map((c) => c.label),
      endHeading: params.opensTitle,
      learnedFrom: 'passive_clicks',
    });
  }
  if (passiveChain.length === 3) {
    upsertMacro({
      startRoute: passiveChain[0].routePath,
      steps: passiveChain.map((c) => c.label),
      endHeading: params.opensTitle,
      learnedFrom: 'passive_clicks',
    });
  }
}

export function recordAiMacroSuccess(params: {
  startRoute: string;
  steps: string[];
  endHeading?: string;
  userQuery: string;
}): void {
  upsertMacro({
    startRoute: params.startRoute,
    steps: params.steps,
    endHeading: params.endHeading,
    extraQueryText: params.userQuery,
    learnedFrom: 'ai_loop',
  });
}

export interface MatchedUiMacroResult {
  macro: LearnedUiMacro;
  /** True if the user ALSO asked a question requiring 1 final AI read of the opened screen's visibleScreenText */
  needsFinalScreenRead: boolean;
}

/**
 * 0-Token Universal Multi-Step UI Macro Matcher.
 * Matches only when:
 * 1. Query is non-destructive
 * 2. Step 1 button/link is ACTUALLY visible on the current live DOM
 * 3. Strong token match covering at least 2 steps (or >= 2 distinct macro keywords)
 */
export function findMatchingUiMacro(
  query: string,
  currentRoute: string,
  currentDom: LiveScreenDomInspection
): MatchedUiMacroResult | null {
  if (!query || DESTRUCTIVE_RE.test(query)) return null;
  const queryTokens = extractTokens(query);
  if (queryTokens.length < 2) return null;

  const normRoute = normalizeRoutePattern(currentRoute || '/');
  const macros = loadLearnedUiMacros();
  if (macros.length === 0) return null;

  const visibleLabelsNorm = new Set(
    (currentDom.interactiveElements || []).map((el) => normalizeLabel(el.label).toLowerCase())
  );

  let best: { macro: LearnedUiMacro; score: number } | null = null;

  for (const macro of macros) {
    if (macro.steps.length < 2) continue;
    // Step 1 must exist right now on the live screen!
    const step1Lower = macro.steps[0].toLowerCase();
    const hasStep1OnScreen = Array.from(visibleLabelsNorm).some(
      (lbl) => lbl === step1Lower || lbl.includes(step1Lower) || step1Lower.includes(lbl)
    );
    if (!hasStep1OnScreen) continue;

    // Count how many distinct steps match query tokens
    let matchedSteps = 0;
    for (const stepLabel of macro.steps) {
      const stepTokens = extractTokens(stepLabel);
      if (stepTokens.some((st) => queryTokens.some((qt) => qt === st || qt.includes(st) || st.includes(qt)))) {
        matchedSteps++;
      }
    }

    // Require ALL steps of a 2-step macro (or >=2 steps of a 3-step macro) to be referenced in the user's request!
    if (matchedSteps < 2) continue;

    let score = matchedSteps * 20 + Math.min(macro.successCount, 10) * 2;
    if (macro.startRoute === normRoute) score += 10;
    if (macro.learnedFrom === 'ai_loop') score += 5;

    if (!best || score > best.score) {
      best = { macro, score };
    }
  }

  if (!best) return null;
  return {
    macro: best.macro,
    needsFinalScreenRead: QUESTION_READ_RE.test(query),
  };
}
