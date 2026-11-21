import { SMARTSHARE_GRAPH } from './assistantGraph';
import { ScreenContext } from './assistantKnowledge';
import {
  createSecurityEnvelope,
  canCallerAccessSpace,
  resolveCallerSpaceRole,
  canCallerAccessVaultItem
} from './assistantFirewall';
import { inspectLiveScreenDOM, LiveScreenDomInspection } from './assistantDomIntrospector';
import { getSharedContactsForUser } from '@/utils/partnerUtils';

export interface VaultItemAccess {
  name: string;
  path?: string;
  visibility: 'open_all' | 'restricted';
  allowedPartnerNames: string[];
  documentsCount?: number;
}

export interface LiveSpaceExecutionResult {
  id: string;
  title: string;
  isCurrentActiveSpace: boolean;
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
  invoices: Array<{
    description: string;
    amount: number;
    payer: string;
    date: string;
    status: 'approved' | 'pending' | 'disputed' | string;
    isApproved: boolean;
    waitingForNames: string[];
    approvedByNames: string[];
    approvalRatioText: string;
  }>;
  vault: {
    shelves: VaultItemAccess[];
    folders: VaultItemAccess[];
    documentsCount: number;
    documents: Array<{
      title: string;
      folderPath: string;
      visibility: 'open_all' | 'restricted';
      allowedPartnerNames: string[];
    }>;
  };
}

export interface LiveAssistantToolPayload {
  callerIdentity: {
    userName: string;
    globalRole: 'system_admin' | 'registered_user' | 'guest';
    isAdmin: boolean;
    appVersion: string;
  };
  liveScreenDOM: LiveScreenDomInspection;
  usersAndPartnersTool: {
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
      activeUsersLast24hNames: string[];
      activeUsersLast7dCount: number;
      activeUsersLast7dNames: string[];
      pwaInstalledUsersCount: number;
      pwaInstalledUsersNames: string[];
      totalSystemActiveSpacesCount: number;
      totalSystemArchivedSpacesCount: number;
      registeredUsersList: Array<{
        name: string;
        isAdmin: boolean;
        pwaInstalled: boolean;
        lastActiveAt?: string;
      }>;
    };
  };
  spacesSummaryTool: {
    totalMyActiveSpacesCount: number;
    createdByMeSpacesCount: number;
    joinedAsPartnerSpacesCount: number;
    myActiveSpaceNames: string[];
    currentActiveSpaceTitle?: string;
  };
  liveSpacesData: LiveSpaceExecutionResult[];
  appMapSummary: string;
}

const GUEST_PLACEHOLDERS = ['משתמש', 'אורח אנונימי', 'Guest', 'אורח'];
const TREASURY_MEMBER_ID = '__space_treasury__';

/**
 * Executes live data introspection tools directly on the live application state,
 * gated by the Unified Zero-Trust Firewall (assistantFirewall.ts).
 * Replaces the old static truncated snapshot middleman completely.
 */
export function executeLiveAssistantTools(
  user: any,
  spaces: any[],
  allUsers: any[] | undefined,
  screenContext: ScreenContext,
  query: string
): LiveAssistantToolPayload {
  // STEP 0: Unified Zero-Trust Firewall & Identity Resolution
  const envelope = createSecurityEnvelope(user);
  const { uid, userName, isAdmin, globalRole } = envelope;

  // STEP 1: Live DOM Screen Introspection (sees real buttons, headings, tabs, modals on screen right now)
  const liveScreenDOM = inspectLiveScreenDOM();

  // Extract query keywords for deep live search across invoices/documents
  const queryTokens = (query || '')
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  // Filter spaces strictly through the Single Zero-Trust Firewall
  const authorizedSpaces = (spaces || []).filter((s: any) => canCallerAccessSpace(envelope, s));

  const liveSpacesData: LiveSpaceExecutionResult[] = authorizedSpaces.map((space: any) => {
    const spaceRole = resolveCallerSpaceRole(envelope, space);
    const isCreatorMe = spaceRole === 'creator';
    const isCurrentActiveSpace =
      Boolean(screenContext.spaceId && space.id === screenContext.spaceId) ||
      Boolean(screenContext.spaceTitle && space.title === screenContext.spaceTitle);

    const isQueriedSpace =
      isCurrentActiveSpace ||
      queryTokens.some((tok) => (space.title || '').toLowerCase().includes(tok));

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
      incomeHeld: 0,
      incomeExpected: 0
    });

    for (const m of validMembers) {
      if (m.userId === creatorId) {
        const c = unified.get(creatorId);
        if (m.name && m.name !== 'אני' && m.name !== 'אורח') c.name = m.name;
        if (m.sharePercentage !== undefined) c.sharePercentage = m.sharePercentage;
        if (m.isActive !== undefined) c.isActive = m.isActive;
      } else if (!unified.has(m.userId)) {
        const displayName = m.userId === uid ? userName : m.name || 'שותף';
        unified.set(m.userId, {
          userId: m.userId,
          name: displayName,
          sharePercentage: m.sharePercentage,
          isActive: m.isActive,
          isCreator: false,
          isMember: true,
          paid: 0,
          expected: 0,
          transfersSent: 0,
          transfersReceived: 0,
          incomeHeld: 0,
          incomeExpected: 0
        });
      }
    }

    const resolveSingleUserId = (rawId?: string, rawName?: string): string => {
      if (rawId && unified.has(rawId)) return rawId;
      const clean = (rawName || '').replace(' (מנהל)', '').trim();
      if (rawId === 'me' || rawId === 'creator_master' || clean === 'אני' || clean === creatorName) {
        return creatorId;
      }
      for (const [id, m] of unified.entries()) {
        if (m.name === clean || m.name === rawName) return id;
      }
      return rawId || rawName || 'unknown';
    };

    // Single Source of Truth: Active Invoices must NOT include deleted, inactive, or removed records
    const rawInvoices: any[] = (Array.isArray(space.invoices) ? space.invoices : []).filter(
      (i: any) => i && i.isActive !== false && !i.deletedAt && !i.isDeleted && i.status !== 'deleted'
    );
    // In SmartShare, all non-disputed invoices (both approved and pending) are part of the active accounting pool
    const activeInvoices = rawInvoices.filter((i) => i.status !== 'disputed' && i.status !== 'dispute' && i.status !== 'rejected');
    const pendingInvoicesList = rawInvoices.filter((i) => i.status === 'pending' || i.status === 'pending_approval');
    const pendingCount = pendingInvoicesList.length;
    const disputedInvoices = rawInvoices.filter((i) => i.status === 'disputed' || i.status === 'dispute' || i.status === 'rejected');

    const expensesOnly = activeInvoices.filter(
      (i) => !i.type || i.type === 'expense' || (i.type === 'store_credit' && (Number(i.amount) || 0) < 0)
    );
    const storeCreditsOnly = activeInvoices.filter((i) => i.type === 'store_credit' && (Number(i.amount) || 0) >= 0);
    const transfersOnly = activeInvoices.filter((i) => i.type === 'transfer');
    const incomesOnly = activeInvoices.filter((i) => i.type === 'income');

    const totalExpenses =
      expensesOnly.reduce((s, i) => s + Math.abs(Number(i.amount) || 0), 0) -
      storeCreditsOnly.reduce((s, i) => s + Math.abs(Number(i.amount) || 0), 0);
    const totalDisputed = disputedInvoices
      .filter((i) => !i.type || i.type === 'expense')
      .reduce((s, i) => s + Math.abs(Number(i.amount) || 0), 0);

    const allParticipants = Array.from(unified.values());
    const activeMembers = allParticipants.filter((m) => m.isActive !== false);
    const hasCustomShares = activeMembers.some((m) => m.sharePercentage !== undefined);
    const equalShare = activeMembers.length > 0 ? 100 / activeMembers.length : 100;

    let sumNonCreators = 0;
    for (const m of activeMembers) {
      if (!m.isCreator) {
        sumNonCreators += m.sharePercentage !== undefined ? m.sharePercentage : equalShare;
      }
    }

    const balances = allParticipants.map((m) => {
      if (m.isActive === false) return { ...m, p: 0 };
      let p = equalShare;
      if (hasCustomShares) {
        p = m.isCreator
          ? m.sharePercentage !== undefined
            ? m.sharePercentage
            : Math.max(0, 100 - sumNonCreators)
          : m.sharePercentage !== undefined
            ? m.sharePercentage
            : equalShare;
      }
      return { ...m, p };
    });

    const getShareForInvoice = (inv: any, b: any): number => {
      const snap = inv?.sharesSnapshot;
      if (snap && typeof snap === 'object') {
        if (snap[b.userId] !== undefined) return Number(snap[b.userId]);
        if (b.isCreator) {
          if (snap['me'] !== undefined) return Number(snap['me']);
          if (snap['creator_master'] !== undefined) return Number(snap['creator_master']);
        }
        for (const [k, v] of Object.entries(snap)) {
          if (resolveSingleUserId(k, k) === b.userId) return Number(v);
        }
      }
      return b.p;
    };

    for (const inv of expensesOnly) {
      const invAmt = Math.abs(Number(inv.amount) || 0);
      if (inv.payerId !== TREASURY_MEMBER_ID) {
        const pid = resolveSingleUserId(inv.payerId, inv.payerName);
        const payer = balances.find((b) => b.userId === pid);
        if (payer) payer.paid += invAmt;
      }
      const excluded = inv.excludedMembers || [];
      const participating = balances.filter((b) => b.isMember && !excluded.includes(b.userId));
      const totalSh = participating.reduce((s, b) => s + getShareForInvoice(inv, b), 0);
      if (totalSh > 0) {
        for (const b of participating) b.expected += invAmt * (getShareForInvoice(inv, b) / totalSh);
      }
    }

    for (const sc of storeCreditsOnly) {
      const scAmt = Math.abs(Number(sc.amount) || 0);
      if (sc.payerId !== TREASURY_MEMBER_ID) {
        const pid = resolveSingleUserId(sc.payerId, sc.payerName);
        const holder = balances.find((b) => b.userId === pid);
        if (holder) holder.paid -= scAmt;
      }
      const excluded = sc.excludedMembers || [];
      const participating = balances.filter((b) => b.isMember && !excluded.includes(b.userId));
      const totalSh = participating.reduce((s, b) => s + getShareForInvoice(sc, b), 0);
      if (totalSh > 0) {
        for (const b of participating) b.expected -= scAmt * (getShareForInvoice(sc, b) / totalSh);
      }
    }

    for (const tr of transfersOnly) {
      const trAmt = Math.abs(Number(tr.amount) || 0);
      const fromId = resolveSingleUserId(tr.payerId, tr.payerName);
      const toId = resolveSingleUserId(tr.targetId, tr.targetName);
      const sender = balances.find((b) => b.userId === fromId);
      const receiver = balances.find((b) => b.userId === toId);
      if (sender) sender.transfersSent += trAmt;
      if (receiver) receiver.transfersReceived += trAmt;
    }

    for (const inc of incomesOnly) {
      const incAmt = Math.abs(Number(inc.amount) || 0);
      if (inc.payerId !== TREASURY_MEMBER_ID) {
        const holderId = resolveSingleUserId(inc.payerId, inc.payerName);
        const holder = balances.find((b) => b.userId === holderId);
        if (holder) holder.incomeHeld += incAmt;
      }
      const excluded = inc.excludedMembers || [];
      const participating = balances.filter((b) => b.isMember && !excluded.includes(b.userId));
      const totalSh = participating.reduce((s, b) => s + getShareForInvoice(inc, b), 0);
      if (totalSh > 0) {
        for (const b of participating) b.incomeExpected += incAmt * (getShareForInvoice(inc, b) / totalSh);
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
      return { name: b.name, sharePercentage: Math.round(b.p * 10) / 10, paid, expected, netBalance, statusText };
    });

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

    // Live Invoice Selection: With accurate per-partner approval status matching FinanceTransactions
    const allFormattedInvoices = rawInvoices
      .slice()
      .reverse()
      .map((inv: any) => {
        const payerName = inv.payerName || unified.get(resolveSingleUserId(inv.payerId, inv.payerName))?.name || 'לא ידוע';
        const isApproved = inv.status === 'approved';
        const approvedBy = Array.isArray(inv.approvedBy) ? inv.approvedBy : [];
        const approvedByNames = approvedBy
          .map((id: string) => unified.get(resolveSingleUserId(id, id))?.name || id)
          .filter(Boolean);

        const excluded = Array.isArray(inv.excludedMembers) ? inv.excludedMembers : [];
        const activeMems = (space.members || []).filter(
          (m: any) => m.isActive !== false && (m.status === 'active' || m.status === 'pending' || m.status === 'extension_requested')
        );
        const creatorObj = { userId: creatorId, name: creatorName };
        const everyone = [creatorObj, ...activeMems];
        const participating = everyone.filter((m: any) => !excluded.includes(m.userId) && m.userId !== TREASURY_MEMBER_ID);

        const waitingForNames = isApproved
          ? []
          : participating
              .filter((m: any) => {
                if (m.userId === inv.payerId || m.userId === 'me') return false;
                if (isCreatorMe && inv.payerId === space.creatorId && m.userId === creatorId) return false;
                if (approvedBy.includes(m.userId)) return false;
                return true;
              })
              .map((m: any) => m.name || 'שותף')
              .filter(Boolean);

        const approvalsNeeded = Math.max(1, Math.min(inv.approvalsNeeded || 1, participating.length));
        const approvalsReceived = inv.approvalsReceived || (isApproved ? approvalsNeeded : approvedBy.length);
        const approvalRatioText = isApproved ? 'מאושר (V)' : `${approvalsReceived}/${approvalsNeeded} אושר`;

        return {
          description: inv.description || inv.vendor || inv.supplier || inv.title || 'הוצאה',
          amount: Number(inv.amount) || 0,
          payer: payerName,
          date: inv.date || '',
          status: inv.status || 'approved',
          isApproved,
          waitingForNames,
          approvedByNames,
          approvalRatioText
        };
      });

    const selectedInvoices = isQueriedSpace
      ? allFormattedInvoices.slice(0, 60)
      : allFormattedInvoices
          .filter((inv) =>
            queryTokens.some(
              (tok) =>
                inv.description.toLowerCase().includes(tok) ||
                inv.payer.toLowerCase().includes(tok)
            )
          )
          .concat(allFormattedInvoices.slice(0, 12))
          .slice(0, 25);

    // Live Vault & Folder Hierarchy Tool (gated by Firewall canCallerAccessVaultItem)
    const canSeeItem = (item: any) => canCallerAccessVaultItem(envelope, space, item, creatorId);

    const resolveAllowedPartnerNames = (item: any): { visibility: 'open_all' | 'restricted'; names: string[] } => {
      const rawAllowed = Array.isArray(item?.allowedPartners)
        ? item.allowedPartners.filter((pid: string) => pid && pid.trim() !== '' && pid !== creatorId)
        : [];
      const names = rawAllowed
        .map((pid: string) => {
          if (pid === '__only_me__') return 'רק ליוצר';
          if (pid === '__creator_vault_secret__') return 'מנהלים בלבד';
          return unified.get(pid)?.name || null;
        })
        .filter((n): n is string => Boolean(n));
      return {
        visibility: rawAllowed.length > 0 ? 'restricted' : 'open_all',
        names: isCreatorMe ? names : []
      };
    };

    const shelfMap = new Map<string, string>();
    if (Array.isArray(space.shelves)) {
      for (const s of space.shelves) {
        if (s?.id) shelfMap.set(s.id, s.title || s.name || 'מדף');
      }
    }

    const folderMap = new Map<string, any>();
    if (Array.isArray(space.documentFolders)) {
      for (const f of space.documentFolders) {
        if (f?.id) folderMap.set(f.id, f);
      }
    }

    const buildFolderPath = (folderId?: string): string => {
      if (!folderId || !folderMap.has(folderId)) return 'ראשי';
      const parts: string[] = [];
      let curr = folderMap.get(folderId);
      let guard = 0;
      while (curr && guard < 8) {
        parts.unshift(curr.name || curr.title || 'תיקייה');
        if (curr.parentId && folderMap.has(curr.parentId)) {
          curr = folderMap.get(curr.parentId);
        } else {
          if (curr.shelfId && shelfMap.has(curr.shelfId)) {
            parts.unshift(`מדף ${shelfMap.get(curr.shelfId)}`);
          }
          break;
        }
        guard++;
      }
      return parts.join(' › ');
    };

    const accessibleDocs = Array.isArray(space.documents)
      ? space.documents.filter((d: any) => !d?.deletedAt && canSeeItem(d))
      : [];

    const docCountByFolder = new Map<string, number>();
    for (const d of accessibleDocs) {
      if (d?.folderId) {
        docCountByFolder.set(d.folderId, (docCountByFolder.get(d.folderId) || 0) + 1);
      }
    }

    const accessibleShelves: VaultItemAccess[] = Array.isArray(space.shelves)
      ? space.shelves.filter(canSeeItem).map((s: any) => {
          const perm = resolveAllowedPartnerNames(s);
          return {
            name: s?.title || s?.name || 'מדף',
            visibility: perm.visibility,
            allowedPartnerNames: perm.names
          };
        })
      : [];

    const accessibleFolders: VaultItemAccess[] = Array.isArray(space.documentFolders)
      ? space.documentFolders.filter(canSeeItem).map((f: any) => {
          const perm = resolveAllowedPartnerNames(f);
          return {
            name: f?.name || f?.title || 'תיקייה',
            path: buildFolderPath(f?.id),
            visibility: perm.visibility,
            allowedPartnerNames: perm.names,
            documentsCount: docCountByFolder.get(f?.id) || 0
          };
        })
      : [];

    const formattedDocs = accessibleDocs
      .slice()
      .reverse()
      .map((d: any) => {
        const perm = resolveAllowedPartnerNames(d);
        return {
          title: d?.title || d?.name || 'מסמך',
          folderPath: d?.folderId ? buildFolderPath(d.folderId) : d?.shelfId && shelfMap.has(d.shelfId) ? `מדף ${shelfMap.get(d.shelfId)}` : 'ראשי',
          visibility: perm.visibility,
          allowedPartnerNames: perm.names
        };
      });

    const selectedDocs = isCurrentActiveSpace
      ? formattedDocs.slice(0, 60)
      : formattedDocs
          .filter((doc) =>
            queryTokens.some(
              (tok) =>
                doc.title.toLowerCase().includes(tok) ||
                doc.folderPath.toLowerCase().includes(tok)
            )
          )
          .concat(formattedDocs.slice(0, 15))
          .slice(0, 30);

    const pendingInvites = Array.isArray(space.pendingInvites)
      ? space.pendingInvites.map((inv: any) => inv?.name || 'מוזמן ממתין').filter(Boolean)
      : [];

    return {
      id: space.id,
      title: space.title || 'מרחב ללא שם',
      isCurrentActiveSpace,
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
      invoices: selectedInvoices,
      vault: {
        shelves: accessibleShelves,
        folders: accessibleFolders,
        documentsCount: accessibleDocs.length,
        documents: selectedDocs
      }
    };
  });

  // Sort so the currently active space is ALWAYS first in the payload
  liveSpacesData.sort((a, b) => (a.isCurrentActiveSpace === b.isCurrentActiveSpace ? 0 : a.isCurrentActiveSpace ? -1 : 1));

  // Users & Partners Tool (Single Source of Truth: getSharedContactsForUser)
  const sharedContacts = getSharedContactsForUser(user, spaces || [], allUsers);
  const mySharedPartners = sharedContacts.map((c) => ({
    name: c.name,
    sharedSpaces: (c.spaces || []).map((sp) => sp.title)
  }));

  // Admin System Telemetry Tool (strictly gated by Firewall: envelope.isAdmin === true)
  let adminSystemStats: LiveAssistantToolPayload['usersAndPartnersTool']['adminSystemStats'] = undefined;
  if (isAdmin && Array.isArray(allUsers) && allUsers.length > 0) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const identifiedUsers = allUsers.filter((u: any) => {
      const hasName = u?.realName && !GUEST_PLACEHOLDERS.includes(u.realName);
      return Boolean(hasName || u?.phone || u?.email);
    });
    const active24h = allUsers.filter((u: any) => u?.lastActiveAt && new Date(u.lastActiveAt).getTime() >= oneDayAgo);
    const active7d = allUsers.filter((u: any) => u?.lastActiveAt && new Date(u.lastActiveAt).getTime() >= sevenDaysAgo);
    const pwaUsers = allUsers.filter((u: any) => Boolean(u?.pwaInstalled));

    const totalSystemActiveSpacesCount = (spaces || []).filter(
      (s: any) => s && s.status !== 'pending_deletion' && !s.isArchived && s.id !== '__global_announcement__'
    ).length;
    const totalSystemArchivedSpacesCount = (spaces || []).filter(
      (s: any) => s && (s.status === 'pending_deletion' || s.isArchived) && s.id !== '__global_announcement__'
    ).length;

    adminSystemStats = {
      totalUsersRecordsInDB: allUsers.length,
      identifiedRegisteredUsersCount: identifiedUsers.length,
      anonymousGuestsCount: Math.max(0, allUsers.length - identifiedUsers.length),
      activeUsersLast24hCount: active24h.length,
      activeUsersLast24hNames: active24h.map((u: any) => u.realName || u.nickname || 'משתמש').slice(0, 30),
      activeUsersLast7dCount: active7d.length,
      activeUsersLast7dNames: active7d.map((u: any) => u.realName || u.nickname || 'משתמש').slice(0, 30),
      pwaInstalledUsersCount: pwaUsers.length,
      pwaInstalledUsersNames: pwaUsers.map((u: any) => u.realName || u.nickname || 'משתמש').slice(0, 30),
      totalSystemActiveSpacesCount,
      totalSystemArchivedSpacesCount,
      registeredUsersList: identifiedUsers.map((u: any) => ({
        name: u.realName || u.nickname || 'משתמש רשום',
        isAdmin: Boolean(u.isAdmin),
        pwaInstalled: Boolean(u.pwaInstalled),
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString('he-IL') : undefined
      }))
    };
  }

  const createdByMeSpacesCount = liveSpacesData.filter((s) => s.role === 'creator').length;
  const joinedAsPartnerSpacesCount = liveSpacesData.filter((s) => s.role === 'member').length;
  const currentActiveSpace = liveSpacesData.find((s) => s.isCurrentActiveSpace);

  const appMapSummary = SMARTSHARE_GRAPH.nodes
    .map((n) => `- ${n.title}: ${n.explanation.replace(/\n/g, ' ')}`)
    .join('\n');

  return {
    callerIdentity: {
      userName,
      globalRole,
      isAdmin,
      appVersion: SMARTSHARE_GRAPH.version
    },
    liveScreenDOM,
    usersAndPartnersTool: {
      mySharedPartnersCount: mySharedPartners.length,
      mySharedPartners,
      adminSystemStats
    },
    spacesSummaryTool: {
      totalMyActiveSpacesCount: liveSpacesData.length,
      createdByMeSpacesCount,
      joinedAsPartnerSpacesCount,
      myActiveSpaceNames: liveSpacesData.map((s) => s.title),
      currentActiveSpaceTitle: currentActiveSpace?.title || screenContext.spaceTitle
    },
    liveSpacesData,
    appMapSummary
  };
}
