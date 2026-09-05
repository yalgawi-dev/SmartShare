const fs = require('fs');
const file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = \const calculateBalancedShares = (members: any[], settings: any) => {
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
};\;

const newFunc = \const calculateBalancedShares = (members: any[], settings: any) => {
  const activeMembers = members.filter(m => m.isActive !== false);
  let unlockedCount = 0;
  let partnersLockedPercentage = 0;

  // First pass: sum up locked partners
  activeMembers.forEach(m => {
    if (m.isCustomShare) {
      partnersLockedPercentage += (m.sharePercentage || 0);
    } else {
      unlockedCount += 1;
    }
  });

  const isCreatorLocked = settings?.isCustomShare === true;
  let creatorLockedValue = settings?.mySharePercentage || 0;

  // If creator is locked, but partners take up too much, the creator MUST yield
  if (isCreatorLocked) {
    creatorLockedValue = Math.min(creatorLockedValue, Math.max(0, 100 - partnersLockedPercentage));
  } else {
    unlockedCount += 1;
  }

  const totalLocked = partnersLockedPercentage + (isCreatorLocked ? creatorLockedValue : 0);
  const remainingPercentage = Math.max(0, 100 - totalLocked);
  const defaultShare = unlockedCount > 0 ? (remainingPercentage / unlockedCount) : 0;

  const finalCreatorShare = isCreatorLocked ? creatorLockedValue : defaultShare;

  const finalMembers = members.map(m => {
    if (m.isActive === false) return { ...m, sharePercentage: 0 };
    if (m.isCustomShare) return m;
    return { ...m, sharePercentage: defaultShare };
  });

  return { finalMembers, finalCreatorShare, defaultShare };
};\;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content, 'utf8');
