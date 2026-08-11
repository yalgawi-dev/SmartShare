// Utility for compressing and resizing images on the client side using Canvas API
// Maintains aspect ratio while reducing file size to save storage.
// This is the SINGLE SOURCE OF TRUTH (Engine) for all image compression in the app.

export async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.5): Promise<string> {
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
export function compressCanvas(canvas: HTMLCanvasElement, quality = 0.5, type = 'image/jpeg'): string {
  // We use 0.5 quality and JPEG format across the app to hit the ~100KB target size
  // This is crucial for keeping our cloud storage under 5GB.
  // PNG is supported for signatures which require transparency.
  return canvas.toDataURL(type, quality);
}
