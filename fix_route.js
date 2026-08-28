const fs = require('fs');
let content = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

content = content.replace(
    /- "amount": (.*?)\n/,
    '- "amount": $1\n        - "vatAmount": The VAT amount extracted as a number. If not written explicitly, calculate it from the total assuming 17% standard rate if it says includes VAT. If unsure, leave null.\n'
);

content = content.replace(
    /amount: \{ type: "NUMBER", (.*?) \},\n/,
    'amount: { type: "NUMBER", $1 },\n              vatAmount: { type: "NUMBER", description: "The VAT amount" },\n'
);

fs.writeFileSync('src/app/api/ocr/route.ts', content, 'utf8');
