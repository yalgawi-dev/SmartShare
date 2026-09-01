const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf-8');
c = c.replace(/display: 'flex', flexDirection: 'column', alignItems: 'flex-end', display: 'none'/g, "display: 'none', flexDirection: 'column', alignItems: 'flex-end'");
fs.writeFileSync('src/app/page.tsx', c);
