const fs = require('fs');
let fSum = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

const handleSaveRegex = /const handleSave = \(\) => \{[\s\S]*?alert\('האחוזים עודכנו בהצלחה!'\);\n    onClose\(\);\n  \};/;
const handleSaveReplacement = `const handleSave = () => {
    if (Math.abs(total - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות 100%');
      return;
    }
    
    // Save all shares atomically
    if (updateSharesBulk) {
      updateSharesBulk(space.id, myShare, partnerShares);
    }
    
    alert('האחוזים עודכנו בהצלחה!');
    onClose();
  };`;

if (fSum.match(handleSaveRegex)) {
  fSum = fSum.replace(handleSaveRegex, handleSaveReplacement);
  console.log('Replaced handleSave');
} else {
  console.log('Regex failed');
}

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', fSum, 'utf-8');
