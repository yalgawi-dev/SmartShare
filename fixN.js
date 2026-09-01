const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');
c = c.replace('interface SpacesContextType {\\n  updateSharesBulk:', 'interface SpacesContextType {\n  updateSharesBulk:');
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed \\n');
