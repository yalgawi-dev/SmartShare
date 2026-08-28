const fs = require('fs');
let content = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

content = content.replace(
    /assuming  \+ vatRate \+ % standard rate/,
    'assuming % standard rate'
);

fs.writeFileSync('src/app/api/ocr/route.ts', content, 'utf8');
