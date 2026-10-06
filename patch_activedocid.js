const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add generateDocId
if (!code.includes('const generateDocId')) {
    code = code.replace(/const \[activeDocId, setActiveDocId\] = React\.useState<string>\('active-doc'\);/, 
    `const generateDocId = () => 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const [activeDocId, setActiveDocId] = React.useState<string>(generateDocId());`);
}

// 2. Patch onItemClick
code = code.replace(/saveCurrentStateToTrays\(\);\s*const docToLoad = scannedPages\.find\(p => p\.id === item\.id\);/g, 
`saveCurrentStateToTrays();
                              setActiveDocId(item.id);
                              const docToLoad = scannedPages.find(p => p.id === item.id);`);

code = code.replace(/saveCurrentStateToTrays\(\);\s*setPendingImports\(prev => prev\.filter\(p => p !== item\.url\)\);/g,
`saveCurrentStateToTrays();
                              setActiveDocId(generateDocId());
                              setPendingImports(prev => prev.filter(p => p !== item.url));`);

// 3. Patch handleGalleryImport
code = code.replace(/setPendingImports\(prev => \[\.\.\.prev, \.\.\.rest\]\);\s*processImportUrl\(first\);/g,
`setPendingImports(prev => [...prev, ...rest]);
      setActiveDocId(generateDocId());
      processImportUrl(first);`);

// 4. Patch handleCapture
code = code.replace(/setRawSnapshot\(snapshotUrl\);\s*setStep\('cropping'\);/g,
`setRawSnapshot(snapshotUrl);
      setActiveDocId(generateDocId());
      setStep('cropping');`);

// 5. Patch handleAddPage
code = code.replace(/setPendingImports\(prev => prev\.slice\(1\)\);\s*processImportUrl\(nextUrl\);/g,
`setPendingImports(prev => prev.slice(1));
        setActiveDocId(generateDocId());
        processImportUrl(nextUrl);`);

code = code.replace(/setStep\('scanning'\);/g,
`setActiveDocId(generateDocId());
        setStep('scanning');`);

// 6. Fix version string to v19.4
code = code.replace(/v19\.3/g, 'v19.4');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched activeDocId!");
