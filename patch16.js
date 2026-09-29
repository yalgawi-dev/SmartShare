const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/AuthContext.tsx', 'utf8');

c = c.replace('  email?: string;', '  dismissedAlerts?: string[];\n  email?: string;');

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/AuthContext.tsx', c, 'utf8');
