const fs = require('fs');
let lines = fs.readFileSync('src/utils/opencvFilters.ts', 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes('S.convertTo(S, -1, 1.25, 0);'));
if (idx > -1 && !lines[idx-1].includes('medianBlur')) {
    lines.splice(idx, 0, '        cv.medianBlur(S, S, 3); // Kills chroma noise (rainbow dots)');
}

fs.writeFileSync('src/utils/opencvFilters.ts', lines.join('\n'));
console.log('Patched S channel medianBlur');
