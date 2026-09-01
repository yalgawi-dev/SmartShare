const fs = require('fs');
const path = 'src/app/space/[id]/page.tsx';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const replacement = `      {/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <WelcomeGate spaceId={id} />
        <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />
        
        {/* Gamification / Wall of Fame */}
        <TopGuestsWidget space={space} />`.split('\n');

const start = lines.findIndex(l => l.includes('The Unified Wall'));
const end = lines.findIndex((l, i) => i > start && l.includes('TopGuestsWidget'));

lines.splice(start, end - start + 1, ...replacement);

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Restored WelcomeGate and PendingApprovalBanner');
