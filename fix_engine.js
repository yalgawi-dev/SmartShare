const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Add experimental to signature
file = file.replace(
    /forcedProfile: 'auto' \| 'text' \| 'photo' \| 'mixed' \| 'bw' \| 'pure_color' \| 'smart_plus' \| 'hybrid' \| 'original' = 'auto'/g, 
    "forcedProfile: 'auto' | 'text' | 'photo' | 'mixed' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' = 'auto'"
);

// 2. Add the logic block right before the final `imshow` section
const targetString = "        // ==========================================";
const logicToAdd = `
        // --- EXPERIMENTAL ENGINE (Background Division) ---
        let finalExperimentalRgba = new cv.Mat();
        if (activeProfile === 'experimental') {
            const expT0 = performance.now();
            let expGray = new cv.Mat();
            cv.cvtColor(dst, expGray, cv.COLOR_RGBA2GRAY, 0);
            
            // Create background map with heavy blur
            let bgMap = new cv.Mat();
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 20);
            if (expK % 2 === 0) expK++;
            if (expK < 31) expK = 31;
            cv.GaussianBlur(expGray, bgMap, new cv.Size(expK, expK), 0, 0, cv.BORDER_DEFAULT);
            
            // Divide image by background map to flatten lighting perfectly!
            // formula: (gray / bgMap) * 255
            let divided = new cv.Mat();
            cv.divide(expGray, bgMap, divided, 255.0, -1);
            
            // Minor contrast stretch to blacken text without hard thresholding
            let stretched = new cv.Mat();
            divided.convertTo(stretched, -1, 1.6, -70);
            
            cv.cvtColor(stretched, finalExperimentalRgba, cv.COLOR_GRAY2RGBA);
            
            expGray.delete(); bgMap.delete(); divided.delete(); stretched.delete();
            timings.bwMs = performance.now() - expT0;
        }

`;
file = file.replace(targetString, logicToAdd + targetString);

// 3. Add to the activeProfile if-else block
const outputTarget = "} else if (activeProfile === 'smart_plus') {";
const outputToAdd = `} else if (activeProfile === 'experimental') {
          cv.imshow(canvas, finalExperimentalRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        `;
file = file.replace(outputTarget, outputToAdd + outputTarget);

// 4. Memory cleanup
const cleanupTarget = "if (typeof finalSmartPlusRgba !== 'undefined') finalSmartPlusRgba.delete();";
const cleanupToAdd = "if (typeof finalExperimentalRgba !== 'undefined' && !finalExperimentalRgba.isDeleted()) finalExperimentalRgba.delete();\n        ";
file = file.replace(cleanupTarget, cleanupToAdd + cleanupTarget);

fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log("opencvFilters updated with experimental engine!");
