const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add failsafe for isProcessing
const stateDecl = `  const [isProcessing, setIsProcessing] = useState(false);`;
const stateDeclWithFailsafe = `  const [isProcessing, setIsProcessing] = useState(false);\n\n  useEffect(() => {\n    if (rawSnapshot) {\n      setIsProcessing(false);\n    }\n  }, [rawSnapshot]);`;
code = code.replace(stateDecl, stateDeclWithFailsafe);

// 2. Remove the small ⏩ button
const smallButtonStr = `{pendingImports.length > 1 && (
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
                           )}`;
code = code.replace(smallButtonStr, '');


// 3. Fix the bottom buttons: Add Skip All button, and fix page count
const oldBottomButtons = `<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
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
                     }} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '24px', fontSize: '0.9rem', cursor: 'pointer' }}>
                       ↩️ חזור שלב
                     </button>
                   )}
                   {(scannedPages.length > 0 || pendingImports.length > 0) && (
                     <button onClick={() => handleDone()} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                       סיום ושמירה ({scannedPages.length} עמודים)
                     </button>
                   )}
                 </div>`;

const newBottomButtons = `<div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
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
                     }} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '24px', fontSize: '0.9rem', cursor: 'pointer' }}>
                       ↩️ חזור שלב
                     </button>
                   )}
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
                     }} style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.75rem 1.5rem', borderRadius: '24px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}>
                       ⏭️ דלג על השאר
                     </button>
                   )}
                   {(scannedPages.length > 0 || pendingImports.length > 0 || (step !== 'scanning' && (rawSnapshot || imageCache[mode]))) && (
                     <button onClick={() => handleDone()} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                       סיום ושמירה ({scannedPages.length + pendingImports.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0)} עמודים)
                     </button>
                   )}
                 </div>`;

if (code.includes('סיום ושמירה ({scannedPages.length} עמודים)')) {
  // Use regex for flexible whitespace matching
  code = code.replace(/<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0\.5rem' }}>[\s\S]*?סיום ושמירה \({scannedPages\.length} עמודים\)[\s\S]*?<\/button>\s*<\/div>/, newBottomButtons);
} else {
  console.log("Could not find bottom buttons block");
}

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched successfully");
