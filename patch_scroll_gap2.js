const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const targetScroll = `        const GAP = 0;
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0) + (loadedImages.length > 1 ? (loadedImages.length - 1) * GAP : 0);
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });
        
        // Fill background with white
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, maxWidth, totalHeight, 'F');`;

const replacementScroll = `        // Add a tiny 4px dark separator between pages so it doesn't look like a single crooked page when crops are uneven
        const GAP = 4;
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0) + (loadedImages.length > 1 ? (loadedImages.length - 1) * GAP : 0);
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });
        
        // Fill background with dark gray for the separators
        pdf.setFillColor(50, 50, 50);
        pdf.rect(0, 0, maxWidth, totalHeight, 'F');`;

code = code.replace(targetScroll, replacementScroll);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Replaced scroll gap again');
