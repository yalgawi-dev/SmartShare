const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Remove the old "מה סרקת?" title
code = code.replace(/<h3 style=\{\{ color: 'white', textAlign: 'center', margin: '0\.5rem 0 0\.5rem 0', fontSize: '1\.2rem', fontWeight: 'bold' \}\}>מה סרקת\?<\/h3>\s*/, '');

// 2. Reduce padding for category buttons
code = code.replace(/padding: '0\.5rem', borderRadius: '12px'/g, "padding: '0.3rem', borderRadius: '8px'");
// Reduce gap above category buttons
code = code.replace(/<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.5rem', marginTop: '0\.5rem' \}\}>/, "<div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>");

// 3. Rewrite the Row 1 secondary actions completely
const row1Regex = /<div style=\{\{ display: 'flex', gap: '0\.5rem' \}\}>[\s\S]*?<\/div>\s*<button onClick=\{\(\) => handleDone[\s\S]*?<\/button>/;
const row1Replacement = `<div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => { if (pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) { setRawSnapshot(null); setStep('scanning'); } else { handleRetake(); } }} style={{ flex: 1, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem' }}>🗑️</span>
                {(pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) ? 'מחק עמוד' : 'צלם שוב'}
              </button>
              <button onClick={() => setStep('cropping')} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem' }}>✂️</span>
                עריכה/חיתוך
              </button>
              {scannedPages.length > 0 && (
                 <button onClick={() => {
                    const pages = [...scannedPages];
                    const lastPage = pages.pop();
                    if (lastPage) {
                       setScannedPages(pages);
                       setImageCache({ 'smart_plus': lastPage.imageUrl });
                       setMode('smart_plus');
                       setRawSnapshot(lastPage.rawImageUrl || lastPage.imageUrl);
                       setStep('review');
                    }
                 }} style={{ flex: 1, background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: '1rem' }}>↩️</span>
                   חזור שלב
                 </button>
              )}
              <button onClick={handleAddPage} style={{ flex: 1, background: 'transparent', color: '#FFD700', border: '1px solid #FFD700', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem' }}>📄</span>
                הוסף עמוד
              </button>
            </div>`;

if (row1Regex.test(code)) {
  code = code.replace(row1Regex, row1Replacement);
} else {
  console.log("Could not find row1 replacement!");
}

// 4. Remove the "חזור שלב" from the bottom row, and make "סיום ושמירה" stretch 100%
const bottomButtonsRegex = /<div style=\{\{ display: 'flex', justifyContent: 'center', gap: '0\.5rem', marginTop: '0\.5rem', flexWrap: 'wrap' \}\}>[\s\S]*?<\/div>/;
const bottomButtonsReplacement = `<div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.2rem', width: '100%' }}>
                   {pendingImports.length > 0 && (
                     <button onClick={async () => {
                         setIsProcessing(true);
                         const newPages = [];
                         for (let idx = 0; idx < pendingImports.length; idx++) {
                           const url = pendingImports[idx];
                           const img = new Image();
                           img.src = url;
                           await new Promise((res) => { img.onload = res; });
                           let w = img.width; let h = img.height;
                           if (w > 2000) { h = Math.round(h * (2000 / w)); w = 2000; }
                           const canvas = document.createElement('canvas');
                           canvas.width = w; canvas.height = h;
                           const ctx = canvas.getContext('2d');
                           if (ctx) {
                             ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
                             ctx.drawImage(img, 0, 0, w, h);
                             newPages.push({
                               id: Date.now().toString() + '-' + idx,
                               imageUrl: compressCanvas(canvas, 0.82),
                               rawImageUrl: compressCanvas(canvas, 0.95),
                               pageNum: scannedPages.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0) + idx + 1
                             });
                           }
                         }
                         setScannedPages(prev => [...prev, ...newPages]);
                         setPendingImports([]);
                         setIsProcessing(false);
                     }} style={{ flex: '1', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.5rem', borderRadius: '12px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}>
                       ⏭️ דלג על השאר
                     </button>
                   )}
                   {(scannedPages.length > 0 || pendingImports.length > 0 || (step !== 'scanning' && (rawSnapshot || imageCache[mode]))) && (
                     <button onClick={() => handleDone()} style={{ flex: '2', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                       סיום ושמירה ({scannedPages.length + pendingImports.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0)} עמודים)
                     </button>
                   )}
                 </div>`;

if (bottomButtonsRegex.test(code)) {
  code = code.replace(bottomButtonsRegex, bottomButtonsReplacement);
} else {
  console.log("Could not find bottom buttons block!");
}

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched successfully");
