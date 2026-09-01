const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf-8');
c = c.replace(
  'hideRealName?: boolean;',
  'hideRealName?: boolean;\n  spaceKeys?: Record<string, { role: "creator" | "partner", token: string }>;'
);
fs.writeFileSync('src/app/context/AuthContext.tsx', c);
console.log('Fixed AuthContext profile');
