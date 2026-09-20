import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('shared_file') as File;
    
    if (!file) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const buffer = await file.arrayBuffer();
    // Convert to base64
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Return HTML that saves to IndexedDB and redirects to the app
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>מעבד קובץ משותף...</title>
        <style>
          body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #f8fafc; color: #334155; margin: 0; }
          .loader { border: 4px solid #e2e8f0; border-top: 4px solid #4f46e5; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 1rem; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="loader"></div>
        <h2>מעביר ל-MySpace...</h2>
        <script>
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
            
            // Store the data URI
            store.put('${dataUri}', 'latest_shared');
            
            tx.oncomplete = () => {
              window.location.href = '/?shared=true';
            };
            
            tx.onerror = () => {
              window.location.href = '/?shared=error';
            };
          };
          
          request.onerror = () => {
            window.location.href = '/?shared=error';
          };
        </script>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (err) {
    console.error("Share target error:", err);
    return NextResponse.redirect(new URL('/?shared=error', request.url));
  }
}
