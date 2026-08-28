const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

content = content.replace(
    /body: JSON\.stringify\(\{\n\s*imageUrl: ocrPayload\n\s*\}\)/,
    'body: JSON.stringify({\n            imageUrl: ocrPayload,\n            vatRate: space?.settings?.defaultVatRate || 17\n          })'
);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf8');
