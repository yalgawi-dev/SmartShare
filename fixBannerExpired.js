const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/PendingApprovalBanner.tsx', 'utf-8');

const regex = /<div style=\{\{ display: 'inline-flex'.*?<\/div>/s;

const newBubble = `{getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <span style={{ fontSize: '1.1rem' }}>❌</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>שים לב: ההזמנה שלך לשותפות פגה!</span>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#e0e7ff', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#3730a3', border: '1px solid #c7d2fe' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>שים לב: השותפות תפוג בעוד {getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1)}</span>
        </div>
      )}`;

c = c.replace(regex, newBubble);

fs.writeFileSync('src/components/widgets/Partners/PendingApprovalBanner.tsx', c);
console.log('Fixed PendingApprovalBanner text for expired');
