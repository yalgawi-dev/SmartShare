const fs = require('fs');
let file = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

file = file.replace(/if \(timings\) timings\.bwMs = performance\.now\(\) - expT0;/g, "t_engine = performance.now() - expT0;");

fs.writeFileSync('src/utils/opencvFilters.ts', file);
console.log("Fixed timings bug!");
