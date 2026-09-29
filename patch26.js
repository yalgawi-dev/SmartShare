const fs = require('fs');
const path = require('path');
const dir = 'C:/yehuda/project/app/SmartShare/src/components/widgets';

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('טבלת מאזנים')) {
    console.log('Found in ' + filePath);
  }
}

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) searchInFile(path.join(dir, file));
});
