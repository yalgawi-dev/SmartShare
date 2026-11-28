import type { Space } from '@/app/context/SpacesContext';

export interface SpaceConversationUnreadSummary {
  conversationId: string;
  title: string;
  subtitle?: string;
  isGuest: boolean;
  isGroup: boolean;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: number;
}

/**
 * DRY Single-Source-of-Truth check for whether a chat message was authored by the current reader.
 * Matches SpacesContext.markConversationRead 1:1 so a user's own legacy messages
 * (`senderId === 'me'`, `from === 'creator'`, `senderId === space.createdBy`) NEVER get stuck as unread!
 */
export function isMessageAuthoredByReader(
  msg: any,
  space: Space,
  readerId: string,
  alternateReaderId?: string
): boolean {
  if (!msg) return true;
  const readers = [readerId, alternateReaderId].filter(Boolean) as string[];
  const isCreator =
    Boolean(readerId && space.creatorId && readerId === space.creatorId) ||
    Boolean(alternateReaderId && space.creatorId && alternateReaderId === space.creatorId);

  if (readers.includes(msg.senderId)) return true;
  if (isCreator && (msg.senderId === (space as any).createdBy || msg.senderId === 'me' || msg.from === 'creator')) {
    return true;
  }
  return false;
}

/**
 * DRY Single-Source-of-Truth unread conversations summary for ANY space.
 * Used identically by Home space cards, In-Space top 💬 button, and the Multi-Sender Chat Picker!
 */
export function getSpaceUnreadSummary(
  space: Space | null | undefined,
  user: { id?: string; spaceKeys?: Record<string, any> } | null | undefined
): {
  totalUnread: number;
  conversations: SpaceConversationUnreadSummary[];
  firstUnreadConvoId: string | null;
} {
  if (!space || !user?.id) {
    return { totalUnread: 0, conversations: [], firstUnreadConvoId: null };
  }

  let mySpaceKey: any = null;
  if (typeof window !== 'undefined') {
    try {
      mySpaceKey = JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[space.id] || null;
    } catch {}
  }

  const isCreator =
    space.creatorId === user.id ||
    user?.spaceKeys?.[space.id]?.role === 'creator' ||
    mySpaceKey?.role === 'creator';
  const partnerToken = user?.spaceKeys?.[space.id]?.token || mySpaceKey?.token;
  const myActualId = isCreator
    ? space.creatorId || (space as any).createdBy || user.id
    : partnerToken || user.id;

  const readerIds = [user.id, myActualId].filter(Boolean) as string[];
  const summaries: SpaceConversationUnreadSummary[] = [];

  for (const convo of space.conversations || []) {
    if (!convo?.id || !Array.isArray(convo.messages) || convo.messages.length === 0) continue;
    const cid = String(convo.id);
    const isGuest = cid.startsWith('guest_');
    const isGroup = cid === 'group';
    if (isGuest && !isCreator) continue;

    const unreadCount = convo.messages.filter((msg: any) => {
      if (!msg || msg.readAt) return false;
      if (isMessageAuthoredByReader(msg, space, user.id!, myActualId)) return false;
      const isRead = Array.isArray(msg.readBy) && readerIds.some((rid) => msg.readBy.includes(rid));
      return !isRead;
    }).length;

    // Resolve friendly human title for this conversation
    let title = isGroup ? 'צ׳אט קבוצתי' : 'שיחה פרטית';
    let subtitle = isGroup ? 'כל חברי המרחב' : undefined;

    if (isGuest) {
      const guestKey = cid.replace(/^guest_/, '');
      let guestName = 'אורח מקישור שיתוף';
      for (const it of (space.fileShareItems || []) as any[]) {
        const rec = (it?.shareLink?.recipients || []).find(
          (r: any) => r?.chatChannelId === cid || r?.id === guestKey || r?.token === guestKey
        );
        if (rec?.recipientName) {
          guestName = rec.recipientName;
          subtitle = rec.profession ? `🛠️ ${rec.profession}` : `🔗 ${it.name || 'קישור שיתוף'}`;
          break;
        }
      }
      title = guestName;
    } else if (!isGroup) {
      const matchedMember = (space.members || []).find(
        (m: any) => m?.id === cid || m?.userId === cid || m?.token === cid
      );
      if (matchedMember) {
        title = matchedMember.name || (matchedMember as any).realName || 'שותף במרחב';
        subtitle = 'שיחה אישית 1:1';
      }
    }

    const lastMsg = convo.messages[convo.messages.length - 1];
    const lastAt = lastMsg?.createdAt ? new Date(lastMsg.createdAt).getTime() : 0;

    summaries.push({
      conversationId: cid,
      title,
      subtitle,
      isGuest,
      isGroup,
      unreadCount,
      lastMessageText: String(lastMsg?.text || '').slice(0, 70),
      lastMessageAt: Number.isFinite(lastAt) ? lastAt : 0,
    });
  }

  // Sort: unread conversations first, then most recent
  summaries.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return b.lastMessageAt - a.lastMessageAt;
  });

  const totalUnread = summaries.reduce((acc, s) => acc + s.unreadCount, 0);
  const firstUnreadConvoId = summaries.find((s) => s.unreadCount > 0)?.conversationId || null;

  return { totalUnread, conversations: summaries, firstUnreadConvoId };
}
