const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

content = content.replace("zIndex: 1000, display: 'flex'", "zIndex: 100000, display: 'flex'");
content = content.replace("zIndex: 40000, display: 'flex'", "zIndex: 100005, display: 'flex'");
content = content.replace("zIndex: 30000, display: 'flex'", "zIndex: 100003, display: 'flex'");
// The bottom bar in ScannerModal:
content = content.replace("gap: '0.5rem', zIndex: 1000 }", "gap: '0.5rem', zIndex: 100000 }");

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
