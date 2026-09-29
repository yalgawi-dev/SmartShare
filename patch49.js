const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

c = c.replace(/export interface SpaceMember \{[\s\S]*?\n\}/, (match) => {
  return match.replace(/\n\}/, '\n  extensionMessage?: string;\n}');
});

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
