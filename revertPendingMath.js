const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  "const activeMembers = members.filter(m => m.isActive !== false && m.status !== 'pending');",
  "const activeMembers = members.filter(m => m.isActive !== false);"
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Reverted pending math exclusion');
