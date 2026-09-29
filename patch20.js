const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');
c = c.replace(
  'if (member.disputeMessage && (isCreator || member.userId === user.id)) {',
  'if (member.status === "disputed" && member.disputeMessage && (isCreator || member.userId === user.id)) {'
);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
