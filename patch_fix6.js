const fs = require('fs');
let file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('inviteData.userId', 'inviteData.token');
fs.writeFileSync(file, content, 'utf8');
