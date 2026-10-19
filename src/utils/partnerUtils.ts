/* eslint-disable */
/**
 * Partner Engine Utils
 * Handles all logic related to partners, shares, and expirations.
 * This keeps the Partner logic decoupled from Finance and other widgets.
 */

export const isPartnerExpired = (joinedAt: string | undefined | null, expHours: number = 1): boolean => {
  if (!joinedAt) return false;
  const expiresMs = new Date(joinedAt).getTime() + (expHours * 3600000);
  return expiresMs - Date.now() <= 0;
};

export const getRemainingTimeText = (joinedAt: string | undefined | null, expHours: number = 1): string => {
  if (!joinedAt) return '';
  const expiresMs = new Date(joinedAt).getTime() + (expHours * 3600000);
  const diffMs = expiresMs - Date.now();
  
  if (diffMs <= 0) return 'פג תוקף';
  
  const minutesLeft = Math.floor(diffMs / 60000);
  if (minutesLeft < 60) return `נותרו ${minutesLeft} דק'`;
  
  const hoursLeft = Math.floor(minutesLeft / 60);
  const minsRound = minutesLeft % 60;
  return `נותרו ${hoursLeft} ש' ${minsRound > 0 ? "ו-" + minsRound + " דק'" : ""}`;
};

export const calculateCurrentSharesSnapshot = (space: any): Record<string, number> => {
  const snapshot: Record<string, number> = {};
  if (!space) return snapshot;

  const validMembers = space.members?.filter((m: any) => m.userId && m.isActive !== false && (m.status === 'active' || m.status === 'pending' || m.status === 'disputed' || m.status === 'extension_requested')) || [];
  const creatorId = space.creatorId || space.createdBy || 'creator_unknown';
  
  const uniqueMembers = validMembers.filter((m: any) => m.userId !== creatorId);
  const activeMembersCount = uniqueMembers.length + 1; // +1 for creator
  
  const defaultShare = activeMembersCount > 0 ? (100 / activeMembersCount) : 100;
  
  if (activeMembersCount <= 1) {
    snapshot[creatorId] = 100;
  } else {
    snapshot[creatorId] = space.settings?.mySharePercentage ?? defaultShare;
    uniqueMembers.forEach((m: any) => {
      snapshot[m.userId] = m.sharePercentage !== undefined ? m.sharePercentage : defaultShare;
    });
  }
  
  return snapshot;
};

export const resolveUserSpaceIdentity = (space: any, user: any): { myId: string; isCreator: boolean } => {
  if (!space) return { myId: user?.id || 'me', isCreator: false };

  let localKey: any = null;
  if (typeof window !== 'undefined') {
    try {
      const keys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      localKey = keys[space.id] || null;
    } catch (e) {}
  }

  const isCreator = space.creatorId === user?.id || 
                    user?.spaceKeys?.[space.id]?.role === 'creator' || 
                    localKey?.role === 'creator';

  if (isCreator) {
    const creatorId = space.creatorId || space.createdBy || user?.id || 'creator';
    return { myId: creatorId, isCreator: true };
  }

  // Partner or member:
  const partnerToken = user?.spaceKeys?.[space.id]?.token || localKey?.token;
  if (partnerToken) {
    return { myId: partnerToken, isCreator: false };
  }

  if (user?.id) {
    const matchedMember = (space.members || []).find((m: any) => m.userId === user.id);
    if (matchedMember) {
      return { myId: user.id, isCreator: false };
    }
  }

  return { myId: user?.id || 'me', isCreator: false };
};
