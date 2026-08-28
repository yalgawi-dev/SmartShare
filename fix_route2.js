const fs = require('fs');
let content = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

// Replace the line fetching base64Data to also fetch vatRate
content = content.replace(
    /const \{ imageUrl \} = await req\.json\(\);/,
    'const { imageUrl, vatRate = 17 } = await req.json();'
);

// Update the prompt to dynamically use the vatRate
content = content.replace(
    /assuming 17% standard rate/,
    'assuming  + vatRate + % standard rate'
);

fs.writeFileSync('src/app/api/ocr/route.ts', content, 'utf8');
