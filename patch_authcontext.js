const fs = require('fs');
let file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/bestName \|\| '.*?'/g, "bestName || ''");
content = content.replace(/activeUser\.realName \|\| '.*?'/g, "activeUser.realName || ''");
fs.writeFileSync(file, content, 'utf8');
