const fs = require('fs');

const path = 'src/app/context/SpacesContext.tsx';
let lines = fs.readFileSync(path, 'utf-8').split('\\n');

const replacement = \`  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \\\`השותף \${memberToRemove.name} נמחק לצמיתות.\\\`;
      } else {
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = \\\`השותף \${memberToRemove.name} סומן כלא-פעיל.\\\`;
      }
      
      const newLog: AuditRecord = {
        id: \\\`audit-\\\${Date.now()}-\\\${Math.random().toString(36).substr(2, 5)}\\\`,
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
  };\`.split('\\n');

// Find start and end
const start = lines.findIndex(l => l.includes('const removeMember ='));
const end = lines.findIndex((l, i) => i > start && l.includes('setTimeout(() => {')) + 3; // +3 for autoBalanceShares, }, 100); };

lines.splice(start, end - start + 1, ...replacement);

fs.writeFileSync(path, lines.join('\\n'), 'utf-8');
console.log('Fixed removeMember completely');
