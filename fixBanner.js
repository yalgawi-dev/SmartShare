const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/PendingApprovalBanner.tsx', 'utf-8');

const targetStr = `  const currentMember = space.members?.find((m: any) => m.userId === currentToken);
  if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed')) return null;`;

const replacementStr = `  const currentMember = space.members?.find((m: any) => m.userId === currentToken);
  if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed')) return null;

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

c = c.replace(targetStr, replacementStr);

const renderTarget = `        <p style={{ margin: '0 0 1rem 0' }}>`;
const renderReplacement = `        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: '16px', display: 'inline-flex' }}>
          <span style={{ fontSize: '1.2rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold' }}>שים לב: ההזמנה תפוג בעוד {getRemainingTimeText(currentMember.joinedAt)}!</span>
        </div>
        <p style={{ margin: '0 0 1rem 0' }}>`;

c = c.replace(renderTarget, renderReplacement);

fs.writeFileSync('src/components/widgets/PendingApprovalBanner.tsx', c);
console.log('Added countdown to PendingApprovalBanner');
