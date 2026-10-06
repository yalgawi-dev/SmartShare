const fs = require('fs');
let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

sm = sm.replace(
    /useState<'auto' \| 'bw' \| 'pure_color' \| 'smart_plus' \| 'hybrid' \| 'experimental' \| 'original'>/g,
    "useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow'>"
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);
console.log('Fixed for real');
