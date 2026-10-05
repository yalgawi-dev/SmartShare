const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const oldShareRegex = /const handleShare = async \(\) => \{[\s\S]*?console\.error\('Share failed', e\);\n    \}\n  \};/m;
const newShare = `const handleShare = async () => {
    setIsProcessing(true);
    let allPageUrls: string[] = [];
    
    for (const item of sortedTrayItems) {
      if (item.type === 'scanned' || item.type === 'active') {
        allPageUrls.push(item.url);
      } else if (item.type === 'pending') {
         const img = new Image();
         img.src = item.url;
         await new Promise((res) => { img.onload = res; });
         let w = img.width; let h = img.height;
         if (w > 2000) { h = Math.round(h * (2000 / w)); w = 2000; }
         const canvas = document.createElement('canvas');
         canvas.width = w; canvas.height = h;
         const ctx = canvas.getContext('2d');
         if (ctx) {
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            allPageUrls.push(compressCanvas(canvas, 0.82));
         }
      }
    }
    
    setIsProcessing(false);
    
    if (allPageUrls.length === 0) return;
    
    if (allPageUrls.length > 1) {
      setExportOptions({ type: 'share', urls: allPageUrls });
      return;
    }

    try {
      const res = await fetch(allPageUrls[0]);
      const blob = await res.blob();
      const file = new File([blob], 'scanned-document.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'מסמך סרוק מ-SmartShare' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scanned-document.jpg';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Share failed', e);
    }
  };`;

code = code.replace(oldShareRegex, newShare);

// Now add the share button back into the secondary actions row
const oldRowRegex = /<button onClick=\{handleAddPage\}/m;
const newRow = `<button onClick={handleShare} style={{ flex: 1, background: 'transparent', color: '#10b981', border: '1px solid #10b981', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>📤</span>
                  שיתוף
                </button>
                <button onClick={handleAddPage}`;
code = code.replace(oldRowRegex, newRow);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Share button and logic restored and adapted for DND');
