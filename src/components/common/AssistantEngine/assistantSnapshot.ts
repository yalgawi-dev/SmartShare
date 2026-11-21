import { SMARTSHARE_GRAPH } from './assistantGraph';
import { canAccessItem } from '@/utils/permissionUtils';
import { getSharedContactsForUser } from '@/utils/partnerUtils';

export interface VaultItemAccess {
  name: string;
  visibility: 'open_all' | 'restricted';
  allowedPartnerNames: string[];
}

export interface LiveSpaceSnapshot {
  id: string;
  title: string;
  role: 'creator' | 'member';
  creatorName: string;
  features: string[];
  membersCount: number;
  members: Array<{
    name: string;
    sharePercentage: number;
    paid: number;
    expected: number;
    netBalance: number;
    statusText: string;
  }>;
  pendingInvites: string[];
  settlements: string[];
  totalExpenses: number;
  totalDisputed: number;
  invoicesCount: number;
  pendingCount: number;
  recentInvoices: Array<{
    description: string;
    amount: number;
    payer: string;
    date: string;
    status: string;
  }>;
  vault: {
    shelves: VaultItemAccess[];
    folders: VaultItemAccess[];
    documentsCount: number;
    recentDocuments: Array<{
      title: string;
      folderName?: string;
      visibility: 'open_all' | 'restricted';
    }>;
  };
}

export interface LiveAssistantSnapshot {
  userName: string;
  isAdmin: boolean;
  appVersion: string;
  appMapSummary: string;
  spacesCount: number;
  createdByMeSpacesCount: number;
  joinedAsPartnerSpacesCount: number;
  mySharedPartnersCount: number;
  mySharedPartners: Array<{
    name: string;
    sharedSpaces: string[];
  }>;
  adminSystemStats?: {
    totalUsersRecordsInDB: number;
    identifiedRegisteredUsersCount: number;
    anonymousGuestsCount: number;
    activeUsersLast24hCount: number;
    activeUsersLast7dCount: number;
    pwaInstalledUsersCount: number;
    totalSystemActiveSpacesCount: number;
    registeredUsersList: Array<{
      name: string;
      isAdmin: boolean;
      pwaInstalled: boolean;
      lastActiveAt?: string;
    }>;
  };
  spaces: LiveSpaceSnapshot[];
}

const GUEST_PLACEHOLDERS = ['משתמש', 'אורח אנונימי', 'Guest'];
const TREASURY_MEMBER_ID = '__space_treasury__';

/**
 * Computes exact balances matching FinanceSummary.tsx (payerId/payerName,
 * targetId/targetName, sharePercentage, sharesSnapshot, excludedMembers,
 * store credits, incomes, and approved transfers) + pairwise settlements.
 */
export function buildLiveAssistantSnapshot(user: any, spaces: any[], allUsers?: any[]): LiveAssistantSnapshot {
  const uid = user?.id || '';
  const userName =
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

  // Exact membership filter matching Dashboard (src/app/page.tsx) & Settings (src/app/settings/page.tsx)
  // so the AI only sees spaces belonging to the current user (never other users' spaces in Firestore!)
  const isUserMemberOfSpace = (s: any): boolean => {
    if (!s || s.status === 'pending_deletion' || s.isArchived || s.id === '__global_announcement__') {
      return false;
    }
    if (uid && s.creatorId && uid === s.creatorId) return true;
    if (user?.spaceKeys?.[s.id]?.role === 'creator') return true;
    if (clientKeys[s.id]?.role === 'creator') return true;

    const partnerToken = user?.spaceKeys?.[s.id]?.token || clientKeys[s.id]?.token;
    const matchedMember = (s.members || []).find((m: any) => {
      if (uid && m.userId === uid) return true;
      if (user?.phone && m.phone && m.phone === user.phone) return true;
      if (partnerToken && m.userId === partnerToken) return true;
      if (guestTokens.includes(m.userId)) return true;
      return false;
    });
    if (matchedMember) {
      return matchedMember.isActive !== false && matchedMember.status !== 'removed';
    }
    if ((user?.spaceKeys?.[s.id]?.role === 'partner' || clientKeys[s.id]?.role === 'partner') && (s.members || []).length === 0) {
      return true;
    }
    return false;
  };

  const mappedSpaces: LiveSpaceSnapshot[] = (spaces || [])
    .filter(isUserMemberOfSpace)
    .slice(0, 25)
    .map((space: any) => {
    const isCreatorMe = space.creatorId === uid || space.createdBy === userName;
    const creatorId =
      space.creatorId ||
      (isCreatorMe ? uid || 'me' : space.masterKey ? 'creator_master' : space.createdBy || 'creator_unknown');
    const creatorName =
      isCreatorMe && userName && userName !== 'אני' && userName !== 'אורח'
        ? userName
        : !space.createdBy || space.createdBy === 'אורח' || space.createdBy === 'אני'
          ? 'יוצר המרחב'
          : space.createdBy;

    const validMembers = (space.members || []).filter((m: any) => m?.userId && m.status !== 'removed');
    const unified = new Map<string, any>();

    unified.set(creatorId, {
      userId: creatorId,
      name: creatorName,
      isCreator: true,
      isMember: true,
      paid: 0,
      expected: 0,
      transfersSent: 0,
      transfersReceived: 0,
      incomeExpected: 0,
      incomeHeld: 0,
      p: 0
    });

    for (const m of validMembers) {
      if ((isCreatorMe && m.userId === uid) || m.userId === space.creatorId || m.userId === space.createdBy) continue;
      if (!unified.has(m.userId)) {
        unified.set(m.userId, {
          userId: m.userId,
          name: m.name || (m.userId === uid ? userName : 'שותף'),
          isCreator: false,
          isMember: true,
          isActive: m.isActive !== false,
          sharePercentage: m.sharePercentage,
          paid: 0,
          expected: 0,
          transfersSent: 0,
          transfersReceived: 0,
          incomeExpected: 0,
          incomeHeld: 0,
          p: 0
        });
      }
    }

    const resolveSingleUserId = (rawId?: string, rawName?: string): string => {
      const trimmed = (rawName || '').trim();
      if (rawId === 'me' || trimmed === 'אני' || trimmed === 'אורח' || trimmed === 'אני (לא פעיל)') return creatorId;
      if (trimmed) {
        if (trimmed === userName || trimmed === creatorName || trimmed === space.createdBy) return creatorId;
        const found = validMembers.find((m: any) => m.name === trimmed);
        if (found) return found.userId;
      }
      if (
        (isCreatorMe && rawId === uid) ||
        (space.creatorId && rawId === space.creatorId) ||
        (space.createdBy && rawId === space.createdBy)
      ) {
        return creatorId;
      }
      if (rawId && unified.has(rawId)) return rawId;
      if (trimmed) return `guest_name_${trimmed}`;
      return rawId || 'unknown';
    };

    const rawInvoices = (space.invoices || []).filter((inv: any) => inv && inv.isActive !== false && inv.status !== 'deleted');
    const expensesOnly = rawInvoices.filter(
      (inv: any) =>
        inv.type !== 'transfer' &&
        inv.type !== 'income' &&
        inv.status !== 'dispute' &&
        inv.category !== 'cashbox_equity' &&
        inv.category !== 'cashbox_withdrawal'
    );
    const incomesOnly = rawInvoices.filter((inv: any) => inv.type === 'income' && inv.status !== 'dispute');
    const transfersOnly = rawInvoices.filter((inv: any) => inv.type === 'transfer' && inv.status === 'approved');
    const disputedInvoices = rawInvoices.filter(
      (inv: any) =>
        inv.type !== 'transfer' &&
        inv.type !== 'income' &&
        inv.status === 'dispute' &&
        inv.category !== 'cashbox_equity' &&
        inv.category !== 'cashbox_withdrawal'
    );

    const totalExpenses = expensesOnly.reduce((acc: number, inv: any) => acc + (Number(inv.amount) || 0), 0);
    const totalDisputed = disputedInvoices.reduce((acc: number, inv: any) => acc + (Number(inv.amount) || 0), 0);
    const pendingCount = rawInvoices.filter((inv: any) => inv.status === 'pending' || inv.status === 'dispute').length;

    for (const inv of expensesOnly) {
      if (inv.payerSplits && typeof inv.payerSplits === 'object' && Object.keys(inv.payerSplits).length > 0) {
        if (inv.isStoreCredit && inv.amount < 0) continue;
        for (const [splitUid, splitAmt] of Object.entries(inv.payerSplits)) {
          const num = Number(splitAmt) || 0;
          if (Math.abs(num) < 0.005) continue;
          const matchedId = resolveSingleUserId(splitUid);
          if (unified.has(matchedId)) unified.get(matchedId).paid += num;
        }
        continue;
      }

      const matchedId = resolveSingleUserId(inv.payerId, inv.payerName);
      if (unified.has(matchedId) && !(inv.isStoreCredit && inv.amount < 0)) {
        unified.get(matchedId).paid += Number(inv.amount) || 0;
      }
    }

    for (const inv of transfersOnly) {
      const senderId = resolveSingleUserId(inv.payerId, inv.payerName);
      const receiverId = resolveSingleUserId(inv.targetId, inv.targetName);
      if (unified.has(senderId)) unified.get(senderId).transfersSent += Number(inv.amount) || 0;
      if (unified.has(receiverId)) unified.get(receiverId).transfersReceived += Number(inv.amount) || 0;
    }

    const balances = Array.from(unified.values()).filter(
      (b) => (b.isMember || b.paid > 0) && !String(b.userId).startsWith('equity_') && b.userId !== 'none' && b.userId !== TREASURY_MEMBER_ID
    );

    const activeParticipating = balances.filter((b) => b.isMember && b.isActive !== false);
    const defaultShare = activeParticipating.length > 0 ? 100 / activeParticipating.length : 100;

    let totalPartnerShares = 0;
    for (const b of balances) {
      if (!b.isCreator && b.isMember) {
        if (b.isActive === false) {
          b.p = 0;
        } else {
          const partnerP = typeof b.sharePercentage === 'number' && b.sharePercentage > 0 ? b.sharePercentage : defaultShare;
          b.p = partnerP;
          totalPartnerShares += partnerP;
        }
      }
    }

    if (totalPartnerShares >= 100 && activeParticipating.length > 1) {
      const scale = 90 / totalPartnerShares;
      for (const b of balances) {
        if (!b.isCreator && b.isMember) b.p = Number((b.p * scale).toFixed(1));
      }
      totalPartnerShares = 90;
    }

    for (const b of balances) {
      if (b.isCreator) {
        b.p = activeParticipating.length <= 1 ? 100 : Number(Math.max(0, 100 - totalPartnerShares).toFixed(1));
      } else if (!b.isMember) {
        b.p = 0;
      }
    }

    const getShareForInvoice = (inv: any, b: any) =>
      inv.sharesSnapshot && inv.sharesSnapshot[b.userId] !== undefined ? Number(inv.sharesSnapshot[b.userId]) : Number(b.p);

    for (const inv of incomesOnly) {
      const invAmt = Number(inv.amount) || 0;
      const holderId = resolveSingleUserId(inv.targetId || inv.payerId || creatorId);
      if (unified.has(holderId)) unified.get(holderId).incomeHeld += invAmt;
      const excluded = inv.excludedMembers || [];
      const participating = balances.filter((b) => b.isMember && !excluded.includes(b.userId));
      const totalSh = participating.reduce((s, b) => s + getShareForInvoice(inv, b), 0);
      if (totalSh > 0) {
        for (const b of participating) b.incomeExpected += invAmt * (getShareForInvoice(inv, b) / totalSh);
      }
    }

    for (const inv of expensesOnly) {
      const invAmt = Number(inv.amount) || 0;
      const excluded = inv.excludedMembers || [];
      const participating = balances.filter((b) => b.isMember && !excluded.includes(b.userId));
      const totalSh = participating.reduce((s, b) => s + getShareForInvoice(inv, b), 0);
      if (totalSh > 0) {
        for (const b of participating) b.expected += invAmt * (getShareForInvoice(inv, b) / totalSh);
      }
    }

    const members = balances.map((b) => {
      const paid = Math.round(b.paid * 100) / 100;
      const expected = Math.round(b.expected * 100) / 100;
      const netBalance =
        Math.round((b.paid - b.expected + b.transfersSent - b.transfersReceived + b.incomeExpected - b.incomeHeld) * 100) / 100;
      const statusText =
        netBalance > 0.5
          ? `מגיע לו לקבל +${netBalance} ₪`
          : netBalance < -0.5
            ? `חייב לשלם ${Math.abs(netBalance)} ₪`
            : 'מאוזן (0 ₪)';
      return { name: b.name, sharePercentage: b.p, paid, expected, netBalance, statusText };
    });

    // Compute clear pairwise settlements ("X חייב לשלם ל-Y סכום של Z ₪")
    const debtors = members.filter((m) => m.netBalance < -0.5).map((m) => ({ name: m.name, amt: Math.abs(m.netBalance) }));
    const creditors = members.filter((m) => m.netBalance > 0.5).map((m) => ({ name: m.name, amt: m.netBalance }));
    const settlements: string[] = [];
    let di = 0;
    let ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const pay = Math.round(Math.min(debtors[di].amt, creditors[ci].amt) * 100) / 100;
      if (pay > 0.5) {
        settlements.push(`${debtors[di].name} חייב לשלם ל-${creditors[ci].name} סכום של ${pay} ₪`);
      }
      debtors[di].amt -= pay;
      creditors[ci].amt -= pay;
      if (debtors[di].amt <= 0.5) di++;
      if (creditors[ci].amt <= 0.5) ci++;
    }

    const partnerToken = user?.spaceKeys?.[space.id]?.token || clientKeys[space.id]?.token || null;
    const spaceRole: 'creator' | 'admin' | 'partner' = isCreatorMe ? 'creator' : 'partner';
    const isManagedMode = Boolean(space.settings?.isManagedMode);

    // Zero-Trust Item-Level Access Filter (DRY via canAccessItem)
    const canCurrentUserSeeVaultItem = (item: any): boolean => {
      return canAccessItem({
        spaceRole,
        userId: uid,
        partnerToken,
        creatorId,
        isManagedMode,
        ownerId: item?.createdBy || item?.addedBy || item?.userId,
        allowedPartners: item?.allowedPartners || item?.permissions || []
      });
    };

    const mapAccess = (item: any, nameField: 'title' | 'name'): VaultItemAccess => {
      const rawAllowed = Array.isArray(item?.allowedPartners)
        ? item.allowedPartners.filter((pid: string) => pid && pid.trim() !== '' && pid !== creatorId)
        : [];
      const resolvedPartnerNames = rawAllowed
        .map((pid: string) => {
          if (pid === '__only_me__') return 'רק ליוצר';
          if (pid === '__creator_vault_secret__') return 'מנהלים בלבד';
          return unified.get(pid)?.name || null;
        })
        .filter((n): n is string => Boolean(n));

      return {
        name: item?.[nameField] || item?.title || item?.name || 'ללא שם',
        visibility: rawAllowed.length > 0 ? 'restricted' : 'open_all',
        // Only reveal full allowedPartnerNames list to space creator; partners only see their own permitted items
        allowedPartnerNames: isCreatorMe ? resolvedPartnerNames : []
      };
    };

    const recentInvoices = expensesOnly
      .slice(-8)
      .reverse()
      .map((inv: any) => ({
        description: inv.description || inv.vendor || inv.title || 'הוצאה',
        amount: Number(inv.amount) || 0,
        payer: inv.payerName || unified.get(resolveSingleUserId(inv.payerId, inv.payerName))?.name || 'לא ידוע',
        date: inv.date || '',
        status: inv.status || 'approved'
      }));

    const accessibleShelves = Array.isArray(space.shelves)
      ? space.shelves.filter(canCurrentUserSeeVaultItem).map((s: any) => mapAccess(s, 'title'))
      : [];
    const folderNameById = new Map<string, string>();
    if (Array.isArray(space.documentFolders)) {
      for (const f of space.documentFolders) {
        if (f?.id) folderNameById.set(f.id, f.name || f.title || 'תיקייה');
      }
    }
    const accessibleFolders = Array.isArray(space.documentFolders)
      ? space.documentFolders.filter(canCurrentUserSeeVaultItem).slice(0, 40).map((f: any) => mapAccess(f, 'name'))
      : [];
    const accessibleDocs = Array.isArray(space.documents)
      ? space.documents.filter((d: any) => !d?.deletedAt && canCurrentUserSeeVaultItem(d))
      : [];
    const recentDocuments = accessibleDocs.slice(-15).reverse().map((d: any) => {
      const rawAllowed = Array.isArray(d?.allowedPartners)
        ? d.allowedPartners.filter((pid: string) => pid && pid.trim() !== '' && pid !== creatorId)
        : [];
      return {
        title: d?.title || d?.name || 'מסמך',
        folderName: d?.folderId ? folderNameById.get(d.folderId) : undefined,
        visibility: (rawAllowed.length > 0 ? 'restricted' : 'open_all') as 'open_all' | 'restricted'
      };
    });

    const pendingInvites = Array.isArray(space.pendingInvites)
      ? space.pendingInvites.map((inv: any) => inv?.name || 'מוזמן ממתין').filter(Boolean)
      : [];

    return {
      id: space.id,
      title: space.title || 'מרחב ללא שם',
      role: isCreatorMe ? 'creator' : 'member',
      creatorName,
      features: space.features || [],
      membersCount: members.length,
      members,
      pendingInvites,
      settlements,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalDisputed: Math.round(totalDisputed * 100) / 100,
      invoicesCount: rawInvoices.length,
      pendingCount,
      recentInvoices,
      vault: {
        shelves: accessibleShelves,
        folders: accessibleFolders,
        documentsCount: accessibleDocs.length,
        recentDocuments
      }
    };
  });

  // 1. Exact Shared Partners / Contacts of the current user (Single Source of Truth: partnerUtils)
  const sharedContacts = getSharedContactsForUser(user, spaces || [], allUsers);
  const mySharedPartners = sharedContacts.map((c) => ({
    name: c.name,
    sharedSpaces: (c.spaces || []).map((sp) => sp.title)
  }));

  const createdByMeSpacesCount = mappedSpaces.filter((s) => s.role === 'creator').length;
  const joinedAsPartnerSpacesCount = mappedSpaces.filter((s) => s.role === 'member').length;

  // 2. System-Wide Admin User Telemetry (ONLY if the current user is a System Admin!)
  let adminSystemStats: LiveAssistantSnapshot['adminSystemStats'] = undefined;
  if (user?.isAdmin && Array.isArray(allUsers) && allUsers.length > 0) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const identifiedUsers = allUsers.filter((u: any) => {
      const hasName = u?.realName && !GUEST_PLACEHOLDERS.includes(u.realName) && u.realName !== 'אורח';
      return Boolean(hasName || u?.phone || u?.email);
    });
    const active24h = allUsers.filter((u: any) => u?.lastActiveAt && new Date(u.lastActiveAt).getTime() >= oneDayAgo);
    const active7d = allUsers.filter((u: any) => u?.lastActiveAt && new Date(u.lastActiveAt).getTime() >= sevenDaysAgo);
    const pwaUsers = allUsers.filter((u: any) => Boolean(u?.pwaInstalled));
    const totalSystemActiveSpaces = (spaces || []).filter(
      (s: any) => s && s.status !== 'pending_deletion' && !s.isArchived && s.id !== '__global_announcement__'
    ).length;

    adminSystemStats = {
      totalUsersRecordsInDB: allUsers.length,
      identifiedRegisteredUsersCount: identifiedUsers.length,
      anonymousGuestsCount: Math.max(0, allUsers.length - identifiedUsers.length),
      activeUsersLast24hCount: active24h.length,
      activeUsersLast7dCount: active7d.length,
      pwaInstalledUsersCount: pwaUsers.length,
      totalSystemActiveSpacesCount: totalSystemActiveSpaces,
      registeredUsersList: identifiedUsers.slice(0, 40).map((u: any) => ({
        name: u.realName || u.nickname || 'משתמש רשום',
        isAdmin: Boolean(u.isAdmin),
        pwaInstalled: Boolean(u.pwaInstalled),
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString('he-IL') : undefined
      }))
    };
  }

  const appMapSummary = SMARTSHARE_GRAPH.nodes
    .map((n) => `- ${n.title}: ${n.explanation.replace(/\n/g, ' ')}`)
    .join('\n');

  return {
    userName,
    isAdmin: Boolean(user?.isAdmin),
    appVersion: SMARTSHARE_GRAPH.version,
    appMapSummary,
    spacesCount: mappedSpaces.length,
    createdByMeSpacesCount,
    joinedAsPartnerSpacesCount,
    mySharedPartnersCount: mySharedPartners.length,
    mySharedPartners,
    adminSystemStats,
    spaces: mappedSpaces
  };
}
