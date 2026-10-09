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

export async function downscaleBase64(base64: string, maxDim = 1500, quality = 0.7): Promise<string> {
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
