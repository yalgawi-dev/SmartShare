const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

if (!c.includes('isPartnerExpired')) {
  c = c.replace(
    "import { AVAILABLE_FEATURES } from '../data/features';",
    "import { AVAILABLE_FEATURES } from '../data/features';\nimport { isPartnerExpired } from '../../utils/partnerUtils';"
  );
}

const calcOld = `const calculateBalancedShares = (members: any[], settings: any) => {
  const activeMembers = members.filter(m => m.isActive !== false);`;

const calcNew = `const calculateBalancedShares = (members: any[], settings: any) => {
  // Use Partner Engine to exclude expired partners
  const activeMembers = members.filter(m => m.isActive !== false && !(m.status === 'pending' && isPartnerExpired(m.joinedAt, settings?.pendingExpirationHours)));`;

c = c.replace(calcOld, calcNew);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Updated SpacesContext to exclude expired partners using partner engine');
