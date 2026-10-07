const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8').split('\n');
let found = 0;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('step === \'cropping\'')) found = i;
}
console.log(lines.slice(found-10, found + 80).join('\n'));
