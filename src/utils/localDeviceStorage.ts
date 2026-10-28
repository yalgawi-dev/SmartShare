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

export interface LocalDeviceItem {
  spaceName: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  sizeMB: number;
  lastModified?: number;
  previewUrl?: string; // Object URL for crisp thumbnail rendering
  type?: 'image' | 'pdf' | 'document';
}

/**
 * Lists all files stored in the local OPFS MySpace folder across all spaces.
 */
export async function listLocalDeviceFiles(): Promise<LocalDeviceItem[]> {
  if (typeof window === 'undefined' || !('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    return [];
  }
  try {
    const root = await navigator.storage.getDirectory();
    let mySpaceDir: FileSystemDirectoryHandle;
    try {
      mySpaceDir = await root.getDirectoryHandle('MySpace');
    } catch {
      return [];
    }

    const items: LocalDeviceItem[] = [];
    // Iterate space folders
    // @ts-ignore
    for await (const [spaceName, spaceHandle] of mySpaceDir.entries()) {
      if (spaceHandle.kind === 'directory') {
        const subDir = spaceHandle as FileSystemDirectoryHandle;
        // @ts-ignore
        for await (const [fileName, fileHandle] of subDir.entries()) {
          if (fileHandle.kind === 'file') {
            try {
              const file = await (fileHandle as FileSystemFileHandle).getFile();
              const isPdf = fileName.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
              const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
              
              let previewUrl: string | undefined = undefined;
              if (isImage) {
                previewUrl = URL.createObjectURL(file);
              }

              items.push({
                spaceName,
                fileName,
                path: `MySpace/${spaceName}/${fileName}`,
                sizeBytes: file.size,
                sizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
                lastModified: file.lastModified,
                previewUrl,
                type: isPdf ? 'pdf' : isImage ? 'image' : 'document'
              });
            } catch (err) {}
          }
        }
      }
    }
    // Sort latest first
    return items.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
  } catch (err) {
    console.error("Failed to list local device files:", err);
    return [];
  }
}

/**
 * Retrieves a blob for a locally stored OPFS file.
 */
export async function getLocalDeviceFileBlob(spaceName: string, fileName: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const mySpaceDir = await root.getDirectoryHandle('MySpace');
    const spaceDir = await mySpaceDir.getDirectoryHandle(spaceName);
    const fileHandle = await spaceDir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch (err) {
    console.error("Failed to get local device file blob:", err);
    return null;
  }
}

/**
 * Deletes a file from the local OPFS storage.
 */
export async function deleteLocalDeviceFile(spaceName: string, fileName: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    return false;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const mySpaceDir = await root.getDirectoryHandle('MySpace');
    const spaceDir = await mySpaceDir.getDirectoryHandle(spaceName);
    // @ts-ignore
    await spaceDir.removeEntry(fileName);
    return true;
  } catch (err) {
    console.error("Failed to delete local device file:", err);
    return false;
  }
}
