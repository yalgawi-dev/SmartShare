const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/NotificationCenterWidget.tsx', 'utf8');
txt = txt.replace(
  "if (n.type === 'invoice') query = '?tab=inbox';",
  "if (n.type === 'invoice') query = '?tab=inbox#invoice-' + n.id.replace('inv-', '');"
);
fs.writeFileSync('src/components/widgets/NotificationCenterWidget.tsx', txt);
console.log('Replaced query invoice');
