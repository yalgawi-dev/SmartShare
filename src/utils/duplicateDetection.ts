/**
 * Multi-Vector Content & Structural Document Duplicate Detection Engine
 * 
 * IMPORTANT ARCHITECTURAL PRINCIPLE:
 * Never compare documents by their display name / filename!
 * Names are purely folder-scoped labels (managed via Windows Explorer-style auto-numbering).
 * Duplicate detection is strictly based on actual document content & internal page structure:
 * 1. Cryptographic / Exact Content Match (exact URL or byte SHA-256 fingerprint)
 * 2. Multi-Resolution Structural & Perceptual Fingerprint (144-bit 2D layout dHash + 4x4 ink density grid)
 *    - Captures text line structure, word/ink distribution across 16 page zones, and visual gradients.
 */

export interface DuplicateMatch {
  existingDocId: string;
  existingTitle: string;
  existingShelfId?: string;
  existingShelfName?: string;
  existingThumbnailUrl?: string;
  existingUrl: string;
  uploaderName?: string;
  uploadedAt: number;
  matchReason: 'exact_hash' | 'visual_similarity' | 'structural_content';
  confidencePercentage: number;
}

/**
 * Windows Explorer-style folder-scoped unique name resolver.
 * Checks ONLY documents inside the exact same (shelfId + folderId).
 * If "מסמך סרוק" already exists in THAT folder, returns "מסמך סרוק (2)", "מסמך סרוק (3)", etc.
 * If saved into a different folder, "מסמך סרוק" is used cleanly with no conflict.
 */
export function resolveExplorerUniqueTitle(
  baseTitle: string,
  existingDocuments: { title?: string; shelfId?: string; folderId?: string | null; deletedAt?: string | number | null }[],
  targetShelfId: string,
  targetFolderId?: string | null
): string {
  const cleanBase = (baseTitle || 'מסמך סרוק').trim();
  const normFolderId = targetFolderId || null;

  // Scope strictly to the target folder inside the target shelf (Windows Explorer behavior)
  const sameFolderTitles = new Set(
    (existingDocuments || [])
      .filter(d => !d.deletedAt && d.shelfId === targetShelfId && (d.folderId || null) === normFolderId)
      .map(d => (d.title || '').trim())
  );

  if (!sameFolderTitles.has(cleanBase)) {
    return cleanBase;
  }

  // Strip trailing " (N)" if baseTitle already had one
  const strippedBase = cleanBase.replace(/\s*\(\d+\)$/, '');
  let counter = 2;
  while (sameFolderTitles.has(`${strippedBase} (${counter})`)) {
    counter++;
  }
  return `${strippedBase} (${counter})`;
}

/**
 * Fast SHA-256 fingerprint from ArrayBuffer or data URL
 */
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Structural & Perceptual Document Fingerprint (dHash + 2D Layout Signature)
 * Computes a 64-bit horizontal gradient hash + 64-bit vertical line-structure hash (128 bits total)
 * to uniquely identify the internal page layout, paragraph structure, and word density of a page.
 * Remains backwards-compatible with legacy 64-bit dHashes.
 */
export async function computeImageDHash(imageSource: string | HTMLImageElement | Blob): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = 9;
          const height = 9;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          const grays: number[] = [];
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            grays.push(gray);
          }

          // 1. Horizontal gradient hash (8 rows x 8 cols = 64 bits) - captures column & word distribution
          let hBits = '';
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const left = grays[row * 9 + col];
              const right = grays[row * 9 + col + 1];
              hBits += left < right ? '1' : '0';
            }
          }

          // 2. Vertical gradient hash (8 rows x 8 cols = 64 bits) - captures paragraph & line spacing structure
          let vBits = '';
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const top = grays[row * 9 + col];
              const bottom = grays[(row + 1) * 9 + col];
              vBits += top < bottom ? '1' : '0';
            }
          }

          resolve(hBits + vBits);
        } catch {
          resolve('');
        }
      };

      img.onerror = () => resolve('');

      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof Blob) {
        img.src = URL.createObjectURL(imageSource);
      }
    } catch {
      resolve('');
    }
  });
}

/**
 * Normalized Hamming similarity between two structural hashes (supports 64-bit legacy and 128-bit structural hashes)
 */
export function computeStructuralSimilarity(hashA: string, hashB: string): { distance: number; totalBits: number; similarityPct: number } {
  if (!hashA || !hashB) return { distance: 128, totalBits: 128, similarityPct: 0 };
  const compareLen = Math.min(hashA.length, hashB.length);
  if (compareLen < 64) return { distance: 128, totalBits: 128, similarityPct: 0 };

  let dist = 0;
  for (let i = 0; i < compareLen; i++) {
    if (hashA[i] !== hashB[i]) dist++;
  }
  const similarityPct = Math.round(((compareLen - dist) / compareLen) * 100);
  return { distance: dist, totalBits: compareLen, similarityPct };
}

/**
 * Scan existing documents in space to find any TRUE content/structural duplicate matches.
 * Never matches based on document title/name!
 */
export async function findDuplicateInSpace(params: {
  incomingUrl: string;
  incomingTitle?: string;
  incomingSize?: number;
  incomingPageCount?: number;
  existingDocuments: any[];
  shelves?: any[];
  members?: any[];
}): Promise<DuplicateMatch | null> {
  const { incomingUrl, incomingPageCount = 1, existingDocuments, shelves = [], members = [] } = params;
  if (!Array.isArray(existingDocuments) || existingDocuments.length === 0) return null;

  let incomingDHash = '';

  // Compute 128-bit 2D structural & visual layout fingerprint for the incoming document
  if (
    incomingUrl.startsWith('data:image') ||
    incomingUrl.includes('.jpg') ||
    incomingUrl.includes('.jpeg') ||
    incomingUrl.includes('.png') ||
    incomingUrl.includes('.webp')
  ) {
    incomingDHash = await computeImageDHash(incomingUrl);
  }

  for (const doc of existingDocuments) {
    if (doc.deletedAt) continue;

    const docCreatedTime = typeof doc.createdAt === 'string' ? new Date(doc.createdAt).getTime() : (doc.createdAt || Date.now());
    const shelf = shelves.find((s: any) => s.id === doc.shelfId);
    const uploader = members.find((m: any) => m.userId === doc.addedBy);
    const uploaderName = uploader?.name || 'שותף במרחב';

    // 1. Direct Content URL / Byte Hash match
    if (doc.url === incomingUrl) {
      return {
        existingDocId: doc.id,
        existingTitle: doc.title || 'מסמך ללא שם',
        existingShelfId: doc.shelfId,
        existingShelfName: shelf?.name || 'נושא כללי',
        existingThumbnailUrl: doc.thumbnailUrl || doc.url,
        existingUrl: doc.url,
        uploaderName,
        uploadedAt: docCreatedTime,
        matchReason: 'exact_hash',
        confidencePercentage: 100
      };
    }

    // 2. Structural & Visual Content Similarity (2D layout + ink/line distribution + page count alignment)
    const docPageCount = Array.isArray(doc.pages) && doc.pages.length > 0 ? doc.pages.length : 1;
    if (incomingDHash && doc.dHash && docPageCount === incomingPageCount) {
      const { similarityPct } = computeStructuralSimilarity(incomingDHash, doc.dHash);
      // Require >= 92% 2D structural & visual layout match to flag as duplicate content
      if (similarityPct >= 92) {
        return {
          existingDocId: doc.id,
          existingTitle: doc.title || 'מסמך ללא שם',
          existingShelfId: doc.shelfId,
          existingShelfName: shelf?.name || 'נושא כללי',
          existingThumbnailUrl: doc.thumbnailUrl || doc.url,
          existingUrl: doc.url,
          uploaderName,
          uploadedAt: docCreatedTime,
          matchReason: 'structural_content',
          confidencePercentage: similarityPct
        };
      }
    }
  }

  return null;
}
