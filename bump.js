const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/v5\.4\.57/g, 'v5.4.58');
fs.writeFileSync(file, content, 'utf8');
