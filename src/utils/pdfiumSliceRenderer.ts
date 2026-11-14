import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';

let pdfiumPromise: Promise<WrappedPdfiumModule> | null = null;

// Cache the currently open PDFium document in WASM memory
let cachedDocKey: string | null = null;
let cachedDocPtr = 0;
let cachedDataPtr = 0;

/**
 * Lazily initializes PDFium WASM once per session.
 */
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

/**
 * Loads PDF bytes into PDFium WASM memory (reuses cached document if same key).
 */
async function getOrLoadDocument(pdfium: WrappedPdfiumModule, pdfBytes: Uint8Array, docKey: string): Promise<number> {
  if (cachedDocKey === docKey && cachedDocPtr) {
    return cachedDocPtr;
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
    throw new Error('PDFium failed to load document');
  }

  cachedDocKey = docKey;
  cachedDataPtr = dataPtr;
  cachedDocPtr = docPtr;
  return docPtr;
}

/**
 * Renders a cropped region of a PDF page using C++ PDFium WASM.
 * Much faster than PDF.js on heavy CAD/vector blueprints.
 */
export async function renderSliceWithPdfium(params: {
  pdfBytes: Uint8Array;
  docKey: string;
  pageIndex: number;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  canvasW: number;
  canvasH: number;
}): Promise<string> {
  const { pdfBytes, docKey, pageIndex, normX, normY, normW, normH, canvasW, canvasH } = params;
  const pdfium = await getPdfium();
  const docPtr = await getOrLoadDocument(pdfium, pdfBytes, docKey);

  const pagePtr = pdfium.FPDF_LoadPage(docPtr, pageIndex);
  if (!pagePtr) {
    throw new Error(`PDFium failed to load page ${pageIndex}`);
  }

  try {
    const pageW = pdfium.FPDF_GetPageWidthF(pagePtr);
    const pageH = pdfium.FPDF_GetPageHeightF(pagePtr);

    // Compute scale from PDF points to target slice canvas pixels
    const scaleX = canvasW / (normW * pageW);
    const scaleY = canvasH / (normH * pageH);
    const offsetX = -normX * pageW * scaleX;
    const offsetY = -normY * pageH * scaleY;

    // Allocate BGRA bitmap (format 4 = FPDFBitmap_BGRA)
    const stride = canvasW * 4;
    const bitmapPtr = pdfium.FPDFBitmap_Create(canvasW, canvasH, 0);
    if (!bitmapPtr) {
      throw new Error('PDFium failed to create bitmap');
    }

    try {
      // Fill white background
      pdfium.FPDFBitmap_FillRect(bitmapPtr, 0, 0, canvasW, canvasH, 0xFFFFFFFF);

      // Allocate FS_MATRIX (6 floats = 24 bytes) and FS_RECTF (4 floats = 16 bytes)
      const matrixPtr = pdfium.pdfium.wasmExports.malloc(24);
      const clipPtr = pdfium.pdfium.wasmExports.malloc(16);

      try {
        // FS_MATRIX: [a, b, c, d, e, f]
        const mod = pdfium.pdfium as any;
        const mBase = matrixPtr >> 2;
        mod.HEAPF32[mBase + 0] = scaleX;
        mod.HEAPF32[mBase + 1] = 0;
        mod.HEAPF32[mBase + 2] = 0;
        mod.HEAPF32[mBase + 3] = scaleY;
        mod.HEAPF32[mBase + 4] = offsetX;
        mod.HEAPF32[mBase + 5] = offsetY;

        // FS_RECTF: [left, top, right, bottom]
        const cBase = clipPtr >> 2;
        mod.HEAPF32[cBase + 0] = 0;
        mod.HEAPF32[cBase + 1] = 0;
        mod.HEAPF32[cBase + 2] = canvasW;
        mod.HEAPF32[cBase + 3] = canvasH;

        // 0x01 = FPDF_ANNOT (skip or include? 0 = fastest, no annot overhead)
        pdfium.FPDF_RenderPageBitmapWithMatrix(bitmapPtr, pagePtr, matrixPtr, clipPtr, 0);
      } finally {
        pdfium.pdfium.wasmExports.free(matrixPtr);
        pdfium.pdfium.wasmExports.free(clipPtr);
      }

      const bufPtr = pdfium.FPDFBitmap_GetBuffer(bitmapPtr);
      const byteLen = stride * canvasH;
      const bgra = (pdfium.pdfium as any).HEAPU8.subarray(bufPtr, bufPtr + byteLen);

      // Convert BGRA -> RGBA into ImageData
      const rgba = new Uint8ClampedArray(byteLen);
      for (let i = 0; i < byteLen; i += 4) {
        rgba[i] = bgra[i + 2];     // R
        rgba[i + 1] = bgra[i + 1]; // G
        rgba[i + 2] = bgra[i];     // B
        rgba[i + 3] = 255;         // A
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');
      ctx.putImageData(new ImageData(rgba, canvasW, canvasH), 0, 0);

      return canvas.toDataURL('image/webp', 0.92);
    } finally {
      pdfium.FPDFBitmap_Destroy(bitmapPtr);
    }
  } finally {
    pdfium.FPDF_ClosePage(pagePtr);
  }
}

/**
 * Renders a full PDF page at up to `maxDim` pixels using C++ PDFium WASM.
 * Replaces slow PDF.js initial page rendering (~15s -> ~0.8s).
 */
export async function renderFullPageWithPdfium(params: {
  pdfBytes: Uint8Array;
  docKey: string;
  pageIndex: number;
  maxDim?: number;
}): Promise<string> {
  const { pdfBytes, docKey, pageIndex, maxDim = 1600 } = params;
  const pdfium = await getPdfium();
  const docPtr = await getOrLoadDocument(pdfium, pdfBytes, docKey);
  const pagePtr = pdfium.FPDF_LoadPage(docPtr, pageIndex);
  if (!pagePtr) throw new Error(`PDFium failed to load page ${pageIndex}`);

  let canvasW: number;
  let canvasH: number;
  try {
    const pageW = pdfium.FPDF_GetPageWidthF(pagePtr);
    const pageH = pdfium.FPDF_GetPageHeightF(pagePtr);
    const scale = Math.min(maxDim / Math.max(pageW, pageH), 2.5);
    canvasW = Math.max(1, Math.round(pageW * scale));
    canvasH = Math.max(1, Math.round(pageH * scale));
  } finally {
    pdfium.FPDF_ClosePage(pagePtr);
  }

  return renderSliceWithPdfium({
    pdfBytes,
    docKey,
    pageIndex,
    normX: 0,
    normY: 0,
    normW: 1,
    normH: 1,
    canvasW,
    canvasH,
  });
}
