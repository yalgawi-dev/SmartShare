const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');
content = content.replace(/v4\.7\.\d+/g, 'v4.7.7');
fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log('Version bumped to v4.7.7');
