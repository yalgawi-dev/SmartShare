const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

code = code.replace(/compressCanvas\(canvas\)/g, 'compressCanvas(canvas, 1.0)');

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Patched opencvFilters compression!");
