const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');
c = c.replace('disputeMessage?: string;', 'disputeMessage?: string;\n  extensionMessage?: string;\n  shareChangeRequest?: any;');
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
