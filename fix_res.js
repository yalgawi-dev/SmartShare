const fs = require('fs');

let opencv = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');
opencv = opencv.replace(/MAX_PROCESSING_WIDTH = 1400/g, 'MAX_PROCESSING_WIDTH = 2200');
fs.writeFileSync('src/utils/opencvFilters.ts', opencv);

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
scanner = scanner.replace(/const scaleFactor = 2000 \/ videoBox\.width;/g, 'const scaleFactor = 2400 / videoBox.width;');
scanner = scanner.replace(/if \(w > 2000\) \{ h = Math\.round\(h \* \(2000 \/ w\)\); w = 2000; \}/g, 'if (w > 2600) { h = Math.round(h * (2600 / w)); w = 2600; }');
// Also check processImportUrl inside pending loop
scanner = scanner.replace(/if \(w > 2000\) \{ h = Math\.round\(h \* \(2000 \/ w\)\); w = 2000; \}/g, 'if (w > 2600) { h = Math.round(h * (2600 / w)); w = 2600; }');

scanner = scanner.replace(/v19\.11/g, 'v19.12');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.69/g, 'v6.5.70');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Updated resolution limits!");
