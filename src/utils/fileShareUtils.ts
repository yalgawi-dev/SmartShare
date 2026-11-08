import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

export interface RecipientShareLink {
  id: string;
  recipientName: string;
  token: string;
  enabled: boolean;
  createdAt: number;
  viewCount: number;
  totalDurationSeconds?: number;
  lastViewedAt: number | null;
}

export interface ShareLinkConfig {
  enabled: boolean;
  token?: string;
  requirePin: boolean;
  pin?: string;
  expiresAt: number | null; // timestamp in ms, or null for no expiry
  allowDownload: boolean;   // if false: view-only mode
  viewCount?: number;
  totalDurationSeconds?: number;
  lastViewedAt?: number | null;
  createdAt?: number;
  recipients?: RecipientShareLink[];
}

export interface FileShareItem {
  id: string;
  spaceId: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null; // null = root level
  url?: string;
  thumbnailUrl?: string;
  pages?: string[];        // for multi-page documents
  fileType?: 'pdf' | 'image' | 'doc' | 'sheet' | 'other';
  size?: number;           // bytes
  createdAt: number;       // timestamp in ms
  createdBy: string;       // user id
  creatorName: string;
  allowedPartners?: string[]; // empty array = open to all space members (Rule 20)
  shareLink?: ShareLinkConfig;
  isFavorite?: boolean;
  deletedAt?: string;
}

export interface PublicSharedData {
  token: string;
  spaceId: string;
  spaceTitle: string;
  itemId: string;
  itemType: 'file' | 'folder';
  name: string;
  recipientName?: string;
  recipientId?: string;
  url?: string;
  thumbnailUrl?: string;
  pages?: string[];
  fileType?: string;
  size?: number;
  requirePin: boolean;
  pin?: string;
  expiresAt: number | null;
  allowDownload: boolean;
  viewCount: number;
  totalDurationSeconds?: number;
  lastViewedAt: number | null;
  createdAt: number;
  folderFiles?: Array<{
    id: string;
    name: string;
    url: string;
    pages?: string[];
    fileType?: string;
    size?: number;
  }>;
}

/**
 * Generate a cryptographically secure, URL-safe random share token (12 characters)
 */
export function generateShareToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint8Array(12);
    crypto.getRandomValues(values);
    for (let i = 0; i < 12; i++) {
      token += chars[values[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return token;
}

/**
 * Creates or updates a public share record in the global 'shared_links' Firestore collection.
 * This allows external guests to access the file/folder via /share/[token] without needing access to the space itself.
 */
export async function createOrUpdatePublicShare(
  spaceId: string,
  spaceTitle: string,
  item: FileShareItem,
  config: ShareLinkConfig,
  folderFiles?: FileShareItem[]
): Promise<string> {
  const token = config.token || generateShareToken();
  const now = Date.now();

  const shareDocRef = doc(db, 'shared_links', token);

  const payload: PublicSharedData = {
    token,
    spaceId,
    spaceTitle: spaceTitle || 'מרחב משותף',
    itemId: item.id,
    itemType: item.type,
    name: item.name,
    url: item.url || '',
    thumbnailUrl: item.thumbnailUrl || (Array.isArray(item.pages) && item.pages.length > 0 ? item.pages[0] : (item.url && !item.url.includes('.pdf') ? item.url : undefined)),
    pages: item.pages || [],
    fileType: item.fileType || 'other',
    size: item.size || 0,
    requirePin: Boolean(config.requirePin),
    pin: config.requirePin && config.pin ? config.pin.trim() : '',
    expiresAt: config.expiresAt || null,
    allowDownload: config.allowDownload !== false,
    viewCount: config.viewCount || 0,
    lastViewedAt: config.lastViewedAt || null,
    createdAt: config.createdAt || now
  };

  if (item.type === 'folder' && folderFiles) {
    payload.folderFiles = folderFiles.map(f => ({
      id: f.id,
      name: f.name,
      url: f.url || '',
      pages: f.pages || [],
      fileType: f.fileType || 'other',
      size: f.size || 0
    }));
  }

  await setDoc(shareDocRef, payload, { merge: true });

  // If there are specific recipients, ensure their personal tokens are also stored/updated in shared_links
  if (Array.isArray(config.recipients)) {
    for (const r of config.recipients) {
      if (r.token) {
        const rDocRef = doc(db, 'shared_links', r.token);
        if (!r.enabled) {
          // If disabled/blocked, delete from shared_links
          await deleteDoc(rDocRef);
        } else {
          const rPayload: PublicSharedData = {
            ...payload,
            token: r.token,
            recipientId: r.id,
            recipientName: r.recipientName,
            viewCount: r.viewCount || 0,
            lastViewedAt: r.lastViewedAt || null,
            totalDurationSeconds: r.totalDurationSeconds || 0,
            createdAt: r.createdAt || now
          };
          await setDoc(rDocRef, rPayload, { merge: true });
        }
      }
    }
  }

  return token;
}

/**
 * Retrieves public share data by token.
 */
export async function getPublicShare(token: string): Promise<PublicSharedData | null> {
  if (!token) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_links', token));
    if (!snap.exists()) return null;
    return snap.data() as PublicSharedData;
  } catch (err) {
    console.error('Error fetching public share:', err);
    return null;
  }
}

/**
 * Records an external guest view by incrementing viewCount and updating lastViewedAt.
 * Also synchronizes the view event into the space's fileShareItems array for owner visibility.
 */
export async function recordPublicShareView(token: string): Promise<void> {
  if (!token) return;
  try {
    const shareDocRef = doc(db, 'shared_links', token);
    const snap = await getDoc(shareDocRef);
    if (!snap.exists()) return;
    const data = snap.data() as PublicSharedData;

    await updateDoc(shareDocRef, {
      viewCount: increment(1),
      lastViewedAt: Date.now()
    });

    // Synchronize to space if spaceId and itemId exist
    if (data.spaceId && data.itemId) {
      const spaceDocRef = doc(db, 'spaces', data.spaceId);
      const spaceSnap = await getDoc(spaceDocRef);
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        const items = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];
        const itemIdx = items.findIndex(i => i.id === data.itemId);
        if (itemIdx >= 0) {
          const it = items[itemIdx];
          const shareLink = { ...(it.shareLink || {}) };
          if (data.recipientId && Array.isArray(shareLink.recipients)) {
            shareLink.recipients = shareLink.recipients.map((r: RecipientShareLink) => {
              if (r.id === data.recipientId || r.token === token) {
                return {
                  ...r,
                  viewCount: (r.viewCount || 0) + 1,
                  lastViewedAt: Date.now()
                };
              }
              return r;
            });
          } else {
            shareLink.viewCount = (shareLink.viewCount || 0) + 1;
            shareLink.lastViewedAt = Date.now();
          }
          items[itemIdx] = { ...it, shareLink };
          await updateDoc(spaceDocRef, { fileShareItems: items });
        }
      }
    }
  } catch (err) {
    console.warn('Failed to record share view count:', err);
  }
}

/**
 * Records time spent on a shared link (heartbeat or on unload).
 */
export async function recordShareHeartbeat(token: string, durationSeconds: number): Promise<void> {
  if (!token || durationSeconds <= 0) return;
  try {
    const shareDocRef = doc(db, 'shared_links', token);
    const snap = await getDoc(shareDocRef);
    if (!snap.exists()) return;
    const data = snap.data() as PublicSharedData;

    await updateDoc(shareDocRef, {
      totalDurationSeconds: increment(durationSeconds)
    });

    if (data.spaceId && data.itemId) {
      const spaceDocRef = doc(db, 'spaces', data.spaceId);
      const spaceSnap = await getDoc(spaceDocRef);
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        const items = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];
        const itemIdx = items.findIndex(i => i.id === data.itemId);
        if (itemIdx >= 0) {
          const it = items[itemIdx];
          const shareLink = { ...(it.shareLink || {}) };
          if (data.recipientId && Array.isArray(shareLink.recipients)) {
            shareLink.recipients = shareLink.recipients.map((r: RecipientShareLink) => {
              if (r.id === data.recipientId || r.token === token) {
                return {
                  ...r,
                  totalDurationSeconds: (r.totalDurationSeconds || 0) + durationSeconds
                };
              }
              return r;
            });
          } else {
            shareLink.totalDurationSeconds = (shareLink.totalDurationSeconds || 0) + durationSeconds;
          }
          items[itemIdx] = { ...it, shareLink };
          await updateDoc(spaceDocRef, { fileShareItems: items });
        }
      }
    }
  } catch (err) {
    console.warn('Failed to record share heartbeat duration:', err);
  }
}

/**
 * Revokes and deletes a public share token.
 */
export async function revokePublicShare(token: string): Promise<void> {
  if (!token) return;
  try {
    await deleteDoc(doc(db, 'shared_links', token));
  } catch (err) {
    console.error('Error revoking public share:', err);
  }
}

// Re-export single source of truth formatFileSize (Rule DRY / Single Source of Truth)
export { formatFileSize } from '@/utils/documentUtils';

/**
 * Checks if a share link has expired.
 */
export function isShareExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
}
