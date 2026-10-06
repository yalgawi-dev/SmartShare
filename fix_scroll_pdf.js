const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix scroll_pdf height crash
let replacement = `
        let finalFormatHeight = totalHeight;
        let finalFormatWidth = maxWidth;
        let scaleDown = 1.0;
        if (totalHeight > 14000) {
            scaleDown = 14000 / totalHeight;
            finalFormatHeight = 14000;
            finalFormatWidth = maxWidth * scaleDown;
        }
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [finalFormatWidth, finalFormatHeight] });
        
        // Fill background with dark gray for the separators
        pdf.setFillColor(50, 50, 50);
        pdf.rect(0, 0, finalFormatWidth, finalFormatHeight, 'F');
        
        let currentY = 0;
        for (let i = 0; i < loadedImages.length; i++) {
          const img = loadedImages[i];
          const scaledH = scaledHeights[i];
          
          if (includeNumbers) {
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = scaledH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, maxWidth, scaledH);
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fillRect(20, 20, 300, 100);
              ctx.fillStyle = '#FFD700';
              ctx.font = 'bold 72px Arial';
              ctx.fillText('עמוד ' + (i+1), 40, 92);
              const numImgUrl = canvas.toDataURL('image/jpeg', 0.95);
              pdf.addImage(numImgUrl, 'JPEG', 0, currentY * scaleDown, finalFormatWidth, scaledH * scaleDown);
            } else {
              pdf.addImage(urls[i], 'JPEG', 0, currentY * scaleDown, finalFormatWidth, scaledH * scaleDown);
            }
          } else {
            pdf.addImage(urls[i], 'JPEG', 0, currentY * scaleDown, finalFormatWidth, scaledH * scaleDown);
          }
          currentY += scaledH + GAP;
        }
`;

// Replace the whole block from "const pdf = new jsPDF" up to the end of the loop
const startIdx = scanner.indexOf("const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });");
const endStr = "currentY += scaledH + GAP;\n        }";
const endIdx = scanner.indexOf(endStr, startIdx) + endStr.length;

if (startIdx !== -1 && endIdx !== -1) {
    scanner = scanner.substring(0, startIdx) + replacement + scanner.substring(endIdx);
    console.log("Successfully replaced scroll PDF logic");
} else {
    console.error("Failed to find scroll PDF logic bounds");
}

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);
