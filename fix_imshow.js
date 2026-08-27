const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const regex = /let finalUrl = '';[\s\S]*?resolve\(\{/;
const replacement = `let finalUrl = '';
        if (activeProfile === 'original') {
          cv.imshow(canvas, dst);
          finalUrl = compressCanvas(canvas, 0.95);
        } else if (activeProfile === 'bw') {
          cv.imshow(canvas, bwRgba);
          finalUrl = compressCanvas(canvas, 0.90);
        } else if (activeProfile === 'pure_color') {
          cv.imshow(canvas, finalPureRgba);
          finalUrl = compressCanvas(canvas, 0.90);
        } else if (activeProfile === 'smart_color') {
          cv.imshow(canvas, finalSmartRgba);
          finalUrl = compressCanvas(canvas, 0.90);
        } else if (activeProfile === 'smart_plus') {
          cv.imshow(canvas, finalSmartPlusRgba);
          finalUrl = compressCanvas(canvas, 0.90);
        } else if (activeProfile === 'hybrid') {
          if (typeof finalHybrid !== 'undefined') {
             cv.imshow(canvas, finalHybrid);
             finalUrl = compressCanvas(canvas, 0.90);
          } else {
             cv.imshow(canvas, finalSmartPlusRgba);
             finalUrl = compressCanvas(canvas, 0.90);
          }
        } else {
          cv.imshow(canvas, dst);
          finalUrl = compressCanvas(canvas, 0.90);
        }

        resolve({`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/utils/opencvFilters.ts', code);
