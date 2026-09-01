const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/WelcomeGate.tsx', 'utf-8');

const target = "localStorage.setItem(`welcomed_${spaceId}_${inviteToken}`, 'true');";
const replacement = `localStorage.setItem(\`welcomed_\${spaceId}_\${inviteToken}\`, 'true');
    const storedTokens = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
    if (inviteToken && !storedTokens.includes(inviteToken)) {
      storedTokens.push(inviteToken);
      localStorage.setItem('smartshare_guest_tokens', JSON.stringify(storedTokens));
    }`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('src/components/widgets/WelcomeGate.tsx', c);
  console.log('Modified WelcomeGate');
} else {
  console.log('Target not found in WelcomeGate');
}
