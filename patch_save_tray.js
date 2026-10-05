const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target = `  const saveCurrentStateToTrays = () => {
    const currentImg = imageCache[mode];
    if (currentImg && step !== 'scanning') {
      if (step === 'cropping') {
        setPendingImports(prev => {
          const imgToSave = rawSnapshot || currentImg;
          if (!prev.includes(imgToSave)) {
            return [imgToSave, ...prev];
          }
          return prev;
        });
      } else if (step === 'review') {
        const newPage: ScannedPage = {
          id: Date.now().toString() + Math.random().toString(),
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined
        };
        setScannedPages(prev => [...prev, newPage]);
      }
    }
  };`;

const replacement = `  const saveCurrentStateToTrays = () => {
    if (step === 'scanning') return;
    
    if (step === 'cropping') {
      if (rawSnapshot) {
        setPendingImports(prev => {
          if (!prev.includes(rawSnapshot)) {
            return [rawSnapshot, ...prev];
          }
          return prev;
        });
      }
    } else if (step === 'review') {
      const currentImg = imageCache[mode];
      if (currentImg) {
        const newPage: ScannedPage = {
          id: Date.now().toString() + Math.random().toString(),
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined
        };
        setScannedPages(prev => [...prev, newPage]);
      }
    }
  };`;

code = code.replace(target, replacement);

// Also bump version to v18.2 so user can verify
code = code.replace(/v18\.1/g, 'v18.2');
code = code.replace(/v18\.0/g, 'v18.2'); // just in case

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Replaced saveCurrentStateToTrays');
