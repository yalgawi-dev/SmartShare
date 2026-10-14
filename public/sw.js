// SmartShare Service Worker with Web Share Target Support

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Robust binary to base64 converter in worker context without memory/stack limits
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32KB chunks safe for JavaScript engines
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// Intercept incoming Web Share Target POST requests locally on device
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/api/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        
        const rawShared = formData.getAll('shared_file');
        let files = (rawShared && rawShared.length > 0)
          ? rawShared.filter(f => f && typeof f === 'object' && typeof f.arrayBuffer === 'function' && f.size > 0)
          : [];

        if (files.length === 0) {
          for (const [key, val] of formData.entries()) {
            if (val && typeof val === 'object' && typeof val.arrayBuffer === 'function' && val.size > 0) {
              files.push(val);
            }
          }
        }

        if (files.length === 0) {
          const keys = [];
          for (const key of formData.keys()) keys.push(key);
          const diag = encodeURIComponent('SW_EMPTY_FILES;keys:' + keys.join(','));
          console.warn('SW: No files found in share payload, keys:', keys);
          return Response.redirect(new URL('/?shared=empty&info=' + diag, event.request.url).href, 303);
        }

        const dataUris = await Promise.all(files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const mimeType = file.type || 'image/jpeg';
          return 'data:' + mimeType + ';base64,' + base64;
        }));

        // 1. Save to Cache Storage first (instant & reliable in SW)
        try {
          const cache = await caches.open('smartshare-shared-cache');
          await cache.put('/api/last-shared-files', new Response(JSON.stringify(dataUris), {
            headers: { 'Content-Type': 'application/json' }
          }));
        } catch (cErr) {
          console.warn('Cache storage put failed:', cErr);
        }

        // 2. Also save to IndexedDB safely without blocking
        try {
          await new Promise((resolve) => {
            const request = indexedDB.open('MySpaceDB');
            request.onupgradeneeded = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('sharedFiles')) {
                db.createObjectStore('sharedFiles');
              }
            };
            request.onsuccess = (e) => {
              try {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sharedFiles')) {
                  db.close();
                  resolve(false);
                  return;
                }
                const tx = db.transaction('sharedFiles', 'readwrite');
                const store = tx.objectStore('sharedFiles');
                store.put(dataUris, 'latest_shared');
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); resolve(false); };
              } catch (txErr) {
                resolve(false);
              }
            };
            request.onerror = () => resolve(false);
            request.onblocked = () => resolve(false);
          });
        } catch (idbErr) {
          console.warn('IndexedDB write skipped/failed:', idbErr);
        }

        // Notify all clients of new shared content
        try {
          const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
          for (const client of allClients) {
            client.postMessage({ action: 'NEW_SHARE_RECEIVED' });
          }
        } catch (msgErr) {}

        const successDiag = encodeURIComponent('SW_SUCCESS;count:' + dataUris.length);
        return Response.redirect(new URL('/?shared=true&info=' + successDiag, event.request.url).href, 303);

      } catch (err) {
        console.error('Service Worker share handling failed:', err);
        const errDiag = encodeURIComponent('SW_ERR:' + (err?.message || err?.toString() || 'unknown'));
        return Response.redirect(new URL('/?shared=error&info=' + errDiag, event.request.url).href, 303);
      }
    })());
    return;
  }
});
