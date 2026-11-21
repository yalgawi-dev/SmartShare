import { canAccessItem } from '@/utils/permissionUtils';

export interface CallerSecurityEnvelope {
  uid: string;
  userName: string;
  userPhone: string;
  isAdmin: boolean;
  globalRole: 'system_admin' | 'registered_user' | 'guest';
  spaceKeys: Record<string, { role: string; token?: string }>;
  clientKeys: Record<string, { role: string; token?: string }>;
  guestTokens: string[];
}

const GUEST_PLACEHOLDERS = ['משתמש', 'אורח אנונימי', 'Guest', 'אורח'];

/**
 * Unified Zero-Trust Firewall & Identity Gatekeeper (Single Source of Truth).
 * Every live tool query MUST pass through this firewall before accessing any space,
 * folder, document, invoice, or system user record.
 */
export function createSecurityEnvelope(user: any): CallerSecurityEnvelope {
  const uid = user?.id || '';
  const rawName =
    user?.realName && !GUEST_PLACEHOLDERS.includes(user.realName)
      ? user.realName
      : user?.nickname && !GUEST_PLACEHOLDERS.includes(user.nickname)
        ? user.nickname
        : 'משתמש';

  let clientKeys: Record<string, { role: string; token?: string }> = {};
  let guestTokens: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      clientKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}') || {};
      const pTokens = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      if (Array.isArray(pTokens)) guestTokens = pTokens;
    } catch (_) {}
  }

  const isAdmin = Boolean(user?.isAdmin);
  const isRegistered = Boolean(uid && !user?.isAnonymous && (rawName !== 'משתמש' || user?.phone || user?.email));

  return {
    uid,
    userName: rawName,
    userPhone: (user?.phone || '').trim(),
    isAdmin,
    globalRole: isAdmin ? 'system_admin' : isRegistered ? 'registered_user' : 'guest',
    spaceKeys: user?.spaceKeys || {},
    clientKeys,
    guestTokens
  };
}

/**
 * Checks whether the caller is an authorized creator or active member of a space.
 * Strictly blocks archived spaces, pending_deletion spaces, global announcement docs,
 * and spaces belonging to other users.
 */
export function canCallerAccessSpace(envelope: CallerSecurityEnvelope, space: any): boolean {
  if (!space || space.status === 'pending_deletion' || space.isArchived || space.id === '__global_announcement__') {
    return false;
  }

  const { uid, userPhone, spaceKeys, clientKeys, guestTokens } = envelope;

  if (uid && space.creatorId && uid === space.creatorId) return true;
  if (spaceKeys[space.id]?.role === 'creator') return true;
  if (clientKeys[space.id]?.role === 'creator') return true;

  const partnerToken = spaceKeys[space.id]?.token || clientKeys[space.id]?.token;
  const matchedMember = (space.members || []).find((m: any) => {
    if (uid && m.userId === uid) return true;
    if (userPhone && m.phone && m.phone === userPhone) return true;
    if (partnerToken && m.userId === partnerToken) return true;
    if (guestTokens.includes(m.userId)) return true;
    return false;
  });

  if (matchedMember) {
    return matchedMember.isActive !== false && matchedMember.status !== 'removed';
  }

  if ((spaceKeys[space.id]?.role === 'partner' || clientKeys[space.id]?.role === 'partner') && (space.members || []).length === 0) {
    return true;
  }

  return false;
}

/**
 * Resolves the caller's exact role inside a specific space.
 */
export function resolveCallerSpaceRole(envelope: CallerSecurityEnvelope, space: any): 'creator' | 'admin' | 'partner' {
  const { uid, userName, spaceKeys, clientKeys } = envelope;
  const isCreator =
    (uid && space?.creatorId === uid) ||
    (userName && userName !== 'משתמש' && space?.createdBy === userName) ||
    spaceKeys[space?.id]?.role === 'creator' ||
    clientKeys[space?.id]?.role === 'creator';

  return isCreator ? 'creator' : 'partner';
}

/**
 * Enforces item-level access control (Shelf, Folder, Sub-folder, Document, FileShare item)
 * using the global permissionUtils.canAccessItem engine (DRY).
 */
export function canCallerAccessVaultItem(
  envelope: CallerSecurityEnvelope,
  space: any,
  item: any,
  resolvedCreatorId: string
): boolean {
  const spaceRole = resolveCallerSpaceRole(envelope, space);
  const partnerToken = envelope.spaceKeys[space?.id]?.token || envelope.clientKeys[space?.id]?.token || null;
  const isManagedMode = Boolean(space?.settings?.isManagedMode);

  return canAccessItem({
    spaceRole,
    userId: envelope.uid,
    partnerToken,
    creatorId: resolvedCreatorId,
    isManagedMode,
    ownerId: item?.createdBy || item?.addedBy || item?.userId,
    allowedPartners: item?.allowedPartners || item?.permissions || []
  });
}
