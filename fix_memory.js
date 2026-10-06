const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix the includeNumbers logic in standard PDF branch
let pdfRegex = /if \(includeNumbers\) \{\s+const canvas = document\.createElement\('canvas'\);\s+canvas\.width = img\.width;\s+canvas\.height = img\.height;\s+const ctx = canvas\.getContext\('2d'\);\s+if \(ctx\) \{\s+ctx\.imageSmoothingEnabled = true;\s+ctx\.imageSmoothingQuality = 'high';\s+ctx\.drawImage\(img, 0, 0\);\s+ctx\.fillStyle = 'rgba\(0,0,0,0\.7\)';\s+ctx\.fillRect\(20, 20, 300, 100\);\s+ctx\.fillStyle = '#FFD700';\s+ctx\.font = 'bold 72px Arial';\s+ctx\.fillText\('עמוד ' \+ \(i\+1\), 40, 92\);\s+const numImgUrl = canvas\.toDataURL\('image\/jpeg', 0\.95\);\s+pdf\.addImage\(numImgUrl, 'JPEG', 0, 0, img\.width, img\.height\);\s+\} else \{\s+pdf\.addImage\(urls\[i\], 'JPEG', 0, 0, img\.width, img\.height\);\s+\}\s+\} else \{\s+\/\/ Directly embed the high-quality Data URL without going through canvas compression again\s+pdf\.addImage\(urls\[i\], 'JPEG', 0, 0, img\.width, img\.height\);\s+\}/g;

let optimizedPdf = `
            pdf.addImage(urls[i], 'JPEG', 0, 0, img.width, img.height);
            if (includeNumbers) {
               const textCanvas = document.createElement('canvas');
               textCanvas.width = 300;
               textCanvas.height = 100;
               const ctx = textCanvas.getContext('2d');
               if (ctx) {
                 ctx.fillStyle = 'rgba(0,0,0,0.7)';
                 ctx.fillRect(0, 0, 300, 100);
                 ctx.fillStyle = '#FFD700';
                 ctx.font = 'bold 72px Arial';
                 ctx.fillText('עמוד ' + (i+1), 40, 72);
                 const numImgUrl = textCanvas.toDataURL('image/png');
                 pdf.addImage(numImgUrl, 'PNG', 20, 20, 300, 100);
               }
            }
`;

scanner = scanner.replace(pdfRegex, optimizedPdf);


// 2. Fix the includeNumbers logic in scroll_pdf branch (just in case)
let scrollRegex = /if \(includeNumbers\) \{\s+const canvas = document\.createElement\('canvas'\);\s+canvas\.width = maxWidth;\s+canvas\.height = scaledH;\s+const ctx = canvas\.getContext\('2d'\);\s+if \(ctx\) \{\s+ctx\.imageSmoothingEnabled = true;\s+ctx\.imageSmoothingQuality = 'high';\s+ctx\.drawImage\(img, 0, 0, maxWidth, scaledH\);\s+ctx\.fillStyle = 'rgba\(0,0,0,0\.7\)';\s+ctx\.fillRect\(20, 20, 300, 100\);\s+ctx\.fillStyle = '#FFD700';\s+ctx\.font = 'bold 72px Arial';\s+ctx\.fillText\('עמוד ' \+ \(i\+1\), 40, 92\);\s+const numImgUrl = canvas\.toDataURL\('image\/jpeg', 0\.95\);\s+pdf\.addImage\(numImgUrl, 'JPEG', 0, currentY \* scaleDown, finalFormatWidth, scaledH \* scaleDown\);\s+\} else \{\s+pdf\.addImage\(urls\[i\], 'JPEG', 0, currentY \* scaleDown, finalFormatWidth, scaledH \* scaleDown\);\s+\}\s+\} else \{\s+pdf\.addImage\(urls\[i\], 'JPEG', 0, currentY \* scaleDown, finalFormatWidth, scaledH \* scaleDown\);\s+\}/g;

let optimizedScroll = `
          pdf.addImage(urls[i], 'JPEG', 0, currentY * scaleDown, finalFormatWidth, scaledH * scaleDown);
          if (includeNumbers) {
            const textCanvas = document.createElement('canvas');
            textCanvas.width = 300;
            textCanvas.height = 100;
            const ctx = textCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fillRect(0, 0, 300, 100);
              ctx.fillStyle = '#FFD700';
              ctx.font = 'bold 72px Arial';
              ctx.fillText('עמוד ' + (i+1), 40, 72);
              const numImgUrl = textCanvas.toDataURL('image/png');
              pdf.addImage(numImgUrl, 'PNG', 20, 20 + (currentY * scaleDown), 300, 100);
            }
          }
`;

scanner = scanner.replace(scrollRegex, optimizedScroll);

// 3. Update versions
scanner = scanner.replace(/v19\.16/g, 'v19.17');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.74/g, 'v6.5.75');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Fixed PDF memory crashes and quality drops due to native JS image layering!");
