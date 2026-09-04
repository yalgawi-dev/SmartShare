const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// The line we want to replace is:
// <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
//   {b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
// </td>

// Let's replace the whole block dynamically using a regex
c = c.replace(/<td style={{ padding: '0\.75rem', fontWeight: b\.userId === myId \? 'bold' : 'normal' }}>\s*{b\.name} {isInactive && <span[^>]+>\([^)]+\)<\/span>}\s*<\/td>/,
  `<td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>{b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}</span>
      {(b as any).status === 'pending' && (
        <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          ⏳ ממתין לאישור ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) : 'שעון פועל'})
        </span>
      )}
    </div>
  </td>`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed FinanceSummary hourglass replace');
