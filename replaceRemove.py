import re
import sys

with open('src/app/context/SpacesContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"  const removeMember = \(spaceId: string, userId: string, performedBy: string\) => \{[\s\S]*?\}, 100\);\n  \};"

replacement = """  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = `השותף ${memberToRemove.name} נמחק לצמיתות (Hard Delete).`;
      } else {
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = `השותף ${memberToRemove.name} סומן כלא-פעיל (מערכת משמרת היסטוריית תשלומים).`;
      }
      
      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
  };"""

new_content = re.sub(pattern, replacement, content)

if new_content == content:
    print("NO MATCH FOUND")
else:
    with open('src/app/context/SpacesContext.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
