const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

// Add to interface
c = c.replace(
  "removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;",
  "refreshMemberInvite: (spaceId: string, userId: string) => void;\n  removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;"
);

// Add implementation
const refreshImpl = `
  const refreshMemberInvite = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const member = space.members?.find(m => m.userId === userId);
      if (!member || member.status !== 'pending') return space;
      
      // Reset joinedAt to now, which resets the hourglass
      member.joinedAt = new Date().toISOString();
      
      return { members: space.members };
    });
  };

  const removeMember =`;

c = c.replace("  const removeMember =", refreshImpl);

// Add to provider
c = c.replace(
  "removeMember,\n    restoreMember,",
  "refreshMemberInvite,\n    removeMember,\n    restoreMember,"
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Added refreshMemberInvite to SpacesContext');
