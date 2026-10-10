const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/settings/page.tsx', 'utf8');

const oldIconCode = `{space.icon || '??'}`;
const newIconCode = `{space.logoUrl ? <img src={space.logoUrl} alt="Logo" style={{width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover'}} /> : (space.icon || '??')}`;

tx = tx.split(oldIconCode).join(newIconCode);

fs.writeFileSync('src/app/space/[id]/settings/page.tsx', tx);
console.log('Patched settings header to show logoUrl');
