const fs = require('fs');
const content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
console.log(content.split('\n').filter(l => l.includes('capturedImage') || l.includes('capturedPages')).join('\n'));
