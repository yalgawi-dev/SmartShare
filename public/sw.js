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

  if (event.request.method === 'POST' && url.pathname === '/api/share-target') {
    // 1. Immediately kick off extraction so stream is not lost
    const formDataPromise = event.request.formData().catch((err) => {
      console.warn('SW: formData() parsing error:', err);
      return null;
    });

    latestSharedFilesPromise = (async () => {
      const formData = await formDataPromise;
      if (!formData) return [];

      const files = [];

      // A. Check primary expected name from manifest: 'shared_file'
      const sharedFileEntries = formData.getAll('shared_file');
      for (const item of sharedFileEntries) {
        if (item && typeof item === 'object' && typeof item.arrayBuffer === 'function' && item.size > 0) {
          files.push(item);
        }
      }

      // B. Check standard fallback name: 'file' or 'files'
      const fileEntries = [...formData.getAll('file'), ...formData.getAll('files')];
      for (const item of fileEntries) {
        if (item && typeof item === 'object' && typeof item.arrayBuffer === 'function' && item.size > 0) {
          files.push(item);
        }
      }

      // C. Universal scan: check ANY field containing a File/Blob
      if (files.length === 0) {
        for (const [key, val] of formData.entries()) {
          if (val && typeof val === 'object' && typeof val.arrayBuffer === 'function' && val.size > 0) {
            files.push(val);
          }
        }
      }

      return files;
    })();

    // 2. Respond with redirect to app while keeping worker alive via waitUntil
    event.respondWith((async () => {
      const files = await latestSharedFilesPromise;

      if (!files || files.length === 0) {
        console.warn('SW: Share target received 0 valid file objects. Passing to server fallback...');
        // Fallback: If Service Worker found no files, pass request through to server API route
        try {
          return await fetch(event.request);
        } catch (fetchErr) {
          return Response.redirect(new URL('/?shared=empty&info=SW_AND_SERVER_EMPTY', event.request.url).href, 303);
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
