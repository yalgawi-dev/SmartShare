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

// In-memory stash of active share promises indexed by share ID or newest
let latestSharedFilesPromise = null;

// Intercept incoming Web Share Target POST requests locally on device
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isShareTarget = event.request.method === 'POST' && (url.pathname === '/' || url.pathname === '/api/share-target');
  
  if (isShareTarget) {
    // If request already came from SW fallback, let it pass directly to network to prevent loops
    if (event.request.headers.get('x-sw-fallback') === 'true') {
      return;
    }

    // 1. Immediately create a clone of the request BEFORE reading its body,
    // so that the server fallback can reliably receive the pristine unconsumed stream.
    const requestCloneForServer = event.request.clone();
    
    // Telemetry summary to capture field keys, types, sizes without personal data
    let swTelemetrySummary = '';

    const formDataPromise = event.request.formData().catch((err) => {
      console.warn('SW: formData() parsing error:', err);
      swTelemetrySummary = 'FORM_ERR:' + (err?.message || 'unknown');
      return null;
    });

    latestSharedFilesPromise = (async () => {
      const formData = await formDataPromise;
      if (!formData) return [];

      const files = [];
      const fieldStats = [];

      // Inspect every entry in FormData for accurate diagnosis
      for (const [key, val] of formData.entries()) {
        const isObj = val && typeof val === 'object';
        const hasBuffer = isObj && typeof val.arrayBuffer === 'function';
        const size = isObj ? (val.size ?? 0) : (typeof val === 'string' ? val.length : 0);
        const name = isObj ? (val.name || 'noname') : '';
        const type = isObj ? (val.type || 'notype') : '';
        const isBlobOrFile = isObj && (val instanceof Blob || hasBuffer);

        fieldStats.push(`${key}:${isBlobOrFile ? 'file' : typeof val}(sz:${size},mime:${type})`);

        if (isBlobOrFile && size > 0) {
          files.push(val);
        }
      }

      swTelemetrySummary = fieldStats.length > 0 ? fieldStats.join(';') : 'NO_KEYS';
      return files;
    })();

    // 2. Respond with redirect to app while keeping worker alive via waitUntil
    event.respondWith((async () => {
      const files = await latestSharedFilesPromise;

      if (!files || files.length === 0) {
        console.warn('SW: No files in SW FormData. Telemetry:', swTelemetrySummary, '- forwarding unconsumed clone to server...');
        // Fallback: Pass the PRISTINE unconsumed clone to the server API route
        try {
          // Add custom header to prevent infinite recursion
          const fallbackHeaders = new Headers(requestCloneForServer.headers);
          fallbackHeaders.set('x-sw-fallback', 'true');
          fallbackHeaders.set('x-sw-telemetry', encodeURIComponent(swTelemetrySummary));
          // Ensure the server-side target route handles the request
          const targetUrl = new URL('/api/share-target', event.request.url).href;
          const serverResponse = await fetch(targetUrl, {
            method: 'POST',
            body: requestCloneForServer.body,
            headers: fallbackHeaders,
            duplex: 'half'
          });
          return serverResponse;
        } catch (fetchErr) {
          console.error('SW: Server fallback fetch failed:', fetchErr);
          const errInfo = encodeURIComponent(`SW_EMPTY[${swTelemetrySummary}];SERVER_FETCH_FAIL:${fetchErr?.message || 'err'}`);
          return Response.redirect(new URL('/?shared=empty&info=' + errInfo, event.request.url).href, 303);
        }
      }

      // 3. Convert files to data URIs safely
      const dataUris = await Promise.all(files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const mimeType = file.type || 'image/jpeg';
        return 'data:' + mimeType + ';base64,' + base64;
      }));

      // 4. Save to Cache Storage immediately (synchronous to redirect flow)
      try {
        const cache = await caches.open('smartshare-shared-cache');
        await cache.put('/api/last-shared-files', new Response(JSON.stringify(dataUris), {
          headers: { 'Content-Type': 'application/json' }
        }));
      } catch (cErr) {
        console.warn('SW Cache storage put failed:', cErr);
      }

      // 5. Also save to IndexedDB safely
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
        console.warn('SW IndexedDB write failed:', idbErr);
      }

      // Redirect browser to main app with success query
      return Response.redirect(new URL('/?shared=true', event.request.url).href, 303);
    })());

    // 6. Direct handshake via message (Squoosh pattern): wait for window to become ready and push
    event.waitUntil((async () => {
      const files = await latestSharedFilesPromise;
      if (!files || files.length === 0) return;

      const dataUris = await Promise.all(files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const mimeType = file.type || 'image/jpeg';
        return 'data:' + mimeType + ';base64,' + base64;
      }));

      // Attempt to broadcast to existing windows right away
      const notifyClients = async () => {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of allClients) {
          client.postMessage({
            action: 'SHARE_FILES_PAYLOAD',
            files: dataUris
          });
        }
      };

      // Broadcast now and retry after 500ms and 1200ms when page loads
      await notifyClients();
      setTimeout(notifyClients, 500);
      setTimeout(notifyClients, 1200);
    })());

    return;
  }
});

// Allow client windows to explicitly pull latest shared files via postMessage
self.addEventListener('message', async (event) => {
  if (event.data && event.data.action === 'REQUEST_PENDING_SHARE') {
    if (latestSharedFilesPromise) {
      const files = await latestSharedFilesPromise;
      if (files && files.length > 0) {
        const dataUris = await Promise.all(files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const mimeType = file.type || 'image/jpeg';
          return 'data:' + mimeType + ';base64,' + base64;
        }));

        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({
            action: 'SHARE_FILES_PAYLOAD',
            files: dataUris
          });
        }
      }
    }
  }
});
