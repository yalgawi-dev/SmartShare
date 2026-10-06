const fs = require('fs');
let imgOpt = fs.readFileSync('src/utils/imageOptimizer.ts', 'utf8');

// Revert the final merge compression to 0.82 to respect the 200KB-300KB limit
imgOpt = imgOpt.replace(/compressCanvas\(canvas, 0\.90\);/g, `compressCanvas(canvas, 0.82);`);
fs.writeFileSync('src/utils/imageOptimizer.ts', imgOpt);
console.log("Restored final compression to 0.82!");
