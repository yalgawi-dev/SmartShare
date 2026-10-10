const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

tx = tx.replace(");\\n              }) : (", ");\n              }) : (");

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
