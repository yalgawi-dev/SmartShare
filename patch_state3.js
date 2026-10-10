const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

const regex = /const \[editTitleValue, setEditTitleValue\] = useState\(''\);\n/;
tx = tx.replace(regex, ''); // Remove the first one
fs.writeFileSync('src/app/space/[id]/page.tsx', tx);
