/**
 * Single source of truth for forcing a clean, crash-free PWA update across Android/iOS/Desktop.
 *
 * Root-Cause Note: Deleting CacheStorage while an old Workbox Service Worker is STILL active
 * causes Chrome Android PWA to fail the immediate navigation with "This page couldn't load".
 * We MUST unregister the active app Service Worker FIRST (preserving firebase-messaging-sw.js),
 * purge stale caches SECOND, and then perform a clean replace() navigation straight to the network.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. Unregister stale PWA Service Worker(s) FIRST so they cannot intercept the reload with wiped caches!
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
            // Keep Firebase Push SW intact; unregister app/Workbox SW so reload hits network directly
            if (scriptUrl.includes('firebase-messaging-sw')) {
              await reg.update().catch(() => {});
              return;
            }
            await reg.unregister();
          } catch (e) {
            console.warn('SW unregister warning:', e);
          }
        })
      );
    }

    // 2. Purge all stale CacheStorage entries AFTER SW is unregistered
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('Cache purge failed:', err);
  }

  // 3. Clean hard navigation directly to network (replace() avoids polluting Back button history!)
  const url = new URL(window.location.href);
  url.searchParams.set('v_reload', Date.now().toString());
  window.location.replace(url.toString());
}
