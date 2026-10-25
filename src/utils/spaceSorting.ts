/**
 * Single source of truth for Space priority sorting and usage tracking.
 * DRY Rule: Used by both the Home Page (src/app/page.tsx) and Settings (src/app/settings/page.tsx).
 */

export function recordSpaceVisit(spaceId: string) {
  if (typeof window === 'undefined' || !spaceId) return;
  try {
    const visitsKey = `space_visits_${spaceId}`;
    const lastActiveKey = `space_last_active_${spaceId}`;
    const currentVisits = parseInt(localStorage.getItem(visitsKey) || '0', 10);
    localStorage.setItem(visitsKey, (currentVisits + 1).toString());
    localStorage.setItem(lastActiveKey, Date.now().toString());
  } catch (e) {
    // Ignore storage quota or disabled errors
  }
}

export function getSpaceUsageMetrics(spaceId: string): { visits: number; lastActive: number } {
  if (typeof window === 'undefined' || !spaceId) return { visits: 0, lastActive: 0 };
  try {
    const visits = parseInt(localStorage.getItem(`space_visits_${spaceId}`) || '0', 10);
    const lastActive = parseInt(localStorage.getItem(`space_last_active_${spaceId}`) || '0', 10);
    return { visits, lastActive };
  } catch (e) {
    return { visits: 0, lastActive: 0 };
  }
}

export function sortSpacesByUsagePriority<T extends { id: string; createdAt?: string; updatedAt?: string }>(spacesList: T[]): T[] {
  return [...spacesList].sort((a, b) => {
    // 1. Priority for brand new spaces (< 24h)
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    const isNewA = (Date.now() - timeA) < 86400000;
    const isNewB = (Date.now() - timeB) < 86400000;

    if (isNewA && !isNewB) return -1;
    if (!isNewA && isNewB) return 1;
    if (isNewA && isNewB) return timeB - timeA; // Both new: newest first

    // 2. Sort by visits count (frequency of use)
    const metricsA = getSpaceUsageMetrics(a.id);
    const metricsB = getSpaceUsageMetrics(b.id);

    if (metricsA.visits !== metricsB.visits) {
      return metricsB.visits - metricsA.visits; // Higher visit count first
    }

    // 3. Sort by recent activity timestamp if visits are equal
    if (metricsA.lastActive !== metricsB.lastActive) {
      return metricsB.lastActive - metricsA.lastActive; // More recently visited first
    }

    // 4. Fallback to updatedAt / createdAt
    const updateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const updateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return updateB - updateA;
  });
}