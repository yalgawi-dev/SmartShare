const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Rewrite autoBalanceShares
const autoBalTarget = /const autoBalanceShares = \(spaceId: string, performedBy: string\) => \{[\s\S]*?\}\);\n  \};\r?\n/;
const autoBalReplacement = `const autoBalanceShares = (spaceId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const { finalMembers, finalCreatorShare, defaultShare } = calculateBalancedShares(space.members || [], space.settings);

      const newLog: AuditRecord = {
        id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        timestamp: new Date().toISOString(),
        actionType: 'AUTO_BALANCE',
        performedBy,
        details: \`המערכת חילקה את האחוזים הנותרים שווה בשווה (\${defaultShare.toFixed(1)}% לכל חלק).\`
      };

      return {
        ...space,
        settings: { ...space.settings, mySharePercentage: finalCreatorShare },
        members: finalMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };\n`;

if (content.match(autoBalTarget)) {
  content = content.replace(autoBalTarget, autoBalReplacement);
  console.log('Replaced autoBalanceShares');
}

// Rewrite finalizeGuestJoin to be atomic and set isCustomShare
const finalizeTarget = /const finalizeGuestJoin = \(spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare\?: number\) => \{[\s\S]*?\}\);\n    \n    setTimeout\(\(\) => \{\n      autoBalanceShares\(spaceId, shadowToken\);\n    \}, 100\);\n  \};\r?\n/;
const finalizeReplacement = `const finalizeGuestJoin = (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => {
    saveSpaceUpdate(spaceId, space => {
      const hasCustomShare = customShare !== undefined && customShare !== null && !isNaN(customShare);
      
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
        sharePercentage: hasCustomShare ? customShare : 0,
        isCustomShare: hasCustomShare
      };
      
      let updatedInvoices = space.invoices || [];
      if (!isRetroactive) {
        updatedInvoices = updatedInvoices.map(inv => ({
          ...inv,
          excludedMembers: [...(inv.excludedMembers || []), shadowToken]
        }));
      }
      
      const newMembersList = [...(space.members || []), newMember];
      
      // Atomically balance shares
      const { finalMembers, finalCreatorShare } = calculateBalancedShares(newMembersList, space.settings);
      
      return {
        ...space,
        members: finalMembers,
        settings: { ...space.settings, mySharePercentage: finalCreatorShare },
        invoices: updatedInvoices
      };
    });
  };\n`;

if (content.match(finalizeTarget)) {
  content = content.replace(finalizeTarget, finalizeReplacement);
  console.log('Replaced finalizeGuestJoin');
} else {
  console.log('Could not find finalizeGuestJoin regex');
}

fs.writeFileSync(path, content, 'utf-8');
