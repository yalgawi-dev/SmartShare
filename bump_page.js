const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf8');
c = c.replace(/v4\.5\.11 - [^<]*/, 'v4.5.12 - ' + Buffer.from('16rXmden15XXnyDXlNeq15fXkdeo15XXqiDXkteV15LXnCDXnNee15XXkdeZ15nXnA==', 'base64').toString('utf8') + ' (PWA)');
fs.writeFileSync('src/app/page.tsx', c, 'utf8');
