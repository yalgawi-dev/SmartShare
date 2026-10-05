const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix saveCurrentStateToTrays duplicates
const saveTarget = `  const saveCurrentStateToTrays = () => {
    if (step === 'review') {
      const currentImg = imageCache[mode];
      if (currentImg) {
        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined
        };
        setScannedPages(prev => [...prev, newPage]);
      }
    }
  };`;

const saveReplacement = `  const saveCurrentStateToTrays = () => {
    if (step === 'review') {
      const currentImg = imageCache[mode];
      if (currentImg) {
        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined
        };
        setScannedPages(prev => {
          if (prev.some(p => p.id === activeDocId)) return prev;
          return [...prev, newPage];
        });
      }
    }
  };`;

code = code.replace(saveTarget, saveReplacement);

// 2. Fix handleAddPage to use activeDocId instead of Date.now()
const addPageTarget = `  const handleAddPage = () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    const newPage: ScannedPage = {
      id: Date.now().toString(),
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1,
      rawImageUrl: rawSnapshot || undefined
    };
    setScannedPages(prev => [...prev, newPage]);`;

const addPageReplacement = `  const handleAddPage = () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    const newPage: ScannedPage = {
      id: activeDocId, // Preserve the ID so the tray order doesn't shift
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1,
      rawImageUrl: rawSnapshot || undefined
    };
    setScannedPages(prev => {
      if (prev.some(p => p.id === activeDocId)) return prev;
      return [...prev, newPage];
    });`;

code = code.replace(addPageTarget, addPageReplacement);

// Bump version
code = code.replace(/v18\.9/g, 'v19.0');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Fixed double click duplicates and handleAddPage ID preserved');
