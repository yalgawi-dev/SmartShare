// Utility for compressing and resizing images on the client side using Canvas API
// Maintains aspect ratio while reducing file size to save storage.
// This is the SINGLE SOURCE OF TRUTH (Engine) for all image compression in the app.

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
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(null);
          } else {
            reject(new Error('pdfjsLib not found on window'));
          }
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    let bytes: Uint8Array;
    if (pdfSource.startsWith('data:')) {
      const base64Data = pdfSource.includes('base64,') ? pdfSource.split('base64,')[1] : pdfSource;
      const binaryString = window.atob(base64Data);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      const res = await fetch(pdfSource);
      const arrayBuffer = await res.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    }

    const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;

    const renderedCanvases: HTMLCanvasElement[] = [];
    let maxWidth = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
      const scale = Math.min(1.8, maxDim / currentMax);
      const viewport = page.getViewport({ scale: Math.max(1.0, scale) });

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pageCtx, viewport }).promise;
        renderedCanvases.push(pageCanvas);
        if (pageCanvas.width > maxWidth) {
          maxWidth = pageCanvas.width;
        }
      }
    }

    if (renderedCanvases.length === 0) {
      return pdfSource;
    }

    if (renderedCanvases.length === 1) {
      return compressCanvas(renderedCanvases[0], quality);
    }

    // Stitch all pages vertically into a continuous scroll ("Megilah")
    const gap = 24;
    const paddingX = 20;
    const paddingY = 20;
    const canvasWidth = maxWidth + paddingX * 2;
    const totalHeight = paddingY * 2 + renderedCanvases.reduce((sum, c) => sum + (maxWidth / c.width) * c.height, 0) + (renderedCanvases.length - 1) * gap;

    const scrollCanvas = document.createElement('canvas');
    scrollCanvas.width = canvasWidth;
    scrollCanvas.height = totalHeight;
    const scrollCtx = scrollCanvas.getContext('2d');
    if (!scrollCtx) return compressCanvas(renderedCanvases[0], quality);

    scrollCtx.fillStyle = '#0f172a';
    scrollCtx.fillRect(0, 0, scrollCanvas.width, scrollCanvas.height);

    let currentY = paddingY;
    for (let i = 0; i < renderedCanvases.length; i++) {
      const c = renderedCanvases[i];
      const scaledH = (maxWidth / c.width) * c.height;

      scrollCtx.save();
      scrollCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      scrollCtx.shadowBlur = 12;
      scrollCtx.shadowOffsetY = 4;
      scrollCtx.fillStyle = '#ffffff';
      scrollCtx.fillRect(paddingX, currentY, maxWidth, scaledH);
      scrollCtx.restore();

      scrollCtx.drawImage(c, paddingX, currentY, maxWidth, scaledH);

      if (i < renderedCanvases.length - 1) {
        const gapMiddleY = currentY + scaledH + gap / 2;
        scrollCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        scrollCtx.lineWidth = 1;
        scrollCtx.beginPath();
        scrollCtx.moveTo(paddingX + 40, gapMiddleY);
        scrollCtx.lineTo(canvasWidth - paddingX - 40, gapMiddleY);
        scrollCtx.stroke();
      }

      currentY += scaledH + gap;
    }

    return compressCanvas(scrollCanvas, quality);
  } catch (err) {
    console.error('Failed to convert multi-page PDF to scroll image:', err);
    return pdfSource;
  }
}

// ── High-Performance Client Caching for PDF Page Extraction ────────────────
const pdfPagesMemoryCache = new Map<string, string[]>();
const PDF_CACHE_DB = 'SmartShareDocCache';
const PDF_CACHE_STORE = 'pdf_pages';

async function getCachedPdfPages(url: string): Promise<string[] | null> {
  if (typeof window === 'undefined') return null;
  if (pdfPagesMemoryCache.has(url)) {
    return pdfPagesMemoryCache.get(url)!;
  }
  try {
    return await new Promise<string[] | null>((resolve) => {
      const req = indexedDB.open(PDF_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(PDF_CACHE_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(PDF_CACHE_STORE, 'readonly');
          const store = tx.objectStore(PDF_CACHE_STORE);
          const getReq = store.get(url);
          getReq.onsuccess = () => {
            const res = getReq.result;
            if (res && Array.isArray(res) && res.length > 0) {
              pdfPagesMemoryCache.set(url, res);
              resolve(res);
            } else {
              resolve(null);
            }
          };
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedPdfPages(url: string, pages: string[]): Promise<void> {
  if (typeof window === 'undefined' || !pages || pages.length === 0) return;
  pdfPagesMemoryCache.set(url, pages);
  try {
    const req = indexedDB.open(PDF_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PDF_CACHE_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(PDF_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(PDF_CACHE_STORE);
        store.put(pages, url);
      } catch {}
    };
  } catch {}
}

export async function extractPdfPages(pdfSource: string, maxDim = 1500, quality = 0.85): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  // 1. Check in-memory & IndexedDB cache for instant 0ms reload
  const cached = await getCachedPdfPages(pdfSource);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(null);
          } else {
            reject(new Error('pdfjsLib not found on window'));
          }
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    let bytes: Uint8Array;
    if (pdfSource.startsWith('data:')) {
      const base64Data = pdfSource.includes('base64,') ? pdfSource.split('base64,')[1] : pdfSource;
      const binaryString = window.atob(base64Data);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      const res = await fetch(pdfSource);
      const arrayBuffer = await res.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    }

    const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;
    const pageUrls: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
      const scale = Math.min(2.0, maxDim / currentMax);
      const viewport = page.getViewport({ scale: Math.max(1.0, scale) });

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pageCtx, viewport }).promise;
        pageUrls.push(compressCanvas(pageCanvas, quality));
      }
    }

    // 2. Save extracted pages to cache for instant future loads
    if (pageUrls.length > 0) {
      setCachedPdfPages(pdfSource, pageUrls);
    }

    return pageUrls;
  } catch (err) {
    console.error('Failed to extract PDF pages:', err);
    return [];
  }
}

export async function downscaleBase64(base64: string, maxDim = 1500, quality = 0.75): Promise<string> {
  if (base64.startsWith('data:application/pdf') || base64.includes('application/pdf')) {
    return convertPdfToOptimizedImage(base64, maxDim, quality);
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
 * Shrinks an image to fit maxBytes.
 * Connected directly to WebP engine with seamless fallback to legacy JPEG engine.
 */
export async function compressToBudget(src: string, maxBytes = DOCUMENT_MAX_BYTES): Promise<string> {
  // If already within budget in WebP or JPEG, keep as-is
  if ((src.startsWith('data:image/webp') || src.startsWith('data:image/jpeg')) && dataUrlBytes(src) <= maxBytes) {
    return src;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });

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
