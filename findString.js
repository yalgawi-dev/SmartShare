const fs = require('fs');
const content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('סה')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});
