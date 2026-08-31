const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const targetMethod = /addGuestPartner: \([\s\S]*?\} \}\);\n  \};\n/;
const newMethod = `finalizeGuestJoin: (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string) => {
    saveSpaceUpdate(spaceId, space => {
      const newMember = {
        userId: shadowToken,
        name,
        role: 'partner' as const,
        joinedAt: new Date().toISOString()
      };
      
      let updatedInvoices = space.invoices || [];
      if (!isRetroactive) {
        updatedInvoices = updatedInvoices.map(inv => ({
          ...inv,
          excludedMembers: [...(inv.excludedMembers || []), shadowToken]
        }));
      }
      
      return {
        ...space,
        members: [...(space.members || []), newMember],
        invoices: updatedInvoices
      };
    });
  };\n`;

if (content.match(targetMethod)) {
  content = content.replace(targetMethod, newMethod);
} else {
  console.log("Could not find addGuestPartner function implementation");
}

const targetType = /addGuestPartner: \(spaceId: string, name: string, isRetroactive: boolean, shadowToken: string\) => void;/;
if (content.match(targetType)) {
  content = content.replace(targetType, 'finalizeGuestJoin: (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string) => void;');
} else {
  console.log("Could not find addGuestPartner in Context type");
}

content = content.replace(/addGuestPartner,/g, 'finalizeGuestJoin,');

fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
console.log('SpacesContext updated for Handshake Logic');
