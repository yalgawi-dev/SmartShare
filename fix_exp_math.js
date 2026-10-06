const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const oldLogic = `let expK = Math.floor(Math.max(dst.cols, dst.rows) / 20);
            if (expK % 2 === 0) expK++;
            if (expK < 31) expK = 31;
            cv.GaussianBlur(expGray, bgMap, new cv.Size(expK, expK), 0, 0, cv.BORDER_DEFAULT);
            
            // Divide image by background map to flatten lighting perfectly!
            // formula: (gray / bgMap) * 255
            let divided = new cv.Mat();
            cv.divide(expGray, bgMap, divided, 255.0, -1);
            
            // Minor contrast stretch to blacken text without hard thresholding
            let stretched = new cv.Mat();
            divided.convertTo(stretched, -1, 1.6, -70);`;

const newLogic = `let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8); // Huge blur to completely erase text from the shadow map
            if (expK % 2 === 0) expK++;
            if (expK < 51) expK = 51;
            cv.GaussianBlur(expGray, bgMap, new cv.Size(expK, expK), 0, 0, cv.BORDER_DEFAULT);
            
            // Divide image by background map to flatten lighting perfectly!
            // formula: (gray / bgMap) * 255
            let divided = new cv.Mat();
            cv.divide(expGray, bgMap, divided, 255.0, -1);
            
            // Aggressive contrast stretch to blacken text without hard thresholding (Preserves Anti-Aliasing)
            // Maps ~190 to 0 (Black) and 255 to 255 (White)
            let stretched = new cv.Mat();
            divided.convertTo(stretched, -1, 4.0, -760);`;

file = file.replace(oldLogic, newLogic);
fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log("Fixed experimental math!");
