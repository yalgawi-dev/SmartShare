const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const func = `
  const updateSharesBulk = (spaceId: string, myShare: number, partnerShares: Record<string, number>) => {
    saveSpaceUpdate(spaceId, space => {
      const newMembers = (space.members || []).map(m => {
        if (partnerShares[m.userId] !== undefined) {
          return { ...m, sharePercentage: partnerShares[m.userId], isCustomShare: true };
        }
        return m;
      });
      return {
        ...space,
        members: newMembers,
        settings: { ...space.settings, mySharePercentage: myShare, isCustomShare: true }
      };
    });
  };
`;

const insertIndex = c.indexOf('const updateMemberPermissions =');
c = c.substring(0, insertIndex) + func + c.substring(insertIndex);
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Inserted updateSharesBulk');
