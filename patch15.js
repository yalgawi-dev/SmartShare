const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/AuthContext.tsx', 'utf8');

c = c.replace('  dismissedAlerts?: string[];\n  addedAt: string;\n}', '  addedAt: string;\n}');

c = c.replace(
  '  nickname?: string;\n  avatarUrl?: string;\n  phone?: string;\n  countryCode?: string;',
  '  nickname?: string;\n  avatarUrl?: string;\n  phone?: string;\n  dismissedAlerts?: string[];\n  countryCode?: string;'
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/AuthContext.tsx', c, 'utf8');
