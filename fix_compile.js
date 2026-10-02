const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8');

// The rest of the messages mapping
const blockStart = '{messagesArray.map(';
const startIdx = txt.indexOf(blockStart);

if (startIdx !== -1) {
  const endIdx = txt.indexOf(')}', txt.indexOf('{/* ChatUI Rendered here */}'));
  // wait, I can just use a regex
  txt = txt.replace(/\{messagesArray\.map\([\s\S]*?\}\)/, '');
}

txt = txt.replace('const dateLabel = showDateBadge ? getChatDateLabel(m.createdAt) : "";', '');
txt = txt.replace('const isMyMsg = m.senderId === user?.id || (m.from && m.from === viewMode);', '');

// Actually, let's just strip everything between the last bracket of shareChangeRequest and ChatUI Rendered here
txt = txt.replace(/\{messagesArray\.map\([\s\S]*?<div ref=\{messagesEndRef\} \/>\s*<\/div>\s*\)\}\s*\{\/\* Input Area \*\/\}[\s\S]*?<\/div>\s*\)\}/, '');

fs.writeFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', txt);
console.log('Fixed PartnerControlPanel logic');

let features = fs.readFileSync('src/app/data/features.ts', 'utf8');
features = features.replace('description: ', 'desc: ');
fs.writeFileSync('src/app/data/features.ts', features);
console.log('Fixed features description');
