const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target = `            let finalW = pdfWidth;
            let finalH = pdfHeight;
            if (imgRatio > pdfRatio) {
              finalH = pdfWidth / imgRatio;
            } else {
              finalW = pdfHeight * imgRatio;
            }
            const x = (pdfWidth - finalW) / 2;
            const y = (pdfHeight - finalH) / 2;`;

const replacement = `            // Force the cropped image to fill the entire A4 page to prevent white margins
            const finalW = pdfWidth;
            const finalH = pdfHeight;
            const x = 0;
            const y = 0;`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Replaced PDF bounds logic');
