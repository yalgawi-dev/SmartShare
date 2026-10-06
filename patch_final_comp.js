const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const helper = `  const getFinalCompressedUrl = async (url: string) => {
    return new Promise<string>((res, rej) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
         const canvas = document.createElement('canvas');
         canvas.width = img.width; canvas.height = img.height;
         const ctx = canvas.getContext('2d');
         if (!ctx) return res(url);
         ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
         ctx.drawImage(img, 0, 0);
         res(compressCanvas(canvas, 0.82));
      };
      img.onerror = () => res(url);
    });
  };

  const handleShare = async () => {`;

code = code.replace(/const handleShare = async \(\) => {/, helper);

const replaceBlock = `if (item.type === 'scanned' || item.type === 'active') {
        allPageUrls.push(item.url);
      } else if`;

const replaceWith = `if (item.type === 'scanned' || item.type === 'active') {
        const compressed = await getFinalCompressedUrl(item.url);
        allPageUrls.push(compressed);
      } else if`;

code = code.replaceAll(replaceBlock, replaceWith);
code = code.replace(/v19\.6/g, 'v19.7');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched final compression loop!");
