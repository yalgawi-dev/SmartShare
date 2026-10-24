/* eslint-disable */
/**
 * Partner Engine Utils
 * Handles all logic related to partners, shares, and expirations.
 * This keeps the Partner logic decoupled from Finance and other widgets.
 */


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

  // Strictly check that user?.id exists AND matches space.creatorId. Never allow undefined === undefined!
  const isCreator = Boolean(user?.id && space.creatorId && user.id === space.creatorId) || 
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

export const isAuthenticPartnerName = (name: any): boolean => {
  if (!name || typeof name !== 'string') return false;
  const str = name.trim();
  if (!str || str === 'שותף מוזמן' || str === 'שותף' || str === 'משתמש' || str === 'מוזמן') return false;
  // Detect double-encoded UTF-8 mojibake, URI encoded leftovers, or corrupted characters
  if (str.includes('׳³') || str.includes('Ã—') || str.includes('%D7') || str.includes('ï¿½') || str.includes('\uFFFD')) {
    return false;
  }
  // Check if string contains excessive non-text symbols or unreadable characters
  const hebrewCount = (str.match(/[\u0590-\u05FF]/g) || []).length;
  const latinCount = (str.match(/[a-zA-Z]/g) || []).length;
  const numCount = (str.match(/[0-9]/g) || []).length;
  if (str.length >= 3 && (hebrewCount + latinCount + numCount) < str.length * 0.4) {
    return false;
  }
  return true;
};

export const sanitizePartnerDisplayName = (name: any, fallback = 'שותף מוזמן'): string => {
  if (isAuthenticPartnerName(name)) {
    return (name as string).trim();
  }
  return fallback;
};
