const fs = require('fs');
let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Update ScannedPage interface
sm = sm.replace(
  'cropPoints?: Point[];',
  `cropPoints?: Point[];
  mode?: 'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow';
  category?: 'receipt' | 'document' | 'image' | 'advanced';`
);

// 2. Allow 'advanced' in selectedCategory state
sm = sm.replace(
  "const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image'>('receipt');",
  "const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image' | 'advanced'>('receipt');"
);

// 3. Update saveCurrentStateToTrays to include mode and category
const saveCurrentStateRegex = /const newPage: ScannedPage = \{\s*id: activeDocId,\s*imageUrl: currentImg,\s*pageNum: scannedPages.length \+ 1,\s*rawImageUrl: rawSnapshot \|\| undefined,\s*cropPoints: cropPoints\.length === 4 \? cropPoints : undefined\s*\};/;
const saveCurrentStateReplacement = `const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined,
          cropPoints: cropPoints.length === 4 ? cropPoints : undefined,
          mode: mode,
          category: selectedCategory
        };`;
sm = sm.replace(saveCurrentStateRegex, saveCurrentStateReplacement);

// 4. Update the docToLoad logic in onItemClick
const docToLoadRegex = /if \(docToLoad\) \{\s*setScannedPages\(prev => prev\.filter\(p => p\.id !== item\.id\)\);\s*setImageCache\(\{ \[mode\]: docToLoad\.imageUrl \}\);\s*setRawSnapshot\(docToLoad\.rawImageUrl \|\| docToLoad\.imageUrl\);\s*if \(docToLoad\.cropPoints\) setCropPoints\(docToLoad\.cropPoints\);\s*setStep\('review'\);\s*\}/;
const docToLoadReplacement = `if (docToLoad) {
                                 setScannedPages(prev => prev.filter(p => p.id !== item.id));
                                 const restoredMode = docToLoad.mode || 'smart_plus';
                                 const restoredCat = docToLoad.category || 'document';
                                 setMode(restoredMode);
                                 setSelectedCategory(restoredCat);
                                 setImageCache({ [restoredMode]: docToLoad.imageUrl });
                                 setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                 if (docToLoad.cropPoints) setCropPoints(docToLoad.cropPoints);
                                 setStep('review');
                               }`;
sm = sm.replace(docToLoadRegex, docToLoadReplacement);

// 5. Un-highlight buttons when an advanced filter is chosen
const handleFilterSwitchRegex = /if \(imageCache\[targetMode\]\) \{\s*setMode\(targetMode\);\s*return;\s*\}/;
const handleFilterSwitchReplacement = `if (imageCache[targetMode]) {
       setMode(targetMode);
       if (targetMode !== 'smart_plus' && targetMode !== 'pure_color' && targetMode !== 'bw') {
          setSelectedCategory('advanced');
       }
       return;
    }
    if (targetMode !== 'smart_plus' && targetMode !== 'pure_color' && targetMode !== 'bw') {
       setSelectedCategory('advanced');
    }`;
sm = sm.replace(handleFilterSwitchRegex, handleFilterSwitchReplacement);

sm = sm.replace(/v19\.36/g, 'v19.37');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.94/g, 'v6.5.95');
fs.writeFileSync('src/app/page.tsx', page);
console.log('Patched modal states');
