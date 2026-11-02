/**
 * Global Permissions & Access Control Engine (Core)
 * Rule 16: Decoupled from any specific widget (Partners, Vault, Finance, etc.)
 * Rule 4: DRY - Single Source of Truth
 */

export interface AccessCheckParams {
  spaceRole: 'creator' | 'admin' | 'partner';
  userId?: string;
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
  const { spaceRole, userId, isManagedMode, ownerId, allowedPartners } = params;

  // 1. Managers (creator and admin) have full visibility across the space
  if (isSpaceManager(spaceRole)) {
    return true;
  }

  // 2. If item is restricted to specific partners
  if (allowedPartners && allowedPartners.length > 0) {
    return Boolean(userId && allowedPartners.includes(userId));
  }

  // 3. If space is in Managed (Hierarchical) Mode, standard partners only see their own items
  if (isManagedMode) {
    if (!ownerId) return true; // General public items in managed mode
    return Boolean(userId && ownerId && userId === ownerId);
  }

  // 4. Default open collaboration mode
  return true;
}
