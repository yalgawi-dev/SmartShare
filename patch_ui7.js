const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
const lines = code.split('\n');

// 1. Rewrite the step === 'review' block
let reviewStartIdx = -1;
let globalTraysIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("step === 'review' && (")) reviewStartIdx = i;
  if (lines[i].includes("{/* GLOBAL TRAYS */}")) globalTraysIdx = i;
}

if (reviewStartIdx !== -1 && globalTraysIdx !== -1) {
  const newReviewBlock = `        {step === 'review' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem' }}>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {hasFinance && (
                  <button 
                    onClick={() => handleCategorySelect('receipt')} 
                    style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', background: selectedCategory === 'receipt' ? '#10b981' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'receipt' ? 'white' : '#aaa', border: selectedCategory === 'receipt' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.85rem', fontWeight: selectedCategory === 'receipt' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', transition: 'all 0.2s' }}
                  >
                    <span style={{ fontSize: '1rem' }}>🧾</span>
                    <span>חשבונית+</span>
                  </button>
                )}
                {hasVault && (
                  <button 
                    onClick={() => handleCategorySelect('document')} 
                    style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', background: selectedCategory === 'document' ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'document' ? 'white' : '#aaa', border: selectedCategory === 'document' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.85rem', fontWeight: selectedCategory === 'document' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', transition: 'all 0.2s' }}
                  >
                    <span style={{ fontSize: '1rem' }}>📄</span>
                    <span>מסמך+</span>
                  </button>
                )}
                <button 
                  onClick={() => handleCategorySelect('image')} 
                  style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', background: selectedCategory === 'image' ? '#f59e0b' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'image' ? 'white' : '#aaa', border: selectedCategory === 'image' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.85rem', fontWeight: selectedCategory === 'image' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '1rem' }}>🖼️</span>
                  <span>תמונה</span>
                </button>
              </div>

              {/* Advanced Filters Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{showAdvancedFilters ? '▲' : '▼'}</span>
                  <span>עיבוד מתקדם (ש/ל ומקור)</span>
                </button>
              </div>
              {showAdvancedFilters && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  <button onClick={() => handleFilterSwitch('original')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>מקור</button>
                </div>
              )}

              {/* Classifier banner */}
              {isClassifying && (
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa', padding: '0.25rem' }}>מנתח מסמך בענן...</div>
              )}
              {classifyResult && !isClassifying && selectedCategory === 'receipt' && (
                <div style={{ background: isFinancialDoc() ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: \`1px solid \${isFinancialDoc() ? '#10b981' : '#ef4444'}\`, borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <span>{isFinancialDoc() ? '✅' : '⚠️'}</span>
                  <span style={{ flex: 1 }}>
                    {isFinancialDoc()
                      ? \`זיהוי: \${getClassifyLabel()} (\${classifyResult.confidence}%)\`
                      : \`זיהוי: \${getClassifyLabel()} – ייתכן שזה לא מתאים ל-OCR\`}
                  </span>
                </div>
              )}

              {/* Row 1: secondary actions */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
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
              </div>
            </div>
          </>
        )}`;
  lines.splice(reviewStartIdx, globalTraysIdx - reviewStartIdx, newReviewBlock);
} else {
  console.log("Could not find step === 'review' block.");
}

// 2. Rewrite the bottom buttons block
let bottomButtonsStartIdx = -1;
let bottomButtonsEndIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("<div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>")) {
    bottomButtonsStartIdx = i;
  }
  if (bottomButtonsStartIdx !== -1 && lines[i].includes("</div>") && i > bottomButtonsStartIdx && lines[i-1].includes(")}")) {
    // wait, we can just replace until the closing div
  }
}
// Actually, let's just use string replacement on the whole file
let newCode = lines.join('\n');
const oldBottomRowRegex = /<div style=\{\{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0\.5rem' \}\}>[\s\S]*?<\/div>/;

const newBottomRow = `<div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', width: '100%' }}>
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
                     }} style={{ flex: '1', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.5rem', borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>
                       ⏭️ דלג על השאר
                     </button>
                   )}
                   {(scannedPages.length > 0 || pendingImports.length > 0 || (step !== 'scanning' && (rawSnapshot || imageCache[mode]))) && (
                     <button onClick={() => handleDone()} style={{ flex: '2', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>
                       סיום ושמירה ({scannedPages.length + pendingImports.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0)} עמודים)
                     </button>
                   )}
                 </div>`;

newCode = newCode.replace(oldBottomRowRegex, newBottomRow);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', newCode);
console.log("Patched successfully.");
