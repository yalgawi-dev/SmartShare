const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Revert needsCompression to true
scanner = scanner.replace(
  /const needsCompression = false; \/\/ Bypass double compression to guarantee pristine quality/g,
  'const needsCompression = true; // Respect the 200-300KB limit rule as standard'
);
scanner = scanner.replace(
  /const needsCompression = false;\n    for \(const item of sortedTrayItems\)/g,
  'const needsCompression = true;\n    for (const item of sortedTrayItems)'
);

// 2. Revert 0.95 back to 0.82 for pending items
scanner = scanner.replace(/const data = compressCanvas\(canvas, 0\.95\);/g, 'const data = compressCanvas(canvas, 0.82);');
scanner = scanner.replace(/imageUrl: compressCanvas\(canvas, 0\.95\),/g, 'imageUrl: compressCanvas(canvas, 0.82),');

// 3. Fix the MULTI-LINE w > 2000 pre-crop bottleneck that I missed earlier
scanner = scanner.replace(
  /if \(w > 2000\) \{\s+h = Math\.round\(h \* \(2000 \/ w\)\);\s+w = 2000;\s+\}/g,
  `if (w > 4000) {
         h = Math.round(h * (4000 / w));
         w = 4000;
      }`
);

// 4. Update versions
scanner = scanner.replace(/v19\.13/g, 'v19.14');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.71/g, 'v6.5.72');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Restored strict file size limits and fixed the true resolution bottleneck!");
