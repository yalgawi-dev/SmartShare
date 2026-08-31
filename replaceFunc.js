const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const oldFuncStart = content.indexOf('const addGuestPartner =');
if (oldFuncStart !== -1) {
  // Find the end of the function block.
  // We can just find the start of the next function, e.g., updateMemberPermissions
  const nextFuncStart = content.indexOf('const updateMemberPermissions =', oldFuncStart);
  
  if (nextFuncStart !== -1) {
    const oldFuncBody = content.slice(oldFuncStart, nextFuncStart);
    const newFunc = `const finalizeGuestJoin = (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string) => {
    saveSpaceUpdate(spaceId, space => {
      // 1. Add the member
      const newMember = {
        userId: shadowToken,
        name,
        role: 'partner' as const,
        joinedAt: new Date().toISOString(),
        canUpload: true,
        canDelete: false,
        canEdit: false,
        status: 'active'
      };
      
      // 2. Process retroactive billing if needed
      let updatedInvoices = space.invoices || [];
      if (!isRetroactive) {
        updatedInvoices = updatedInvoices.map(inv => ({
          ...inv,
          excludedMembers: [...(inv.excludedMembers || []), shadowToken]
        }));
      }
      
      return {
        ...space,
        members: [...(space.members || []), newMember as any],
        invoices: updatedInvoices
      };
    });
  };\n\n  `;
    content = content.replace(oldFuncBody, newFunc);
    fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
    console.log("Successfully replaced function body");
  } else {
    console.log("Could not find next function start");
  }
} else {
  console.log("Could not find start");
}
