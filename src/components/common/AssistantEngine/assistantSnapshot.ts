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
  members: Array<{ name: string; share: number; netBalance: number }>;
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
 * partner balances, invoices, and vault permissions from client state.
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

    const memberMap = new Map<string, { name: string; share: number; paid: number; sent: number; received: number }>();

    const creatorId = data.creatorId || '';
    if (creatorId) {
      const creatorMember = membersRaw.find((m: any) => m.userId === creatorId);
      memberMap.set(creatorId, {
        name: creatorId === uid ? userName : (creatorMember?.name || data.createdBy || 'יוצר המרחב'),
        share: Number(creatorMember?.share ?? 0),
        paid: 0,
        sent: 0,
        received: 0
      });
    }

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

    let totalExpenses = 0;
    let pendingCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'pending' || inv.status === 'dispute') pendingCount++;
      if (inv.status === 'missing') continue;

      const amt = Number(inv.amount) || 0;
      if (inv.type === 'transfer') {
        const from = memberMap.get(inv.paidById);
        const to = memberMap.get(inv.toUserId);
        if (from) from.sent += amt;
        if (to) to.received += amt;
        continue;
      }

      totalExpenses += amt;
      if (inv.payerSplits && typeof inv.payerSplits === 'object') {
        for (const [splitUid, splitVal] of Object.entries(inv.payerSplits)) {
          const entry = memberMap.get(splitUid);
          if (entry) entry.paid += Number(splitVal) || 0;
        }
      } else if (inv.paidById && memberMap.has(inv.paidById)) {
        memberMap.get(inv.paidById)!.paid += amt;
      }
    }

    const totalShare = Array.from(memberMap.values()).reduce((s, m) => s + (m.share > 0 ? m.share : 0), 0);
    const count = Math.max(1, memberMap.size);

    const members = Array.from(memberMap.values()).map((m) => {
      const ratio = totalShare > 0 ? m.share / totalShare : 1 / count;
      const expected = totalExpenses * ratio;
      const netBalance = Math.round((m.paid - expected + m.sent - m.received) * 100) / 100;
      return { name: m.name, share: m.share, netBalance };
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
      creatorName: memberMap.get(creatorId)?.name || data.createdBy || 'יוצר המרחב',
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
