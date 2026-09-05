const settings = { isCustomShare: false, mySharePercentage: undefined };
const members = [];

const calculateBalancedShares = (members, settings) => {
  const activeMembers = members.filter(m => m.isActive !== false);
  const totalPeople = activeMembers.length + 1;
  
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

console.log(calculateBalancedShares(members, settings));
