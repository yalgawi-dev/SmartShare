const fs = require('fs');
let c = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8');

const marker = `<div className={styles.container} style={{ maxWidth: '1200px' }}>
              <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />`;

c = c.replace(marker, `<div className={styles.container} style={{ maxWidth: '1200px' }}>`);

fs.writeFileSync('src/app/space/[id]/page.tsx', c);
console.log('Removed duplicate banner');
