// SmartShare Service Worker with Web Share Target Support

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Robust binary to base64 converter in worker context without memory/stack limits (fallback only for small thumbs)
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

// Helper to store binary Blob items directly in IndexedDB without Base64 memory inflation
async function saveSharedBlobsToIndexedDB(fileItems) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('MySpaceDB');
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sharedFiles')) {
          db.createObjectStore('sharedFiles');
        }
        if (!db.objectStoreNames.contains('sharedBlobs')) {
          db.createObjectStore('sharedBlobs');
        }
      };
      request.onsuccess = (e) => {
        try {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sharedBlobs')) {
            // Need upgrade or fallback
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction('sharedBlobs', 'readwrite');
          const store = tx.objectStore('sharedBlobs');
          store.put(fileItems, 'latest_blobs');
          tx.oncomplete = () => { db.close(); resolve(true); };
          tx.onerror = () => { db.close(); resolve(false); };
        } catch (err) {
          resolve(false);
        }
      };
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

// Intercept incoming Web Share Target POST requests locally on device
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/api/share-target') {
    // If request already came from SW fallback, let it pass directly to network to prevent loops
    if (event.request.headers.get('x-sw-fallback') === 'true') {
      return;
    }

    // Clone request before reading, in case fallback is needed
    const requestCloneForServer = event.request.clone();
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

    // 2. Respond with immediate redirect to app while processing binary blobs in background
    event.respondWith((async () => {
      const files = await latestSharedFilesPromise;

      if (!files || files.length === 0) {
        console.warn('SW: No files in SW FormData. Telemetry:', swTelemetrySummary, '- forwarding unconsumed clone to server...');
        try {
          const fallbackHeaders = new Headers(requestCloneForServer.headers);
          fallbackHeaders.set('x-sw-fallback', 'true');
          fallbackHeaders.set('x-sw-telemetry', encodeURIComponent(swTelemetrySummary));
          const serverResponse = await fetch(requestCloneForServer, {
            headers: fallbackHeaders
          });
          return serverResponse;
        } catch (fetchErr) {
          console.error('SW: Server fallback fetch failed:', fetchErr);
          const errInfo = encodeURIComponent(`SW_EMPTY[${swTelemetrySummary}];SERVER_FETCH_FAIL:${fetchErr?.message || 'err'}`);
          return Response.redirect(new URL('/?shared=empty&info=' + errInfo, event.request.url).href, 303);
        }
      }

      // 3. Save as pure binary Blobs (instant 0ms memory-friendly storage!)
      const blobEntries = files.map((file, idx) => ({
        id: `blob_${Date.now()}_${idx}`,
        name: file.name || `shared_file_${idx}`,
        type: file.type || 'application/octet-stream',
        size: file.size,
        blob: file // Storing the File/Blob directly into IndexedDB!
      }));

      await saveSharedBlobsToIndexedDB(blobEntries);

      // Also for backward-compatibility with small files under 3MB, generate dataUri fallback
      const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
      if (totalSize < 4 * 1024 * 1024) {
        try {
          const dataUris = await Promise.all(files.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            const mimeType = file.type || 'image/jpeg';
            return 'data:' + mimeType + ';base64,' + base64;
          }));

          const cache = await caches.open('smartshare-shared-cache');
          await cache.put('/api/last-shared-files', new Response(JSON.stringify(dataUris), {
            headers: { 'Content-Type': 'application/json' }
          }));
        } catch (e) {}
      }

      // Redirect immediately!
      return Response.redirect(new URL('/?shared=true', event.request.url).href, 303);
    })());

    // 4. Notify active windows via message
    event.waitUntil((async () => {
      const files = await latestSharedFilesPromise;
      if (!files || files.length === 0) return;

      const notifyClients = async () => {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of allClients) {
          client.postMessage({
            action: 'SHARE_BLOBS_AVAILABLE',
            count: files.length
          });
        }
      };

      await notifyClients();
      setTimeout(notifyClients, 300);
      setTimeout(notifyClients, 800);
    })());

    return;
  }
});
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
