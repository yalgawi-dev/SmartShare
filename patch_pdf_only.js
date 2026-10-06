const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Force compression to 82% always (since everything is PDF now)
code = code.replace(/const needsCompression = sortedTrayItems\.length > 1;/g, 'const needsCompression = true; // Always compress since we only export PDF');

// 2. Remove JPEG share fallback and ALWAYS open ExportOptionsModal
const target = `    if (allPageUrls.length > 1) {
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
    }`;

const replaceWith = `    if (allPageUrls.length > 0) {
      setExportOptions({ type: 'share', urls: allPageUrls });
      return;
    }`;

code = code.replace(target, replaceWith);

// 3. Bump ScannerModal version
code = code.replace(/v19\.8/g, 'v19.9');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched ScannerModal logic successfully.");

// 4. Bump Global Version
let pageCode = fs.readFileSync('src/app/page.tsx', 'utf8');
pageCode = pageCode.replace(/v6\.5\.65/g, 'v6.5.66');
fs.writeFileSync('src/app/page.tsx', pageCode);
console.log("Bumped global version to v6.5.66.");
