/**
 * Single source of truth for forcing a hard reload and cache purging across mobile and desktop PWAs.
 */
export async function forceAppUpdate(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // 1. Purge all CacheStorage caches (Workbox, PWA, dynamic chunks)
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    // 2. Trigger active service workers to update/skip waiting
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          } catch (e) {
            console.warn('SW update warning:', e);
          }
        })
      );
    }
  } catch (err) {
    console.warn('Cache purge failed:', err);
  }

  // 3. Force hard navigation with timestamp query parameter to bypass HTTP caches completely
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('v_reload', Date.now().toString());
    window.location.href = url.toString();
  }
}
