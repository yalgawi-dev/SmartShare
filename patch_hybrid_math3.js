const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const oldCodeRegex = /let punchyRgb = new cv\.Mat\(\);[\s\S]*?punchyRgb\.copyTo\(finalRgb, mask\);/;

const newCode = `let punchyRgb = new cv.Mat();
              flatRgb.convertTo(punchyRgb, -1, 1.2, -80); 
              
              let flatGray = new cv.Mat();
              cv.cvtColor(flatRgb, flatGray, cv.COLOR_RGB2GRAY);
              
              // Destroy amplified shadow noise speckles without blurring text edges
              cv.medianBlur(flatGray, flatGray, 3);
              
              let mask = new cv.Mat();
              // C=6 is very sensitive to catch all faint text, but safe from noise thanks to medianBlur
              cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 6);
              
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);`;

f = f.replace(oldCodeRegex, newCode);

fs.writeFileSync('src/utils/opencvFilters.ts', f);
console.log("Patched hybrid math 3");

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.34/g, 'v19.35');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.92/g, 'v6.5.93');
fs.writeFileSync('src/app/page.tsx', page);
