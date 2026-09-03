const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf-8');

c = c.replace(
  'לא נמצאו חשבוניות. לחץ על ה-➕ כדי להוסיף.',
  "{filter === 'pending_me' ? 'אין חשבוניות שממתינות לאישור שלך.' : filter === 'pending_partners' ? 'אין חשבוניות שממתינות לאישור השותפים.' : 'לא נמצאו חשבוניות.'}"
);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', c);
console.log('Fixed text');
