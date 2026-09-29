const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');
c = c.replace(/inv\.uploaderId/g, '(inv as any).uploaderId');
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
