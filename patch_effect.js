const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const buggyEffect = `  useEffect(() => {
    if (defaultMode === 'upload' && step === 'scanning') {
      setTimeout(() => {
        galleryInputRef.current?.click();
      }, 100);
    }
  }, [defaultMode, step]);`;

const fixedEffect = `  useEffect(() => {
    if (defaultMode === 'upload') {
      setTimeout(() => {
        galleryInputRef.current?.click();
      }, 100);
    }
  }, []); // Only run once on mount!`;

content = content.replace(buggyEffect, fixedEffect);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
