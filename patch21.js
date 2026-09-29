const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');
c = c.replace(
  'if (member.disputeMessage && (isCreator || member.userId === user.id) && !dismissedAlerts.includes(\\'disp-\\' + member.userId)) count++;',
  'if (member.status === "disputed" && member.disputeMessage && (isCreator || member.userId === user.id) && !dismissedAlerts.includes("disp-" + member.userId)) count++;'
);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
