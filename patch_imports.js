const fs = require('fs');
let lines = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8').split(/\r?\n/);
const firstLine = lines.shift(); // remove line 1
lines.splice(6, 0, firstLine); // insert at line 7
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', lines.join('\n'), 'utf8');
