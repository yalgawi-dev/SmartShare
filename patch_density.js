const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// The original lines in hybrid_shadow:
// flatRgb.convertTo(punchyRgb, -1, 1.5, -50);
// cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 15);

f = f.replace(
    'flatRgb.convertTo(punchyRgb, -1, 1.5, -50);',
    'flatRgb.convertTo(punchyRgb, -1, 2.5, -150);'
);

f = f.replace(
    'cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 15);',
    'cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 8);'
);

fs.writeFileSync('src/utils/opencvFilters.ts', f);
console.log("Patched hybrid_shadow text density");

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.31/g, 'v19.32');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.89/g, 'v6.5.90');
fs.writeFileSync('src/app/page.tsx', page);
