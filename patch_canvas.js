const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const oldCanvasOutput = `} else if (activeProfile === 'experimental') {
          cv.imshow(canvas, finalExperimentalRgba);
          finalUrl = compressCanvas(canvas, 0.85);`;

const newCanvasOutput = `} else if (activeProfile === 'hybrid_shadow') {
          cv.imshow(canvas, finalHybridShadowRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'experimental') {
          cv.imshow(canvas, finalExperimentalRgba);
          finalUrl = compressCanvas(canvas, 0.85);`;

if (!f.includes("activeProfile === 'hybrid_shadow'")) {
    f = f.replace(oldCanvasOutput, newCanvasOutput);
    fs.writeFileSync('src/utils/opencvFilters.ts', f);
    console.log("Patched canvas output");
} else if (f.includes("activeProfile === 'hybrid_shadow'") && f.includes(oldCanvasOutput)) {
    // it was already patched? let's make sure.
    // wait, we injected `if (activeProfile === 'hybrid_shadow' || forcedProfile === 'hybrid_shadow') {` so it WILL include it!
    // But we need to check if the `else if (activeProfile === 'hybrid_shadow') {` block exists near imshow
    if (!f.includes("cv.imshow(canvas, finalHybridShadowRgba);")) {
        f = f.replace(oldCanvasOutput, newCanvasOutput);
        fs.writeFileSync('src/utils/opencvFilters.ts', f);
        console.log("Patched canvas output for real");
    }
}

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.30/g, 'v19.31');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.88/g, 'v6.5.89');
fs.writeFileSync('src/app/page.tsx', page);
console.log('Bumped v31');
