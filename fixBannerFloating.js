const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/PendingApprovalBanner.tsx', 'utf-8');

const banner = `      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#e0e7ff', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#3730a3', border: '1px solid #c7d2fe' }}>
        <span style={{ fontSize: '1.1rem' }}>⏳</span>
        <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>שים לב: השותפות תפוג בעוד {getRemainingTimeText(currentMember.joinedAt)}</span>
      </div>\n      <h3`;

c = c.replace(/<h3/g, banner);

fs.writeFileSync('src/components/widgets/PendingApprovalBanner.tsx', c);
console.log('Added floating banner successfully');
