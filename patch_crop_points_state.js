const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add cropPoints to ScannedPage interface
const interfaceTarget = `interface ScannedPage {
  id: string;
  imageUrl: string;
  pageNum: number;
  rawImageUrl?: string;
}`;
const interfaceReplacement = `interface ScannedPage {
  id: string;
  imageUrl: string;
  pageNum: number;
  rawImageUrl?: string;
  cropPoints?: Point[];
}`;
code = code.replace(interfaceTarget, interfaceReplacement);

// 2. Save cropPoints in saveCurrentStateToTrays
const saveTarget = `        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined
        };`;
const saveReplacement = `        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined,
          cropPoints: cropPoints
        };`;
code = code.replace(saveTarget, saveReplacement);

// 3. Save cropPoints in handleAddPage
const addTarget = `    const newPage: ScannedPage = {
      id: activeDocId, // Preserve the ID so the tray order doesn't shift
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1,
      rawImageUrl: rawSnapshot || undefined
    };`;
const addReplacement = `    const newPage: ScannedPage = {
      id: activeDocId, // Preserve the ID so the tray order doesn't shift
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1,
      rawImageUrl: rawSnapshot || undefined,
      cropPoints: cropPoints
    };`;
code = code.replace(addTarget, addReplacement);

// 4. Load cropPoints in onItemClick
const loadTarget = `                                setImageCache({ [mode]: docToLoad.imageUrl });
                                setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                setStep('review');`;
const loadReplacement = `                                setImageCache({ [mode]: docToLoad.imageUrl });
                                setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                if (docToLoad.cropPoints) setCropPoints(docToLoad.cropPoints);
                                setStep('review');`;
code = code.replace(loadTarget, loadReplacement);

// Bump version
code = code.replace(/v19\.0/g, 'v19.1');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('cropPoints state saved and loaded for scanned pages');
