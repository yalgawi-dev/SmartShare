const fs = require('fs');
let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

sm = sm.replace(
    /const \[mode, setMode\] = useState<'auto' \| 'bw' \| 'pure_color' \| 'smart_plus' \| 'hybrid' \| 'experimental' \| 'original'>\('auto'\);/,
    "const [mode, setMode] = useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow'>('auto');"
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);
console.log('Fixed');
