const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');

const regex = /{hasChat && hasActivePartners[\s\S]*?צ'אט<\/span>\s*<\/button>\s*\)}\s*/g;
tx = tx.replace(regex, '');

fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', tx);
