const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add activeDocId state
code = code.replace(
  `  const [trayOrder, setTrayOrder] = React.useState<string[]>([]);`,
  `  const [trayOrder, setTrayOrder] = React.useState<string[]>([]);\n  const [activeDocId, setActiveDocId] = React.useState<string>('active-doc');`
);

// 2. Update derivedTrayItems
code = code.replace(
  `...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: 'active-doc', type: 'active' as const, url: imageCache[mode] || rawSnapshot, isEdited: step === 'review' }] : []),`,
  `...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: activeDocId, type: 'active' as const, url: imageCache[mode] || rawSnapshot, isEdited: step === 'review' }] : []),`
);

// 3. Update saveCurrentStateToTrays to use activeDocId
code = code.replace(
  `        const newPage: ScannedPage = {
          id: Date.now().toString() + Math.random().toString(),`,
  `        const newPage: ScannedPage = {
          id: activeDocId,`
);

// 4. Update onItemClick to set activeDocId
const onItemClickTarget = `                        onItemClick={(item) => {
                           if (item.type === 'scanned') {
                              saveCurrentStateToTrays();
                              const docToLoad = scannedPages.find(p => p.id === item.id);
                              if (docToLoad) {
                                setScannedPages(prev => prev.filter(p => p.id !== item.id));
                                setImageCache({ [mode]: docToLoad.imageUrl });
                                setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                setStep('review');
                              }
                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                           }
                        }}`;
const onItemClickReplacement = `                        onItemClick={(item) => {
                           if (item.type === 'scanned') {
                              saveCurrentStateToTrays();
                              const docToLoad = scannedPages.find(p => p.id === item.id);
                              if (docToLoad) {
                                setScannedPages(prev => prev.filter(p => p.id !== item.id));
                                setImageCache({ [mode]: docToLoad.imageUrl });
                                setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                setStep('review');
                                setActiveDocId(item.id);
                              }
                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                              setActiveDocId(item.id);
                           }
                        }}`;
code = code.replace(onItemClickTarget, onItemClickReplacement);

// 5. Update processImportUrl to reset activeDocId
code = code.replace(
  `    setRawSnapshot(url);`,
  `    setActiveDocId('doc-' + Date.now() + Math.random().toString());\n    setRawSnapshot(url);`
);

// 6. Update handleCapture to reset activeDocId
code = code.replace(
  `    setRawSnapshot(snapshot);`,
  `    setActiveDocId('doc-' + Date.now() + Math.random().toString());\n    setRawSnapshot(snapshot);`
);

// 7. Bump version
code = code.replace(/v18\.5/g, 'v18.6');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('ScannerModal patched');
