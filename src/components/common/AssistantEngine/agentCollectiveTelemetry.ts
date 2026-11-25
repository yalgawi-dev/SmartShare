/**
 * ADR-014: Collective Batch Telemetry, Autonomous UI Change Detection & Version Impact Analytics
 *
 * 100% App-Agnostic Universal Agent OS Engine:
 * - Zero per-click Firestore writes: buffers anonymous structural events in RAM and flushes
 *   ONE compressed atomic batch every 60 seconds (or on visibilitychange hidden / pagehide).
 * - Optional industry-standard Firebase Analytics bridge (non-blocking, when measurementId is set).
 * - Strict Privacy Sanitizer: zero PII, zero document names, zero amounts, zero user identifiers.
 * - Version Change-Impact Engine: compares action shares Before/After APP_VERSION with an
 *   explicit N >= 50 statistical significance guard.
 */

import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import app, { db } from '@/lib/firebase';
import { APP_VERSION } from '@/constants/version';

export type TelemetryActionSource = 'human' | 'ai' | 'autonomous_skill';

export interface UiChangeMarker {
  version: string;
  routePattern: string;
  scopeLabel: string;
  addedControls: string[];
  detectedAt: number;
}

export interface VersionTelemetryBucket {
  versionLabel: string;
  totalEvents: number;
  humanEvents?: number;
  aiEvents?: number;
  autonomousEvents?: number;
  actions?: Record<string, number>; // key: "routePattern||actionLabel"
}

export interface CollectiveTelemetrySnapshot {
  updatedAt?: number;
  totalEvents?: number;
  versions?: Record<string, VersionTelemetryBucket>; // key: sanitized version e.g. "v3_5_328"
  discoveredControlsByRoute?: Record<string, string[]>;
  recentChangeMarkers?: UiChangeMarker[];
}

export interface ActionRankItem {
  key: string;
  routePattern: string;
  actionLabel: string;
  count: number;
  sharePct: number;
}

export interface VersionImpactDeltaItem {
  key: string;
  routePattern: string;
  actionLabel: string;
  baseCount: number;
  targetCount: number;
  baseSharePct: number;
  targetSharePct: number;
  deltaSharePct: number;
}

export interface VersionImpactReport {
  availableVersions: string[];
  baseVersion: string | null;
  targetVersion: string | null;
  baseTotal: number;
  targetTotal: number;
  isStatisticallySignificant: boolean;
  minSampleThreshold: number;
  topActions: ActionRankItem[];
  unusedDiscoveredControls: Array<{ routePattern: string; controlLabel: string }>;
  deltas: VersionImpactDeltaItem[];
  recentChangeMarkers: UiChangeMarker[];
}

const TELEMETRY_COLLECTION = 'assistant_ui_map';
const TELEMETRY_DOC_ID = 'collective_telemetry_v1';
const FLUSH_INTERVAL_MS = 60_000; // 60 seconds batch window (zero per-click writes!)
const MIN_SIGNIFICANT_SAMPLE = 50;

// In-memory RAM batch buffers
const pendingActions = new Map<string, number>(); // "routePattern||actionLabel" -> count
const pendingSources: Record<TelemetryActionSource, number> = {
  human: 0,
  ai: 0,
  autonomous_skill: 0,
};
const pendingDiscoveredControls = new Map<string, Set<string>>(); // sanitizedRoute -> Set<controlLabel>
let pendingChangeMarkers: UiChangeMarker[] = [];
let pendingTotalEvents = 0;

let flusherInstalled = false;
let flushIntervalId: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

/**
 * Privacy-first sanitizer: strips numbers, emails, phone patterns, and Firestore-unsafe key chars.
 */
export function sanitizeStructuralLabel(raw: string): string {
  return String(raw || '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/\+?\d[\d\s\-().]{4,}\d/g, '')
    .replace(/\d+/g, '')
    .replace(/[.~*/[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 36);
}

export function sanitizeVersionKey(version: string): string {
  return String(version || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sanitizeRouteKey(routePattern: string): string {
  const clean = String(routePattern || '/')
    .replace(/[.~*[\]]/g, '_')
    .trim();
  return clean || '/';
}

/**
 * Optional, non-blocking Firebase Analytics bridge (industry-standard funnel & retention).
 */
async function emitFirebaseAnalyticsBatch(eventName: string, params: Record<string, string | number>): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return;
  try {
    const { getAnalytics, isSupported, logEvent } = await import('firebase/analytics');
    if (await isSupported()) {
      const analytics = getAnalytics(app);
      logEvent(analytics, eventName, params);
    }
  } catch {
    // Silent fallback if analytics is blocked by ad-blocker or unsupported
  }
}

/**
 * Queues a single anonymous structural action into RAM (0ms, zero Firestore cost).
 */
export function queueCollectiveAction(
  routePattern: string,
  rawActionLabel: string,
  source: TelemetryActionSource = 'human'
): void {
  if (typeof window === 'undefined') return;
  const label = sanitizeStructuralLabel(rawActionLabel);
  if (!label || label.length < 2) return;

  const route = sanitizeRouteKey(routePattern);
  const compositeKey = `${route}||${label}`;
  pendingActions.set(compositeKey, (pendingActions.get(compositeKey) || 0) + 1);
  pendingSources[source] = (pendingSources[source] || 0) + 1;
  pendingTotalEvents += 1;

  if (!flusherInstalled) {
    installCollectiveTelemetryFlusher();
  }
}

/**
 * Queues discovered controls from MutationObserver and records structural UI Change Markers
 * whenever new controls appear on a known route/scope.
 */
export function queueScreenDiscoveryDiff(
  routePattern: string,
  scopeLabel: string,
  controls: string[],
  previousControls?: string[]
): void {
  if (typeof window === 'undefined' || !Array.isArray(controls) || controls.length === 0) return;

  const route = sanitizeRouteKey(routePattern);
  const cleanControls = Array.from(
    new Set(controls.map(sanitizeStructuralLabel).filter((c) => c.length >= 2))
  ).slice(0, 20);

  if (cleanControls.length === 0) return;

  if (!pendingDiscoveredControls.has(route)) {
    pendingDiscoveredControls.set(route, new Set());
  }
  const routeSet = pendingDiscoveredControls.get(route)!;
  cleanControls.forEach((c) => routeSet.add(c));

  if (Array.isArray(previousControls) && previousControls.length > 0) {
    const prevSet = new Set(previousControls.map(sanitizeStructuralLabel).filter(Boolean));
    const added = cleanControls.filter((c) => !prevSet.has(c)).slice(0, 8);
    if (added.length > 0) {
      pendingChangeMarkers.unshift({
        version: APP_VERSION,
        routePattern: route,
        scopeLabel: sanitizeStructuralLabel(scopeLabel) || route,
        addedControls: added,
        detectedAt: Date.now(),
      });
      pendingChangeMarkers = pendingChangeMarkers.slice(0, 10);
    }
  }

  if (!flusherInstalled) {
    installCollectiveTelemetryFlusher();
  }
}

/**
 * Flushes all buffered structural telemetry in ONE compressed atomic Firestore write.
 */
export async function flushCollectiveTelemetryNow(): Promise<boolean> {
  if (typeof window === 'undefined' || isFlushing) return false;
  const hasActions = pendingTotalEvents > 0;
  const hasDiscoveries = pendingDiscoveredControls.size > 0;
  const hasMarkers = pendingChangeMarkers.length > 0;
  if (!hasActions && !hasDiscoveries && !hasMarkers) return false;

  isFlushing = true;

  // Snapshot and clear RAM buffers immediately so concurrent clicks are never lost
  const actionsBatch = Array.from(pendingActions.entries());
  const totalBatch = pendingTotalEvents;
  const sourcesBatch = { ...pendingSources };
  const discoveriesBatch = Array.from(pendingDiscoveredControls.entries()).map(([r, s]) => [r, Array.from(s)] as const);
  const markersBatch = [...pendingChangeMarkers];

  pendingActions.clear();
  pendingTotalEvents = 0;
  pendingSources.human = 0;
  pendingSources.ai = 0;
  pendingSources.autonomous_skill = 0;
  pendingDiscoveredControls.clear();
  pendingChangeMarkers = [];

  try {
    const versionKey = sanitizeVersionKey(APP_VERSION);
    const versionActionsUpdate: Record<string, ReturnType<typeof increment>> = {};
    for (const [compositeKey, count] of actionsBatch) {
      versionActionsUpdate[compositeKey] = increment(count);
    }

    const payload: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (totalBatch > 0) {
      payload.totalEvents = increment(totalBatch);
      payload.versions = {
        [versionKey]: {
          versionLabel: APP_VERSION,
          totalEvents: increment(totalBatch),
          ...(sourcesBatch.human > 0 ? { humanEvents: increment(sourcesBatch.human) } : {}),
          ...(sourcesBatch.ai > 0 ? { aiEvents: increment(sourcesBatch.ai) } : {}),
          ...(sourcesBatch.autonomous_skill > 0 ? { autonomousEvents: increment(sourcesBatch.autonomous_skill) } : {}),
          actions: versionActionsUpdate,
        },
      };
    }

    if (discoveriesBatch.length > 0) {
      const discoveredUpdate: Record<string, string[]> = {};
      for (const [route, controls] of discoveriesBatch) {
        discoveredUpdate[route] = controls.slice(0, 24);
      }
      payload.discoveredControlsByRoute = discoveredUpdate;
    }

    if (markersBatch.length > 0) {
      // Read-append-trim only when actual structural UI changes occurred (rare)
      try {
        const snap = await getDoc(doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID));
        const existingMarkers: UiChangeMarker[] = snap.exists()
          ? (snap.data()?.recentChangeMarkers || [])
          : [];
        const combined = [...markersBatch, ...existingMarkers];
        const deduped: UiChangeMarker[] = [];
        const seen = new Set<string>();
        for (const m of combined) {
          const sig = `${m.version}|${m.routePattern}|${(m.addedControls || []).join(',')}`;
          if (!seen.has(sig)) {
            seen.add(sig);
            deduped.push(m);
          }
          if (deduped.length >= 25) break;
        }
        payload.recentChangeMarkers = deduped;
      } catch {
        payload.recentChangeMarkers = markersBatch.slice(0, 15);
      }
    }

    await setDoc(doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID), payload, { merge: true });

    if (totalBatch > 0) {
      void emitFirebaseAnalyticsBatch('agent_collective_batch', {
        app_version: APP_VERSION,
        batch_events: totalBatch,
        unique_actions: actionsBatch.length,
        autonomous_events: sourcesBatch.autonomous_skill,
      });
    }

    return true;
  } catch {
    // Silent non-blocking failure; never disrupt host app UX
    return false;
  } finally {
    isFlushing = false;
  }
}

/**
 * Installs ONE global 60-second batch flusher + pagehide/visibilitychange flush hook.
 */
export function installCollectiveTelemetryFlusher(): () => void {
  if (typeof window === 'undefined' || flusherInstalled) return () => {};
  flusherInstalled = true;

  flushIntervalId = setInterval(() => {
    void flushCollectiveTelemetryNow();
  }, FLUSH_INTERVAL_MS);

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void flushCollectiveTelemetryNow();
    }
  };
  const onPageHide = () => {
    void flushCollectiveTelemetryNow();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    if (flushIntervalId) clearInterval(flushIntervalId);
    flushIntervalId = null;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    flusherInstalled = false;
  };
}

/**
 * Fetches the collective telemetry snapshot for the Admin Product Intelligence Panel.
 */
export async function fetchCollectiveTelemetryDoc(): Promise<CollectiveTelemetrySnapshot | null> {
  try {
    const snap = await getDoc(doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID));
    if (!snap.exists()) return null;
    return snap.data() as CollectiveTelemetrySnapshot;
  } catch {
    return null;
  }
}

/**
 * Computes Top Actions, Unused Discovered Controls, and Before/After Version Impact Deltas
 * with an explicit statistical significance guard (N >= 50 per version).
 */
export function computeVersionImpactReport(
  snapshot: CollectiveTelemetrySnapshot | null,
  preferredBaseVersion?: string,
  preferredTargetVersion?: string
): VersionImpactReport {
  const versionsObj = snapshot?.versions || {};
  const versionBuckets = Object.values(versionsObj)
    .filter((v) => v && v.versionLabel)
    .sort((a, b) => a.versionLabel.localeCompare(b.versionLabel, undefined, { numeric: true }));

  const availableVersions = versionBuckets.map((v) => v.versionLabel);

  // Aggregate global action counts across all versions
  const globalActions = new Map<string, number>();
  let grandTotal = 0;
  for (const bucket of versionBuckets) {
    const actions = bucket.actions || {};
    for (const [k, count] of Object.entries(actions)) {
      const n = Number(count) || 0;
      if (n <= 0) continue;
      globalActions.set(k, (globalActions.get(k) || 0) + n);
      grandTotal += n;
    }
  }

  const topActions: ActionRankItem[] = Array.from(globalActions.entries())
    .map(([key, count]) => {
      const [routePattern, actionLabel] = key.split('||');
      return {
        key,
        routePattern: routePattern || '/',
        actionLabel: actionLabel || key,
        count,
        sharePct: grandTotal > 0 ? Number(((count / grandTotal) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Unused discovered controls (seen by MutationObserver, 0 recorded clicks)
  const usedLabelSet = new Set(
    Array.from(globalActions.keys()).map((k) => {
      const parts = k.split('||');
      return `${parts[0]}||${(parts[1] || '').toLowerCase()}`;
    })
  );
  const unusedDiscoveredControls: Array<{ routePattern: string; controlLabel: string }> = [];
  const discoveredByRoute = snapshot?.discoveredControlsByRoute || {};
  for (const [routePattern, controls] of Object.entries(discoveredByRoute)) {
    if (!Array.isArray(controls)) continue;
    for (const controlLabel of controls) {
      const sig = `${routePattern}||${String(controlLabel || '').toLowerCase()}`;
      if (!usedLabelSet.has(sig) && controlLabel.length >= 2) {
        unusedDiscoveredControls.push({ routePattern, controlLabel });
      }
    }
  }

  // Version Before/After comparison
  const targetVersion =
    preferredTargetVersion && availableVersions.includes(preferredTargetVersion)
      ? preferredTargetVersion
      : availableVersions[availableVersions.length - 1] || null;
  const baseVersion =
    preferredBaseVersion && availableVersions.includes(preferredBaseVersion)
      ? preferredBaseVersion
      : availableVersions.length >= 2
        ? availableVersions[availableVersions.length - 2]
        : null;

  const baseBucket = versionBuckets.find((v) => v.versionLabel === baseVersion);
  const targetBucket = versionBuckets.find((v) => v.versionLabel === targetVersion);
  const baseTotal = baseBucket?.totalEvents || 0;
  const targetTotal = targetBucket?.totalEvents || 0;

  const deltas: VersionImpactDeltaItem[] = [];
  if (baseBucket && targetBucket && baseVersion !== targetVersion) {
    const allKeys = new Set([
      ...Object.keys(baseBucket.actions || {}),
      ...Object.keys(targetBucket.actions || {}),
    ]);
    for (const key of allKeys) {
      const baseCount = Number(baseBucket.actions?.[key]) || 0;
      const targetCount = Number(targetBucket.actions?.[key]) || 0;
      const baseSharePct = baseTotal > 0 ? Number(((baseCount / baseTotal) * 100).toFixed(1)) : 0;
      const targetSharePct = targetTotal > 0 ? Number(((targetCount / targetTotal) * 100).toFixed(1)) : 0;
      const deltaSharePct = Number((targetSharePct - baseSharePct).toFixed(1));
      const [routePattern, actionLabel] = key.split('||');
      deltas.push({
        key,
        routePattern: routePattern || '/',
        actionLabel: actionLabel || key,
        baseCount,
        targetCount,
        baseSharePct,
        targetSharePct,
        deltaSharePct,
      });
    }
    deltas.sort((a, b) => Math.abs(b.deltaSharePct) - Math.abs(a.deltaSharePct));
  }

  return {
    availableVersions,
    baseVersion,
    targetVersion,
    baseTotal,
    targetTotal,
    isStatisticallySignificant: baseTotal >= MIN_SIGNIFICANT_SAMPLE && targetTotal >= MIN_SIGNIFICANT_SAMPLE,
    minSampleThreshold: MIN_SIGNIFICANT_SAMPLE,
    topActions,
    unusedDiscoveredControls: unusedDiscoveredControls.slice(0, 24),
    deltas: deltas.slice(0, 15),
    recentChangeMarkers: snapshot?.recentChangeMarkers || [],
  };
}
