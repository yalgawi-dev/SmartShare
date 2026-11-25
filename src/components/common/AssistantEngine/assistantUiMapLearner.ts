// Layer 3: Self-Learning & Self-Healing UI Transition Graph ("The Conductor" / Consolidator).
// 100% Generic, Zero Host-App Code Changes:
// - Normalizes dynamic button labels ("שותפים (5)" -> "שותפים") to eliminate duplicates
// - Filters noise clicks (close/cancel/back/empty)
// - Scores transitions with Reinforcement & Time-Decay: score = hitCount * recency - (missCount * 3)
// - Enforces strict Top-8 budget (~100 tokens) per route and self-heals stale/moved buttons.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { inspectLiveScreenDOM } from './assistantDomIntrospector';

export interface LearnedUiTransition {
  routePattern: string;
  triggerLabel: string;
  opensTitle: string;
  discoveredControls: string[];
  lastSeenAt: number;
  hitCount: number;
  missCount?: number;
}

const LOCAL_UI_MAP_KEY = 'smartshare_assistant_ui_map_v1';
const MAX_EDGES = 60;
const STALE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days self-healing TTL

const NOISE_TRIGGERS = new Set([
  '✕', 'x', '×', 'סגור', 'ביטול', 'אישור', 'חזור', 'חזרה', 'הבא', 'הקודם',
  'close', 'cancel', 'ok', 'back', 'next', 'prev', 'dismiss', 'done', 'סיום'
]);

let memoryMap: LearnedUiTransition[] | null = null;
let passiveListenerInstalled = false;
let cloudHydrated = false;
let cloudSaveTimer: any = null;

/**
 * Normalizes dynamic IDs in any web app's URL path into generic route patterns
 * (e.g. "/space/abc12345" -> "/space/:id", "/orders/98421" -> "/orders/:id").
 */
export function normalizeRoutePattern(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname
    .split('/')
    .map((seg, idx) => {
      if (idx === 0 || !seg) return seg;
      if (/^\d+$/.test(seg) || (seg.length >= 8 && /[0-9]/.test(seg))) {
        return ':id';
      }
      return seg;
    })
    .join('/');
}

/**
 * Conductor Normalizer: strips dynamic numeric counters/badges from button labels
 * so "שותפים (1)" and "שותפים (5)" consolidate into ONE clean record: "שותפים".
 */
export function normalizeTriggerLabel(raw: string): string {
  return (raw || '')
    .replace(/\(\s*\d+\s*\)/g, '') // remove "(5)"
    .replace(/\b\d+\s*$/g, '')     // remove trailing counter " 12"
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
}

/**
 * Conductor Noise Gate: ignores non-navigational / close / cancel clicks.
 */
function isNoiseTrigger(normalizedLabel: string): boolean {
  if (!normalizedLabel || normalizedLabel.length < 2) return true;
  const low = normalizedLabel.toLowerCase();
  if (NOISE_TRIGGERS.has(low)) return true;
  if (/^[\d\W_]+$/.test(normalizedLabel) && !/[🔗📁⚙➕🔍💬👥📇]/.test(normalizedLabel)) return true;
  return false;
}

/**
 * Reinforcement & Time-Decay Scoring:
 * High-frequency recent transitions rank first; unseen/failing ones decay and auto-prune.
 */
function computeEdgeScore(edge: LearnedUiTransition, now = Date.now()): number {
  const ageDays = Math.max(0, (now - (edge.lastSeenAt || now)) / (24 * 60 * 60 * 1000));
  const recencyWeight = Math.max(0.25, 1 - ageDays / 21);
  const hits = Math.max(1, edge.hitCount || 1);
  const misses = edge.missCount || 0;
  return hits * recencyWeight - misses * 3;
}

function loadMap(): LearnedUiTransition[] {
  if (memoryMap) return memoryMap;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_UI_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    memoryMap = Array.isArray(parsed)
      ? parsed.filter(
          (e: LearnedUiTransition) =>
            e &&
            e.triggerLabel &&
            !isNoiseTrigger(normalizeTriggerLabel(e.triggerLabel)) &&
            now - (e.lastSeenAt || 0) < STALE_TTL_MS &&
            computeEdgeScore(e, now) > -1
        )
      : [];
  } catch {
    memoryMap = [];
  }
  return memoryMap;
}

function saveMap(entries: LearnedUiTransition[]): void {
  const now = Date.now();
  memoryMap = entries
    .filter((e) => computeEdgeScore(e, now) > -1)
    .sort((a, b) => computeEdgeScore(b, now) - computeEdgeScore(a, now))
    .slice(0, MAX_EDGES);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_UI_MAP_KEY, JSON.stringify(memoryMap));
    } catch {
      // Ignore storage quota errors
    }
  }
  // Debounced non-blocking cloud sync so 1 user's learning teaches all users
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    setDoc(
      doc(db, 'assistant_ui_map', 'global_v1'),
      { transitions: memoryMap, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});
  }, 4000);
}

/**
 * Hydrates shared learned transitions from Firestore once per session (non-blocking).
 */
export function hydrateCloudUiMap(): void {
  if (typeof window === 'undefined' || cloudHydrated) return;
  cloudHydrated = true;
  getDoc(doc(db, 'assistant_ui_map', 'global_v1'))
    .then((snap) => {
      if (!snap.exists()) return;
      const remote: LearnedUiTransition[] = snap.data()?.transitions || [];
      if (!Array.isArray(remote) || remote.length === 0) return;
      const local = loadMap();
      const merged = new Map<string, LearnedUiTransition>();
      for (const item of [...remote, ...local]) {
        if (!item?.triggerLabel) continue;
        const normTrigger = normalizeTriggerLabel(item.triggerLabel);
        if (isNoiseTrigger(normTrigger)) continue;
        const key = `${item.routePattern}::${normTrigger}`;
        const prev = merged.get(key);
        if (!prev) {
          merged.set(key, { ...item, triggerLabel: normTrigger });
        } else {
          merged.set(key, {
            ...prev,
            opensTitle: (item.lastSeenAt || 0) >= (prev.lastSeenAt || 0) ? item.opensTitle : prev.opensTitle,
            discoveredControls: (item.lastSeenAt || 0) >= (prev.lastSeenAt || 0) ? item.discoveredControls : prev.discoveredControls,
            lastSeenAt: Math.max(prev.lastSeenAt || 0, item.lastSeenAt || 0),
            hitCount: Math.max(prev.hitCount || 1, item.hitCount || 1),
            missCount: Math.min(prev.missCount || 0, item.missCount || 0),
          });
        }
      }
      const now = Date.now();
      memoryMap = Array.from(merged.values())
        .sort((a, b) => computeEdgeScore(b, now) - computeEdgeScore(a, now))
        .slice(0, MAX_EDGES);
      try {
        localStorage.setItem(LOCAL_UI_MAP_KEY, JSON.stringify(memoryMap));
      } catch {}
    })
    .catch(() => {});
}

/**
 * Records, normalizes, reinforces, or self-heals a learned UI transition
 * (called by BOTH human clicks AND AI clicks).
 */
export function recordUiTransition(params: {
  routePath: string;
  triggerLabel: string;
  opensTitle: string;
  discoveredControls: string[];
}): void {
  const trigger = normalizeTriggerLabel(params.triggerLabel);
  if (isNoiseTrigger(trigger)) return;

  const controls = Array.from(
    new Set(
      (params.discoveredControls || [])
        .map((c) => normalizeTriggerLabel(c).slice(0, 28))
        .filter((c) => !isNoiseTrigger(c) && c !== trigger)
    )
  ).slice(0, 8);

  if (controls.length === 0 && !params.opensTitle) return;

  const routePattern = normalizeRoutePattern(params.routePath || '/');
  const map = loadMap();
  const idx = map.findIndex((e) => e.routePattern === routePattern && e.triggerLabel === trigger);

  // Merge controls cleanly, keeping the newest structural controls first
  const mergedControls =
    idx >= 0
      ? Array.from(new Set([...controls, ...(map[idx].discoveredControls || [])])).slice(0, 8)
      : controls;

  const nextEntry: LearnedUiTransition = {
    routePattern,
    triggerLabel: trigger,
    opensTitle: (params.opensTitle || (idx >= 0 ? map[idx].opensTitle : '')).slice(0, 50),
    discoveredControls: mergedControls,
    lastSeenAt: Date.now(),
    hitCount: idx >= 0 ? (map[idx].hitCount || 1) + 1 : 1,
    missCount: 0,
  };

  if (idx >= 0) {
    map[idx] = nextEntry;
  } else {
    map.unshift(nextEntry);
  }
  saveMap(map);
}

/**
 * Self-Healing: if an AI click on a learned trigger produced no UI change, mark a miss
 * so obsolete/moved buttons automatically decay and prune themselves.
 */
export function markUiTransitionMissed(routePath: string, triggerLabel: string): void {
  const trigger = normalizeTriggerLabel(triggerLabel);
  const routePattern = normalizeRoutePattern(routePath || '/');
  const map = loadMap();
  const idx = map.findIndex((e) => e.routePattern === routePattern && e.triggerLabel === trigger);
  if (idx === -1) return;
  const nextMiss = (map[idx].missCount || 0) + 1;
  if (nextMiss >= 2) {
    map.splice(idx, 1);
  } else {
    map[idx] = { ...map[idx], missCount: nextMiss };
  }
  saveMap(map);
}

/**
 * Checks whether a trigger label was already learned in the UI Transition Graph for this route.
 * Used to accurately display the "🧠 לימוד עצמי" vs "✨ AI חכם" source badge per step!
 */
export function wasTriggerLearnedOnRoute(routePath: string, triggerLabel: string): { learned: boolean; hitCount: number } {
  const trigger = normalizeTriggerLabel(triggerLabel).toLowerCase();
  if (!trigger) return { learned: false, hitCount: 0 };
  const routePattern = normalizeRoutePattern(routePath || '/');
  const match = loadMap().find(
    (e) =>
      e.routePattern === routePattern &&
      (e.triggerLabel.toLowerCase() === trigger ||
        trigger.includes(e.triggerLabel.toLowerCase()) ||
        e.triggerLabel.toLowerCase().includes(trigger))
  );
  return match ? { learned: true, hitCount: match.hitCount || 1 } : { learned: false, hitCount: 0 };
}

/**
 * Returns a strict Top-8 (~100 tokens) learned UI transition summary for the active route,
 * ranked by Reinforcement & Recency score and strictly filtered to buttons visible on screen.
 */
export function getCompactUiMapForRoute(routePath: string, visibleLabels: string[]): string[] {
  const routePattern = normalizeRoutePattern(routePath || '/');
  const now = Date.now();
  const map = loadMap()
    .filter((e) => e.routePattern === routePattern)
    .sort((a, b) => computeEdgeScore(b, now) - computeEdgeScore(a, now));
  if (map.length === 0) return [];

  const visibleNorm = visibleLabels.map((v) => normalizeTriggerLabel(v).toLowerCase()).filter(Boolean);
  const prioritized = map
    .filter((e) =>
      visibleNorm.some((v) => v.includes(e.triggerLabel.toLowerCase()) || e.triggerLabel.toLowerCase().includes(v))
    )
    .slice(0, 8);

  return prioritized.map((e) => {
    const titlePart = e.opensTitle ? `"${e.opensTitle}" ` : '';
    const controlsPart = e.discoveredControls.length > 0 ? `[${e.discoveredControls.join(', ')}]` : '';
    const badge = (e.hitCount || 1) >= 3 ? ` (×${e.hitCount})` : '';
    return `"${e.triggerLabel}"${badge} -> פותח ${titlePart}${controlsPart}`.trim();
  });
}

/**
 * Installs ONE lightweight passive click observer (0ms UI impact, 0 API calls, 0 host-app edits).
 * Automatically learns what modal/controls appear behind any button a user clicks.
 */
export function installPassiveUiMapLearner(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  hydrateCloudUiMap();

  if (passiveListenerInstalled) return () => {};
  passiveListenerInstalled = true;

  const onClickCapture = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest('[data-assistant-drawer="true"]') ||
      target.closest('[data-assistant-fab="true"]') ||
      target.closest('[data-bug-recorder-hud="true"]')
    ) {
      return;
    }

    const clickable = target.closest('button, [role="button"], [role="tab"], a') as HTMLElement | null;
    if (!clickable) return;

    const rawLabel = (clickable.innerText || clickable.getAttribute('title') || clickable.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ')
      .trim();
    const triggerLabel = normalizeTriggerLabel(rawLabel);
    if (isNoiseTrigger(triggerLabel)) return;

    const beforePath = window.location.pathname;
    const beforeSnapshot = inspectLiveScreenDOM();
    const beforeLabels = new Set(beforeSnapshot.interactiveElements.map((e) => normalizeTriggerLabel(e.label)));

    setTimeout(() => {
      try {
        const afterSnapshot = inspectLiveScreenDOM();
        const routeChanged = window.location.pathname !== beforePath;
        const newControls = afterSnapshot.interactiveElements
          .filter((e) => e.inModal || !beforeLabels.has(normalizeTriggerLabel(e.label)))
          .map((e) => e.label);

        const opensTitle =
          afterSnapshot.openModalsOrBanners[0] ||
          (routeChanged ? afterSnapshot.visibleHeadings[0] || window.location.pathname : '');

        if (
          routeChanged ||
          newControls.length >= 2 ||
          afterSnapshot.openModalsOrBanners.length > beforeSnapshot.openModalsOrBanners.length
        ) {
          recordUiTransition({
            routePath: beforePath,
            triggerLabel,
            opensTitle,
            discoveredControls: newControls,
          });
        }
      } catch {
        // Silent passive observer
      }
    }, 380);
  };

  document.addEventListener('click', onClickCapture, { capture: true });
  return () => {
    document.removeEventListener('click', onClickCapture, { capture: true });
    passiveListenerInstalled = false;
  };
}


// ============================================================
// Layer 7B: Autonomous Continuous Screen-Change Watcher (MutationObserver)
// Automatically detects newly added screens, buttons, and entity types on ANY host app
// without developer intervention or manual tags!
// ============================================================
const DISCOVERED_SCREENS_KEY = 'smartshare_assistant_discovered_screens_v1';

export interface DiscoveredScreenSnapshot {
  routePattern: string;
  scopeLabel: string;
  controls: string[];
  entityTypes: string[];
  lastSeenAt: number;
}

let watcherInstalled = false;

export function getDiscoveredScreensMap(): DiscoveredScreenSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISCOVERED_SCREENS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function installAutonomousScreenWatcher(): () => void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || watcherInstalled) {
    return () => {};
  }
  watcherInstalled = true;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFingerprint = '';

  const scanAndLearn = () => {
    try {
      const dom = inspectLiveScreenDOM();
      const routePattern = normalizeRoutePattern(window.location.pathname);
      const scopeLabel = dom.activeScope?.label || dom.visibleHeadings[0] || routePattern;
      const controls = Array.from(
        new Set(dom.visibleButtonsAndActions.map(normalizeTriggerLabel).filter((c) => c.length >= 2))
      ).slice(0, 20);
      const entityTypes = Array.from(
        new Set((dom.visibleEntities || []).map((e) => e.type).filter(Boolean))
      );

      const fp = `${routePattern}|${scopeLabel}|${controls.join(',')}|${entityTypes.join(',')}`;
      if (fp === lastFingerprint || controls.length === 0) return;
      lastFingerprint = fp;

      const list = getDiscoveredScreensMap();
      const idx = list.findIndex((s) => s.routePattern === routePattern && s.scopeLabel === scopeLabel);
      const entry: DiscoveredScreenSnapshot = {
        routePattern,
        scopeLabel,
        controls,
        entityTypes,
        lastSeenAt: Date.now(),
      };
      if (idx >= 0) list[idx] = entry;
      else list.unshift(entry);

      localStorage.setItem(DISCOVERED_SCREENS_KEY, JSON.stringify(list.slice(0, 30)));
    } catch {
      // Never impact host UI
    }
  };

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndLearn, 1800);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  debounceTimer = setTimeout(scanAndLearn, 1200);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    observer.disconnect();
    watcherInstalled = false;
  };
}
