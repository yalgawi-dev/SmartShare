const fs = require('fs');
const path = 'src/components/widgets/WelcomeGate.tsx';
let content = fs.readFileSync(path, 'utf-8');

const regex = /const isRetroParam = new URLSearchParams\(window\.location\.search\)\.get\('retro'\) === 'true';\s*finalizeGuestJoin\(spaceId, guestName\.trim\(\), isRetroParam, inviteToken\);/;

const replacement = `const urlParams = new URLSearchParams(window.location.search);
    const isRetroParam = urlParams.get('retro') === 'true';
    const shareParam = urlParams.get('share');
    
    finalizeGuestJoin(spaceId, guestName.trim(), isRetroParam, inviteToken, shareParam ? Number(shareParam) : undefined);`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("WelcomeGate updated with regex");
} else {
  console.log("Failed to match WelcomeGate regex");
}
