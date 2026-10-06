const fs = require('fs');
let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const targetStr = "} else if (activeProfile === 'experimental') {";
const replacerStr = `} else if (activeProfile === 'hybrid_shadow') {
          cv.imshow(canvas, finalHybridShadowRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'experimental') {`;

if (!f.includes('cv.imshow(canvas, finalHybridShadowRgba);')) {
    f = f.replace(targetStr, replacerStr);
    fs.writeFileSync('src/utils/opencvFilters.ts', f);
    console.log("Patched canvas");
} else {
    console.log("Already patched canvas");
}
