'use client';

function normalizeRoutePattern(path: string): string {
  return String(path || '/')
    .split('?')[0]
    .replace(/\/[A-Za-z0-9_-]{12,}(?=\/|$)/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id') || '/';
}

/**
 * 100% Universal, App-Agnostic Behavioral Choice Learner.
 * Watches real user selections on <select>, radio, and form toggle controls across ANY web app.
 * Automatically discovers which controls are real "Decision Points" (where users actively pick
 * between 2+ distinct values) vs passive defaults nobody ever changes — ZERO app-specific rules!
 */

export interface LearnedControlChoices {
  id: string;
  routePattern: string;
  controlLabel: string;
  /** Map of chosen option label -> number of times actively selected by user */
  optionCounts: Record<string, number>;
  totalSelections: number;
  lastUpdatedAt: number;
}

export interface LearnedDecisionPointSummary {
  controlLabel: string;
  observedOptions: string[];
  topChoice: string;
  totalSelections: number;
}

const STORAGE_KEY = 'agent_learned_choices_v1';
const MAX_CONTROLS = 80;

function cleanText(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function loadLearnedChoices(): LearnedControlChoices[] {
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

function saveLearnedChoices(list: LearnedControlChoices[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...list]
      .sort((a, b) => b.totalSelections - a.totalSelections || b.lastUpdatedAt - a.lastUpdatedAt)
      .slice(0, MAX_CONTROLS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Records an active user selection on a form control (<select>, radio, or toggle group).
 */
export function recordObservedChoice(params: {
  routePath: string;
  controlLabel: string;
  chosenValue: string;
}): void {
  const controlLabel = cleanText(params.controlLabel);
  const chosenValue = cleanText(params.chosenValue);
  if (controlLabel.length < 2 || chosenValue.length < 1) return;

  const routePattern = normalizeRoutePattern(params.routePath || '/');
  const id = `${routePattern}::${controlLabel.toLowerCase()}`;
  const list = loadLearnedChoices();
  const idx = list.findIndex((c) => c.id === id);
  const now = Date.now();

  if (idx >= 0) {
    const prev = list[idx];
    const nextCounts = { ...prev.optionCounts };
    nextCounts[chosenValue] = (nextCounts[chosenValue] || 0) + 1;
    // Cap distinct tracked options per control to prevent unbounded growth
    const trimmedCounts: Record<string, number> = {};
    Object.entries(nextCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .forEach(([k, v]) => {
        trimmedCounts[k] = v;
      });
    list[idx] = {
      ...prev,
      optionCounts: trimmedCounts,
      totalSelections: prev.totalSelections + 1,
      lastUpdatedAt: now,
    };
  } else {
    list.unshift({
      id,
      routePattern,
      controlLabel,
      optionCounts: { [chosenValue]: 1 },
      totalSelections: 1,
      lastUpdatedAt: now,
    });
  }

  saveLearnedChoices(list);
}

/**
 * Returns controls on the current route where users actively switch between 2+ distinct options.
 * Used by the universal agent to recognize genuine decision points on ANY unknown app!
 */
export function getLearnedDecisionPointsForRoute(routePath: string): LearnedDecisionPointSummary[] {
  const normRoute = normalizeRoutePattern(routePath || '/');
  const list = loadLearnedChoices();

  return list
    .filter((c) => c.routePattern === normRoute && Object.keys(c.optionCounts).length >= 2)
    .sort((a, b) => b.totalSelections - a.totalSelections)
    .slice(0, 8)
    .map((c) => {
      const sortedOpts = Object.entries(c.optionCounts).sort((a, b) => b[1] - a[1]);
      return {
        controlLabel: c.controlLabel,
        observedOptions: sortedOpts.map(([opt]) => opt).slice(0, 8),
        topChoice: sortedOpts[0]?.[0] || '',
        totalSelections: c.totalSelections,
      };
    });
}
