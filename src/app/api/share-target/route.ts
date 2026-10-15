export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/?shared=true', request.url), 303);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || 'none';
    const contentLength = request.headers.get('content-length') || '0';
    
    let formData: FormData | null = null;
    let parseError = '';
    try {
      formData = await request.formData();
    } catch (e: any) {
      parseError = e?.message || 'formData_error';
    }
    
    const allKeys = formData ? Array.from(formData.keys()) : [];
    const files: File[] = [];
    const swTelemetry = request.headers.get('x-sw-telemetry') ? decodeURIComponent(request.headers.get('x-sw-telemetry')!) : '';
    const debugEntries: string[] = [
      `ct:${contentType.substring(0, 25)}`,
      `len:${contentLength}`,
      ...(swTelemetry ? [`sw:[${swTelemetry}]`] : []),
      ...(parseError ? [`err:${parseError}`] : [])
    ];

    if (formData) {
      for (const [key, val] of formData.entries()) {
        const isObj = val && typeof val === 'object';
        const hasBuffer = isObj && typeof (val as any).arrayBuffer === 'function';
        const size = isObj ? (val as any).size : (typeof val === 'string' ? val.length : 0);
        const name = isObj ? ((val as any).name || 'noname') : '';
        const type = isObj ? ((val as any).type || 'notype') : '';

        debugEntries.push(`${key}:${isObj ? 'obj' : typeof val}(${name},sz:${size},tp:${type})`);

        if (hasBuffer && size > 0) {
          files.push(val as File);
        }
      }
    }
    
    if (!files || files.length === 0) {
      const info = encodeURIComponent(debugEntries.join(';'));
      console.warn("Share target received no files. Info:", debugEntries);
      return NextResponse.redirect(new URL(`/?shared=empty&info=${info}`, request.url), 303);
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
        <title>ביקורת שיתוף - שלב 1</title>
        <style>
          body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 1.5rem; box-sizing: border-box; text-align: center; }
          .card { background: #1e293b; border-radius: 16px; padding: 1.5rem; max-width: 420px; width: 100%; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .loader { border: 4px solid #334155; border-top: 4px solid #38bdf8; border-radius: 50%; width: 44px; height: 44px; animation: spin 1s linear infinite; margin: 0 auto 1.25rem; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .step { text-align: right; font-size: 0.85rem; margin: 0.4rem 0; padding: 0.4rem 0.6rem; border-radius: 6px; background: #0f172a; font-family: monospace; }
          .ok { color: #4ade80; border-right: 3px solid #4ade80; }
          .wait { color: #facc15; border-right: 3px solid #facc15; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="loader"></div>
          <h2 style="font-size: 1.25rem; margin: 0 0 0.5rem; color: #38bdf8;">📥 נקודת ביקורת 1: קובץ התקבל בשרת</h2>
          <p style="font-size: 0.9rem; color: #94a3b8; margin: 0 0 1rem;">מעבד ${files.length} קבצים ששותפו...</p>
          
          <div id="log-list">
            <div class="step ok">✅ תחנה 1: נתיב POST נקלט בשרת בהצלחה</div>
            <div class="step ok">✅ תחנה 2: נחלצו ${files.length} קבצים בנפח כולל</div>
            <div id="step-db" class="step wait">⏳ תחנה 3: שומר למאגר מקומי IndexedDB...</div>
          </div>
        </div>

        <script>
          const filesData = ${arrayString};
          const checkpointLog = [
            'ST_POST_RECEIVED: ' + filesData.length + ' files',
            'TIMESTAMP: ' + new Date().toISOString()
          ];

          try {
            localStorage.setItem('smartshare_latest_shared_backup', JSON.stringify(filesData));
            checkpointLog.push('LOCAL_STORAGE_BACKUP: OK');
          } catch (e) {
            checkpointLog.push('LOCAL_STORAGE_BACKUP_FAIL: ' + e.message);
          }
          localStorage.setItem('smartshare_share_checkpoints', JSON.stringify(checkpointLog));

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
              const stepDb = document.getElementById('step-db');
              if (stepDb) {
                stepDb.className = 'step ok';
                stepDb.textContent = '✅ תחנה 3: נשמר בהצלחה ב-IndexedDB, עובר לאפליקציה...';
              }
              checkpointLog.push('INDEXED_DB: OK');
              localStorage.setItem('smartshare_share_checkpoints', JSON.stringify(checkpointLog));
              setTimeout(() => {
                window.location.replace('/?shared=true');
              }, 400);
            };
            
            tx.onerror = (err) => {
              checkpointLog.push('INDEXED_DB_ERR: ' + (err?.message || 'fail'));
              localStorage.setItem('smartshare_share_checkpoints', JSON.stringify(checkpointLog));
              window.location.replace('/?shared=true');
            };
          };
          
          request.onerror = (err) => {
            checkpointLog.push('INDEXED_DB_OPEN_ERR: ' + (err?.message || 'fail'));
            localStorage.setItem('smartshare_share_checkpoints', JSON.stringify(checkpointLog));
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
