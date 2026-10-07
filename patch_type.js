const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
content = content.replace(
  "routingType?: 'receipt' | 'document' | 'image') => void;",
  "routingType?: 'receipt' | 'document' | 'image' | 'receipt_batch') => void;"
);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
