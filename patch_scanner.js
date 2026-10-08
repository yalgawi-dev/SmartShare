const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const strToRemove = `    // Process single page as PDF
    if (allPageUrls.length === 1) {
       try {
         const result = await processMultiPage(allPageUrls, 'pdf', false);
         primary = result.dataUrl;
       } catch (e) {
         console.error('Failed to auto-pdf 1 page', e);
       }
    }`;

tx = tx.replace(strToRemove, "");

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', tx);
