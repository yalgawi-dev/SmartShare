const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

tx = tx.replace(/}\);\s*\)\)\s*:\s*\(/g, "});\n              }) : (");
tx = tx.replace(/</div>\s*\)\)\s*:\s*\(/g, "</div>\n                );\n              }) : (");

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
console.log('Fixed syntax!');
