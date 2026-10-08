const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
content = content.replace("overflow: 'hidden'", "overflow: 'visible'");
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
