const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

// 1. Remove overflowX
content = content.replace(
  "<div style={{ overflowX: 'auto', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>",
  "<div style={{ background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>"
);

// 2. Make table header sticky
content = content.replace(
  "<tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right' }}>",
  "<tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right', position: 'sticky', top: '128px', zIndex: 30 }}>"
);

// 3. Fix the gap under Total Row by replacing margin with padding
content = content.replace(
  "marginBottom: '1rem', margin: '0 -0.5rem 1rem -0.5rem'",
  "paddingBottom: '1rem', margin: '0 -0.5rem 0 -0.5rem'"
);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', content);
