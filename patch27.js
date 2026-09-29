const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      if (fs.readFileSync(fullPath, 'utf8').includes('טבלת מאזנים')) {
        console.log('Found in ' + fullPath);
      }
    }
  });
}

walkDir('C:/yehuda/project/app/SmartShare/src');
