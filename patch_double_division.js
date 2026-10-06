const fs = require('fs');
const file = 'src/utils/opencvFilters.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `      const finalPts = scoredCandidates[0].pts.map(p => ({ x: Math.max(0, Math.min(canvas.width, p.x / tempScale)), y: Math.max(0, Math.min(canvas.height, p.y / tempScale)) })); return finalPts;`;
const replacement = `      const finalPts = scoredCandidates[0].pts.map(p => ({ x: Math.max(0, Math.min(canvas.width, p.x)), y: Math.max(0, Math.min(canvas.height, p.y)) })); return finalPts;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Fixed double division in detectDocument');
} else {
  console.log('Target not found!');
}
