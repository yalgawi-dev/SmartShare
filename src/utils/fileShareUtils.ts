import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

export interface ShareLinkConfig {
  enabled: boolean;
  token?: string;
  requirePin: boolean;
  pin?: string;
  expiresAt: number | null; // timestamp in ms, or null for no expiry
  allowDownload: boolean;   // if false: view-only mode
  viewCount?: number;
  lastViewedAt?: number | null;
  createdAt?: number;
}

export interface FileShareItem {
  id: string;
  spaceId: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null; // null = root level
  url?: string;
  pages?: string[];        // for multi-page documents
  fileType?: 'pdf' | 'image' | 'doc' | 'sheet' | 'other';
  size?: number;           // bytes
  createdAt: number;       // timestamp in ms
  createdBy: string;       // user id
  creatorName: string;
  allowedPartners?: string[]; // empty array = open to all space members (Rule 20)
  shareLink?: ShareLinkConfig;
}

export interface PublicSharedData {
  token: string;
  spaceId: string;
  spaceTitle: string;
  itemId: string;
  itemType: 'file' | 'folder';
  name: string;
  url?: string;
  pages?: string[];
  fileType?: string;
  size?: number;
  requirePin: boolean;
  pin?: string;
  expiresAt: number | null;
  allowDownload: boolean;
  viewCount: number;
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
 */
export async function recordPublicShareView(token: string): Promise<void> {
  if (!token) return;
  try {
    const shareDocRef = doc(db, 'shared_links', token);
    await updateDoc(shareDocRef, {
      viewCount: increment(1),
      lastViewedAt: Date.now()
    });
  } catch (err) {
    console.warn('Failed to record share view count:', err);
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
