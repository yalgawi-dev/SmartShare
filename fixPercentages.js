const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// 1. Add isPartnerExpired import
if (!c.includes('isPartnerExpired')) {
  c = c.replace(
    "import { getRemainingTimeText } from '../../../utils/partnerUtils';",
    "import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';"
  );
}

// 2. Fix the percentage assignment to force 0% if expired
const pCalcOld = `const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = defaultShare;`;

const pCalcNew = `const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) {
            // Check if they are expired from the Partner Engine
            if (m.status === 'pending' && isPartnerExpired(m.joinedAt, space.settings?.pendingExpirationHours)) {
              p = 0; // Exclude from calculations
            } else {
              p = m.sharePercentage;
            }
          }
          else p = defaultShare;`;

c = c.replace(pCalcOld, pCalcNew);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed expired partner percentages in FinanceSummary');
