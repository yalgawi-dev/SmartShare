// Utility for compressing and resizing images on the client side using Canvas API
// Maintains aspect ratio while reducing file size to save storage.
// This is the SINGLE SOURCE OF TRUTH (Engine) for all image compression in the app.

export async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82, type = "image/jpeg"): Promise<string> {
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
        
        // Use the unified canvas compressor
        resolve(compressCanvas(canvas, quality, type));
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Single Source of Truth for Canvas compression.
 * Used by ScannerModal and other components that manipulate images in-memory.
 */
export function compressCanvas(canvas: HTMLCanvasElement, quality = 0.82, type = 'image/jpeg'): string {
  // We use 0.82 quality and JPEG format across the app for sharp text while keeping sizes small. Single Source of Truth.
  // This is crucial for keeping our cloud storage under 5GB.
  // PNG is supported for signatures which require transparency.
  return canvas.toDataURL(type, quality);
}

export async function convertPdfToOptimizedImage(pdfSource: string, maxDim = 1200, quality = 0.82): Promise<string> {
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
      // Remote URL (e.g. Firebase Storage)
      const res = await fetch(pdfSource);
      const arrayBuffer = await res.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    }

    const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;

    // Render each page into its own offscreen canvas
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
      return renderedCanvases[0].toDataURL('image/jpeg', quality);
    }

    // Stitch all pages vertically into a continuous scroll ("Megilah")
    const gap = 16;
    const totalHeight = renderedCanvases.reduce((sum, c) => sum + (maxWidth / c.width) * c.height, 0) + (renderedCanvases.length - 1) * gap;

    const scrollCanvas = document.createElement('canvas');
    scrollCanvas.width = maxWidth;
    scrollCanvas.height = totalHeight;
    const scrollCtx = scrollCanvas.getContext('2d');
    if (!scrollCtx) return renderedCanvases[0].toDataURL('image/jpeg', quality);

    scrollCtx.fillStyle = '#f1f5f9';
    scrollCtx.fillRect(0, 0, scrollCanvas.width, scrollCanvas.height);

    let currentY = 0;
    for (let i = 0; i < renderedCanvases.length; i++) {
      const c = renderedCanvases[i];
      const scaledH = (maxWidth / c.width) * c.height;
      scrollCtx.drawImage(c, 0, currentY, maxWidth, scaledH);

      // Page badge indicator
      scrollCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      scrollCtx.fillRect(16, currentY + 16, 120, 36);
      scrollCtx.fillStyle = '#38bdf8';
      scrollCtx.font = 'bold 20px sans-serif';
      scrollCtx.fillText(`עמוד ${i + 1}`, 32, currentY + 41);

      currentY += scaledH + gap;
    }

    return scrollCanvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.error('Failed to convert multi-page PDF to scroll image:', err);
    return pdfSource;
  }
}

export async function downscaleBase64(base64: string, maxDim = 1500, quality = 0.7): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', quality));
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
  const gap = 30;

  const scaledHeights = loadedImages.map(img => (targetWidth / img.width) * img.height);
  canvas.width = targetWidth;
  canvas.height = scaledHeights.reduce((sum, h) => sum + h, 0) + gap * (loadedImages.length - 1);

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = 0;
  loadedImages.forEach((img, i) => {
    ctx.drawImage(img, 0, currentY, targetWidth, scaledHeights[i]);

    ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
    ctx.fillRect(0, currentY, 160, 50);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('עמוד ' + (i + 1), 20, currentY + 36);

    currentY += scaledHeights[i] + gap;
  });

  return compressCanvas(canvas, 0.82);
}

/** Every stored document must fit this budget. Documents are never rejected - they are shrunk. */
export const DOCUMENT_MAX_BYTES = 300 * 1024;

const dataUrlBytes = (u: string) => Math.round((u.length - u.indexOf(',') - 1) * 0.75);

/**
 * Shrinks an image to fit maxBytes. Always re-encodes from the ORIGINAL source (never from an
 * intermediate result) so there is at most one extra generation of loss. A JPEG already within
 * budget is returned untouched. Never throws on size - returns the best effort.
 */
export async function compressToBudget(src: string, maxBytes = DOCUMENT_MAX_BYTES): Promise<string> {
  if (src.startsWith('data:image/jpeg') && dataUrlBytes(src) <= maxBytes) return src;
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
      best = canvas.toDataURL('image/jpeg', q);
      if (dataUrlBytes(best) <= maxBytes) return best;
    }
    scale *= 0.85;
  }
  return best;
}
