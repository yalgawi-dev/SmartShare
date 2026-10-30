/**
 * SmartShare Zero-Cost User Telemetry & Product Intelligence Tracker
 * 
 * Rules:
 * - Single Source of Truth (DRY)
 * - Strict Decoupling: Runs silently in the background
 * - Zero Firebase Cost: Accumulates active seconds, space visits and actions in localStorage
 * - Batched / Piggyback Sync: Only returns aggregated payload when eligible (e.g. once per session/day)
 */

export interface SpaceTelemetryItem {
  id: string;
  title?: string;
  seconds: number;
  visits: number;
  lastVisitAt: string;
}

export interface UserTelemetryPayload {
  totalActiveSeconds: number;
  spaces: Record<string, SpaceTelemetryItem>;
  actions: {
    invoicesCreated: number;
    invoicesApproved: number;
    docsUploaded: number;
    ocrScans: number;
    chatMessages?: number;
  };
  lastSyncedAt?: string;
}

const LOCAL_STORAGE_KEY = 'smartshare_user_telemetry_v1';
const MIN_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours minimum between Firestore updates (Zero-Cost Throttling)

export function getLocalTelemetry(): UserTelemetryPayload {
  if (typeof window === 'undefined') {
    return {
      totalActiveSeconds: 0,
      spaces: {},
      actions: { invoicesCreated: 0, invoicesApproved: 0, docsUploaded: 0, ocrScans: 0, chatMessages: 0 }
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalActiveSeconds: parsed.totalActiveSeconds || 0,
        spaces: parsed.spaces || {},
        actions: {
          invoicesCreated: parsed.actions?.invoicesCreated || 0,
          invoicesApproved: parsed.actions?.invoicesApproved || 0,
          docsUploaded: parsed.actions?.docsUploaded || 0,
          ocrScans: parsed.actions?.ocrScans || 0,
          chatMessages: parsed.actions?.chatMessages || 0,
        },
        lastSyncedAt: parsed.lastSyncedAt
      };
    }
  } catch (e) {
    console.warn('Error reading local telemetry:', e);
  }

  return {
    totalActiveSeconds: 0,
    spaces: {},
    actions: { invoicesCreated: 0, invoicesApproved: 0, docsUploaded: 0, ocrScans: 0, chatMessages: 0 }
  };
}

export function saveLocalTelemetry(data: UserTelemetryPayload) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // LocalStorage quota or private mode protection
  }
}

/**
 * Record active dwell time in a specific space or global app
 */
export function addActiveSeconds(seconds: number, spaceId?: string, spaceTitle?: string) {
  if (seconds <= 0) return;
  const current = getLocalTelemetry();
  current.totalActiveSeconds = (current.totalActiveSeconds || 0) + seconds;

  if (spaceId) {
    if (!current.spaces[spaceId]) {
      current.spaces[spaceId] = {
        id: spaceId,
        title: spaceTitle || 'מרחב',
        seconds: 0,
        visits: 0,
        lastVisitAt: new Date().toISOString()
      };
    }
    current.spaces[spaceId].seconds = (current.spaces[spaceId].seconds || 0) + seconds;
    if (spaceTitle) {
      current.spaces[spaceId].title = spaceTitle;
    }
  }

  saveLocalTelemetry(current);
}

/**
 * Record visit count when a space is entered
 */
export function recordSpaceEnter(spaceId: string, spaceTitle?: string) {
  if (!spaceId) return;
  const current = getLocalTelemetry();
  if (!current.spaces[spaceId]) {
    current.spaces[spaceId] = {
      id: spaceId,
      title: spaceTitle || 'מרחב',
      seconds: 0,
      visits: 0,
      lastVisitAt: new Date().toISOString()
    };
  }
  current.spaces[spaceId].visits = (current.spaces[spaceId].visits || 0) + 1;
  current.spaces[spaceId].lastVisitAt = new Date().toISOString();
  if (spaceTitle) current.spaces[spaceId].title = spaceTitle;

  saveLocalTelemetry(current);
}

/**
 * Record key action events (creation, approval, OCR)
 */
export function recordTelemetryAction(actionType: 'invoiceCreate' | 'invoiceApprove' | 'docUpload' | 'ocrScan' | 'chatMessage') {
  const current = getLocalTelemetry();
  if (actionType === 'invoiceCreate') current.actions.invoicesCreated = (current.actions.invoicesCreated || 0) + 1;
  if (actionType === 'invoiceApprove') current.actions.invoicesApproved = (current.actions.invoicesApproved || 0) + 1;
  if (actionType === 'docUpload') current.actions.docsUploaded = (current.actions.docsUploaded || 0) + 1;
  if (actionType === 'ocrScan') current.actions.ocrScans = (current.actions.ocrScans || 0) + 1;
  if (actionType === 'chatMessage') current.actions.chatMessages = (current.actions.chatMessages || 0) + 1;
  saveLocalTelemetry(current);
}

/**
 * Checks if telemetry needs to be synced to Firestore (Piggyback condition)
 */
export function shouldSyncTelemetry(): boolean {
  if (typeof window === 'undefined') return false;
  const current = getLocalTelemetry();
  if (!current.lastSyncedAt) return current.totalActiveSeconds > 30; // Sync if accumulated at least 30s

  const msSinceLastSync = Date.now() - new Date(current.lastSyncedAt).getTime();
  return msSinceLastSync >= MIN_SYNC_INTERVAL_MS;
}

/**
 * Prepares payload to sync and updates lastSyncedAt
 */
export function prepareSyncPayload(): UserTelemetryPayload {
  const current = getLocalTelemetry();
  current.lastSyncedAt = new Date().toISOString();
  saveLocalTelemetry(current);
  return current;
}


export function triggerTelemetrySyncNow() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('smartshare:sync_telemetry_request'));
}

export function getNextSyncEstimate(): { lastSyncedAt?: string; nextSyncEstimate?: string } {
  const current = getLocalTelemetry();
  if (!current.lastSyncedAt) {
    return { lastSyncedAt: undefined, nextSyncEstimate: 'בסנכרון הקרוב (ממתין לפעילות)' };
  }
  const nextTime = new Date(current.lastSyncedAt).getTime() + MIN_SYNC_INTERVAL_MS;
  const isReady = Date.now() >= nextTime;
  return {
    lastSyncedAt: current.lastSyncedAt,
    nextSyncEstimate: isReady ? 'מוכן לסנכרון בפעולה הבאה' : `בעוד ${Math.ceil((nextTime - Date.now()) / 60000)} דקות`
  };
}
