/**
 * Single Source of Truth for Cloud Blueprint & PDF Rendering
 * Connects directly to Google Cloud Function running on myspace-da215
 */
import { getCachedPdfPages, setCachedPdfPages } from '@/utils/imageOptimizer';

export const CLOUD_RENDERER_URL = 'https://renderblueprint-ovrjchd3fq-uc.a.run.app';

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
