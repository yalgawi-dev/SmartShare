const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(
  "import { useSpaces } from '@/app/context/SpacesContext';",
  "import { useSpaces } from '@/app/context/SpacesContext';\nimport { getRemainingTimeText } from '../../../utils/partnerUtils';"
);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed missing import in FinanceSummary');
