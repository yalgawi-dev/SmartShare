import sys

with open('src/components/widgets/ScannerModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
old_func = re.compile(r'  const handleShare = async \(\) => \{.*?console\.error\(\'Share failed\', e\);\n    \}\n  \};', re.DOTALL)

new_func = r'''  const handleShare = async () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    
    let shareImg = currentImg;
    const allPageUrls = [...scannedPages.map(p => p.imageUrl), currentImg];

    if (allPageUrls.length > 1) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const loadedImages = await Promise.all(allPageUrls.map(url => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = url;
            });
          }));
          const maxWidth = Math.max(...loadedImages.map(img => img.width));
          const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);
          canvas.width = maxWidth;
          canvas.height = totalHeight;
          let currentY = 0;
          loadedImages.forEach((img, i) => {
            ctx.drawImage(img, 0, currentY, img.width, img.height);
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(20, currentY + 20, 160, 60);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('עמוד ' + (i+1), 40, currentY + 62);
            currentY += img.height;
          });
          shareImg = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {
        console.error('Merge for share failed', e);
      }
    }

    try {
      const res = await fetch(shareImg);
      const blob = await res.blob();
      const file = new File([blob], 'scanned-document.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'מסמך סרוק מ-SmartShare' });
      } else {
        alert('הדפדפן שלך אינו תומך בשיתוף קבצים.');
      }
    } catch (e) {
      console.error('Share failed', e);
    }
  };'''

content = old_func.sub(new_func, content)

with open('src/components/widgets/ScannerModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
