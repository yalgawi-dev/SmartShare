const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/v5\.4\.30/g, 'v5.4.31');
fs.writeFileSync(file, content, 'utf8');
console.log("Bumped to v5.4.31");
