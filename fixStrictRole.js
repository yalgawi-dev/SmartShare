const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  "if ((space as any).creatorId === user?.id || (space as any).createdBy === user?.id) {",
  "if (user?.id && ((space as any).creatorId === user.id || (space as any).createdBy === user.id)) {"
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed strict role check');
