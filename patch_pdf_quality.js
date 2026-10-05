const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const targetMultiPage = `  const processMultiPage = async (urls: string[], format: 'pdf'|'scroll_pdf', includeNumbers: boolean): Promise<{ dataUrl: string, blob: Blob, format: 'pdf' }> => {
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < urls.length; i++) {
        if (i > 0) pdf.addPage();
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const imgRatio = img.width / img.height;
            const pdfRatio = pdfWidth / pdfHeight;
            // Force the cropped image to fill the entire A4 page to prevent white margins
            const finalW = pdfWidth;
            const finalH = pdfHeight;
            const x = 0;
            const y = 0;
            
            if (includeNumbers) {
               // Draw number on an offscreen canvas first
               const canvas = document.createElement('canvas');
               canvas.width = img.width;
               canvas.height = img.height;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.drawImage(img, 0, 0);
                 ctx.fillStyle = 'rgba(0,0,0,0.7)';
                 ctx.fillRect(20, 20, 300, 100);
                 ctx.fillStyle = '#FFD700';
                 ctx.font = 'bold 72px Arial';
                 ctx.fillText('עמוד ' + (i+1), 40, 92);
                 const numImgUrl = canvas.toDataURL('image/jpeg', 0.9);
                 pdf.addImage(numImgUrl, 'JPEG', x, y, finalW, finalH);
               } else {
                 pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
               }
            } else {
               pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
            }
            resolve();
          };
          img.onerror = reject;
          img.src = urls[i];
        });
      }
      const blob = pdf.output('blob');
      const dataUrl = pdf.output('datauristring');
      return { dataUrl, blob, format: 'pdf' };
    } else {
      // Scroll (PDF with custom single page height)
      try {
        const loadedImages = await Promise.all(urls.map(url => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }));
        
        // Add a tiny 4px dark separator between pages so it doesn't look like a single crooked page when crops are uneven
        const GAP = 4;
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0) + (loadedImages.length > 1 ? (loadedImages.length - 1) * GAP : 0);
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });
        
        // Fill background with dark gray for the separators
        pdf.setFillColor(50, 50, 50);
        pdf.rect(0, 0, maxWidth, totalHeight, 'F');
        
        let currentY = 0;
        for (let i = 0; i < loadedImages.length; i++) {
          const img = loadedImages[i];
          if (includeNumbers) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fillRect(20, 20, 300, 100);
              ctx.fillStyle = '#FFD700';
              ctx.font = 'bold 72px Arial';
              ctx.fillText('עמוד ' + (i+1), 40, 92);
              const numImgUrl = canvas.toDataURL('image/jpeg', 0.9);
              pdf.addImage(numImgUrl, 'JPEG', 0, currentY, img.width, img.height);
            } else {
              pdf.addImage(img, 'JPEG', 0, currentY, img.width, img.height);
            }
          } else {
            pdf.addImage(img, 'JPEG', 0, currentY, img.width, img.height);
          }
          currentY += img.height + GAP;
        }
        
        const blob = pdf.output('blob');
        const dataUrl = pdf.output('datauristring');
        return { dataUrl, blob, format: 'pdf' };
      } catch (e) {
        console.error('Scroll PDF error:', e);
        throw e;
      }
    }
  };`;

const replacementMultiPage = `  const processMultiPage = async (urls: string[], format: 'pdf'|'scroll_pdf', includeNumbers: boolean): Promise<{ dataUrl: string, blob: Blob, format: 'pdf' }> => {
    if (format === 'pdf') {
      let pdf = null as any;
      
      for (let i = 0; i < urls.length; i++) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const orientation = img.width > img.height ? 'l' : 'p';
            if (!pdf) {
               pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
            } else {
               pdf.addPage([img.width, img.height], orientation);
            }
            
            if (includeNumbers) {
               const canvas = document.createElement('canvas');
               canvas.width = img.width;
               canvas.height = img.height;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.imageSmoothingEnabled = true;
                 ctx.imageSmoothingQuality = 'high';
                 ctx.drawImage(img, 0, 0);
                 ctx.fillStyle = 'rgba(0,0,0,0.7)';
                 ctx.fillRect(20, 20, 300, 100);
                 ctx.fillStyle = '#FFD700';
                 ctx.font = 'bold 72px Arial';
                 ctx.fillText('עמוד ' + (i+1), 40, 92);
                 const numImgUrl = canvas.toDataURL('image/jpeg', 0.95);
                 pdf.addImage(numImgUrl, 'JPEG', 0, 0, img.width, img.height);
               } else {
                 pdf.addImage(urls[i], 'JPEG', 0, 0, img.width, img.height);
               }
            } else {
               // Directly embed the high-quality Data URL without going through canvas compression again
               pdf.addImage(urls[i], 'JPEG', 0, 0, img.width, img.height);
            }
            resolve();
          };
          img.onerror = reject;
          img.src = urls[i];
        });
      }
      
      if (!pdf) throw new Error("Failed to generate PDF");
      const blob = pdf.output('blob');
      const dataUrl = pdf.output('datauristring');
      return { dataUrl, blob, format: 'pdf' };
    } else {
      // Scroll (PDF with custom single page height)
      try {
        const loadedImages = await Promise.all(urls.map(url => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }));
        
        // Add a tiny 4px dark separator between pages
        const GAP = 4;
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        
        // Compute scaled heights so all images perfectly fit maxWidth
        const scaledHeights = loadedImages.map(img => (maxWidth / img.width) * img.height);
        const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0) + (loadedImages.length > 1 ? (loadedImages.length - 1) * GAP : 0);
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });
        
        // Fill background with dark gray for the separators
        pdf.setFillColor(50, 50, 50);
        pdf.rect(0, 0, maxWidth, totalHeight, 'F');
        
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
              pdf.addImage(numImgUrl, 'JPEG', 0, currentY, maxWidth, scaledH);
            } else {
              pdf.addImage(urls[i], 'JPEG', 0, currentY, maxWidth, scaledH);
            }
          } else {
            pdf.addImage(urls[i], 'JPEG', 0, currentY, maxWidth, scaledH);
          }
          currentY += scaledH + GAP;
        }
        
        const blob = pdf.output('blob');
        const dataUrl = pdf.output('datauristring');
        return { dataUrl, blob, format: 'pdf' };
      } catch (e) {
        console.error('Scroll PDF error:', e);
        throw e;
      }
    }
  };`;

// Because the original string might have minor differences due to previous replacements, 
// let's just locate the function via substring search and replace the whole block dynamically.
const startIndex = code.indexOf("  const processMultiPage = async (urls: string[], format: 'pdf'|'scroll_pdf', includeNumbers: boolean)");
const endStr = "      }\n    }\n  };\n";
let endIndex = code.indexOf(endStr, startIndex);
if (endIndex === -1) {
    endIndex = code.indexOf("      }\n    }\n  };", startIndex);
    endIndex += "      }\n    }\n  };".length;
} else {
    endIndex += endStr.length;
}

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + replacementMultiPage + '\n' + code.substring(endIndex);
    fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
    console.log('Successfully patched processMultiPage logic!');
} else {
    console.error('Could not find processMultiPage boundaries!');
}
