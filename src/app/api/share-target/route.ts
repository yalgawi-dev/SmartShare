export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/?shared=true', request.url), 303);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Extract any file or blob regardless of the field name used by the source app
    const files: File[] = [];
    for (const [key, val] of formData.entries()) {
      if (val && typeof val === 'object' && 'arrayBuffer' in val && (val as any).size > 0) {
        files.push(val as File);
      }
    }
    
    if (!files || files.length === 0) {
      console.warn("Share target received no files. Keys received:", Array.from(formData.keys()));
      return NextResponse.redirect(new URL('/?shared=empty', request.url), 303);
    }

    const dataUris = await Promise.all(files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = file.type || 'image/jpeg';
      return '"data:' + mimeType + ';base64,' + base64 + '"';
    }));
    
    const arrayString = '[' + dataUris.join(',') + ']';

    // Return HTML that saves to IndexedDB and redirects to the app
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>מעבד קבצים ששותפו...</title>
        <style>
          body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #f8fafc; color: #334155; margin: 0; }
          .loader { border: 4px solid #e2e8f0; border-top: 4px solid #4f46e5; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 1rem; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="loader"></div>
        <h2 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: #1e293b;">📥 מקבל קובץ חיצוני...</h2>
        <p style="font-size: 0.95rem; color: #64748b; margin: 0;">פותח את SmartShare לניתוב הקובץ</p>
        <script>
          const filesData = ${arrayString};
          try {
            // Also store in localStorage as reliable immediate fallback
            localStorage.setItem('smartshare_latest_shared_backup', JSON.stringify(filesData));
          } catch (e) {
            console.warn('localStorage backup failed', e);
          }

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
            
            store.put(filesData, 'latest_shared');
            
            tx.oncomplete = () => {
              window.location.replace('/?shared=true');
            };
            
            tx.onerror = () => {
              window.location.replace('/?shared=true');
            };
          };
          
          request.onerror = () => {
            window.location.replace('/?shared=true');
          };
        </script>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err) {
    console.error("Share target error:", err);
    return NextResponse.redirect(new URL('/?shared=error', request.url), 303);
  }
}
