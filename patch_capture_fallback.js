const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target1 = `      const pts = detectDocument(canvas) || [
        {x: w * 0.1, y: h * 0.1},
        {x: w * 0.9, y: h * 0.1},
        {x: w * 0.9, y: h * 0.9},
        {x: w * 0.1, y: h * 0.9}
      ];`;

const replacement1 = `      const pts = detectDocument(canvas) || [
        {x: canvas.width * 0.1, y: canvas.height * 0.1},
        {x: canvas.width * 0.9, y: canvas.height * 0.1},
        {x: canvas.width * 0.9, y: canvas.height * 0.9},
        {x: canvas.width * 0.1, y: canvas.height * 0.9}
      ];`;

code = code.replace(target1, replacement1);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Fixed handleCapture fallback!");
