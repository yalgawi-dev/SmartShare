const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `const detected = detectDocument(offscreen);`,
  `const detected = detectDocument(offscreen, true);`
);

content = content.replace(
  `const W = 480;`,
  `const W = 250;`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched ScannerModal.tsx');
