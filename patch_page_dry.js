const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Add import if missing
if (!tx.includes('import { compressImage }')) {
  tx = tx.replace(`import { uploadImageToStorage } from '@/lib/firebase';`, `import { uploadImageToStorage } from '@/lib/firebase';\nimport { compressImage } from '../utils/imageOptimizer';`);
}

// 2. Remove local resizeAndCompressImage
const localCompressorStart = tx.indexOf('const resizeAndCompressImage');
if (localCompressorStart !== -1) {
  const localCompressorEnd = tx.indexOf('};', tx.indexOf('reader.readAsDataURL(file);')) + 2;
  tx = tx.slice(0, localCompressorStart) + tx.slice(localCompressorEnd);
}

// 3. Replace calls
tx = tx.split('resizeAndCompressImage(file)').join(`compressImage(file, 256, 256, 0.85, 'image/webp')`);

fs.writeFileSync('src/app/page.tsx', tx);
console.log('Patched page.tsx to use DRY compressor');
