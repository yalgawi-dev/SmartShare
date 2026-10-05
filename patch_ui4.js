const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add fullScreenImage state
if (!code.includes('const [fullScreenImage, setFullScreenImage]')) {
  code = code.replace(
    `const [isProcessing, setIsProcessing] = useState(false);`,
    `const [isProcessing, setIsProcessing] = useState(false);\n  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);`
  );
}

// 2. Add full screen image overlay at the very end of the modal, before the last </div>
const overlayCode = `
      {fullScreenImage && (
        <div 
          onClick={() => setFullScreenImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 40000, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
        >
          <img src={fullScreenImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <button onClick={() => setFullScreenImage(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}
`;

if (!code.includes('fullScreenImage && (')) {
  code = code.replace(
    `{exportOptions && (`,
    overlayCode + '\n\n      {exportOptions && ('
  );
}

// 3. Make the review preview image clickable
const reviewImgTarget = `<img \n                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} \n                    alt="Preview" \n                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}\n                  />`;
// Try unix or windows newlines
const reviewImgClickable = `<img 
                    onClick={() => setFullScreenImage(previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode])}
                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', cursor: 'zoom-in' }}
                  />`;

// Replace it flexibly
code = code.replace(/<img[^>]*src=\{previewIndex[^>]*alt="Preview"[^>]*\/>/m, reviewImgClickable);


// 4. Change "צלם שוב" to "ביטול עריכה" / "צלם שוב" dynamically
// And handleSkipCrop logic
const skipCropLogic = `
  const handleSkipCrop = () => {
    if (!rawSnapshot) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setImageCache(prev => ({ ...prev, 'original': rawSnapshot }));
      setMode('original');
      setStep('review');
    }, 50);
  };
`;

if (!code.includes('const handleSkipCrop =')) {
  code = code.replace(`const handleCropComplete = () => {`, skipCropLogic + `\n  const handleCropComplete = () => {`);
}

const buttonsTargetOld = `<button onClick={handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              צלם שוב
            </button>`;
const buttonsTargetNew = `<button onClick={pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg')) ? handleSkipCrop : handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              {(pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) ? 'בטל עריכה' : 'צלם שוב'}
            </button>`;

code = code.replace(/<button onClick=\{handleRetake\} style=\{\{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0\.75rem 1\.5rem', borderRadius: '8px', cursor: 'pointer' \}\}>\s*צלם שוב\s*<\/button>/m, buttonsTargetNew);


fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched successfully");
