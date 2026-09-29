const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

c = c.replace(
  'const newPendingInvites = (space.pendingInvites || []).filter(i => i.token !== userId);',
  'const newPendingInvites = (space.pendingInvites || []).filter(i => i.token !== (inviteToken || userId));'
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
