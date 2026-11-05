/**
 * Global Permissions & Access Control Engine (Core)
 * Rule 16: Decoupled from any specific widget (Partners, Vault, Finance, etc.)
 * Rule 4: DRY - Single Source of Truth
 */

export interface AccessCheckParams {
  spaceRole: 'creator' | 'admin' | 'partner';
  userId?: string;
  partnerToken?: string | null;
  creatorId?: string;
  isManagedMode?: boolean;
  ownerId?: string;
  allowedPartners?: string[];
}

/**
 * Check if the user is a manager (creator or admin) in the space.
 */
export function isSpaceManager(spaceRole: 'creator' | 'admin' | 'partner'): boolean {
  return spaceRole === 'creator' || spaceRole === 'admin';
}

/**
 * Universal Access Check:
 * Determines if a user can access a specific item (Shelf, Folder, Document, or Sales Record).
 */
export function canAccessItem(params: AccessCheckParams): boolean {
  const { spaceRole, userId, partnerToken, creatorId, isManagedMode, ownerId, allowedPartners } = params;

  // 1. Strict Personal Vault ("Only Me" / רק לעצמי)
  // When an item is marked as '__only_me__', NO ONE ELSE can see it, NOT EVEN other managers or group members!
  const isOnlyMe = allowedPartners && allowedPartners.includes('__only_me__');
  if (isOnlyMe) {
    const isOwner = Boolean(
      (userId && ownerId && userId === ownerId) ||
      (userId && allowedPartners.includes(userId)) ||
      (partnerToken && allowedPartners.includes(partnerToken))
    );
    return isOwner;
  }

  // 2. Managers (creator and admin) have full visibility across normal space items
  if (isSpaceManager(spaceRole)) {
    return true;
  }

  // If item is marked as manager-only stealth vault and current user is NOT a manager:
  if (allowedPartners && allowedPartners.includes('__creator_vault_secret__')) {
    return false;
  }

  // 3. Filter out special tags and creator IDs from allowedPartners (empty array = public to all partners)
  const effectiveAllowedPartners = (allowedPartners || []).filter(
    id => id && id.trim() !== '' && (!creatorId || id !== creatorId) && id !== '__creator_vault_secret__' && id !== '__only_me__'
  );

  // If item is restricted to specific partners
  if (effectiveAllowedPartners.length > 0) {
    const matchesUser = Boolean(userId && effectiveAllowedPartners.includes(userId));
    const matchesToken = Boolean(partnerToken && effectiveAllowedPartners.includes(partnerToken));
    return matchesUser || matchesToken;
  }

  // 4. If space is in Managed (Hierarchical) Mode, standard partners only see their own items
  if (isManagedMode) {
    if (!ownerId) return true; // General public items in managed mode
    return Boolean((userId && userId === ownerId) || (partnerToken && partnerToken === ownerId));
  }

  // 5. Default open collaboration mode
  return true;
}
