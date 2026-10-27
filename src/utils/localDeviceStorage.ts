/**
 * Single source of truth for Local Device Storage (WhatsApp Style)
 * Uses standard Origin Private File System (OPFS) with fallback.
 * DRY Rule: Reusable across spaces, scanners, and document managers.
 */

export interface LocalStorageQuota {
  usageBytes: number;
  quotaBytes: number;
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
  isPersistent: boolean;
}

/**
 * Requests persistent storage from the browser / OS to prevent automatic cache clearing.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  } catch (err) {
    console.warn("Storage persistence request failed:", err);
    return false;
  }
}

/**
 * Returns current device storage estimate for MySpace.
 */
export async function getDeviceStorageEstimate(): Promise<LocalStorageQuota> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return { usageBytes: 0, quotaBytes: 0, usageMB: 0, quotaMB: 0, percentUsed: 0, isPersistent: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const isPersistent = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const usageBytes = estimate.usage || 0;
    const quotaBytes = estimate.quota || 0;
    const usageMB = Number((usageBytes / (1024 * 1024)).toFixed(2));
    const quotaMB = Number((quotaBytes / (1024 * 1024)).toFixed(0));
    const percentUsed = quotaBytes > 0 ? Number(((usageBytes / quotaBytes) * 100).toFixed(1)) : 0;

    return {
      usageBytes,
      quotaBytes,
      usageMB,
      quotaMB,
      percentUsed,
      isPersistent
    };
  } catch (e) {
    return { usageBytes: 0, quotaBytes: 0, usageMB: 0, quotaMB: 0, percentUsed: 0, isPersistent: false };
  }
}

/**
 * Saves a file into the dedicated local MySpace device folder structure:
 * Directory structure: MySpace / [spaceTitle] / [filename]
 */
export async function saveLocalDeviceFile(
  spaceTitle: string,
  fileName: string,
  fileData: Blob | string
): Promise<{ success: boolean; localPath: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, localPath: '', error: 'Window is undefined' };
  }

  try {
    // Ensure persistence
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist().catch(() => {});
    }

    if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
      return { success: true, localPath: `MySpace/${spaceTitle}/${fileName}` };
    }

    // Standard OPFS (Origin Private File System)
    const root = await navigator.storage.getDirectory();
    
    // 1. MySpace root folder
    const mySpaceDir = await root.getDirectoryHandle('MySpace', { create: true });
    
    // 2. Specific Space folder (sanitized)
    const safeSpaceName = (spaceTitle || 'General').replace(/[/\\?%*:|"<>]/g, '_');
    const spaceDir = await mySpaceDir.getDirectoryHandle(safeSpaceName, { create: true });

    // 3. File handle
    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const fileHandle = await spaceDir.getFileHandle(safeFileName, { create: true });
    
    // 4. Write stream
    const writable = await fileHandle.createWritable();
    
    if (typeof fileData === 'string') {
      if (fileData.startsWith('data:')) {
        const res = await fetch(fileData);
        const blob = await res.blob();
        await writable.write(blob);
      } else {
        await writable.write(fileData);
      }
    } else {
      await writable.write(fileData);
    }

    await writable.close();
    return { success: true, localPath: `MySpace/${safeSpaceName}/${safeFileName}` };
  } catch (err: any) {
    console.error("Failed to save local device file:", err);
    return { success: false, localPath: '', error: err.message };
  }
}
