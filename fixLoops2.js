const fs = require('fs');
let c = fs.readFileSync('src/utils/opencvFilters.ts', 'utf-8');

c = c.replace(/for \(let i = 0; i < contours\.size\(\); \+\+i\) \{/g, 'let maxC = Math.min(contours.size(), 300); for (let i = 0; i < maxC; ++i) {');

fs.writeFileSync('src/utils/opencvFilters.ts', c);
console.log('Fixed loops!');
