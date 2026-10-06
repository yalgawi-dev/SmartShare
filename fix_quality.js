const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. In handleShare, change needsCompression to false
scanner = scanner.replace(
  /const needsCompression = true; \/\/ Always compress since we only export PDF/g,
  'const needsCompression = false; // Bypass double compression to guarantee pristine quality'
);

// 2. In handleDone, change needsCompression to false
scanner = scanner.replace(
  /const needsCompression = true;\s+for \(const item of sortedTrayItems\)/g,
  'const needsCompression = false;\n    for (const item of sortedTrayItems)'
);

// 3. For pending items in handleShare and handleDone, upgrade 0.82 to 0.95
scanner = scanner.replace(/const data = compressCanvas\(canvas, 0\.82\);/g, 'const data = compressCanvas(canvas, 0.95);');
scanner = scanner.replace(/imageUrl: compressCanvas\(canvas, 0\.82\),/g, 'imageUrl: compressCanvas(canvas, 0.95),');

// 4. Update versions
scanner = scanner.replace(/v19\.12/g, 'v19.13');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.70/g, 'v6.5.71');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Updated to pristine quality mode!");
