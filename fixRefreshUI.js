const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

if (!c.includes('refreshMemberInvite')) {
  c = c.replace(
    "const { updateSpaceSettings, removeMember } = useSpaces() as any;",
    "const { updateSpaceSettings, removeMember, refreshMemberInvite } = useSpaces() as any;"
  );
}

const searchBlock = `          {(b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' && (
            <button 
              onClick={() => removeMember(space.id, b.userId, user?.id || 'system')}
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              title="מחק הזמנה שפגה"
            >
              🗑️ הסר
            </button>
          )}`;

const replacementBlock = `          {(b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button 
                onClick={() => removeMember(space.id, b.userId, user?.id || 'system')}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="מחק הזמנה שפגה"
              >
                🗑️ הסר
              </button>
              <button 
                onClick={() => refreshMemberInvite(space.id, b.userId)}
                style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="שלח בקשה חוזרת וחדש את השעון"
              >
                🔄 חדש
              </button>
            </div>
          )}`;

c = c.replace(searchBlock, replacementBlock);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Added refresh button to FinanceSummary');
