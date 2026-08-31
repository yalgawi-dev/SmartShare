const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/WelcomeGate.tsx', 'utf-8');

// Replace updateMemberPermissions with finalizeGuestJoin
const oldHandleStartRegex = /const handleStart = \(\) => \{[\s\S]*?setShowGate\(false\);\n  \};/;

const newHandleStart = `const handleStart = () => {
    if (!guestName.trim()) {
      alert('אנא הזן את שמך כדי להמשיך');
      return;
    }

    const isRetroParam = new URLSearchParams(window.location.search).get('retro') === 'true';
    finalizeGuestJoin(spaceId, guestName.trim(), isRetroParam, inviteToken);

    localStorage.setItem(\`welcomed_\${spaceId}_\${inviteToken}\`, 'true');
    setShowGate(false);
  };`;

content = content.replace(oldHandleStartRegex, newHandleStart);
content = content.replace('updateMemberPermissions', 'finalizeGuestJoin');

// Also fix the retro check because the guest isn't in members yet!
const oldRetroCheck = /const isRetroactive = space\?\.invoices\?\.some\(\(inv: any\) => \!\(inv\.excludedMembers \|\| \[\]\)\.includes\(inviteToken \|\| ''\)\);/;
const newRetroCheck = "const isRetroactive = new URLSearchParams(window.location.search).get('retro') === 'true';";
content = content.replace(oldRetroCheck, newRetroCheck);

// And fix needsName logic
const oldNeedsName = /const currentMember = space\?\.members\?\.find\(\(m: any\) => m\.userId === inviteToken\);\n  const needsName = currentMember && \(currentMember\.name === 'אורח\/ת' \|\| !currentMember\.name\);/;
const newNeedsName = "const currentMember = space?.members?.find((m: any) => m.userId === inviteToken);\n  const needsName = !currentMember;"; // If they don't exist yet, they need a name!
content = content.replace(oldNeedsName, newNeedsName);

fs.writeFileSync('src/components/widgets/WelcomeGate.tsx', content, 'utf-8');
console.log('WelcomeGate updated with Handshake logic');
