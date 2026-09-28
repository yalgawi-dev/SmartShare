const fs = require('fs');
const file = 'src/components/auth/PhoneLinkEnforcer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix ref assignment
content = content.replace(/ref=\{el => inputRefs\.current\[i\] = el\}/g, 'ref={el => { inputRefs.current[i] = el; }}');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed PhoneLinkEnforcer TS error");
