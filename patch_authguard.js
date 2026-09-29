const fs = require('fs');
let file = 'src/app/AuthGuard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("if (!user || !user.phone) {", "if (!user || !user.phone || !user.realName) {");
fs.writeFileSync(file, content, 'utf8');
