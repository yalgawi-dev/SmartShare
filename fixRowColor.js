const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// Update row background color
c = c.replace(
  "'rgba(239, 68, 68, 0.05)'",
  "'rgba(239, 68, 68, 0.15)'"
);

// We should also make the name red
const oldName = `<span>{b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}</span>`;

const newName = `<span style={{ color: (b as any).status === 'pending' && (b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? '#ef4444' : 'inherit' }}>
        {b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
      </span>`;

c = c.replace(oldName, newName);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Made expired rows bolder red');
