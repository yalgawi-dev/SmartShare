const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const oldRegex = /    if \(!isClosingRef\.current\) \{\n        isClosingRef\.current = true;\n        window\.history\.back\(\);\n      \}\n      \n      setTimeout\(\(\) => \{\n        onComplete\(primary, currentImg \|\| primary, allPageUrls\.length > 1 \? allPageUrls : undefined, finalRouting as any\);\n        setIsProcessing\(false\);\n      \}, 50\);\n    \};/m;

const newLogic = `    // Process single page as PDF
    if (allPageUrls.length === 1) {
       try {
         const result = await processMultiPage(allPageUrls, 'pdf', false);
         primary = result.dataUrl;
       } catch (e) {
         console.error('Failed to auto-pdf 1 page', e);
       }
    }

    if (!isClosingRef.current) {
        isClosingRef.current = true;
        window.history.back();
    }
      
    setTimeout(() => {
      onComplete(primary, currentImg || primary, undefined, finalRouting as any);
      setIsProcessing(false);
    }, 50);
  };`;

code = code.replace(oldRegex, newLogic);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Patched handleDone to output PDF for single pages');
