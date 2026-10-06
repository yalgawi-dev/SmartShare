const fs = require('fs');
let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Disable needsCompression (we now compress at source to 0.85, so we don't re-compress)
scanner = scanner.replace(/const needsCompression = true;/g, 'const needsCompression = false; // We now compress to 0.85 at the OpenCV source to prevent double-compression!');

// 2. Fix jsPDF Data URL corruption (strip the `;filename=generated.pdf` so Firebase doesn't choke)
scanner = scanner.replace(/const dataUrl = pdf\.output\('datauristring'\);/g, `let dataUrl = pdf.output('datauristring');
      // Fix jsPDF's non-standard data URI format which breaks Firebase uploadString
      dataUrl = dataUrl.replace(/;filename=[^;]+/, '');`);

// 3. Update versions
scanner = scanner.replace(/v19\.17/g, 'v19.18');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.75/g, 'v6.5.76');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Fixed double compression and Firebase data URI corruption!");
