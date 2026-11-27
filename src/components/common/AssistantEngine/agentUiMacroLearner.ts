'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

const STORAGE_KEY = 'agent_learned_ui_macros_v2';
const CLOUD_MACROS_DOC_ID = 'global_macros_v2';
const CROWD_CONSENSUS_MIN_COUNT = 2;
const MAX_MACROS = 60;
const PASSIVE_CHAIN_WINDOW_MS = 14_000;

let cloudMacrosHydrated = false;
let cloudMacrosSaveTimer: ReturnType<typeof setTimeout> | null = null;

const DESTRUCTIVE_RE = /מחק|הסר|בטל|סגור חשבון|חסום|אפס|רוקן|delete|remove|destroy|reset|block|revoke/i;

const HEBREW_STOP_WORDS = new Set([
  'את', 'של', 'על', 'אל', 'עם', 'לי', 'אותי', 'בבקשה', 'תפתחי', 'תפתח', 'פתח', 'פתחי',
  'תביאי', 'תביא', 'לך', 'לעבור', 'לפתוח', 'עבור', 'כדי', 'הזה', 'הזו', 'באותו', 'שלי',
  'רוצה', 'ממך', 'תתחברי', 'תתחבר', 'תיכנסי', 'תיכנס', 'כנסי', 'כנס', 'שם', 'שמה',
  'the', 'to', 'and', 'for', 'me', 'open', 'go', 'show', 'please', 'want', 'you',
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

function saveLearnedUiMacros(list: LearnedUiMacro[], syncToCloud = true): void {
  if (typeof window === 'undefined') return;
  const sorted = [...list]
    .sort((a, b) => b.successCount * 10 + (b.lastUsedAt > a.lastUsedAt ? 1 : 0) - a.successCount * 10)
    .slice(0, MAX_MACROS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage quota errors
  }

  // Collective Crowd Intelligence Sync (strictly structural button chains — NEVER leaks private user queries!)
  if (syncToCloud) {
    if (cloudMacrosSaveTimer) clearTimeout(cloudMacrosSaveTimer);
    cloudMacrosSaveTimer = setTimeout(() => {
      const structuralCrowdMacros = sorted
        .filter((m) => m.successCount >= CROWD_CONSENSUS_MIN_COUNT && m.steps.length >= 2)
        .map((m) => ({
          id: m.id,
          startRoute: m.startRoute,
          steps: m.steps,
          endHeading: m.endHeading || '',
          // Strictly structural keywords derived only from UI button/heading labels (zero PII!)
          keywords: extractTokens(`${m.steps.join(' ')} ${m.endHeading || ''}`).slice(0, 16),
          learnedFrom: m.learnedFrom,
          successCount: m.successCount,
          lastUsedAt: m.lastUsedAt,
        }));
      if (structuralCrowdMacros.length === 0) return;
      setDoc(
        doc(db, 'assistant_ui_map', CLOUD_MACROS_DOC_ID),
        { macros: structuralCrowdMacros, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }, 4500);
  }
}

/**
 * Hydrates crowd-validated multi-step UI macros from Firestore once per session (non-blocking).
 * Enforces Consensus Guard (successCount >= 2) so a single user's random misclick never pollutes the crowd!
 */
export function hydrateCloudUiMacros(): void {
  if (typeof window === 'undefined' || cloudMacrosHydrated) return;
  cloudMacrosHydrated = true;
  getDoc(doc(db, 'assistant_ui_map', CLOUD_MACROS_DOC_ID))
    .then((snap) => {
      if (!snap.exists()) return;
      const remote: LearnedUiMacro[] = snap.data()?.macros || [];
      if (!Array.isArray(remote) || remote.length === 0) return;

      const local = loadLearnedUiMacros();
      const merged = new Map<string, LearnedUiMacro>();

      for (const item of [...remote, ...local]) {
        if (!item?.id || !Array.isArray(item.steps) || item.steps.length < 2) continue;
        // Skip remote items that haven't reached crowd consensus
        const isRemoteOnly = !local.some((l) => l.id === item.id);
        if (isRemoteOnly && (item.successCount || 0) < CROWD_CONSENSUS_MIN_COUNT) continue;

        const prev = merged.get(item.id);
        if (!prev) {
          merged.set(item.id, item);
        } else {
          merged.set(item.id, {
            ...prev,
            endHeading: item.endHeading || prev.endHeading,
            keywords: Array.from(new Set([...(prev.keywords || []), ...(item.keywords || [])])).slice(0, 24),
            successCount: Math.max(prev.successCount || 1, item.successCount || 1),
            lastUsedAt: Math.max(prev.lastUsedAt || 0, item.lastUsedAt || 0),
          });
        }
      }

      saveLearnedUiMacros(Array.from(merged.values()), false);
    })
    .catch(() => {});
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
  /**
   * 100% Universal Token-Coverage Check (Zero app-specific regex!):
   * True if the user's request contains ANY meaningful words/data/questions NOT already covered
   * by the macro's navigation steps (e.g., data to fill into a form, a time, a name, or a question to answer).
   * When true, the macro acts as a 0-token fast-forward prefix and hands off directly to the full Autonomous AI Loop!
   */
  requiresAiContinuation: boolean;
}

/**
 * 0-Token Universal Multi-Step UI Macro Matcher.
 * Matches only when:
 * 1. Query is non-destructive
 * 2. Step 1 button/link is ACTUALLY visible on the current live DOM
 * 3. Strong token match covering at least 2 distinct steps
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

    // Count how many distinct steps match query tokens (strict token matching, no tiny substring collisions)
    let matchedSteps = 0;
    for (const stepLabel of macro.steps) {
      const stepTokens = extractTokens(stepLabel);
      if (
        stepTokens.some((st) =>
          queryTokens.some((qt) => qt === st || (st.length >= 3 && qt.includes(st)))
        )
      ) {
        matchedSteps++;
      }
    }

    // Require >=2 steps to be explicitly referenced in the user's request!
    if (matchedSteps < 2) continue;

    let score = matchedSteps * 20 + Math.min(macro.successCount, 10) * 2;
    if (macro.startRoute === normRoute) score += 10;
    if (macro.learnedFrom === 'ai_loop') score += 5;

    if (!best || score > best.score) {
      best = { macro, score };
    }
  }

  if (!best) return null;

  // Universal Token-Coverage Check: if the user asked for ANYTHING beyond clicking these exact buttons
  // (such as filling a form, adding a task/time/note, or reading/summarizing content), hand off to AI loop!
  const macroCoveredTokens = extractTokens(
    `${best.macro.steps.join(' ')} ${best.macro.endHeading || ''}`
  );
  const uncoveredQueryTokens = queryTokens.filter(
    (qt) => !macroCoveredTokens.some((mt) => qt === mt || (mt.length >= 3 && qt.includes(mt)) || (qt.length >= 3 && mt.includes(qt)))
  );

  return {
    macro: best.macro,
    requiresAiContinuation: uncoveredQueryTokens.length > 0,
  };
}
