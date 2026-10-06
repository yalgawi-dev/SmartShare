const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

file = file.replace(/finalUrl = compressCanvas\(canvas, 1\.0\);/g, 'finalUrl = compressCanvas(canvas, 0.85);');

fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log('opencvFilters updated!');
