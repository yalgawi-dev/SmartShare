const fs = require('fs');
let lines = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8').split(/\r?\n/);
lines = lines.filter(line => !line.includes('shareChangeRequest?: any;'));
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', lines.join('\n'), 'utf8');
