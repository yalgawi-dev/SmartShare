const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// 1. Add removeMember to destructured useSpaces
if (!c.includes('removeMember')) {
  c = c.replace('const { updateSpaceSettings } = useSpaces();', 'const { updateSpaceSettings, removeMember } = useSpaces() as any;');
}

// 2. Add the delete button next to expired
const searchBlock = `<span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          ⏳ ממתין לאישור ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) : 'שעון פועל'})
        </span>`;

const replacementBlock = `
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            ⏳ ממתין ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) : 'שעון פועל'})
          </span>
          {(b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' && (
            <button 
              onClick={() => removeMember(space.id, b.userId, user?.id || 'system')}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: '0.1rem' }}
              title="מחק הזמנה שפגה"
            >
              🗑️
            </button>
          )}
        </div>
`;

c = c.replace(searchBlock, replacementBlock);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Added trash button to expired partners');
