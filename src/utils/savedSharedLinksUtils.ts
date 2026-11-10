/**
 * Utility to manage the user's saved/collected external share links.
 * Stored locally in localStorage and synced to user profile when authenticated.
 */

export interface SavedSharedLinkItem {
  token: string;
  url: string;
  name: string;
  customLabel?: string;
  itemType: 'file' | 'folder';
  fileType?: string;
  spaceTitle?: string;
  spaceLogoUrl?: string;
  savedAt: number;
  lastOpenedAt: number;
}

const STORAGE_KEY = 'myspace_saved_shared_links';

export function getSavedSharedLinks(): SavedSharedLinkItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Failed to parse saved shared links:', e);
    return [];
  }
}

export function saveSharedLink(item: {
  token: string;
  name: string;
  itemType: 'file' | 'folder';
  fileType?: string;
  spaceTitle?: string;
  spaceLogoUrl?: string;
}): void {
  if (typeof window === 'undefined' || !item.token) return;
  try {
    const current = getSavedSharedLinks();
    const existingIdx = current.findIndex(x => x.token === item.token);
    const now = Date.now();
    const origin = window.location.origin || 'https://smart-share-tvwn-delta.vercel.app';
    const linkUrl = `${origin}/share/${item.token}`;

    if (existingIdx >= 0) {
      // Update last opened and refresh metadata
      current[existingIdx] = {
        ...current[existingIdx],
        name: item.name || current[existingIdx].name,
        spaceTitle: item.spaceTitle || current[existingIdx].spaceTitle,
        spaceLogoUrl: item.spaceLogoUrl || current[existingIdx].spaceLogoUrl,
        lastOpenedAt: now
      };
    } else {
      current.unshift({
        token: item.token,
        url: linkUrl,
        name: item.name,
        itemType: item.itemType,
        fileType: item.fileType,
        spaceTitle: item.spaceTitle,
        spaceLogoUrl: item.spaceLogoUrl,
        savedAt: now,
        lastOpenedAt: now
      });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('myspace:saved_links_updated'));
  } catch (e) {
    console.warn('Failed to save shared link to storage:', e);
  }
}

export function updateSavedSharedLinkLabel(token: string, newLabel: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const current = getSavedSharedLinks();
    const updated = current.map(x => x.token === token ? { ...x, customLabel: newLabel.trim() || undefined } : x);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('myspace:saved_links_updated'));
  } catch (e) {
    console.warn('Failed to update shared link label:', e);
  }
}

export function removeSavedSharedLink(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const current = getSavedSharedLinks();
    const filtered = current.filter(x => x.token !== token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('myspace:saved_links_updated'));
  } catch (e) {
    console.warn('Failed to remove shared link:', e);
  }
}
