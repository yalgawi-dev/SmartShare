const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const regex = /const finalizeGuestJoin = \(spaceId: string, name: string, isRetroactive: boolean, shadowToken: string\) => \{[\s\S]*?\}\);\n  \};\r?\n/;

const replacement = `const finalizeGuestJoin = (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => {
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
        sharePercentage: customShare
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
    
    setTimeout(() => {
      autoBalanceShares(spaceId, shadowToken);
    }, 100);
  };\n`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("SpacesContext updated finalizeGuestJoin implementation");
} else {
  console.log("Failed to match finalizeGuestJoin implementation regex");
}
