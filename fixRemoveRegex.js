const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const regex = /const removeMember = \(spaceId: string, userId: string, performedBy: string\) => \{[\s\S]*?\}, 100\);\r?\n  \};/;

const replacement = `const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \`השותף \${memberToRemove.name} נמחק לצמיתות.\`;
      } else {
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = \`השותף \${memberToRemove.name} סומן כלא-פעיל.\`;
      }
      
      const newLog: AuditRecord = {
        id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };
      
      const newSettings = { ...space.settings, mySharePercentage: undefined };

      return {
        ...space,
        settings: newSettings,
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
    
    // Auto balance after removing
    setTimeout(() => {
      autoBalanceShares(spaceId, performedBy);
    }, 100);
  };`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
  console.log("SUCCESS JS");
} else {
  console.log("NO MATCH JS");
}
