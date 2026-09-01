const fs = require('fs');
const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

const replacement = `
// ==========================================
// SMART SHARES BALANCING ENGINE
// ==========================================
export const calculateBalancedShares = (members: any[], settings: any) => {
  const activeMembers = members.filter(m => m.isActive !== false);
  const totalPeople = activeMembers.length + 1; // +1 for the creator
  
  let lockedPercentage = 0;
  let unlockedCount = 0;
  
  const isCreatorLocked = settings?.isCustomShare === true;
  const creatorLockedValue = settings?.mySharePercentage || 0;
  
  if (isCreatorLocked) {
    lockedPercentage += creatorLockedValue;
  } else {
    unlockedCount += 1;
  }
  
  activeMembers.forEach(m => {
    if (m.isCustomShare) {
      lockedPercentage += (m.sharePercentage || 0);
    } else {
      unlockedCount += 1;
    }
  });
  
  const remainingPercentage = Math.max(0, 100 - lockedPercentage);
  const defaultShare = unlockedCount > 0 ? (remainingPercentage / unlockedCount) : 0;
  
  const finalCreatorShare = isCreatorLocked ? creatorLockedValue : defaultShare;
  
  const finalMembers = members.map(m => {
    if (m.isActive === false) return { ...m, sharePercentage: 0 };
    if (m.isCustomShare) return m;
    return { ...m, sharePercentage: defaultShare };
  });
  
  return { finalMembers, finalCreatorShare, defaultShare };
};

`;

const startTarget = `const autoBalanceShares = (spaceId: string, performedBy: string) => {`;
const startIdx = content.indexOf(startTarget);

if (startIdx !== -1) {
  content = content.substring(0, startIdx) + replacement + content.substring(startIdx);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Injected calculateBalancedShares');
} else {
  console.log('Failed to find target');
}
