const fs = require('fs');

const path = 'src/app/space/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

const target = `{/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Gamification / Wall of Fame */}`;

const replacement = `{/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <WelcomeGate spaceId={id} />
        <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />
        
        {/* Gamification / Wall of Fame */}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("WelcomeGate and PendingApprovalBanner restored");
} else {
  console.log("Failed to match target");
}
