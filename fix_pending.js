const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. State type
code = code.replace(
  'const [pendingImports, setPendingImports] = useState<string[]>([]);',
  'const [pendingImports, setPendingImports] = useState<{id: string, url: string}[]>([]);'
);

// 2. handleGalleryImport
code = code.replace(
  /const rest = urls\.slice\(1\);\s+setPendingImports\(prev => \[\.\.\.prev, \.\.\.rest\]\);\s+setActiveDocId\(generateDocId\(\)\);\s+processImportUrl\(first\);/g,
  `const rest = urls.slice(1).map(url => ({ id: generateDocId(), url }));
      setPendingImports(prev => [...prev, ...rest]);
      setActiveDocId(generateDocId());
      processImportUrl(first);`
);

// 3. derivedTrayItems
code = code.replace(
  /...pendingImports\.map\(\(url, i\) => \(\{ id: \`pending-\$\{i\}-\$\{url\.substring\(0,10\)\}\`, type: 'pending' as const, url \}\)\)/g,
  `...pendingImports.map((p) => ({ id: p.id, type: 'pending' as const, url: p.url }))`
);

// 4. handleSkipCrop
code = code.replace(
  /const nextUrl = pendingImports\[0\];\s+setPendingImports\(prev => prev\.slice\(1\)\);\s+setActiveDocId\(generateDocId\(\)\);\s+processImportUrl\(nextUrl\);/g,
  `const nextItem = pendingImports[0];
        setPendingImports(prev => prev.slice(1));
        setActiveDocId(nextItem.id);
        processImportUrl(nextItem.url, nextItem.id);`
);

// 5. saveCurrentStateToTrays
code = code.replace(
  /setPendingImports\(prev => \{\s+if \(\!prev\.includes\(rawSnapshot\)\) \{\s+return \[rawSnapshot, \.\.\.prev\];\s+\}\s+return prev;\s+\}\);/g,
  `setPendingImports(prev => {
          if (!prev.some(p => p.url === rawSnapshot)) {
            return [{ id: activeDocId, url: rawSnapshot }, ...prev];
          }
          return prev;
        });`
);

// 6. pending loop in handleShare
code = code.replace(
  /const url = pendingImports\[idx\];\s+const img = new Image\(\);\s+img\.src = url;/g,
  `const pItem = pendingImports[idx];
                            const url = pItem.url;
                            const img = new Image();
                            img.src = url;`
);

code = code.replace(
  /id: Date\.now\(\)\.toString\(\) \+ '-' \+ idx,/g,
  `id: pItem.id,`
);

// 7. onItemClick
code = code.replace(
  /setPendingImports\(prev => prev\.filter\(p => p !== item\.url\)\);\s+processImportUrl\(item\.url\);/g,
  `setPendingImports(prev => prev.filter(p => p.id !== item.id));
                              processImportUrl(item.url, item.id);`
);
code = code.replace(
  /setActiveDocId\(generateDocId\(\)\);\s+setPendingImports\(prev => prev\.filter\(p => p\.id !== item\.id\)\);/g,
  `setActiveDocId(item.id);\n                              setPendingImports(prev => prev.filter(p => p.id !== item.id));`
);

// 8. processImportUrl signature and logic
code = code.replace(
  /const processImportUrl = \(url: string\) => \{/g,
  `const processImportUrl = (url: string, preserveId?: string) => {`
);
code = code.replace(
  /setRawSnapshot\(snapshotUrl\);\s+setActiveDocId\(generateDocId\(\)\);\s+setStep\('cropping'\);/g,
  `setRawSnapshot(snapshotUrl);
        if (!preserveId) setActiveDocId(generateDocId());
        setStep('cropping');`
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Refactoring complete");
