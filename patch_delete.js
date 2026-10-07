const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const handleDeleteActiveFunc = `  const handleDeleteActive = () => {
    const nextPending = pendingImports.length > 0 ? pendingImports[0] : null;
    const nextScanned = scannedPages.length > 0 ? scannedPages[scannedPages.length - 1] : null;

    if (nextPending) {
       setPendingImports(prev => prev.filter(p => p.id !== nextPending.id));
       setActiveDocId(nextPending.id);
       processImportUrl(nextPending.url, nextPending.id);
    } else if (nextScanned) {
       setScannedPages(prev => prev.filter(p => p.id !== nextScanned.id));
       const restoredMode = nextScanned.mode || 'smart_plus';
       const restoredCat = nextScanned.category || 'document';
       setMode(restoredMode);
       setSelectedCategory(restoredCat);
       setImageCache({ [restoredMode]: nextScanned.imageUrl });
       setRawSnapshot(nextScanned.rawImageUrl || nextScanned.imageUrl);
       if (nextScanned.cropPoints) setCropPoints(nextScanned.cropPoints);
       setStep('review');
       setActiveDocId(nextScanned.id);
    } else {
       setRawSnapshot(null); 
       setActiveDocId(generateDocId());
       setImageCache({});
       if (step !== 'scanning') setStep('scanning');
    }
  };

  const handleRetake = () => {`;

content = content.replace("  const handleRetake = () => {", handleDeleteActiveFunc);

// Replace line 1301
const oldBtn = `onClick={() => { if (pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) { setRawSnapshot(null); setActiveDocId(generateDocId());
        setStep('scanning'); } else { handleRetake(); } }}`;
const newBtn = `onClick={() => { if (pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) { handleDeleteActive(); } else { handleRetake(); } }}`;
content = content.replace(oldBtn, newBtn);

// Replace line 1359
const oldItemDelete = `                           } else if (item.type === 'active') {
                               setRawSnapshot(null);
                               setActiveDocId(generateDocId());
                               if (step !== 'scanning') setStep('scanning');
                           }`;
const newItemDelete = `                           } else if (item.type === 'active') {
                               handleDeleteActive();
                           }`;
content = content.replace(oldItemDelete, newItemDelete);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
