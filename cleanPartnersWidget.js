const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/PartnersWidget.tsx', 'utf-8');

// Strip out the invite logic and button
const btnRegex = /<button[\s\S]*?onClick=\{handleInviteClick\}[\s\S]*?<\/button>/;
content = content.replace(btnRegex, '');

const logicRegex = /const \{ addGuestPartner[\s\S]*?const handleInviteClick = \(\) => \{\s*setShowInviteModal\(true\);\s*\};\n/m;
content = content.replace(logicRegex, '');

const modalRegex = /\{showInviteModal && \([\s\S]*?\}\)\}/;
content = content.replace(modalRegex, '');

// Clean up unused imports if any, but TS will just warn
fs.writeFileSync('src/components/widgets/PartnersWidget.tsx', content, 'utf-8');
console.log('PartnersWidget cleaned of invite logic');
