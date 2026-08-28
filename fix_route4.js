const fs = require('fs');
let content = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

content = content.replace(
    /assuming % standard rate/,
    'assuming \% standard rate'
);

// also let's make sure the var is extracted:
if (!content.includes('const { imageUrl, vatRate = 17 }')) {
    content = content.replace(
        /const \{ imageUrl \} = await req\.json\(\);/,
        'const { imageUrl, vatRate = 17 } = await req.json();'
    );
}

fs.writeFileSync('src/app/api/ocr/route.ts', content, 'utf8');
