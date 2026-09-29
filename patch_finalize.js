const fs = require('fs');
let file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update interface
content = content.replace(/finalizeGuestJoin: \(\n    spaceId: string, \n    name: string, \n    isRetroactive: boolean, \n    shadowToken: string, /g, 'finalizeGuestJoin: (\\n    spaceId: string, \\n    name: string, \\n    isRetroactive: boolean, \\n    userId: string, \\n    inviteToken?: string, ');

// Update function definition
content = content.replace(/const finalizeGuestJoin = \(\n    spaceId: string, \n    name: string, \n    isRetroactiveParam: boolean, \n    shadowToken: string, /g, 'const finalizeGuestJoin = (\\n    spaceId: string, \\n    name: string, \\n    isRetroactiveParam: boolean, \\n    userId: string, \\n    inviteToken?: string, ');

// Update pendingInvite search
content = content.replace('const pendingInvite = (space.pendingInvites || []).find(i => i.token === shadowToken);', 'const pendingInvite = inviteToken ? (space.pendingInvites || []).find(i => i.token === inviteToken) : undefined;');

// Replace shadowToken with userId in newMember creation
content = content.replace('const existingMember = (space.members || []).find(m => m.userId === shadowToken);', 'const existingMember = (space.members || []).find(m => m.userId === userId);');
content = content.replace('userId: shadowToken,', 'userId: userId,');

// Delete pendingInvite
content = content.replace('pendingInvites: (space.pendingInvites || []).filter(i => i.token !== shadowToken)', 'pendingInvites: (space.pendingInvites || []).filter(i => i.token !== inviteToken)');

fs.writeFileSync(file, content, 'utf8');

// Now update WelcomeGate
file = 'src/components/widgets/Partners/WelcomeGate.tsx';
content = fs.readFileSync(file, 'utf8');

content = content.replace(/finalizeGuestJoin\(\n      spaceId, \n      finalName, \n      isRetroParam, \n      user.id, \/\/ REAL USER ID\n      currentMember\?.sharePercentage \!== undefined \? currentMember.sharePercentage : \(shareParam \? Number\(shareParam\) : undefined\),\n      sharesPlan\n    \);/g,     const inviteTokenParams = params.get('invite');\n    finalizeGuestJoin(\n      spaceId, \n      finalName, \n      isRetroParam, \n      user.id, // REAL USER ID\n      inviteTokenParams || undefined,\n      currentMember?.sharePercentage !== undefined ? currentMember.sharePercentage : (shareParam ? Number(shareParam) : undefined),\n      sharesPlan\n    ););

fs.writeFileSync(file, content, 'utf8');
