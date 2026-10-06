const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix SVG Handles (make them smaller and less thick)
code = code.replace(/<polygon\s+points=\{svgPoints\}\s+fill="transparent"\s+stroke="#FFD700"\s+strokeWidth="3"/, 
  `<polygon points={svgPoints} fill="transparent" stroke="#FFD700" strokeWidth="2"`);
code = code.replace(/<rect x=\{s\.x - 6\} y=\{s\.y - 6\} width="12" height="12" fill="#FFD700" stroke="white" strokeWidth="2"/g, 
  `<rect x={s.x - 4} y={s.y - 4} width="8" height="8" fill="#FFD700" stroke="white" strokeWidth="1.5"`);
code = code.replace(/<circle cx=\{s\.x\} cy=\{s\.y\} r="25" fill="transparent" \/>/g, 
  `<circle cx={s.x} cy={s.y} r="20" fill="transparent" />`);
code = code.replace(/<circle cx=\{s\.x\} cy=\{s\.y\} r=\{isActive \? "12" : "8"\} fill="#FFD700" stroke="white" strokeWidth="2" \/>/g, 
  `<circle cx={s.x} cy={s.y} r={isActive ? "9" : "6"} fill="#FFD700" stroke="white" strokeWidth="1.5" />`);
code = code.replace(/<circle cx=\{s\.x\} cy=\{s\.y\} r="30" fill="transparent" \/>/g, 
  `<circle cx={s.x} cy={s.y} r="25" fill="transparent" />`);

// 2. Fix Double Compression (use 0.98 instead of 0.92 and 0.95 for intermediate steps)
code = code.replace(/compressCanvas\(canvas, 0\.95\)/g, `compressCanvas(canvas, 1.0)`);
code = code.replace(/compressCanvas\(outCanvas, 0\.92\)/g, `compressCanvas(outCanvas, 0.98)`);

// 3. Fix Version
code = code.replace(/v19\.4/g, 'v19.5');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched ScannerModal for SVG size and compression!");

let imgOpt = fs.readFileSync('src/utils/imageOptimizer.ts', 'utf8');
imgOpt = imgOpt.replace(/compressCanvas\(canvas, 0\.82\);/g, `compressCanvas(canvas, 0.90);`);
fs.writeFileSync('src/utils/imageOptimizer.ts', imgOpt);
console.log("Patched imageOptimizer for merge compression!");
