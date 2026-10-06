const fs = require('fs');

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

sm = sm.replace('{timingCache[mode] && (', '{showDebug && timingCache[mode] && (');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

console.log("Patched successfully v4!");
