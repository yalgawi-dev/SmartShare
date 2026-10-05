const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const cropperTarget = `<ManualCropper 
                  imageUrl={rawSnapshot} 
                  initialPoints={cropPoints} 
                  onChange={setCropPoints} 
                />`;

const cropperReplacement = `<ManualCropper 
                  key={rawSnapshot}
                  imageUrl={rawSnapshot} 
                  initialPoints={cropPoints} 
                  onChange={setCropPoints} 
                />`;

code = code.replace(cropperTarget, cropperReplacement);

// Bump version
code = code.replace(/v18\.7/g, 'v18.8');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Added key to ManualCropper');
