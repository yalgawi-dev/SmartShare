const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

code = code.replace(/v6\.5\.19/g, 'v6.5.65');

fs.writeFileSync('src/app/page.tsx', code);
console.log("Bumped global version in page.tsx!");
