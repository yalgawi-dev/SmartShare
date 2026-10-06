const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add activeOriginalUrl state
code = code.replace(
  'const [activeDocId, setActiveDocId] = React.useState<string>(generateDocId());',
  'const [activeDocId, setActiveDocId] = React.useState<string>(generateDocId());\n  const [activeOriginalUrl, setActiveOriginalUrl] = React.useState<string | null>(null);'
);

// 2. Update derivedTrayItems to use activeOriginalUrl
code = code.replace(
  /\.\.\.\(step !== 'scanning' && \(rawSnapshot \|\| imageCache\[mode\]\) \? \[\{ id: activeDocId, type: 'active' as const, url: imageCache\[mode\] \|\| rawSnapshot, isEdited: step === 'review' \}\] : \[\]\),/g,
  `...(step !== 'scanning' && (rawSnapshot || imageCache[mode] || activeOriginalUrl) ? [{ id: activeDocId, type: 'active' as const, url: (imageCache[mode] || rawSnapshot || activeOriginalUrl) as string, isEdited: step === 'review' }] : []),`
);

// Also need to add activeOriginalUrl to the dependency array of derivedTrayItems
code = code.replace(
  /}, \[scannedPages, step, rawSnapshot, imageCache, mode, pendingImports, activeDocId\]\);/g,
  `}, [scannedPages, step, rawSnapshot, imageCache, mode, pendingImports, activeDocId, activeOriginalUrl]);`
);

// 3. Update processImportUrl to set it
code = code.replace(
  /const processImportUrl = \(url: string, preserveId\?: string\) => \{/g,
  `const processImportUrl = (url: string, preserveId?: string) => {\n    setActiveOriginalUrl(url);`
);

// 4. Update Scanner version to v19.11
code = code.replace(/v19\.10/g, 'v19.11');

// 5. Update Global version to v6.5.69
let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.68/g, 'v6.5.69');
fs.writeFileSync('src/app/page.tsx', page);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Fixed carousel bug!");
