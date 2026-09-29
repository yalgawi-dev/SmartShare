const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('mergeImagesCleanly')) {
  content = content.replace("import { compressCanvas } from '../../utils/imageOptimizer';", "import { compressCanvas, mergeImagesCleanly } from '../../utils/imageOptimizer';");
}

// 2. Replace handleShare logic
const regex = /const handleShare = async \(\) => \{[\s\S]*?ctx\.fillText\('עמוד ' \+ \(i\+1\), 40, currentY \+ 62\);\r?\n              currentY \+= img\.height;\r?\n            \}\);\r?\n            shareImg = canvas\.toDataURL\('image\/jpeg', 0\.85\);\r?\n          \}\r?\n        \} catch \(e\) \{[\s\S]*?console\.error\('Failed to merge for share', e\);\r?\n        \}\r?\n      \}/m;

const replacement = `const handleShare = async () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    
    let shareImg = currentImg;
    const allPageUrls = [...scannedPages.map(p => p.imageUrl), currentImg];

    if (allPageUrls.length > 1) {
      try {
        shareImg = await mergeImagesCleanly(allPageUrls);
      } catch (e) {
        console.error('Failed to merge for share', e);
      }
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('patched handleShare');
