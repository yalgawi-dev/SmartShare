const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const logicToAdd = `
        // --- EXPERIMENTAL ENGINE (Background Division) ---
        let finalExperimentalRgba = new cv.Mat();
        if (activeProfile === 'experimental' || forcedProfile === 'experimental') {
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
            if (timings) timings.bwMs = performance.now() - expT0;
        }

        // --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---`;

file = file.replace("// --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---", logicToAdd);

fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log("Fixed missing logic!");
