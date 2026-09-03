const fs = require('fs');
let lines = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8').split('\n');

// Add import back if missing
if (!lines.some(l => l.includes("import PendingApprovalBanner"))) {
  const importIdx = lines.findIndex(l => l.includes("import TopGuestsWidget"));
  lines.splice(importIdx, 0, "import PendingApprovalBanner from '../../../components/widgets/PendingApprovalBanner';");
}

// Now remove the FIRST rendered banner (the one near className={styles.container})
let c = lines.join('\n');
const marker = `<div className={styles.container} style={{ maxWidth: '1200px' }}>\n              <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />`;
c = c.replace(marker, `<div className={styles.container} style={{ maxWidth: '1200px' }}>`);

fs.writeFileSync('src/app/space/[id]/page.tsx', c);
console.log('Fixed duplicate banner correctly');
