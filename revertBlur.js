const fs = require('fs');
let lines = fs.readFileSync('src/utils/opencvFilters.ts', 'utf-8').split('\n');
lines = lines.filter(l => !l.includes('cv.medianBlur(S, S, 3)') && !l.includes('cv.medianBlur(mask, mask, 3)') && !l.includes('Remove 1-pixel salt'));
fs.writeFileSync('src/utils/opencvFilters.ts', lines.join('\n'));
console.log('Reverted');
