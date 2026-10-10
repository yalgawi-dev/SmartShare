const fs = require('fs');
let tx = fs.readFileSync('src/utils/imageOptimizer.ts', 'utf8');
tx = tx.replace('export async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82): Promise<string> {', 'export async function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82, type = "image/jpeg"): Promise<string> {');
tx = tx.replace('resolve(compressCanvas(canvas, quality));', 'resolve(compressCanvas(canvas, quality, type));');
fs.writeFileSync('src/utils/imageOptimizer.ts', tx);
console.log('Patched imageOptimizer');
