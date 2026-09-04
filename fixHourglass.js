const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(
  `unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false });`,
  `unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false, status: m.status, joinedAt: m.joinedAt });`
);

// Also add a helper to calculate time remaining
const helperString = `  const activePartnersCount = space.members?.filter((m: any) => m.status === 'active').length || 0;`;
const helperReplacement = `  const activePartnersCount = space.members?.filter((m: any) => m.status === 'active').length || 0;
  
  const getRemainingTimeText = (joinedAt: string) => {
    if (!joinedAt) return '';
    const expHours = space.settings?.pendingExpirationHours || 1;
    const expiresMs = new Date(joinedAt).getTime() + (expHours * 3600000);
    const diffMs = expiresMs - Date.now();
    if (diffMs <= 0) return 'פג תוקף';
    const minutesLeft = Math.floor(diffMs / 60000);
    if (minutesLeft < 60) return \`נותרו \${minutesLeft} דק'\`;
    const hoursLeft = Math.floor(minutesLeft / 60);
    const minsRound = minutesLeft % 60;
    return \`נותרו \${hoursLeft} ש' \${minsRound > 0 ? 'ו-'+minsRound+' דק\\'' : ''}\`;
  };`;

c = c.replace(helperString, helperReplacement);

// Render the hourglass next to the name
const tdString = `                      <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
                        {b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
                      </td>`;

const tdReplacement = `                      <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}</span>
                          {(b as any).status === 'pending' && (
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              ⏳ ממתין לאישור ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt) : 'שעון פועל'})
                            </span>
                          )}
                        </div>
                      </td>`;

c = c.replace(tdString, tdReplacement);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Added hourglass to FinanceSummary');
