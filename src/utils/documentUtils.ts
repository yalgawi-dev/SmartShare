/**
 * Shared document utilities for SmartShare
 * Follows Rule 2 & 4 (DRY Principle - Single Source of Truth)
 */

import { jsPDF } from 'jspdf';

export interface ExportPdfOptions {
  format?: 'scroll' | 'pages';
  includeNumbers?: boolean;
}

/**
 * Single Source of Truth for converting images (single page, multi-page, or scroll) to a PDF Blob.
 */
export async function convertImagesToPdfBlob(
  imageUrls: string[],
  options: ExportPdfOptions = { format: 'pages', includeNumbers: false }
): Promise<Blob> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images provided for PDF conversion');
  }

  // Force 'pages' if there is only 1 image (a single page can never be a scroll)
  const isSinglePage = imageUrls.length === 1;
  const requestedFormat = options.format || 'pages';
  const format = isSinglePage ? 'pages' : requestedFormat;
  const includeNumbers = options.includeNumbers || false;


  // Load all images
  const loadedImages = await Promise.all(
    imageUrls.map(url => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for PDF'));
        img.src = url;
      });
    })
  );

  if (format === 'pages') {
    let pdf: any = null;
    for (let i = 0; i < loadedImages.length; i++) {
      const img = loadedImages[i];
      const orientation = img.width > img.height ? 'l' : 'p';
      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
      } else {
        pdf.addPage([img.width, img.height], orientation);
      }

      // Add image to cover 100% of the page with 0 margins
      pdf.addImage(imageUrls[i], 'JPEG', 0, 0, img.width, img.height);

      if (includeNumbers) {
        const textCanvas = document.createElement('canvas');
        textCanvas.width = 300;
        textCanvas.height = 100;
        const ctx = textCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(0, 0, 300, 100);
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 72px Arial';
          ctx.fillText('עמוד ' + (i + 1), 40, 72);
          const numImgUrl = textCanvas.toDataURL('image/png');
          pdf.addImage(numImgUrl, 'PNG', 15, 15, 150, 50);
        }
      }
    }
    return pdf.output('blob');
  }


  // Scroll mode (one long continuous page)
  const GAP = 0;
  const maxWidth = Math.max(...loadedImages.map(img => img.width));
  const scaledHeights = loadedImages.map(img => (maxWidth / img.width) * img.height);
  const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0) + (loadedImages.length > 1 ? (loadedImages.length - 1) * GAP : 0);

  let finalFormatHeight = totalHeight;
  let finalFormatWidth = maxWidth;
  let scaleDown = 1.0;
  // jsPDF canvas limits
  if (totalHeight > 14000) {
    scaleDown = 14000 / totalHeight;
    finalFormatHeight = 14000;
    finalFormatWidth = maxWidth * scaleDown;
  }

  const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [finalFormatWidth, finalFormatHeight] });

  let currentY = 0;
  for (let i = 0; i < loadedImages.length; i++) {
    const scaledH = scaledHeights[i];
    pdf.addImage(imageUrls[i], 'JPEG', 0, currentY * scaleDown, finalFormatWidth, scaledH * scaleDown);

    if (includeNumbers) {
      const textCanvas = document.createElement('canvas');
      textCanvas.width = 300;
      textCanvas.height = 100;
      const ctx = textCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, 300, 100);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 72px Arial';
        ctx.fillText('עמוד ' + (i + 1), 40, 72);
        const numImgUrl = textCanvas.toDataURL('image/png');
        pdf.addImage(numImgUrl, 'PNG', 20, 20 + currentY * scaleDown, 300, 100);
      }
    }
    currentY += scaledH + GAP;
  }

  return pdf.output('blob');
}

export interface ShareOptions {
  asPdf?: boolean;
  pages?: string[];
  pdfOptions?: ExportPdfOptions;
}

/**
 * Universal Share Document - Single Source of Truth
 * - If asPdf is true and file is an image, it converts to PDF on-the-fly and shares as .pdf
 * - If asPdf is false or item is a photo, it shares directly as .jpg
 */
export async function shareDocument(url: string, title?: string, options: ShareOptions = {}): Promise<void> {
  try {
    const cleanTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-');
    let fileToShare: File | null = null;

    if (options.asPdf && !url.includes('.pdf') && !url.startsWith('data:application/pdf')) {
      // Convert on-the-fly to PDF
      const imagesToConvert = options.pages && options.pages.length > 0 ? options.pages : [url];
      const pdfBlob = await convertImagesToPdfBlob(imagesToConvert, options.pdfOptions);
      fileToShare = new File([pdfBlob], `${cleanTitle}.pdf`, { type: 'application/pdf' });
    } else {
      // Fetch with 8s timeout to prevent infinite UI freeze
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const blob = await res.blob();
        const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
        const ext = isPdf ? 'pdf' : 'jpg';
        const mime = isPdf ? 'application/pdf' : 'image/jpeg';
        fileToShare = new File([blob], `${cleanTitle}.${ext}`, { type: mime });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.warn('Direct file fetch failed, falling back to link share/download', fetchErr);
      }
    }

    if (fileToShare && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
      await navigator.share({ files: [fileToShare], title: title || 'מסמך' });
    } else if (typeof navigator !== 'undefined' && navigator.share && url) {
      await navigator.share({ title: title || 'מסמך', url: url });
    } else {
      await downloadDocument(url, title, options);
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.error('Error sharing document', e);
      await downloadDocument(url, title, options);
    }
  }
}

/**
 * Universal Download Document - Single Source of Truth
 */
export async function downloadDocument(url: string, title?: string, options: ShareOptions = {}): Promise<void> {
  try {
    const cleanTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-');
    let blob: Blob;
    let ext = 'jpg';

    if (options.asPdf && !url.includes('.pdf') && !url.startsWith('data:application/pdf')) {
      const imagesToConvert = options.pages && options.pages.length > 0 ? options.pages : [url];
      blob = await convertImagesToPdfBlob(imagesToConvert, options.pdfOptions);
      ext = 'pdf';
    } else {
      const res = await fetch(url);
      blob = await res.blob();
      const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
      ext = isPdf ? 'pdf' : 'jpg';
    }

    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `${cleanTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch (e) {
    console.error('Error downloading document, fallback direct open', e);
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Returns the best URL to view a PDF document in an iframe (legacy fallback for pre-existing PDFs).
 */
export function getDocumentPreviewUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('.pdf')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return url;
}
