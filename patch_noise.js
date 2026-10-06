const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const oldBlock = `let expGray = new cv.Mat();
            cv.cvtColor(expRgb, expGray, cv.COLOR_RGB2GRAY, 0);
            
            // 1. Create background map with heavy blur
            let bgMap = new cv.Mat();
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8); 
            if (expK % 2 === 0) expK++;
            if (expK < 51) expK = 51;
            cv.GaussianBlur(expGray, bgMap, new cv.Size(expK, expK), 0, 0, cv.BORDER_DEFAULT);
            
            // 2. Convert background map to 3 channels so we can divide RGB by it
            let bgMapRgb = new cv.Mat();
            cv.cvtColor(bgMap, bgMapRgb, cv.COLOR_GRAY2RGB);`;

const newBlock = `// 1. Create a COLOR background map (Illumination Map)
            let bgMapRgb = new cv.Mat();
            let smallRgb = new cv.Mat();
            let scale = 0.2; // Downscale to 20% for lightning fast processing
            cv.resize(expRgb, smallRgb, new cv.Size(0,0), scale, scale, cv.INTER_AREA);
            
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8);
            let smallK = Math.floor(expK * scale);
            if (smallK % 2 === 0) smallK++;
            if (smallK < 15) smallK = 15;
            
            cv.GaussianBlur(smallRgb, smallRgb, new cv.Size(smallK, smallK), 0, 0, cv.BORDER_DEFAULT);
            // Upscale back to original size
            cv.resize(smallRgb, bgMapRgb, new cv.Size(expRgb.cols, expRgb.rows), 0, 0, cv.INTER_LINEAR);
            smallRgb.delete();`;

f = f.replace(oldBlock, newBlock);
f = f.replace('expGray.delete(); bgMap.delete(); ', '');

fs.writeFileSync('src/utils/opencvFilters.ts', f);
console.log('Fixed opencvFilters.ts');

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.2[0-9]/g, 'v19.26');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.[0-9]+/g, 'v6.5.84');
fs.writeFileSync('src/app/page.tsx', page);
