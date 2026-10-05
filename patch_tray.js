const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix ManualCropper padding
const cropperDivOld = `<div \r\n      ref={containerRef}\r\n      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}`;
const cropperDivNew = `<div \r\n      ref={containerRef}\r\n      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none', padding: '24px', boxSizing: 'border-box' }}`;
code = code.replace(cropperDivOld, cropperDivNew);

// Unix style fallback
const cropperDivOldUnix = `<div \n      ref={containerRef}\n      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}`;
const cropperDivNewUnix = `<div \n      ref={containerRef}\n      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none', padding: '24px', boxSizing: 'border-box' }}`;
code = code.replace(cropperDivOldUnix, cropperDivNewUnix);


// 2. Combine Trays into a single unified row
const lines = code.split('\n');
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// GLOBAL TRAYS')) {
    startIdx = i; // wait, let's find the exact block
  }
}

// More precise search:
let pendingImportsStart = -1;
let editedTrayEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{pendingImports.length > 0 && (') && lines[i+1].includes('overflowX: \'auto\'')) {
    pendingImportsStart = i;
  }
  if (lines[i].includes('{scannedPages.length > 0 && (') && lines[i+1].includes('overflowX: \'auto\'')) {
    // found edited tray start
  }
  if (pendingImportsStart !== -1 && lines[i].includes('<div style={{ display: \'flex\', justifyContent: \'center\', gap: \'1rem\', marginTop: \'0.5rem\' }}>')) {
    editedTrayEnd = i - 1;
    break;
  }
}

if (pendingImportsStart !== -1 && editedTrayEnd !== -1) {
  const unifiedTrayCode = `                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', overflowX: 'auto', direction: 'rtl', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    
                    {scannedPages.length > 0 && (
                      <>
                        <div style={{ color: 'white', fontSize: '0.7rem', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', flexShrink: 0 }}>ערוכים</div>
                        {scannedPages.map((page, i) => (
                          <div key={page.id} onClick={() => {
                              saveCurrentStateToTrays();
                              setScannedPages(prev => prev.filter(p => p.id !== page.id));
                              setImageCache({ 'smart_plus': page.imageUrl });
                              setMode('smart_plus');
                              setRawSnapshot(page.rawImageUrl || page.imageUrl);
                              setStep('review');
                          }} style={{ position: 'relative', flexShrink: 0, width: '56px', height: '76px', borderRadius: '4px', overflow: 'hidden', border: '2px solid #10b981', cursor: 'pointer' }}>
                            <img src={page.imageUrl} alt={\`Page \${i+1}\`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(16,185,129,0.9)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderBottomRightRadius: '4px', fontWeight: 'bold' }}>✓ {i+1}</div>
                          </div>
                        ))}
                        <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.2)', flexShrink: 0, margin: '0 0.2rem' }} />
                      </>
                    )}

                    {step !== 'scanning' && (rawSnapshot || imageCache[mode]) && (
                      <>
                        <div style={{ color: '#3b82f6', fontSize: '0.7rem', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', flexShrink: 0 }}>פתוח</div>
                        <div style={{ position: 'relative', flexShrink: 0, width: '60px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '3px solid #3b82f6', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }}>
                           <img src={(step === 'cropping' ? rawSnapshot : imageCache[mode]) || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           <div style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(59,130,246,0.9)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderBottomRightRadius: '4px', fontWeight: 'bold' }}>👁️ {scannedPages.length + 1}</div>
                        </div>
                        <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.2)', flexShrink: 0, margin: '0 0.2rem' }} />
                      </>
                    )}

                    {pendingImports.length > 0 && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                          <div style={{ color: 'white', fontSize: '0.7rem', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center' }}>לא ערוכים</div>
                          {pendingImports.length > 1 && (
                            <button 
                               onClick={async () => {
                                 const newPages = [];
                                 for (let idx = 0; idx < pendingImports.length; idx++) {
                                   const url = pendingImports[idx];
                                   const img = new Image();
                                   img.src = url;
                                   await new Promise((res) => { img.onload = res; });
                                   
                                   let w = img.width;
                                   let h = img.height;
                                   if (w > 2000) {
                                     h = Math.round(h * (2000 / w));
                                     w = 2000;
                                   }
                                   const canvas = document.createElement('canvas');
                                   canvas.width = w;
                                   canvas.height = h;
                                   const ctx = canvas.getContext('2d');
                                   if (ctx) {
                                     ctx.imageSmoothingEnabled = true;
                                     ctx.imageSmoothingQuality = 'high';
                                     ctx.drawImage(img, 0, 0, w, h);
                                     const optimizedUrl = compressCanvas(canvas, 0.82);
                                     newPages.push({
                                       id: Date.now().toString() + '-' + idx,
                                       imageUrl: optimizedUrl,
                                       rawImageUrl: optimizedUrl,
                                       pageNum: scannedPages.length + (step !== 'scanning' ? 1 : 0) + idx + 1
                                     });
                                   }
                                 }
                                 setScannedPages(prev => [...prev, ...newPages]);
                                 setPendingImports([]);
                               }}
                               title="אשר הכל והעבר לערוכים"
                               style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                             >
                               <span style={{ fontSize: '1rem', lineHeight: 1 }}>⏩</span>
                             </button>
                           )}
                        </div>
                        {pendingImports.map((url, i) => (
                          <div key={\`pending-\${i}\`} onClick={() => {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter((_, idx) => idx !== i));
                              processImportUrl(url);
                          }} style={{ position: 'relative', flexShrink: 0, width: '56px', height: '76px', borderRadius: '4px', overflow: 'hidden', border: '2px solid #ef4444', cursor: 'pointer' }}>
                            <img src={url} alt={\`Pending \${i}\`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(239,68,68,0.9)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderBottomRightRadius: '4px', fontWeight: 'bold' }}>{scannedPages.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0) + i + 1}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>`;

  lines.splice(pendingImportsStart, editedTrayEnd - pendingImportsStart + 1, unifiedTrayCode);
  fs.writeFileSync('src/components/widgets/ScannerModal.tsx', lines.join('\n'));
  console.log("Patched successfully");
} else {
  console.error("Could not find tray block indices", pendingImportsStart, editedTrayEnd);
}
