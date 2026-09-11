const fs = require('fs');
let c = fs.readFileSync('src/components/common/ContactSelector.tsx', 'utf8');
c = c.replace('../../../app/context/AuthContext', '../../app/context/AuthContext');
fs.writeFileSync('src/components/common/ContactSelector.tsx', c);
console.log('Fixed properly');
