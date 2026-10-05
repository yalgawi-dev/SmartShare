const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Remove preview states
code = code.replace(`  const [previewIndex, setPreviewIndex] = useState<number | null>(null);\n  const [previewType, setPreviewType] = React.useState<'scanned' | 'pending' | null>(null);`, ``);

// 2. Fix the image src rendering
code = code.replace(
  `src={previewIndex !== null ? (previewType === 'pending' ? pendingImports[previewIndex] : scannedPages[previewIndex]?.imageUrl) : imageCache[mode]}`,
  `src={imageCache[mode]}`
);

// 3. Fix the active document logic to handle 'scanned' clicks
const onItemClickTarget = `                        onItemClick={(item) => {
                           if (item.type === 'scanned') {
                              setPreviewType('scanned');
                              setPreviewIndex(scannedPages.findIndex(p => p.id === item.id));
                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                           } else {
                              setPreviewType(null);
                              setPreviewIndex(null);
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
                              }
                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                           }
                        }}`;
code = code.replace(onItemClickTarget, onItemClickReplacement);

// 4. Remove the 'חזור שלב' button entirely
const backButtonRegex = /\{scannedPages\.length > 0 && \(\s*<button onClick=\{\(\) => \{\s*const pages = \[\.\.\.scannedPages\];\s*const lastPage = pages\.pop\(\);\s*if \(lastPage\) \{\s*setScannedPages\(pages\);\s*setImageCache\(\{ 'smart_plus': lastPage\.imageUrl \}\);\s*setMode\('smart_plus'\);\s*setRawSnapshot\(lastPage\.rawImageUrl \|\| lastPage\.imageUrl\);\s*setStep\('review'\);\s*\}\s*\}\} style=\{\{[^}]+\}\}>\s*<span style=\{\{[^}]+\}\}>↩️<\/span>\s*חזור שלב\s*<\/button>\s*\)\}/g;
code = code.replace(backButtonRegex, '');

// Also bump version to v18.4
code = code.replace(/v18\.3/g, 'v18.4');
code = code.replace(/v18\.2/g, 'v18.4');
code = code.replace(/v18\.0/g, 'v18.4');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Patched UI click bugs and removed back button');
