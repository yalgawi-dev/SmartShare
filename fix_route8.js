const fs = require('fs');
let content = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

const regex = /- "vatAmount"[\s\S]*?leave null\./;
const replacement = '- "vatAmount": The VAT amount extracted as a number. If not written explicitly, calculate it from the total assuming % standard rate if it says includes VAT. If unsure, leave null.';

content = content.replace(regex, replacement);
fs.writeFileSync('src/app/api/ocr/route.ts', content, 'utf8');
