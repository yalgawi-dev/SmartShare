/**
 * Single source of truth for crash-free PWA version updates on Android WebAPK, iOS PWA & Desktop.
 *
 * Root-Cause Fix:
 * - NEVER call `reg.unregister()` on `sw.js` mid-navigation: in Chrome Android WebAPK,
 *   killing the active SW controller right before navigating triggers Chrome's native
 *   "This page couldn't load" white error screen (and breaks Web Share Target).
 * - Instead: pre-fetch the current URL with `{ cache: 'reload' }` FIRST so Chrome refreshes
 *   its HTTP cache with the brand-new Vercel HTML (retrying once on cellular blip),
 *   and ONLY THEN trigger a clean `window.location.reload()`.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. Clean any legacy ?v_reload= query param so we reload the canonical URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('v_reload');
    const targetHref = cleanUrl.toString();

    // 2. Pre-fetch fresh HTML directly from network (bypasses HTTP cache) & verify 200 OK
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(targetHref, {
          cache: 'reload',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) break;
      } catch {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    }

    // 3. Softly check for SW updates in background without killing the active WebAPK controller
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.update().catch(() => {})))
        .catch(() => {});
    }

    // 4. Clean reload without dead SW race condition
    if (window.location.href !== targetHref) {
      window.location.replace(targetHref);
    } else {
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
}
