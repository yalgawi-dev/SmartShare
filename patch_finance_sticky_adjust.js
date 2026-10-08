const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

// 1. Adjust top offset of the total row
content = content.replace(
  "top: '70px'",
  "top: '73px'"
);

// 2. Remove sticky from table header to fix the overflow-x issue
content = content.replace(
  "<tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right', position: 'sticky', top: '125px', zIndex: 30 }}>",
  "<tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right' }}>"
);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', content);
