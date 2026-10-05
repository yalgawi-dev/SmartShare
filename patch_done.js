const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const oldDoneRegex = /\} else if \(item\.type === 'pending'\) \{\n         const img = new Image\(\);\n         img\.src = item\.url;\n         await new Promise\(\(res\) => \{ img\.onload = res; \}\);\n         let w = img\.width; let h = img\.height;\n         if \(w > 2000\) \{ h = Math\.round\(h \* \(2000 \/ w\)\); w = 2000; \}\n         const canvas = document\.createElement\('canvas'\);\n         canvas\.width = w; canvas\.height = h;\n         const ctx = canvas\.getContext\('2d'\);\n         if \(ctx\) \{\n            ctx\.imageSmoothingEnabled = true; ctx\.imageSmoothingQuality = 'high';\n            ctx\.drawImage\(img, 0, 0, w, h\);\n            allPageUrls\.push\(compressCanvas\(canvas, 0\.82\)\);\n         \}\n      \}/m;

const newDone = `} else if (item.type === 'pending') {
         try {
           const img = new Image();
           img.src = item.url;
           await new Promise((res, rej) => { 
              img.onload = res; 
              img.onerror = () => rej(new Error('Failed to load pending image'));
           });
           let w = img.width; let h = img.height;
           if (w === 0 || h === 0) {
              console.warn("Invalid image dimensions", w, h);
              continue;
           }
           if (w > 2000) { h = Math.round(h * (2000 / w)); w = 2000; }
           const canvas = document.createElement('canvas');
           canvas.width = w; canvas.height = h;
           const ctx = canvas.getContext('2d');
           if (ctx) {
              ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, w, h);
              const data = compressCanvas(canvas, 0.82);
              if (data && data !== 'data:,') {
                 allPageUrls.push(data);
              }
           }
         } catch (e) {
           console.error("Error processing pending image:", e);
         }
      }`;

code = code.replace(oldDoneRegex, newDone);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Patched handleDone for pending images error handling');
