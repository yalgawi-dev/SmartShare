const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// Replace the text generation and mask generation block in hybrid_shadow
const oldCodeRegex = /let punchyRgb = new cv\.Mat\(\);[\s\S]*?punchyRgb\.copyTo\(finalRgb, mask\);/;

const newCode = `let punchyRgb = new cv.Mat();
              flatRgb.convertTo(punchyRgb, -1, 3.5, -500); 
              
              let punchyGray = new cv.Mat();
              cv.cvtColor(punchyRgb, punchyGray, cv.COLOR_RGB2GRAY);
              
              let mask = new cv.Mat();
              cv.adaptiveThreshold(punchyGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 15);
              
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);`;

f = f.replace(oldCodeRegex, newCode);

// Fix cleanup: flatGray is now punchyGray
f = f.replace('flatRgb.delete(); punchyRgb.delete(); flatGray.delete();', 'flatRgb.delete(); punchyRgb.delete(); punchyGray.delete();');

fs.writeFileSync('src/utils/opencvFilters.ts', f);
console.log("Patched hybrid math");

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.32/g, 'v19.33');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.90/g, 'v6.5.91');
fs.writeFileSync('src/app/page.tsx', page);
