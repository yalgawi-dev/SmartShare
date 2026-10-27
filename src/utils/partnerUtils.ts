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

export interface SharedContactItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  spaces: { id: string; title: string }[];
}

/**
 * Calculates all unique contacts for a given user across spaces and saved address book contacts (DRY Single Source of Truth).
 */
export const getSharedContactsForUser = (targetUser: any, spacesList: any[], allUsers?: any[]): SharedContactItem[] => {
  if (!targetUser) return [];

  const targetUserId = targetUser.id;
  const targetUserPhone = (targetUser.phone || '').trim();

  // Find all spaces where targetUser is creator or member
  const userSpaces = (spacesList || []).filter((s: any) => {
    if (s.status === 'pending_deletion' || s.isArchived) return false;
    const isCreator = s.creatorId === targetUserId || s.createdBy === targetUserId;
    const isMember = (s.members || []).some((m: any) => 
      (m.userId && m.userId === targetUserId) || 
      (targetUserPhone && m.phone && m.phone === targetUserPhone)
    );
    return isCreator || isMember;
  });

  const contactsMap = new Map<string, SharedContactItem>();

  userSpaces.forEach((s: any) => {
    // 1. If targetUser is not the creator, creator is a contact
    if (s.creatorId && s.creatorId !== targetUserId) {
      const creatorId = s.creatorId;
      const existing = contactsMap.get(creatorId) || {
        id: creatorId,
        name: s.createdBy || 'מנהל המרחב',
        spaces: []
      };
      if (!existing.spaces.some(sp => sp.id === s.id)) {
        existing.spaces.push({ id: s.id, title: s.title || 'פרויקט ללא שם' });
      }
      contactsMap.set(creatorId, existing);
    }

    // 2. Members of the space
    (s.members || []).forEach((m: any) => {
      const mId = m.userId;
      if (!mId || mId === targetUserId) return;
      if (targetUserPhone && m.phone && m.phone === targetUserPhone) return;
      if (m.isInvite && m.status === 'pending' && !m.phone) return;
      if (mId.startsWith('guest_') && !m.phone) return;

      const contactKey = mId || m.phone;
      const existing = contactsMap.get(contactKey) || {
        id: contactKey,
        name: m.name || 'שותף במרחב',
        phone: m.phone,
        avatarUrl: m.avatarUrl,
        spaces: []
      };
      if (m.name && (existing.name === 'שותף במרחב' || !existing.name)) existing.name = m.name;
      if (m.phone && !existing.phone) existing.phone = m.phone;
      if (m.avatarUrl && !existing.avatarUrl) existing.avatarUrl = m.avatarUrl;
      if (!existing.spaces.some(sp => sp.id === s.id)) {
        existing.spaces.push({ id: s.id, title: s.title || 'פרויקט ללא שם' });
      }
      contactsMap.set(contactKey, existing);
    });
  });

  // 3. Saved personal contacts from targetUser.contacts
  (targetUser.contacts || []).forEach((c: any) => {
    const cId = c.id || c.phone;
    if (!cId || cId === targetUserId) return;
    if (targetUserPhone && c.phone && c.phone === targetUserPhone) return;
    if (!c.phone && cId.startsWith('guest_')) return;

    const existing = contactsMap.get(cId) || {
      id: cId,
      name: c.name || 'איש קשר',
      phone: c.phone,
      avatarUrl: c.avatarUrl,
      spaces: []
    };
    if (c.name && (!existing.name || existing.name === 'איש קשר')) existing.name = c.name;
    if (c.phone && !existing.phone) existing.phone = c.phone;
    contactsMap.set(cId, existing);
  });

  const contacts = Array.from(contactsMap.values());
  if (Array.isArray(allUsers) && allUsers.length > 0) {
    contacts.forEach(c => {
      if (!c.avatarUrl) {
        const matched = allUsers.find(u => 
          (c.id && u.id === c.id) ||
          (c.phone && u.phone && u.phone.trim() === c.phone.trim()) ||
          (c.name && (u.realName === c.name || u.nickname === c.name))
        );
        if (matched?.avatarUrl) {
          c.avatarUrl = matched.avatarUrl;
        }
      }
    });
  }

  return contacts;
};
