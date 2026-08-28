const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Add scaleRatio calculation
let oldMaxWidth = `        const maxWidth = Math.round(Math.max(widthA, widthB));
  
        const heightA = Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
        const heightB = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
        const maxHeight = Math.round(Math.max(heightA, heightB));`;

let newMaxWidth = `        let maxWidth = Math.round(Math.max(widthA, widthB));
  
        const heightA = Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
        const heightB = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
        let maxHeight = Math.round(Math.max(heightA, heightB));
        
        let scaleRatio = 1.0;
        const MAX_PROCESSING_WIDTH = 2200;
        if (maxWidth > MAX_PROCESSING_WIDTH) {
            scaleRatio = MAX_PROCESSING_WIDTH / maxWidth;
            maxWidth = MAX_PROCESSING_WIDTH;
            maxHeight = Math.round(maxHeight * scaleRatio);
        }
        
        // Helper to scale a kernel size and ensure it's odd
        const getK = (size) => {
            let s = Math.round(size * scaleRatio);
            if (s % 2 === 0) s += 1;
            return Math.max(3, s);
        };`;

code = code.replace(oldMaxWidth, newMaxWidth);

// 2. Replace static kernel sizes with dynamic scaled sizes

code = code.replace(/new cv\.Size\(21, 21\)/g, `new cv.Size(getK(21), getK(21))`);
code = code.replace(/new cv\.Size\(5, 5\)/g, `new cv.Size(getK(5), getK(5))`);
code = code.replace(/, 61, 15/g, `, getK(61), 15`);
code = code.replace(/new cv\.Size\(15, 15\)/g, `new cv.Size(getK(15), getK(15))`);
code = code.replace(/new cv\.Size\(31, 31\)/g, `new cv.Size(getK(31), getK(31))`);
code = code.replace(/new cv\.Size\(9, 9\)/g, `new cv.Size(getK(9), getK(9))`);
code = code.replace(/new cv\.Size\(3, 3\)/g, `new cv.Size(getK(3), getK(3))`);

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Done");
