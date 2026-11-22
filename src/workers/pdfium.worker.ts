/// <reference lib="webworker" />
import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';

let pdfiumPromise: Promise<WrappedPdfiumModule> | null = null;

// Cache the currently open PDFium document AND active parsed page in Worker WASM memory.
let cachedDocKey: string | null = null;
let cachedDocPtr = 0;
let cachedDataPtr = 0;
let cachedPageIndex = -1;
let cachedPagePtr = 0;
let cachedPageW = 595;
let cachedPageH = 842;

async function getPdfium(): Promise<WrappedPdfiumModule> {
  if (!pdfiumPromise) {
    pdfiumPromise = init({
      locateFile: (path: string) => (path.endsWith('.wasm') ? '/pdfium.wasm' : path),
    }).then((mod) => {
      mod.PDFiumExt_Init();
      return mod;
    });
  }
  return pdfiumPromise;
}

function getOrLoadDocument(
  pdfium: WrappedPdfiumModule,
  pdfBytes: Uint8Array | undefined,
  docKey: string
): number {
  if (cachedDocKey === docKey && cachedDocPtr) {
    return cachedDocPtr;
  }
  if (!pdfBytes) {
    throw new Error('PDF bytes required for uncached document');
  }

  if (cachedPagePtr) {
    pdfium.FPDF_ClosePage(cachedPagePtr);
    cachedPagePtr = 0;
    cachedPageIndex = -1;
  }
  if (cachedDocPtr) {
    pdfium.FPDF_CloseDocument(cachedDocPtr);
    cachedDocPtr = 0;
  }
  if (cachedDataPtr) {
    pdfium.pdfium.wasmExports.free(cachedDataPtr);
    cachedDataPtr = 0;
  }

  const mod = pdfium.pdfium as any;
  const dataPtr = mod.wasmExports.malloc(pdfBytes.byteLength);
  mod.HEAPU8.set(pdfBytes, dataPtr);

  const docPtr = pdfium.FPDF_LoadMemDocument(dataPtr, pdfBytes.byteLength, '');
  if (!docPtr) {
    pdfium.pdfium.wasmExports.free(dataPtr);
    throw new Error('PDFium Worker failed to load document');
  }

  cachedDocKey = docKey;
  cachedDataPtr = dataPtr;
  cachedDocPtr = docPtr;
  return docPtr;
}

function getOrLoadPage(
  pdfium: WrappedPdfiumModule,
  docPtr: number,
  pageIndex: number
): { pagePtr: number; pageW: number; pageH: number } {
  if (cachedPagePtr && cachedPageIndex === pageIndex && cachedDocPtr === docPtr) {
    return { pagePtr: cachedPagePtr, pageW: cachedPageW, pageH: cachedPageH };
  }

  if (cachedPagePtr) {
    pdfium.FPDF_ClosePage(cachedPagePtr);
    cachedPagePtr = 0;
    cachedPageIndex = -1;
  }

  const pagePtr = pdfium.FPDF_LoadPage(docPtr, pageIndex);
  if (!pagePtr) {
    throw new Error(`PDFium Worker failed to load page ${pageIndex}`);
  }

  cachedPagePtr = pagePtr;
  cachedPageIndex = pageIndex;
  cachedPageW = pdfium.FPDF_GetPageWidthF(pagePtr) || 595;
  cachedPageH = pdfium.FPDF_GetPageHeightF(pagePtr) || 842;

  return { pagePtr: cachedPagePtr, pageW: cachedPageW, pageH: cachedPageH };
}

type WorkerRequest =
  | { id: number; type: 'prewarm' }
  | { id: number; type: 'inspect'; docKey: string; pdfBytes?: Uint8Array }
  | { id: number; type: 'pageSize'; docKey: string; pdfBytes?: Uint8Array; pageIndex: number }
  | {
      id: number;
      type: 'renderSlice';
      docKey: string;
      pdfBytes?: Uint8Array;
      pageIndex: number;
      normX: number;
      normY: number;
      normW: number;
      normH: number;
      canvasW: number;
      canvasH: number;
    };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'prewarm') {
      await getPdfium();
      self.postMessage({ id: msg.id, ok: true });
      return;
    }

    if (msg.type === 'pageSize') {
      const pdfium = await getPdfium();
      const docPtr = getOrLoadDocument(pdfium, msg.pdfBytes, msg.docKey);
      const { pageW, pageH } = getOrLoadPage(pdfium, docPtr, msg.pageIndex);
      self.postMessage({ id: msg.id, ok: true, result: { width: pageW, height: pageH } });
      return;
    }

    if (msg.type === 'inspect') {
      const pdfium = await getPdfium();
      const docPtr = getOrLoadDocument(pdfium, msg.pdfBytes, msg.docKey);
      const pageCount = Math.max(1, pdfium.FPDF_GetPageCount(docPtr) || 1);
      let signatureCount = 0;
      try {
        signatureCount = pdfium.FPDF_GetSignatureCount(docPtr) || 0;
      } catch {}

      let textCharCount = 0;
      let hasTextObjects = false;
      let hasVectorPaths = false;
      let hasImageObjects = false;
      let pageWidthPt = 595;
      let pageHeightPt = 842;

      try {
        const { pagePtr, pageW, pageH } = getOrLoadPage(pdfium, docPtr, 0);
        pageWidthPt = pageW;
        pageHeightPt = pageH;

        const textPagePtr = pdfium.FPDFText_LoadPage(pagePtr);
        if (textPagePtr) {
          try {
            textCharCount = pdfium.FPDFText_CountChars(textPagePtr) || 0;
          } finally {
            pdfium.FPDFText_ClosePage(textPagePtr);
          }
        }

        const objCount = pdfium.FPDFPage_CountObjects(pagePtr) || 0;
        const maxInspect = Math.min(objCount, 600);
        let pathCount = 0;
        for (let i = 0; i < maxInspect; i++) {
          const objPtr = pdfium.FPDFPage_GetObject(pagePtr, i);
          if (!objPtr) continue;
          const objType = pdfium.FPDFPageObj_GetType(objPtr);
          if (objType === 1) hasTextObjects = true;
          else if (objType === 2) pathCount++;
          else if (objType === 3) hasImageObjects = true;
        }
        if (pathCount > 25) hasVectorPaths = true;
      } catch {}

      self.postMessage({
        id: msg.id,
        ok: true,
        result: {
          pageCount,
          signatureCount,
          textCharCount,
          hasTextObjects,
          hasVectorPaths,
          hasImageObjects,
          pageWidthPt,
          pageHeightPt,
        },
      });
      return;
    }

    if (msg.type === 'renderSlice') {
      const { docKey, pdfBytes, pageIndex, normX, normY, normW, normH, canvasW, canvasH } = msg;
      const pdfium = await getPdfium();
      const docPtr = getOrLoadDocument(pdfium, pdfBytes, docKey);
      const { pagePtr, pageW, pageH } = getOrLoadPage(pdfium, docPtr, pageIndex);

      const scaleX = canvasW / (normW * pageW);
      const scaleY = canvasH / (normH * pageH);
      const offsetX = -normX * pageW * scaleX;
      const offsetY = -normY * pageH * scaleY;

      const stride = canvasW * 4;
      const bitmapPtr = pdfium.FPDFBitmap_Create(canvasW, canvasH, 0);
      if (!bitmapPtr) {
        throw new Error('PDFium Worker failed to create bitmap');
      }

      try {
        pdfium.FPDFBitmap_FillRect(bitmapPtr, 0, 0, canvasW, canvasH, 0xFFFFFFFF);
        const matrixPtr = pdfium.pdfium.wasmExports.malloc(24);
        const clipPtr = pdfium.pdfium.wasmExports.malloc(16);

        try {
          const mod = pdfium.pdfium as any;
          const mBase = matrixPtr >> 2;
          mod.HEAPF32[mBase + 0] = scaleX;
          mod.HEAPF32[mBase + 1] = 0;
          mod.HEAPF32[mBase + 2] = 0;
          mod.HEAPF32[mBase + 3] = scaleY;
          mod.HEAPF32[mBase + 4] = offsetX;
          mod.HEAPF32[mBase + 5] = offsetY;

          const cBase = clipPtr >> 2;
          mod.HEAPF32[cBase + 0] = 0;
          mod.HEAPF32[cBase + 1] = 0;
          mod.HEAPF32[cBase + 2] = canvasW;
          mod.HEAPF32[cBase + 3] = canvasH;

          pdfium.FPDF_RenderPageBitmapWithMatrix(bitmapPtr, pagePtr, matrixPtr, clipPtr, 0);
        } finally {
          pdfium.pdfium.wasmExports.free(matrixPtr);
          pdfium.pdfium.wasmExports.free(clipPtr);
        }

        const bufPtr = pdfium.FPDFBitmap_GetBuffer(bitmapPtr);
        const byteLen = stride * canvasH;
        const bgra = (pdfium.pdfium as any).HEAPU8.subarray(bufPtr, bufPtr + byteLen);

        const pixelCount = canvasW * canvasH;
        const src32 = new Uint32Array(bgra.buffer, bgra.byteOffset, pixelCount);
        const rgba = new Uint8ClampedArray(byteLen);
        const dst32 = new Uint32Array(rgba.buffer);
        for (let i = 0; i < pixelCount; i++) {
          const v = src32[i];
          dst32[i] = 0xFF000000 | ((v & 0x000000FF) << 16) | (v & 0x0000FF00) | ((v & 0x00FF0000) >>> 16);
        }

        // Fast-path: encode WebP Binary Blob 100% off-main-thread via OffscreenCanvas!
        if (typeof OffscreenCanvas !== 'undefined') {
          try {
            const offscreen = new OffscreenCanvas(canvasW, canvasH);
            const ctx = offscreen.getContext('2d');
            if (ctx) {
              ctx.putImageData(new ImageData(rgba, canvasW, canvasH), 0, 0);
              const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.88 });
              self.postMessage({ id: msg.id, ok: true, blob });
              return;
            }
          } catch {
            // Fall through to zero-copy RGBA buffer transfer
          }
        }

        // Fallback: zero-copy Transferable ArrayBuffer back to Main Thread
        self.postMessage(
          { id: msg.id, ok: true, rgbaBuffer: rgba.buffer, canvasW, canvasH },
          [rgba.buffer]
        );
      } finally {
        pdfium.FPDFBitmap_Destroy(bitmapPtr);
      }
      return;
    }
  } catch (err: any) {
    self.postMessage({
      id: msg.id,
      ok: false,
      error: err?.message || 'PDFium Worker error',
    });
  }
};
