const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
tx = tx.replace(/if \(w > 4000\) \{ h = Math.round\(h \* \(4000 \/ w\)\); w = 4000; \}/g, 'if (w > 1500) { h = Math.round(h * (1500 / w)); w = 1500; }');
tx = tx.replace(/if \(w > 4000\) \{\r?\n\s+h = Math\.round\(h \* \(4000 \/ w\)\);\r?\n\s+w = 4000;\r?\n\s+\}/g, 'if (w > 1500) { h = Math.round(h * (1500 / w)); w = 1500; }');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', tx);
