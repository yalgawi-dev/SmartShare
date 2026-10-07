const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');
content = content.replace('onOpenScanner: () => void;', "onOpenScanner: (mode?: 'camera' | 'upload') => void;");
content = content.replace('onClick={onOpenScanner}', "onClick={() => onOpenScanner('upload')}");
content = content.replace('onClick={onOpenScanner}', "onClick={() => onOpenScanner('camera')}"); // For the main central button
fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', content);
