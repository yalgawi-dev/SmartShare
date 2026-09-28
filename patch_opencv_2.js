const fs = require('fs');
const file = 'src/utils/opencvFilters.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Increase Live Preview Resolution
content = content.replace(
  `const TARGET_W = isLivePreview ? 250 : 500;`,
  `const TARGET_W = isLivePreview ? 400 : 800; // Increased resolution to capture outer document edges`
);

// 2. Adjust epsilon in findBestContour to 0.04 (was 0.03) for better polygon approximation
content = content.replace(
  `epsilon = 0.03`,
  `epsilon = 0.04`
);
content = content.replace(
  `epsilon * peri`,
  `0.04 * peri` // ensure it uses 0.04
);

// 3. Increase Morphology Kernel to bridge gaps in paper edges (Canny breaks)
content = content.replace(
  `const M = cv.Mat.ones(3, 3, cv.CV_8U);`,
  `const M = cv.Mat.ones(9, 9, cv.CV_8U); // Larger kernel to close broken paper edges`
);

// 4. Also use RETR_EXTERNAL to prioritize outer boundaries over inner tables!
content = content.replace(
  `cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);`,
  `cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);`
);
content = content.replace(
  `cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);`,
  `cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);`
);


// 5. In the detectDocument block, make sure it passes 0.04
content = content.replace(
  `return findBestContour(cv, contours, src.rows * src.cols, scale, 0.03);`,
  `return findBestContour(cv, contours, src.rows * src.cols, scale, 0.04);`
);
// replace multiple occurrences if they exist
content = content.split(`return findBestContour(cv, contours, src.rows * src.cols, scale, 0.03);`).join(`return findBestContour(cv, contours, src.rows * src.cols, scale, 0.04);`);


fs.writeFileSync(file, content, 'utf8');
console.log('Patched opencvFilters.ts for better contour detection');
