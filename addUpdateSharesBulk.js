const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const updateSharesBulkFunc = `
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

const insertPoint = `const updateMemberPermissions = (spaceId: string, userId: string, permissions: any) => {`;
if (content.includes(insertPoint)) {
  content = content.replace(insertPoint, updateSharesBulkFunc + '\n  ' + insertPoint);
}

const contextValTarget = `updateMemberPermissions,`;
if (content.includes(contextValTarget)) {
  content = content.replace(contextValTarget, `updateMemberPermissions, updateSharesBulk,`);
}

const typeTarget = `updateMemberPermissions: (spaceId: string, userId: string, permissions: any) => void;`;
if (content.includes(typeTarget)) {
  content = content.replace(typeTarget, `updateMemberPermissions: (spaceId: string, userId: string, permissions: any) => void;\n  updateSharesBulk: (spaceId: string, myShare: number, partnerShares: Record<string, number>) => void;`);
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Added updateSharesBulk to SpacesContext');
