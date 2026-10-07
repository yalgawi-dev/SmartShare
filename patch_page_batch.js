const fs = require('fs');
let content = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

content = content.replace(
  "if (routingType === 'receipt' || !routingType) {",
  "if (routingType === 'receipt_batch' && allPages && allPages.length > 1) {\n                    financeRef.current?.processBatch(allPages);\n                } else if (routingType === 'receipt' || !routingType) {"
);

fs.writeFileSync('src/app/space/[id]/page.tsx', content);
