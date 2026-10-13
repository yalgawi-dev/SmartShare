// SmartShare Service Worker with Web Share Target Support

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
          return fetch(event.request);
        }

        const dataUris = await Promise.all(files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const mimeType = file.type || 'image/jpeg';
          return 'data:' + mimeType + ';base64,' + base64;
        }));

        // Store into IndexedDB directly from Service Worker
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('MySpaceDB', 1);
          request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('sharedFiles')) {
              db.createObjectStore('sharedFiles');
            }
          };
          request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('sharedFiles', 'readwrite');
            const store = tx.objectStore('sharedFiles');
            store.put(dataUris, 'latest_shared');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        });

        // Also save to Cache Storage
        try {
          const cache = await caches.open('smartshare-shared-cache');
          await cache.put('/api/last-shared-files', new Response(JSON.stringify(dataUris), {
            headers: { 'Content-Type': 'application/json' }
          }));
        } catch (cErr) {
          console.warn('Cache storage put failed:', cErr);
        }

        return Response.redirect('/?shared=true', 303);

      } catch (err) {
        console.error('Service Worker share handling failed:', err);
        return fetch(event.request);
      }
    })());
    return;
  }
});
