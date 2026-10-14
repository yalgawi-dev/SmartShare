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
        const reqHeaders = [];
        for (const [k, v] of event.request.headers.entries()) {
          reqHeaders.push(`${k}=${v.substring(0, 30)}`);
        }
        
        let formData = null;
        let formErr = null;
        try {
          formData = await event.request.formData();
        } catch (e) {
          formErr = e?.message || e?.toString();
        }

        if (!formData) {
          const diag = encodeURIComponent(`SW_NO_FORMDATA;err:${formErr};hdrs:${reqHeaders.join('|')}`);
          return Response.redirect(new URL('/?shared=empty&info=' + diag, event.request.url).href, 303);
        }

        const entriesInfo = [];
        const files = [];

        for (const [key, val] of formData.entries()) {
          const isFile = val && typeof val === 'object' && typeof val.arrayBuffer === 'function';
          const size = isFile ? val.size : (typeof val === 'string' ? val.length : 0);
          const name = isFile ? (val.name || 'noname') : '';
          const type = isFile ? (val.type || 'notype') : '';
          entriesInfo.push(`${key}:${isFile ? 'file' : typeof val}(${name},sz:${size},tp:${type})`);
          if (isFile && size > 0) {
            files.push(val);
          }
        }

        if (files.length === 0) {
          const diag = encodeURIComponent(`SW_EMPTY;entries:${entriesInfo.join(';') || 'none'};hdrs:${reqHeaders.join('|')}`);
          console.warn('SW: No files found in share payload:', entriesInfo);
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
