const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

const regex = /<tr key=\{b\.name\} style=\{\{ borderBottom[^<]*<td style=\{\{ padding: '0\.75rem', fontWeight: b\.userId === myId \? 'bold' : 'normal' \}\}>[\s\S]*?<\/td>/;

const newRowStart = `<tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: (b as any).status === 'pending' && (b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? 'rgba(239, 68, 68, 0.05)' : b.userId === myId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1 }}>
                      <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>{b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}</span>
      {(b as any).status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
          {getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? (
            <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
              ❌ פג תוקף
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              ⏳ ממתין ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) : 'שעון פועל'})
            </span>
          )}
          {(b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' && (
            <button 
              onClick={() => removeMember(space.id, b.userId, user?.id || 'system')}
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              title="מחק הזמנה שפגה"
            >
              🗑️ הסר
            </button>
          )}
        </div>
      )}
    </div>
  </td>`;

c = c.replace(regex, newRowStart);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed FinanceSummary styling for expired');
