// Layer 3: Self-Learning & Self-Healing UI Transition Graph (100% Generic, Zero Host-App Code Changes).
// Passively observes human clicks AND AI clicks from outside the host app to learn what modal,
// panel, or controls open behind every button — and self-heals automatically when the UI changes.

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
      // Treat numeric IDs or long alphanumeric tokens as dynamic params
      if (/^\d+$/.test(seg) || (seg.length >= 8 && /[0-9]/.test(seg))) {
        return ':id';
      }
      return seg;
    })
    .join('/');
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
            now - (e.lastSeenAt || 0) < STALE_TTL_MS &&
            (e.missCount || 0) < 3
        )
      : [];
  } catch {
    memoryMap = [];
  }
  return memoryMap;
}

function saveMap(entries: LearnedUiTransition[]): void {
  memoryMap = entries.slice(0, MAX_EDGES);
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
        const key = `${item.routePattern}::${item.triggerLabel}`;
        const prev = merged.get(key);
        if (!prev || (item.lastSeenAt || 0) > (prev.lastSeenAt || 0)) {
          merged.set(key, item);
        }
      }
      memoryMap = Array.from(merged.values())
        .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0))
        .slice(0, MAX_EDGES);
      try {
        localStorage.setItem(LOCAL_UI_MAP_KEY, JSON.stringify(memoryMap));
      } catch {}
    })
    .catch(() => {});
}

/**
 * Records or self-heals a learned UI transition (called by BOTH human clicks AND AI clicks).
 */
export function recordUiTransition(params: {
  routePath: string;
  triggerLabel: string;
  opensTitle: string;
  discoveredControls: string[];
}): void {
  const trigger = (params.triggerLabel || '').replace(/\s+/g, ' ').trim().slice(0, 45);
  const controls = Array.from(
    new Set(
      (params.discoveredControls || [])
        .map((c) => c.replace(/\s+/g, ' ').trim().slice(0, 32))
        .filter((c) => c.length >= 2 && c !== trigger)
    )
  ).slice(0, 10);

  if (!trigger || (controls.length === 0 && !params.opensTitle)) return;

  const routePattern = normalizeRoutePattern(params.routePath || '/');
  const map = loadMap();
  const idx = map.findIndex((e) => e.routePattern === routePattern && e.triggerLabel === trigger);

  const nextEntry: LearnedUiTransition = {
    routePattern,
    triggerLabel: trigger,
    opensTitle: (params.opensTitle || '').slice(0, 50),
    discoveredControls: controls,
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
 * so obsolete/moved buttons automatically prune themselves.
 */
export function markUiTransitionMissed(routePath: string, triggerLabel: string): void {
  const routePattern = normalizeRoutePattern(routePath || '/');
  const map = loadMap();
  const idx = map.findIndex((e) => e.routePattern === routePattern && e.triggerLabel === triggerLabel);
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
 * Returns a super-compact (~80-120 tokens) learned UI transition summary for the active route,
 * strictly filtered to transitions whose trigger is visible or relevant on the current route.
 */
export function getCompactUiMapForRoute(routePath: string, visibleLabels: string[]): string[] {
  const routePattern = normalizeRoutePattern(routePath || '/');
  const map = loadMap().filter((e) => e.routePattern === routePattern);
  if (map.length === 0) return [];

  const visibleLower = visibleLabels.map((v) => v.toLowerCase());
  // Prioritize triggers currently visible on screen (Live DOM always beats stale entries!)
  const prioritized = map
    .filter((e) => visibleLower.some((v) => v.includes(e.triggerLabel.toLowerCase()) || e.triggerLabel.toLowerCase().includes(v)))
    .slice(0, 10);

  return prioritized.map((e) => {
    const titlePart = e.opensTitle ? `"${e.opensTitle}" ` : '';
    const controlsPart = e.discoveredControls.length > 0 ? `[${e.discoveredControls.join(', ')}]` : '';
    return `"${e.triggerLabel}" -> פותח ${titlePart}${controlsPart}`.trim();
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

    const triggerLabel = (clickable.innerText || clickable.getAttribute('title') || clickable.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 45);
    if (!triggerLabel || triggerLabel.length < 2) return;

    const beforePath = window.location.pathname;
    const beforeSnapshot = inspectLiveScreenDOM();
    const beforeLabels = new Set(beforeSnapshot.interactiveElements.map((e) => e.label));

    setTimeout(() => {
      try {
        const afterSnapshot = inspectLiveScreenDOM();
        const routeChanged = window.location.pathname !== beforePath;
        const newControls = afterSnapshot.interactiveElements
          .filter((e) => e.inModal || !beforeLabels.has(e.label))
          .map((e) => e.label);

        const opensTitle =
          afterSnapshot.openModalsOrBanners[0] ||
          (routeChanged ? afterSnapshot.visibleHeadings[0] || window.location.pathname : '');

        if (routeChanged || newControls.length >= 2 || (afterSnapshot.openModalsOrBanners.length > beforeSnapshot.openModalsOrBanners.length)) {
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
