const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

content = content.replace(
    /body: JSON\.stringify\(\{ imageUrl: ocrPayload \}\)/,
    'body: JSON.stringify({ imageUrl: ocrPayload, vatRate: space?.settings?.defaultVatRate || 17 })'
);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf8');
