const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

const replacement = `const handleSave = () => {
    if (Math.abs(total - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות 100%');
      return;
    }
    
    if (updateSharesBulk) {
      updateSharesBulk(space.id, myShare, partnerShares);
    }
    
    alert('האחוזים עודכנו בהצלחה!');
    onClose();
  };

  `;

content = content.substring(0, 19523) + replacement + content.substring(20043);
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', content, 'utf-8');
console.log('Replaced handleSave exactly');
