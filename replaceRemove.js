const fs = require('fs');

const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const target = `  const removeMember = (spaceId: string, userId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      const hasInvoices = space.invoices?.some(i => i.payerId === userId);
      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (hasInvoices) {
        // Soft delete
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false } : m) || [];
        details = \`השותף \${memberToRemove.name} סומן כלא-פעיל (יש לו היסטוריית תשלומים). האחוזים יאופסו.\`;
      } else {
        // Hard delete
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \`השותף \${memberToRemove.name} הוסר מהמרחב לחלוטין. האחוזים יאופסו.\`;
      }
      
      const newLog: AuditRecord = {
        id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };

      return {
        ...space,
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };`;

const replacement = `  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete) {
        // Hard delete ONLY if explicitly requested
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \`השותף \${memberToRemove.name} נמחק לצמיתות (Hard Delete).\`;
      } else {
        // Soft delete ALWAYS by default to retain history and toggle capability!
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = \`השותף \${memberToRemove.name} סומן כלא-פעיל (מערכת משמרת היסטוריית חשבוניות עבר).\`;
      }
      
      const newLog: AuditRecord = {
        id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };
      
      // Auto-balance: Reset custom percentages to default
      const newSettings = { ...space.settings, mySharePercentage: undefined };

      return {
        ...space,
        settings: newSettings,
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Successfully replaced removeMember logic');
} else {
  console.log('Failed to match exact removeMember target');
}
