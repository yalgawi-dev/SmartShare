// Utility for compressing and resizing images on the client side using Canvas API
// Maintains aspect ratio while reducing file size to save storage.
// This is the SINGLE SOURCE OF TRUTH (Engine) for all image compression in the app.

// ============================================================================
// PDF STRUCTURE DETECTION (100% Pure C++ PDFium WASM - ADR-006)
// ============================================================================

export interface PdfAnalysisResult {
  hasDigitalSignature: boolean;
  hasTextLayer: boolean;
  hasVectorPaths?: boolean;
  isWrappedRasterScan: boolean;
  hasFullPageImage: boolean;
  pageCount: number;
  avgBytesPerPage: number;
}

/**
 * Analyzes a PDF buffer to detect digital signatures, vector text layers, vector CAD paths, and wrapped raster scans
 * Powered by C++ PDFium WASM (< 5ms) with PDF.js / binary fallback (ADR-001, ADR-006).
 */
export async function analyzePdfStructure(arrayBuffer: ArrayBuffer): Promise<PdfAnalysisResult> {
  const bytes = new Uint8Array(arrayBuffer);
  const fileSize = arrayBuffer.byteLength;

  // 1. Fast binary inspection of signature & object markers
  const decoder = new TextDecoder('latin1');
  const headChunk = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 500000)));
  const tailChunk = decoder.decode(bytes.subarray(Math.max(0, bytes.length - 100000)));

  const hasSigDict =
    headChunk.includes('/Type/Sig') ||
    headChunk.includes('/Type /Sig') ||
    headChunk.includes('/adbe.pkcs7') ||
    headChunk.includes('ETSI.CAdES') ||
    tailChunk.includes('/Type/Sig') ||
    tailChunk.includes('/Type /Sig') ||
    tailChunk.includes('/adbe.pkcs7');
  const hasByteRange = headChunk.includes('/ByteRange') || tailChunk.includes('/ByteRange');
  let hasDigitalSignature = hasSigDict && hasByteRange;

  let hasBinaryFontMarkers = false;
  let hasBinaryImageMarkers = false;
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = decoder.decode(bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize + 128)));
    if (!hasBinaryImageMarkers) {
      if (chunk.includes('/Subtype/Image') || chunk.includes('/Subtype /Image') || chunk.includes('/DCTDecode') || chunk.includes('/JPXDecode') || chunk.includes('/CCITTFaxDecode')) {
        hasBinaryImageMarkers = true;
      }
    }
    if (!hasBinaryFontMarkers) {
      if (chunk.includes('/Type/Font') || chunk.includes('/Type /Font') || chunk.includes('/FontDescriptor')) {
        hasBinaryFontMarkers = true;
      }
    }
    if (hasBinaryImageMarkers && hasBinaryFontMarkers) break;
  }

  let pageCount = 1;
  let hasTextItems = false;
  let hasVectorPaths = false;
  let hasFullPageImage = false;
  let inspectedByPdfium = false;

  // 2. Primary Engine: 100% Pure C++ PDFium WASM structure inspection (ADR-006)
  if (typeof window !== 'undefined') {
    try {
      const { inspectPdfStructureWithPdfium } = await import('./pdfiumSliceRenderer');
      const info = await inspectPdfStructureWithPdfium(bytes, `analyze_${fileSize}_${bytes[0]}_${bytes[bytes.length - 1]}`);
      pageCount = info.pageCount;
      if (info.signatureCount > 0) {
        hasDigitalSignature = true;
      }
      hasTextItems = info.textCharCount >= 10 || info.hasTextObjects;
      hasVectorPaths = info.hasVectorPaths;
      hasFullPageImage = info.hasImageObjects;
    } catch (pdfiumErr) {
      console.warn('[PDFium] Structure inspection warning:', pdfiumErr);
    }
  }

  const avgBytesPerPage = Math.round(fileSize / Math.max(1, pageCount));
  const hasTextLayer = hasTextItems || (!hasFullPageImage && hasBinaryFontMarkers);

  // ADR Rule 1 & 6: A document is a "Wrapped Raster Scan" (קובץ סרוק עטוף) if:
  // - It has NO digital signature AND
  // - Either:
  //   1. It has NO selectable text layer and NO vector drawing paths (pure camera/scanner images wrapped in PDF)
  //      NOTE: If a multi-page PDF has 5+ pages and avgBytesPerPage <= 500KB (e.g. 56 pages at 5.7MB = ~100KB/page),
  //      it is clearly an optimized digital/compressed PDF, NOT an uncompressed raw camera scan wrapper!
  //   2. OR it contains embedded raster images and average page weight exceeds 700KB/page (e.g. 2 pages = 3.7MB -> 1.85MB/page!)
  const isMultiPageLightweight = pageCount >= 5 && avgBytesPerPage <= 500 * 1024;
  const isHeavyImageEnvelope = (hasFullPageImage || hasBinaryImageMarkers) && avgBytesPerPage > 700 * 1024;
  const isWrappedRasterScan = !hasDigitalSignature && !isMultiPageLightweight && (
    (!hasTextLayer && !hasVectorPaths) ||
    isHeavyImageEnvelope
  );

  return {
    hasDigitalSignature,
    hasTextLayer,
    hasVectorPaths,
    isWrappedRasterScan,
    hasFullPageImage: hasFullPageImage || hasBinaryImageMarkers,
    pageCount,
    avgBytesPerPage
  };
}

/**
 * ADR Rule 1 & 6 (OR-based Dual-Check):
 * Determines whether a PDF should be retained as an intact raw PDF file.
 * Returns true if ANY ("OR") of the following holds:
 * 1. OR: Cryptographically signed PDF (`hasDigitalSignature`) -> retain legal validity.
 * 2. OR: True digital-born vector/text PDF (`hasTextLayer` or `hasVectorPaths`) with lightweight page density (<= 700KB/page) -> retain original PDF even without a signature!
 * Returns false ONLY for Wrapped Raster Scans (e.g., 3.7MB for 2 pages of scanned photos without a signature), which MUST be converted to WebP!
 */
export function isTrueOriginalPdf(analysis: PdfAnalysisResult, fileSize: number): boolean {
  // Condition 1 (OR): Cryptographic digital signature -> MUST retain intact PDF
  if (analysis.hasDigitalSignature) {
    return true;
  }

  // Guard: Wrapped Raster Scan (no signature, heavy image pages > 700KB/page or zero text/vectors) -> Convert to WebP!
  if (analysis.isWrappedRasterScan) {
    return false;
  }

  // Condition 2 (OR): Multi-page lightweight document (5+ pages, avg <= 500KB/page) -> Retain intact raw PDF
  if (analysis.pageCount >= 5 && analysis.avgBytesPerPage <= 500 * 1024) {
    return true;
  }

  // Condition 3 (OR): Digital-born PDF with live text layer OR vector drawing paths (<= 700KB/page) -> Retain intact PDF
  if ((analysis.hasTextLayer || analysis.hasVectorPaths) && analysis.avgBytesPerPage <= 700 * 1024) {
    return true;
  }

  return false;
}

let _webpSupported: boolean | null = null;

/**
 * Checks whether the client browser supports WebP canvas export.
 */
export function isWebPSupported(): boolean {
  if (_webpSupported !== null) return _webpSupported;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return true; // Default assumption in modern environments
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    _webpSupported = dataUrl.startsWith('data:image/webp');
  } catch (e) {
    _webpSupported = false;
  }
  return _webpSupported;
}

// ============================================================================
// 1. MODERN WEBP ENGINE (ACTIVE PIPELINE - v2.6.9)
// ============================================================================

export function compressCanvasWebP(canvas: HTMLCanvasElement, quality = 0.80): string {
  return canvas.toDataURL('image/webp', quality);
}

export async function compressImageWebP(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.80): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(compressCanvasWebP(canvas, quality));
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}

// ============================================================================
// 2. UNIFIED GLOBAL PIPELINES (WEBP ENGINE - SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Single Source of Truth for Canvas compression across the application.
 * Connected directly to WebP for 30%-50% smaller sizes and crystal clear rendering.
 */
export function compressCanvas(canvas: HTMLCanvasElement, quality = 0.80, type?: string): string {
  // If an explicit mime type is requested (e.g. image/jpeg for hardware acceleration or image/png for transparency), respect it:
  if (type) {
    if (type === 'image/webp') {
      return isWebPSupported() ? compressCanvasWebP(canvas, quality) : canvas.toDataURL('image/jpeg', quality);
    }
    return canvas.toDataURL(type, quality);
  }
  // Default fallback: WebP if supported, otherwise JPEG
  if (isWebPSupported()) {
    return compressCanvasWebP(canvas, quality);
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Single Source of Truth for File compression across the application.
 * Connected directly to WebP.
 */
export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.80, type?: string): Promise<string> {
  if (type && type !== 'image/jpeg' && type !== 'image/webp') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(height * (maxWidth / width));
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(width * (maxHeight / height));
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get canvas context'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(type, quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  return compressImageWebP(file, maxWidth, maxHeight, quality);
}

export async function convertPdfToOptimizedImage(pdfSource: string, maxDim = 1200, quality = 0.80): Promise<string> {
  if (typeof window === 'undefined') return pdfSource;
  try {
    const pages = await extractPdfPages(pdfSource, maxDim, quality);
    if (!pages || pages.length === 0) return pdfSource;
    if (pages.length === 1) return pages[0];
    return await mergeImagesCleanly(pages);
  } catch (err) {
    console.error('[PDFium] Failed to convert PDF to scroll image:', err);
    return pdfSource;
  }
}

// ── High-Performance Client Caching for PDF Page Extraction & Raw Bytes ────
const pdfPagesMemoryCache = new Map<string, string[]>();
const pdfBytesMemoryCache = new Map<string, Uint8Array>();
const PDF_CACHE_DB = 'SmartShareDocCache';
const PDF_CACHE_STORE = 'pdf_pages';
const PDF_BYTES_STORE = 'pdf_bytes';

function openPdfCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_CACHE_DB, 2);
    req.onupgradeneeded = (e: any) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PDF_CACHE_STORE)) {
        db.createObjectStore(PDF_CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(PDF_BYTES_STORE)) {
        db.createObjectStore(PDF_BYTES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedPdfBytes(url: string): Promise<Uint8Array | null> {
  if (typeof window === 'undefined') return null;
  if (pdfBytesMemoryCache.has(url)) {
    return pdfBytesMemoryCache.get(url)!;
  }
  try {
    const db = await openPdfCacheDb();
    return await new Promise<Uint8Array | null>((resolve) => {
      try {
        const tx = db.transaction(PDF_BYTES_STORE, 'readonly');
        const store = tx.objectStore(PDF_BYTES_STORE);
        const getReq = store.get(url);
        getReq.onsuccess = () => {
          const res = getReq.result;
          if (res) {
            const bytes = res instanceof Uint8Array ? res : new Uint8Array(res);
            pdfBytesMemoryCache.set(url, bytes);
            resolve(bytes);
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function setCachedPdfBytes(url: string, bytes: Uint8Array): Promise<void> {
  if (typeof window === 'undefined' || !bytes || bytes.length === 0) return;
  pdfBytesMemoryCache.set(url, bytes);
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction(PDF_BYTES_STORE, 'readwrite');
    const store = tx.objectStore(PDF_BYTES_STORE);
    store.put(bytes.buffer, url);
  } catch {}
}

export async function getCachedPdfPages(url: string): Promise<string[] | null> {
  if (typeof window === 'undefined') return null;
  if (pdfPagesMemoryCache.has(url)) {
    return pdfPagesMemoryCache.get(url)!;
  }
  try {
    const db = await openPdfCacheDb();
    return await new Promise<string[] | null>((resolve) => {
      try {
        const tx = db.transaction(PDF_CACHE_STORE, 'readonly');
        const store = tx.objectStore(PDF_CACHE_STORE);
        const getReq = store.get(url);
        getReq.onsuccess = () => {
          const res = getReq.result;
          if (res && Array.isArray(res) && res.length > 0) {
            // Rehydrate native binary Blobs into fresh ObjectURLs (Rule 21: Zero Base64!)
            // Reject stale 'blob:' strings from previous sessions so they re-render cleanly.
            const hydrated: string[] = [];
            for (const item of res) {
              if (item instanceof Blob) {
                hydrated.push(URL.createObjectURL(item));
              } else if (typeof item === 'string' && !item.startsWith('blob:')) {
                hydrated.push(item);
              } else {
                resolve(null);
                return;
              }
            }
            pdfPagesMemoryCache.set(url, hydrated);
            resolve(hydrated);
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function setCachedPdfPages(url: string, pages: string[]): Promise<void> {
  if (typeof window === 'undefined' || !pages || pages.length === 0) return;
  pdfPagesMemoryCache.set(url, pages);
  try {
    // Convert ephemeral blob: URLs to persistent native Binary Blobs before storing in IndexedDB (Rule 21)
    const persistable: Array<Blob | string> = await Promise.all(
      pages.map(async (p) => {
        if (typeof p === 'string' && p.startsWith('blob:')) {
          const res = await fetch(p);
          return await res.blob();
        }
        return p;
      })
    );
    const db = await openPdfCacheDb();
    const tx = db.transaction(PDF_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(PDF_CACHE_STORE);
    store.put(persistable, url);
  } catch {}
}

export async function generatePdfFirstPageThumbnail(source: Blob | string, maxDim = 800, _quality = 0.80): Promise<string> {
  if (typeof window === 'undefined') return '';

  let bytes: Uint8Array;
  let docKey = '';
  if (source instanceof Blob) {
    bytes = new Uint8Array(await source.arrayBuffer());
    docKey = `upload_${source.size}_${source.type}`;
  } else if (typeof source === 'string') {
    docKey = source;
    if (source.startsWith('data:')) {
      const base64Data = source.includes('base64,') ? source.split('base64,')[1] : source;
      const binaryString = window.atob(base64Data);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      let res = await fetch(source).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(source)}`);
      }
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  } else {
    throw new Error('Unsupported PDF source for thumbnail');
  }

  // 100% Pure C++ PDFium WASM thumbnail generation
  const { inspectPdfStructureWithPdfium, renderFullPageWithPdfium } = await import('./pdfiumSliceRenderer');
  const info = await inspectPdfStructureWithPdfium(bytes, docKey);
  const wPt = info.pageWidthPt || 595;
  const hPt = info.pageHeightPt || 842;
  const currentMax = Math.max(wPt, hPt);
  const scale = Math.max(0.3, Math.min(1.5, maxDim / currentMax));

  return await renderFullPageWithPdfium({
    pdfBytes: bytes,
    docKey,
    pageIndex: 0,
    targetW: Math.max(1, Math.round(wPt * scale)),
    targetH: Math.max(1, Math.round(hPt * scale)),
  });
}

export async function extractPdfPages(
  pdfSource: Blob | string,
  maxDim = 1200,
  quality = 0.80,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  const cacheKey = typeof pdfSource === 'string' ? pdfSource : '';
  if (cacheKey) {
    const cached = await getCachedPdfPages(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  try {
    let bytes: Uint8Array;
    if (pdfSource instanceof Blob) {
      const arrayBuffer = await pdfSource.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    } else if (typeof pdfSource === 'string') {
      if (pdfSource.startsWith('data:')) {
        const base64Data = pdfSource.includes('base64,') ? pdfSource.split('base64,')[1] : pdfSource;
        const binaryString = window.atob(base64Data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } else {
        try {
          const res = await fetch(pdfSource);
          if (!res.ok) throw new Error('Fetch failed: ' + res.status);
          const arrayBuffer = await res.arrayBuffer();
          bytes = new Uint8Array(arrayBuffer);
        } catch (fetchErr) {
          // Fallback to server proxy to bypass CORS
          const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(pdfSource)}`;
          const proxyRes = await fetch(proxyUrl);
          const arrayBuffer = await proxyRes.arrayBuffer();
          bytes = new Uint8Array(arrayBuffer);
        }
      }
    } else {
      return [];
    }

    // 100% Pure C++ PDFium WASM (ADR-006)
    const { extractAllPagesWithPdfium } = await import('./pdfiumSliceRenderer');
    const docKey = cacheKey || `blob_${bytes.byteLength}_${bytes[0] || 0}`;
    const pdfiumPages = await extractAllPagesWithPdfium(bytes, docKey, maxDim, onProgress);
    if (pdfiumPages && pdfiumPages.length > 0) {
      if (cacheKey) {
        setCachedPdfPages(cacheKey, pdfiumPages).catch(() => {});
      }
      return pdfiumPages;
    }
    return [];
  } catch (err) {
    console.error('Failed to extract PDF pages:', err);
    return [];
  }
}

export async function downscaleBase64(base64: string, maxDim = 1500, quality = 0.75): Promise<string> {
  if (base64.startsWith('data:application/pdf') || base64.includes('application/pdf') || base64.toLowerCase().includes('.pdf')) {
    return convertPdfToOptimizedImage(base64, maxDim, quality);
  }
  if (base64.startsWith('blob:')) {
    try {
      const res = await fetch(base64);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        return convertPdfToOptimizedImage(base64, maxDim, quality);
      }
    } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, width, height);
      resolve(compressCanvas(canvas, quality));
    };
    img.onerror = (err) => reject(err);
  });
}

export async function mergeImagesCleanly(imageUrls: string[]): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  const loadedImages = await Promise.all(imageUrls.map(url => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }));

  const targetWidth = Math.max(...loadedImages.map(img => img.width));
  const gap = 24;
  const paddingX = 20;
  const paddingY = 20;
  const canvasWidth = targetWidth + paddingX * 2;
  const scaledHeights = loadedImages.map(img => (targetWidth / img.width) * img.height);
  canvas.width = canvasWidth;
  canvas.height = paddingY * 2 + scaledHeights.reduce((sum, h) => sum + h, 0) + gap * (loadedImages.length - 1);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = paddingY;
  loadedImages.forEach((img, i) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddingX, currentY, targetWidth, scaledHeights[i]);
    ctx.restore();

    ctx.drawImage(img, paddingX, currentY, targetWidth, scaledHeights[i]);

    if (i < loadedImages.length - 1) {
      const gapMiddleY = currentY + scaledHeights[i] + gap / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingX + 40, gapMiddleY);
      ctx.lineTo(canvasWidth - paddingX - 40, gapMiddleY);
      ctx.stroke();
    }

    currentY += scaledHeights[i] + gap;
  });

  return compressCanvas(canvas, 0.80);
}

export const DOCUMENT_MAX_BYTES = 300 * 1024;

export const dataUrlBytes = (u: string) => Math.round((u.length - u.indexOf(',') - 1) * 0.75);

/**
 * Converts any image URL (remote cloud URL, blob URL, or data URL) into a clean, local Base64 DataURL.
 * This guarantees that the Canvas is never tainted by cross-origin security restrictions.
 */
export async function toCleanDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;

  // Try direct fetch to blob first
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (err) {
    console.warn('Direct fetch to blob failed, falling back to proxy / image element', err);
  }

  // Fallback via server pdf/image proxy if remote fetch is blocked by CORS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (proxyErr) {
      console.warn('Proxy fetch failed', proxyErr);
    }
  }

  // Final fallback using Image element with crossOrigin
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/webp', 0.90));
          return;
        }
      } catch (canvasErr) {
        console.warn('Canvas export tainted', canvasErr);
      }
      resolve(url);
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

/**
 * Shrinks an image to fit maxBytes.
 * Connected directly to WebP engine with seamless fallback to legacy JPEG engine.
 */
export async function compressToBudget(src: string, maxBytes = DOCUMENT_MAX_BYTES): Promise<string> {
  // If it's already an HTTP/HTTPS or local static URL, it is already hosted on cloud storage — keep as-is!
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
    return src;
  }

  // If already within budget in WebP or JPEG, keep as-is
  if ((src.startsWith('data:image/webp') || src.startsWith('data:image/jpeg')) && dataUrlBytes(src) <= maxBytes) {
    return src;
  }

  const img = await new Promise<HTMLImageElement>((resolve) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => resolve(i); // Never crash on load error, resolve and fallback gracefully
    i.src = src;
  });

  if (!img.width || !img.height) {
    return src;
  }

  let scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  let best = src;

  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return best;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      best = compressCanvas(canvas, q);
      if (dataUrlBytes(best) <= maxBytes) return best;
    }
    scale *= 0.85;
  }
  return best;
}
