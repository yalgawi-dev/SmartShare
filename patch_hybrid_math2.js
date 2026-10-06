const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// The code we are replacing:
const oldCodeRegex = /let punchyRgb = new cv\.Mat\(\);[\s\S]*?punchyRgb\.copyTo\(finalRgb, mask\);/;

const newCode = `let punchyRgb = new cv.Mat();
              // Darken the ink uniformly so faint text doesn't turn white
              flatRgb.convertTo(punchyRgb, -1, 1.2, -80); 
              
              let flatGray = new cv.Mat();
              cv.cvtColor(flatRgb, flatGray, cv.COLOR_RGB2GRAY);
              
              let mask = new cv.Mat();
              // C=4 is highly sensitive, catching faint lines and filling holes
              cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 4);
              
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);`;

f = f.replace(oldCodeRegex, newCode);

// Fix cleanup: replace punchyGray with flatGray
f = f.replace('punchyGray.delete();', 'flatGray.delete();');

fs.writeFileSync('src/utils/opencvFilters.ts', f);
console.log("Patched hybrid math 2");

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.33/g, 'v19.34');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.91/g, 'v6.5.92');
fs.writeFileSync('src/app/page.tsx', page);
