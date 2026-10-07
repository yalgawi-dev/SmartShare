const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8').split('\n');
let firstProcessBatchIdx = -1;
let endOfFirst = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('processBatch: (urls: string[]) => {')) {
    if (firstProcessBatchIdx === -1) {
      firstProcessBatchIdx = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '},') {
          endOfFirst = j;
          break;
        }
      }
      break;
    }
  }
}
if (firstProcessBatchIdx !== -1 && endOfFirst !== -1) {
  lines.splice(firstProcessBatchIdx, endOfFirst - firstProcessBatchIdx + 1);
  fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', lines.join('\n'));
}
