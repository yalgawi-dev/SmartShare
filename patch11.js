const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = \  balances.forEach(b => {
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
    b.p = p;\;

const replacement = \  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
      if (b.userId === myId || b.isCreator) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.userId === myId || b.isCreator) p = space.settings?.mySharePercentage ?? defaultShare;
        else {
          const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = defaultShare;
        }
      }
    }
    b.p = p;\;

content = content.replace(targetStr, replacement);
fs.writeFileSync(file, content, 'utf8');
