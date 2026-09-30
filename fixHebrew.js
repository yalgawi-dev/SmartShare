const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');
c = c.replace(/'עודכן עכשיו'/g, "'\\u05e2\\u05d5\\u05d3\\u05db\\u05df \\u05e2\\u05db\\u05e9\\u05d9\\u05d5'");
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Replaced hebrew literals');
