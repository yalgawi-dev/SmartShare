const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Fix page count
code = code.replace(/סיום ושמירה \(\{scannedPages\.length\} עמודים\)/g, "סיום ושמירה ({scannedPages.length + pendingImports.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0)} עמודים)");

// Add full screen preview click
const reviewImgTarget = `<img 
                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    alt="Scanned document" 
                  />`;
const reviewImgClickable = `<img 
                    onClick={() => setFullScreenImage(previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode])}
                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'zoom-in' }} 
                    alt="Scanned document" 
                  />`;

code = code.replace(reviewImgTarget, reviewImgClickable);

// Also replace standard unix newlines just in case
const reviewImgTargetUnix = `<img \n                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} \n                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} \n                    alt="Scanned document" \n                  />`;
code = code.replace(reviewImgTargetUnix, reviewImgClickable);

// Fix "צלם שוב" in review step
const reviewRetakeOld = `<button onClick={handleRetake} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: '1px solid white', color: 'white', padding: '0.6rem 1rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>📸</span>
                    צלם שוב
                  </button>`;
const reviewRetakeNew = `<button onClick={() => { if (pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) { setRawSnapshot(null); setStep('scanning'); } else { handleRetake(); } }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.6rem 1rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🗑️</span>
                    {(pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) ? 'מחק עמוד' : 'צלם שוב'}
                  </button>`;
code = code.replace(reviewRetakeOld, reviewRetakeNew);
code = code.replace(reviewRetakeOld.replace(/\r\n/g, '\n'), reviewRetakeNew);

// Fix "חיתוך ידני" in review step to be "עריכה (חיתוך)"
code = code.replace(/<span style=\{\{ fontSize: '1\.2rem' \}\}>✂️<\/span>\s*חיתוך ידני/g, `<span style={{ fontSize: '1.2rem' }}>✂️</span>\n                    עריכה (חיתוך)`);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched successfully");
