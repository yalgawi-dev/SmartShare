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
 * Loads an image from any source (WebP, PNG, remote Firebase URL, or DataURL)
 * and converts it to a standard, clean, 100% valid JPEG DataURL.
 * This solves the jsPDF WebP incompatibility where WebP URLs produce blank pages.
 */
async function loadAndConvertImageToJpeg(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  // If already a valid JPEG Data URL, parse dimensions and return directly
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return { dataUrl: url, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  }

  // Fetch as Blob to prevent any cross-origin canvas tainting issues
  let blob: Blob | null = null;
  try {
    const res = await fetch(url);
    blob = await res.blob();
  } catch (err) {
    console.warn('Fetch blob for PDF image conversion failed, trying direct URL', err);
  }

  // 1. Hardware-accelerated decoding using Chromium/Blink native createImageBitmap if available
  if (blob && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const w = bitmap.width;
      const h = bitmap.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close(); // Release GPU texture memory
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        return { dataUrl: jpegDataUrl, width: w, height: h };
      }
    } catch (bitmapErr) {
      console.warn('createImageBitmap failed, falling back to Image element', bitmapErr);
    }
  }

  // 2. Fallback via Image element and DataURL
  let safeSrc = url;
  if (blob) {
    safeSrc = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image for PDF conversion'));
    i.src = safeSrc;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available for PDF export');
  }

  // Solid white background to prevent black or transparent regions in PDF
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // High quality JPEG DataURL (0.95 quality)
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  return { dataUrl: jpegDataUrl, width: w, height: h };
}

const A4_PT_WIDTH = 595.28;
const A4_PT_HEIGHT = 841.89;

/**
 * Helper to slice an ultra-tall scroll image (receipt) into sequential A4 aspect-ratio slices.
 * This is the exact algorithm used by CamScanner / Adobe Scan to make tall receipts readable, printable,
 * and ensure Page 1 produces a crisp thumbnail in WhatsApp.
 */
async function sliceTallImageIntoA4Slices(imgData: { dataUrl: string; width: number; height: number }): Promise<Array<{ dataUrl: string; width: number; height: number }>> {
  const W = imgData.width;
  const H = imgData.height;
  const a4Ratio = A4_PT_HEIGHT / A4_PT_WIDTH; // ~1.4143
  const targetSliceH = Math.round(W * a4Ratio);

  // If not significantly taller than A4, keep as 1 slice
  if (H <= targetSliceH * 1.25) {
    return [imgData];
  }

  const numSlices = Math.ceil(H / targetSliceH);
  const slices: Array<{ dataUrl: string; width: number; height: number }> = [];

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imgData.dataUrl;
  });

  for (let i = 0; i < numSlices; i++) {
    const currentY = i * targetSliceH;
    const currentSliceH = Math.min(targetSliceH, H - currentY);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = targetSliceH;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, targetSliceH);
    ctx.drawImage(img, 0, currentY, W, currentSliceH, 0, 0, W, currentSliceH);

    slices.push({
      dataUrl: canvas.toDataURL('image/jpeg', 0.95),
      width: W,
      height: targetSliceH
    });
  }

  return slices.length > 0 ? slices : [imgData];
}

/**
 * Single Source of Truth for converting images to a standard ISO 32000 A4 PDF Blob.
 * Conforms to Rule 2 & 4 (DRY) and Rule 5 (Root Cause Analysis - True PDF Standard).
 * Formats every page onto Standard A4 (595.28 x 841.89 pt) so mobile OSs and WhatsApp
 * can reliably rasterize page 0 into a crisp thumbnail without memory exhaustion.
 */
export async function convertImagesToPdfBlob(
  imageUrls: string[],
  options: ExportPdfOptions = { format: 'pages', includeNumbers: false }
): Promise<Blob> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images provided for PDF conversion');
  }

  const requestedFormat = options.format || 'pages';
  const includeNumbers = options.includeNumbers || false;

  // 1. Load and convert all images to guaranteed high-res JPEG DataURLs
  const rawLoadedImages = await Promise.all(
    imageUrls.map(url => loadAndConvertImageToJpeg(url))
  );

  // 2. Prepare pages: For 'pages' mode, slice any ultra-tall scrolls into A4 slices
  let pagesToRender: Array<{ dataUrl: string; width: number; height: number }> = [];
  if (requestedFormat === 'pages') {
    for (const item of rawLoadedImages) {
      // True mega scrolls (ratio > 3.0) are sliced into sequential A4 pages
      // Standard documents, parking tickets, and regular receipts (ratio <= 3.0) fit completely onto a single A4 page
      if (item.height / item.width > 3.0) {
        const slices = await sliceTallImageIntoA4Slices(item);
        pagesToRender.push(...slices);
      } else {
        pagesToRender.push(item);
      }
    }
  } else {
    // For 'scroll' (fit on single A4), take each image as a page
    pagesToRender = rawLoadedImages;
  }

  // 3. Build standard A4 PDF document
  let pdf: any = null;

  for (let i = 0; i < pagesToRender.length; i++) {
    const item = pagesToRender[i];
    const isLandscape = item.width > item.height;
    const pageW = isLandscape ? A4_PT_HEIGHT : A4_PT_WIDTH;
    const pageH = isLandscape ? A4_PT_WIDTH : A4_PT_HEIGHT;
    const orientation = isLandscape ? 'l' : 'p';

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    } else {
      pdf.addPage('a4', orientation);
    }

    // CamScanner-compliant Page Placement:
    // When a document aspect ratio is close to standard A4 (ratio between 1.22 and 1.58),
    // stretch/fill the full A4 page directly (Full Bleed) without creating unwanted top/bottom white margins!
    const imgRatio = isLandscape ? (item.width / item.height) : (item.height / item.width);
    const standardA4Ratio = A4_PT_HEIGHT / A4_PT_WIDTH; // ~1.4143

    let renderW: number;
    let renderH: number;
    let posX: number;
    let posY: number;

    if (imgRatio >= 1.22 && imgRatio <= 1.58) {
      // Standard document: fill the entire A4 sheet cleanly
      renderW = pageW;
      renderH = pageH;
      posX = 0;
      posY = 0;
    } else {
      // Non-standard formats (slender receipts, square notes): fit proportionally with clean centering
      const scale = Math.min(pageW / item.width, pageH / item.height);
      renderW = Math.round(item.width * scale);
      renderH = Math.round(item.height * scale);
      posX = Math.round((pageW - renderW) / 2);
      posY = Math.round((pageH - renderH) / 2);
    }

    pdf.addImage(item.dataUrl, 'JPEG', posX, posY, renderW, renderH);

    if (includeNumbers && pagesToRender.length > 1) {
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
        pdf.addImage(numImgUrl, 'PNG', 15, 15, 75, 25);
      }
    }
  }

  return pdf.output('blob');
}

/**
 * Loads an image from any source (WebP, PNG, remote URL, DataURL) and returns a guaranteed JPEG Blob.
 * In WhatsApp mobile, image/jpeg files are recognized as photos and displayed completely OPEN in the chat!
 */
export async function convertImageToJpegBlob(url: string): Promise<Blob> {
  const converted = await loadAndConvertImageToJpeg(url);
  const res = await fetch(converted.dataUrl);
  return await res.blob();
}

/**
 * Stitches multiple page images into a single continuous vertical JPEG image.
 * When shared to WhatsApp, it appears as an open, readable scroll directly inside the chat!
 */
export async function convertImagesToScrollJpegBlob(imageUrls: string[]): Promise<Blob> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images provided for scroll creation');
  }

  // Load and convert all images to guaranteed JPEG DataURLs
  const loadedImages = await Promise.all(
    imageUrls.map(url => loadAndConvertImageToJpeg(url))
  );

  const maxWidth = Math.max(...loadedImages.map(img => img.width));
  const scaledHeights = loadedImages.map(img => (maxWidth / img.width) * img.height);
  const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0);

  // Guard against browser canvas max texture limits (typically 16,384px)
  let finalWidth = maxWidth;
  let finalHeight = totalHeight;
  let scaleDown = 1.0;
  if (totalHeight > 16000) {
    scaleDown = 16000 / totalHeight;
    finalHeight = 16000;
    finalWidth = Math.round(maxWidth * scaleDown);
  }

  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available for scroll export');
  }

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  let currentY = 0;
  for (let i = 0; i < loadedImages.length; i++) {
    const imgData = loadedImages[i];
    const scaledH = scaledHeights[i] * scaleDown;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgData.dataUrl;
    });

    ctx.drawImage(img, 0, currentY, finalWidth, scaledH);
    currentY += scaledH;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create scroll JPEG blob'));
      },
      'image/jpeg',
      0.92
    );
  });
}

export type ShareMode = 'open_image' | 'open_scroll' | 'open_album' | 'pdf_pages' | 'pdf_scroll';

export interface ShareOptions {
  mode?: ShareMode;
  asPdf?: boolean;
  pages?: string[];
  pdfOptions?: ExportPdfOptions;
  onReady?: () => void;
}

/**
 * Universal Share Document - Single Source of Truth
 * - 'open_image': Guaranteed JPEG (.jpg) photo. Appears completely OPEN in WhatsApp chat!
 * - 'open_scroll': Stitched continuous JPEG (.jpg) photo. Appears completely OPEN in WhatsApp chat!
 * - 'open_album': Multiple JPEG (.jpg) photos. Appears as an open photo album in WhatsApp!
 * - 'pdf_pages' / 'pdf_scroll': Official PDF document attachment for printing and downloads.
 */
export async function shareDocument(url: string, title?: string, options: ShareOptions = {}): Promise<void> {
  try {
    const cleanTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-');
    const isPdf = url.includes('.pdf') || url.startsWith('data:application/pdf');
    const pages = options.pages && options.pages.length > 0 ? options.pages : [url];
    let filesToShare: File[] = [];

    // Default mode: Standard ISO 32000 A4 PDF (with first-page preview)
    let mode: ShareMode = options.mode || (
      options.asPdf === false 
        ? 'open_image'
        : (options.pdfOptions?.format === 'scroll' ? 'pdf_scroll' : 'pdf_pages')
    );

    if (mode === 'open_scroll') {
      // Stitched continuous vertical JPEG image for WhatsApp open preview
      const scrollBlob = await convertImagesToScrollJpegBlob(pages);
      filesToShare = [new File([scrollBlob], `${cleanTitle}-מגילה.jpg`, { type: 'image/jpeg' })];
    } else if (mode === 'open_album') {
      // Multiple open photo images for WhatsApp photo album
      const blobs = await Promise.all(pages.map(pUrl => convertImageToJpegBlob(pUrl)));
      filesToShare = blobs.map((b, idx) => new File([b], `${cleanTitle}-עמוד-${idx + 1}.jpg`, { type: 'image/jpeg' }));
    } else if (mode === 'open_image') {
      // Single open photo for WhatsApp (first page or single document)
      const targetUrl = pages[0] || url;
      if (!isPdf) {
        // Guaranteed standard JPEG for native WhatsApp photo bubble
        const jpegBlob = await convertImageToJpegBlob(targetUrl);
        filesToShare = [new File([jpegBlob], `${cleanTitle}.jpg`, { type: 'image/jpeg' })];
      } else {
        // If already a PDF, share as document
        const res = await fetch(url);
        const blob = await res.blob();
        filesToShare = [new File([blob], `${cleanTitle}.pdf`, { type: 'application/pdf' })];
      }
    } else if (mode === 'pdf_pages' || mode === 'pdf_scroll') {
      // Official PDF document file (for printing/filing)
      if (!isPdf) {
        const pdfBlob = await convertImagesToPdfBlob(pages, { format: mode === 'pdf_scroll' ? 'scroll' : 'pages' });
        filesToShare = [new File([pdfBlob], `${cleanTitle}.pdf`, { type: 'application/pdf' })];
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        filesToShare = [new File([blob], `${cleanTitle}.pdf`, { type: 'application/pdf' })];
      }
    }

    // Close any loading dialog/modal immediately before opening the OS native share sheet
    if (options.onReady) {
      options.onReady();
    }

    if (filesToShare.length > 0 && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: filesToShare })) {
      await navigator.share({ files: filesToShare, title: title || 'מסמך' });
    } else if (typeof navigator !== 'undefined' && navigator.share && url) {
      await navigator.share({ title: title || 'מסמך', url: url });
    } else if (filesToShare.length > 0) {
      // Fallback: download first file
      const objUrl = URL.createObjectURL(filesToShare[0]);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filesToShare[0].name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
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
      const isWebp = blob.type === 'image/webp' || url.includes('.webp');
      ext = isPdf ? 'pdf' : (isWebp ? 'webp' : 'jpg');
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
