const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const startMarker = `        if (activeProfile === 'smart_color') {`;
const endMarker = `        if (activeProfile === 'smart_plus') {`;

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex > -1 && endIndex > -1) {
    const before = code.substring(0, startIndex);
    const after = code.substring(endIndex);
    code = before + after;
}

code = code.replace(/ \\| 'smart_color'/g, "");

// also remove from the render block
code = code.replace(/        } else if \\(activeProfile === 'smart_color'\\) \\{\\s*cv.imshow\\(canvas, finalSmartRgba\\);\\s*finalUrl = compressCanvas\\(canvas, 0\\.90\\);/g, "");

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Done");
