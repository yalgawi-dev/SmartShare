const fs = require('fs');

function checkFile(name) {
  console.log('--- ' + name + ' ---');
  const lines = fs.readFileSync(name, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes('zIndex')) {
      console.log(i + 1, l.trim());
    }
  });
}

checkFile('src/components/widgets/ScannerModal.tsx');
checkFile('src/components/widgets/FloatingActionBar.tsx');
