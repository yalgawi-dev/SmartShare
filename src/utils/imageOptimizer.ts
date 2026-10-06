// Utility for compressing and resizing images on the client side using Canvas API
// Maintains aspect ratio while reducing file size to save storage.
// This is the SINGLE SOURCE OF TRUTH (Engine) for all image compression in the app.

export async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82): Promise<string> {
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
        resolve(compressCanvas(canvas, quality));
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
