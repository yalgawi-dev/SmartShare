const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  "removeMember,\n      restoreMember,",
  "refreshMemberInvite,\n      removeMember,\n      restoreMember,"
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Added refreshMemberInvite to provider properly');
