const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
content = content.replace("uploadedBy: user?.displayName || 'משתמש'", "uploadedBy: user?.realName || 'משתמש'");
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
