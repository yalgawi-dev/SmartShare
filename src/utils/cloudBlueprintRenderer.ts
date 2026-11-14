/**
 * Single Source of Truth for Cloud Blueprint & PDF Rendering
 * Connects directly to Google Cloud Function running on myspace-da215
 */
import { getCachedPdfPages, setCachedPdfPages } from '@/utils/imageOptimizer';

export const CLOUD_RENDERER_URL = 'https://renderblueprint-ovrjchd3fq-uc.a.run.app';
export const CPP_TILER_URL = 'https://smartshare-cpp-tiler-731292009937.us-central1.run.app';

/**
 * Returns a high-resolution cloud-rendered WebP URL or fetches it as a blob/base64 cached in IndexedDB.
 */
export async function getCloudRenderedBlueprint(
  pdfUrl: string,
  page: number = 1,
  targetWidth: number = 4500
): Promise<string> {
  const cacheKey = `cloud_rendered_${pdfUrl}_p${page}_w${targetWidth}`;

  // 1. Check local IndexedDB cache first
  try {
    const cached = await getCachedPdfPages(cacheKey);
    if (cached && cached.length > 0 && cached[0]) {
      return cached[0];
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB cache:', err);
  }

  // 2. Fetch from Cloud Function
  const requestUrl = `${CLOUD_RENDERER_URL}?pdfUrl=${encodeURIComponent(pdfUrl)}&page=${page}&targetWidth=${targetWidth}&quality=85`;
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Cloud render failed with status ${response.status}: ${response.statusText}`);
  }

  const blob = await response.blob();
  
  // Convert blob to Data URL for seamless offline persistence in IndexedDB
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // 3. Save to IndexedDB asynchronously
  try {
    await setCachedPdfPages(cacheKey, [dataUrl]);
  } catch (err) {
    console.warn('Error saving rendered blueprint to IndexedDB:', err);
  }

  return dataUrl;
}

/**
 * Fetches a high-resolution WebP slice of a specific normalized viewport rectangle from the Cloud Function.
 */
export async function getCloudFocusedSlice(
  pdfUrl: string,
  normX: number,
  normY: number,
  normW: number,
  normH: number,
  canvasW: number,
  canvasH: number,
  page: number = 1
): Promise<{ dataUrl: string; serverRenderMs?: string }> {
  const params = new URLSearchParams({
    pdfUrl,
    page: String(page),
    cropX: normX.toFixed(5),
    cropY: normY.toFixed(5),
    cropW: normW.toFixed(5),
    cropH: normH.toFixed(5),
    outW: String(canvasW),
    outH: String(canvasH),
    quality: '88',
  });

  const requestUrl = `${CPP_TILER_URL}/slice?${params.toString()}`;
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`C++ Cloud slice failed (${response.status}): ${response.statusText}`);
  }

  const serverRenderMs = response.headers.get('X-Render-Time-Ms') || undefined;
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { dataUrl, serverRenderMs };
}

export interface BlueprintTile {
  col: number;
  row: number;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  url: string;
}

export interface TilesManifest {
  docId: string;
  cols: number;
  rows: number;
  widthPts: number;
  heightPts: number;
  dpi: number;
  renderTimeMs?: number;
  tiles: BlueprintTile[];
}

const STORAGE_BUCKET = 'myspace-da215.firebasestorage.app';

/**
 * Generates a deterministic short ID from a PDF URL for Storage tile caching.
 */
export function getStableDocIdFromUrl(pdfUrl: string): string {
  let hash = 0;
  for (let i = 0; i < pdfUrl.length; i++) {
    const ch = pdfUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `doc_${Math.abs(hash).toString(36)}`;
}

/**
 * Checks Firebase Storage directly (<50ms) if pre-rendered tiles already exist.
 */
export async function getTilesManifest(docId: string): Promise<TilesManifest | null> {
  try {
    const manifestUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/rendered_tiles/${docId}/manifest.json`;
    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Triggers parallel 4-vCPU C++ pre-tiling on Cloud Run and persists tiles to Firebase Storage.
 */
export async function triggerPreTile(pdfUrl: string, docId: string, page: number = 1): Promise<TilesManifest | null> {
  try {
    const res = await fetch(`${CPP_TILER_URL}/pre-tile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl, docId, page }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
