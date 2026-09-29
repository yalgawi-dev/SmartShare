const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');
c = c.replace(
  "  shareChangeRequest?: { proposedShare: number; creatorShare: number; timestamp: string; };\n}",
  "  shareChangeRequest?: { proposedShare: number; creatorShare: number; timestamp: string; };\n  extensionMessage?: string;\n}"
);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
