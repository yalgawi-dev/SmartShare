'use client';

import { useCallback, useEffect, useState } from 'react';

export interface GlobalTransferClipboardState {
  mode: 'cut' | 'copy';
  sourceEngine: 'vault' | 'fileshare';
  sourceSpaceId: string;
  sourceSpaceTitle?: string;
  itemType: 'document' | 'folder' | 'shelf' | 'mixed';
  itemIds: string[];
  folderIds?: string[];
  label: string;
  sourceShelfId?: string | null;
  sourceFolderId?: string | null;
  createdAt?: number;
}

const STORAGE_KEY = 'smartshare_global_transfer_clipboard_v1';
const EVENT_NAME = 'smartshare:global_clipboard_changed';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes auto-expiry

export function readGlobalTransferClipboard(): GlobalTransferClipboardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GlobalTransferClipboardState;
    if (!parsed || !parsed.mode || !Array.isArray(parsed.itemIds)) return null;
    if (parsed.createdAt && Date.now() - parsed.createdAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeGlobalTransferClipboard(next: GlobalTransferClipboardState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...next, createdAt: next.createdAt || Date.now() })
      );
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * DRY Single Source of Truth Hook: Windows-Explorer-style Global Clipboard.
 * Survives navigation across folders, shelves, AND different spaces!
 */
export function useGlobalTransferClipboard() {
  const [clipboard, setLocalClipboard] = useState<GlobalTransferClipboardState | null>(() =>
    readGlobalTransferClipboard()
  );

  useEffect(() => {
    const sync = () => setLocalClipboard(readGlobalTransferClipboard());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setClipboard = useCallback((next: GlobalTransferClipboardState | null) => {
    writeGlobalTransferClipboard(next);
    setLocalClipboard(next);
  }, []);

  const clearClipboard = useCallback(() => {
    writeGlobalTransferClipboard(null);
    setLocalClipboard(null);
  }, []);

  return { clipboard, setClipboard, clearClipboard };
}
