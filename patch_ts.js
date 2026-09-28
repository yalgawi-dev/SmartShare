const fs = require('fs');
const file = 'src/components/auth/PhoneLinkEnforcer.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/window\.recaptchaVerifierLink/g, '(window as any).recaptchaVerifierLink');
fs.writeFileSync(file, content, 'utf8');
console.log("Fixed window TS error");
