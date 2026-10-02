const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Chat/ChatEngineUI.tsx', 'utf8');
txt = txt.replace('                        ✓✓', "                        {(!isReadByOther && (now - new Date(m.createdAt).getTime() < 1500)) ? '✓' : '✓✓'}");
fs.writeFileSync('src/components/widgets/Chat/ChatEngineUI.tsx', txt);
