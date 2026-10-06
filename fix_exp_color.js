const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const oldLogic = `let expGray = new cv.Mat();
            cv.cvtColor(dst, expGray, cv.COLOR_RGBA2GRAY, 0);
            
            // Create background map with heavy blur
            let bgMap = new cv.Mat();
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8); // Huge blur to completely erase text from the shadow map
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
            divided.convertTo(stretched, -1, 4.0, -760);
            
            cv.cvtColor(stretched, finalExperimentalRgba, cv.COLOR_GRAY2RGBA);
            
            expGray.delete(); bgMap.delete(); divided.delete(); stretched.delete();`;

const newLogic = `let expRgb = new cv.Mat();
            cv.cvtColor(dst, expRgb, cv.COLOR_RGBA2RGB, 0);
            
            let expGray = new cv.Mat();
            cv.cvtColor(expRgb, expGray, cv.COLOR_RGB2GRAY, 0);
            
            // 1. Create background map with heavy blur
            let bgMap = new cv.Mat();
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8); 
            if (expK % 2 === 0) expK++;
            if (expK < 51) expK = 51;
            cv.GaussianBlur(expGray, bgMap, new cv.Size(expK, expK), 0, 0, cv.BORDER_DEFAULT);
            
            // 2. Convert background map to 3 channels so we can divide RGB by it
            let bgMapRgb = new cv.Mat();
            cv.cvtColor(bgMap, bgMapRgb, cv.COLOR_GRAY2RGB);
            
            // 3. Divide RGB image by RGB background map to flatten lighting but keep colors!
            let dividedRgb = new cv.Mat();
            cv.divide(expRgb, bgMapRgb, dividedRgb, 255.0, -1);
            
            // 4. Mild contrast stretch to darken text and punch up colors, without destroying anti-aliasing
            let stretchedRgb = new cv.Mat();
            // alpha = 1.4, beta = -50
            // 250 -> 255 (white stays white)
            // 150 -> 160
            // 100 -> 90
            // 50 -> 20 (darker shadows)
            dividedRgb.convertTo(stretchedRgb, -1, 1.4, -50);
            
            cv.cvtColor(stretchedRgb, finalExperimentalRgba, cv.COLOR_RGB2RGBA);
            
            expRgb.delete(); expGray.delete(); bgMap.delete(); bgMapRgb.delete(); dividedRgb.delete(); stretchedRgb.delete();`;

file = file.replace(oldLogic, newLogic);
fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log("Updated experimental engine to TRUE COLOR DIVIDE!");
