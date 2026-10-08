const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const anchor = `    if (allPageUrls.length > 1) {
      setExportOptions({ type: 'save', urls: allPageUrls, routingType });
      return; // Don't process further, modal will handle it via executeExport
    }`;

const insert = `
    
    // Process single page as PDF ONLY for Documents, not Receipts!
    // Receipts need to stay as images so OCR works fast and doesn't upload 7MB PDFs!
    if (allPageUrls.length === 1 && finalRouting !== 'receipt') {
       try {
         const result = await processMultiPage(allPageUrls, 'pdf', false);
         primary = result.dataUrl;
       } catch (e) {
         console.error('Failed to auto-pdf 1 page', e);
       }
    }
`;

const lines = tx.split('\n');
const idx = lines.findIndex(l => l.includes('modal will handle it via executeExport'));

if (idx !== -1) {
    lines.splice(idx + 2, 0, insert);
    fs.writeFileSync('src/components/widgets/ScannerModal.tsx', lines.join('\n'));
    console.log("Patched successfully!");
} else {
    console.log("Could not find anchor");
}
