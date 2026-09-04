const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const badRefresh = `  const refreshMemberInvite = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const member = space.members?.find(m => m.userId === userId);
      if (!member || member.status !== 'pending') return space;
      
      // Reset joinedAt to now, which resets the hourglass
      member.joinedAt = new Date().toISOString();
      
      return { members: space.members };
    });
  };`;

const goodRefresh = `  const refreshMemberInvite = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const updatedMembers = (space.members || []).map(m => {
        if (m.userId === userId && m.status === 'pending') {
          return { ...m, joinedAt: new Date().toISOString() };
        }
        return m;
      });
      return { ...space, members: updatedMembers };
    });
  };`;

c = c.replace(badRefresh, goodRefresh);
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed refreshMemberInvite space corruption bug');
