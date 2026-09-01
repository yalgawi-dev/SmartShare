const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const startTarget = `const autoBalanceShares = (spaceId: string, performedBy: string) => {`;
const endTarget = `  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {`;

const startIdx = content.indexOf(startTarget);
const endIdx = content.indexOf(endTarget);

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
  };

`;

content = content.substring(0, startIdx) + autoBalReplacement + content.substring(endIdx);
fs.writeFileSync(path, content, 'utf-8');
console.log('Replaced autoBalanceShares by index');
