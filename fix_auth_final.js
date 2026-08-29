const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');
c = c.replace(/signInWithPopup/g, 'signInWithRedirect');
fs.writeFileSync('src/app/context/AuthContext.tsx', c, 'utf8');
