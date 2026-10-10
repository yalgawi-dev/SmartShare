const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const regex = /useEffect\(\(\) => \{\s*if \(hasFinance\) \{\s*setSelectedCategory\('receipt'\);\s*setMode\('smart_plus'\);\s*\} else if \(hasVault\) \{\s*setSelectedCategory\('document'\);\s*setMode\('smart_plus'\);\s*\} else \{\s*setSelectedCategory\('image'\);\s*setMode\('pure_color'\);\s*\}\s*\}, \[hasFinance, hasVault\]\);/g;

tx = tx.replace(regex, '');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', tx);
