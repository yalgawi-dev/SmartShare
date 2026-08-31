const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const joinSpaceFunc = `const joinSpace = (spaceId: string, userId: string, name: string) => {
    saveSpaceUpdate(spaceId, space => {
      if (space.members?.some(m => m.userId === userId)) return space; 
      return {
        ...space,
        members: [...(space.members || []), {
          userId,
          name,
          canUpload: true,
          canDelete: false,
          canEdit: false,
          isActive: true
        } as any]
      };
    });
  };

  const finalizeGuestJoin`;

content = content.replace("const finalizeGuestJoin", joinSpaceFunc);
fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
console.log('Restored joinSpace');
