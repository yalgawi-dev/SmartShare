const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<img\s*src=\{imageCache\[mode\]\}\s*style=\{\{\s*width:\s*'100%',\s*height:\s*'100%',\s*objectFit:\s*'contain'\s*\}\}\s*alt="Scanned document"\s*\/>/m;

const replacement = `<img 
                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    alt="Scanned document" 
                  />`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('patched viewer');
