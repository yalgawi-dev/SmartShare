const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const regex = /finalizeGuestJoin: \(spaceId: string, name: string, isRetroactive: boolean, shadowToken: string\) => \{[\s\S]*?\}\);\s*\};\r?\n/;

const replacement = `finalizeGuestJoin: (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => {
    saveSpaceUpdate(spaceId, space => {
      const newMember = {
        userId: shadowToken,
        name,
        role: 'partner' as const,
        joinedAt: new Date().toISOString(),
        isActive: true,
        canUpload: true,
        canEdit: false,
        canDelete: false,
        status: 'pending' as const,
        sharePercentage: customShare // Apply custom share if provided
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
    
    // Auto balance shares after joining (especially important if they joined with a custom share!)
    setTimeout(() => {
      autoBalanceShares(spaceId, shadowToken);
    }, 100);
  };\n`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
} else {
  console.log("Failed to match finalizeGuestJoin implementation");
}

// Update the interface
const typeRegex = /finalizeGuestJoin: \(spaceId: string, name: string, isRetroactive: boolean, shadowToken: string\) => void;/;
if (content.match(typeRegex)) {
  content = content.replace(typeRegex, 'finalizeGuestJoin: (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => void;');
} else {
  console.log("Failed to match finalizeGuestJoin type");
}

fs.writeFileSync(path, content, 'utf-8');
console.log('SpacesContext updated finalizeGuestJoin');
