const fs = require('fs');
const c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');
const lines = c.split('\n');
const gibberishLines = lines.filter((l, i) => l.includes('updatedAt') && !l.includes('Date'));
console.log(gibberishLines.join('\n'));
