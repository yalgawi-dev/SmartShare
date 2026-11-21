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
  members: Array<{
    name: string;
    share: number;
    paid: number;
    expected: number;
    netBalance: number;
    statusText: string;
  }>;
  totalExpenses: number;
  invoicesCount: number;
  pendingCount: number;
  vault: {
    shelves: VaultItemAccess[];
    folders: VaultItemAccess[];
    documentsCount: number;
  };
}

export interface LiveAssistantSnapshot {
  userName: string;
  isAdmin: boolean;
  spacesCount: number;
  spaces: LiveSpaceSnapshot[];
}

/**
 * Builds a compact, accurate live snapshot of the authenticated user's spaces,
 * partner balances (matching FinanceSummary payer resolution rules), invoices,
 * and vault permissions from client state.
 */
export function buildLiveAssistantSnapshot(user: any, spaces: any[]): LiveAssistantSnapshot {
  const uid = user?.id || '';
  const userName = user?.realName || user?.nickname || 'משתמש';

  const mappedSpaces: LiveSpaceSnapshot[] = (spaces || []).slice(0, 30).map((data: any) => {
    const membersRaw = Array.isArray(data.members)
      ? data.members.filter((m: any) => m?.userId && m.status !== 'removed')
      : [];

    const invoices = Array.isArray(data.invoices)
      ? data.invoices.filter((inv: any) => inv?.status !== 'deleted')
      : [];

    const creatorId = data.creatorId || (data.createdBy === userName ? uid : 'creator_unknown');
    const creatorMember = membersRaw.find((m: any) => m.userId === creatorId);
    const creatorName =
      creatorId === uid
        ? userName
        : (creatorMember?.name || (data.createdBy && data.createdBy !== 'אני' ? data.createdBy : 'יוצר המרחב'));

    const memberMap = new Map<string, { name: string; share: number; paid: number; sent: number; received: number }>();

    memberMap.set(creatorId, {
      name: creatorName,
      share: Number(creatorMember?.share ?? 0),
      paid: 0,
      sent: 0,
      received: 0
    });

    for (const m of membersRaw) {
      if (!memberMap.has(m.userId)) {
        memberMap.set(m.userId, {
          name: m.userId === uid ? userName : (m.name || 'שותף'),
          share: Number(m.share ?? 0),
          paid: 0,
          sent: 0,
          received: 0
        });
      }
    }

    // Resolve payer/recipient IDs identically to FinanceSummary ('me', 'אני', creatorName, member name)
    const resolveMemberId = (rawId?: string, rawName?: string): string | null => {
      const trimmed = (rawName || '').trim();
      if (rawId === 'me' || trimmed === 'אני' || trimmed === 'אני (לא פעיל)') return creatorId;
      if (rawId && memberMap.has(rawId)) return rawId;
      if (rawId && (rawId === data.creatorId || rawId === data.createdBy)) return creatorId;
      if (trimmed) {
        if (trimmed === creatorName || trimmed === data.createdBy || (creatorId === uid && trimmed === userName)) {
          return creatorId;
        }
        for (const [mid, entry] of memberMap.entries()) {
          if (entry.name === trimmed) return mid;
        }
      }
      return null;
    };

    let totalExpenses = 0;
    let pendingCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'pending' || inv.status === 'dispute') pendingCount++;
      if (inv.status === 'missing') continue;

      const amt = Number(inv.amount) || 0;
      if (inv.type === 'transfer') {
        const fromId = resolveMemberId(inv.paidById, inv.paidBy);
        const toId = resolveMemberId(inv.toUserId, inv.toUserName);
        if (fromId && memberMap.has(fromId)) memberMap.get(fromId)!.sent += amt;
        if (toId && memberMap.has(toId)) memberMap.get(toId)!.received += amt;
        continue;
      }

      if (inv.type === 'income') continue;

      totalExpenses += amt;
      if (inv.payerSplits && typeof inv.payerSplits === 'object' && Object.keys(inv.payerSplits).length > 0) {
        for (const [splitUid, splitVal] of Object.entries(inv.payerSplits)) {
          const resolved = resolveMemberId(splitUid);
          if (resolved && memberMap.has(resolved)) {
            memberMap.get(resolved)!.paid += Number(splitVal) || 0;
          }
        }
      } else {
        const payerId = resolveMemberId(inv.paidById, inv.paidBy);
        if (payerId && memberMap.has(payerId)) {
          memberMap.get(payerId)!.paid += amt;
        }
      }
    }

    const totalShare = Array.from(memberMap.values()).reduce((s, m) => s + (m.share > 0 ? m.share : 0), 0);
    const count = Math.max(1, memberMap.size);

    const members = Array.from(memberMap.values()).map((m) => {
      const ratio = totalShare > 0 ? m.share / totalShare : 1 / count;
      const expected = Math.round(totalExpenses * ratio * 100) / 100;
      const paid = Math.round(m.paid * 100) / 100;
      const netBalance = Math.round((m.paid - expected + m.sent - m.received) * 100) / 100;
      const statusText =
        netBalance > 0.5
          ? `מגיע לו +${netBalance} ₪`
          : netBalance < -0.5
            ? `חייב ${Math.abs(netBalance)} ₪`
            : 'מאוזן (0 ₪)';
      return { name: m.name, share: m.share, paid, expected, netBalance, statusText };
    });

    const mapAccess = (item: any, nameField: 'title' | 'name'): VaultItemAccess => {
      const rawAllowed = Array.isArray(item?.allowedPartners)
        ? item.allowedPartners.filter((pid: string) => pid && pid.trim() !== '' && pid !== creatorId)
        : [];
      return {
        name: item?.[nameField] || item?.title || item?.name || 'ללא שם',
        visibility: rawAllowed.length > 0 ? 'restricted' : 'open_all',
        allowedPartnerNames: rawAllowed.map((pid: string) => memberMap.get(pid)?.name || pid)
      };
    };

    const shelves = Array.isArray(data.shelves) ? data.shelves.map((s: any) => mapAccess(s, 'title')) : [];
    const folders = Array.isArray(data.documentFolders) ? data.documentFolders.slice(0, 40).map((f: any) => mapAccess(f, 'name')) : [];
    const documentsCount = Array.isArray(data.documents) ? data.documents.length : 0;

    return {
      id: data.id,
      title: data.title || 'מרחב ללא שם',
      role: data.creatorId === uid ? 'creator' : 'member',
      creatorName,
      members,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      invoicesCount: invoices.length,
      pendingCount,
      vault: { shelves, folders, documentsCount }
    };
  });

  return {
    userName,
    isAdmin: Boolean(user?.isAdmin),
    spacesCount: mappedSpaces.length,
    spaces: mappedSpaces
  };
}
