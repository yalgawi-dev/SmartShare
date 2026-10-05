const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

code = code.replace(
  'const [trayOrder',
  "const [previewType, setPreviewType] = React.useState<'scanned' | 'pending' | null>(null);\n  const [trayOrder"
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Fixed previewType');
