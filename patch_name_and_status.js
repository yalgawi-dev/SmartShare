const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
content = content.replace("uploadedBy: user?.name || 'משתמש',", "uploadedBy: user?.realName || 'משתמש',");
content = content.replace("status: 'processing',", "status: 'processing' as const,");
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
