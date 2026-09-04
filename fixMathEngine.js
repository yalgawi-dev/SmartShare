const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// 1. Add isPartnerExpired import
c = c.replace(
  "import { getRemainingTimeText } from '../../../utils/partnerUtils';",
  "import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';"
);

// 2. Fix the rogue percentage engine
const oldMath = `  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
      if (b.userId === myId) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.userId === myId) p = space.settings?.mySharePercentage ?? defaultShare;
        else {
          const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = defaultShare;
        }
      }
    }
    b.p = p;`;

const newMath = `  balances.forEach(b => {
    let p = 0;
    if (b.isMember) {
      if (b.isCreator) {
        p = space.settings?.mySharePercentage ?? defaultShare;
      } else {
        const m = validMembers.find((vm: any) => vm.userId === b.userId);
        if (m && m.sharePercentage !== undefined) {
          if (m.status === 'pending' && isPartnerExpired(m.joinedAt, space.settings?.pendingExpirationHours)) {
            p = 0;
          } else {
            p = m.sharePercentage;
          }
        }
        else p = defaultShare;
      }
    }
    b.p = p;`;

c = c.replace(oldMath, newMath);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed math and import');
