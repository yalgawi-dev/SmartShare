const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf-8');

c = c.replace(
  `min="1" max="72"`,
  `min="0.01" max="72" step="0.01"`
);

fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', c);
console.log('Fixed expiration input to allow decimals (minutes)');
