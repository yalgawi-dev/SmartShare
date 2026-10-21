import { Space } from '../app/context/SpacesContext';
import { resolveUserSpaceIdentity } from './partnerUtils';

export interface AppNotification {
  id: string;
  type: 'invoice' | 'dispute' | 'extension' | 'share' | 'system' | 'chat';
  priority: 'high' | 'medium' | 'low';
  title: string;
  text: string;
  spaceId: string;
  spaceName: string;
  createdAt: string;
  actionable: boolean;
  chatType?: 'group' | 'p2p';
  targetId?: string;
  inviteToken?: string;
}

/**
 * Robust sanitizer that detects corrupted character encoding (Latin1/UTF-8 mojibake, URI encoded leftovers, replacement characters)
 * and cleanses or converts them into readable Hebrew/English.
 */
export function sanitizeAlertText(text: any, fallback = 'הודעת מערכת'): string {
  if (!text || typeof text !== 'string') return fallback;
  let str = text.trim();

  // Try decoding URI encoding if present (e.g. %D7%A9%D7%9C%D7%95%D7%9D)
  if (str.includes('%')) {
    try {
      str = decodeURIComponent(str);
    } catch (e) {}
  }

  // Detect common UTF-8 mojibake patterns (e.g. ×©×œ×•×ם)
  if (/[\u00C0-\u00FF][\u0080-\u00BF]/.test(str)) {
    try {
      const decoded = decodeURIComponent(escape(str));
      if (decoded && decoded !== str) {
        str = decoded;
      }
    } catch (e) {}
  }

  // Detect unreadable replacement chars or excessive control/junk characters
  if (str.includes('\uFFFD') || str.includes('ï¿½') || /^[^\p{L}\p{N}\s]{4,}$/u.test(str)) {
    // Return cleansed version or fallback
    str = str.replace(/[\uFFFD|ï¿½]/g, '').trim();
    if (str.length < 2) return fallback;
  }

  return str || fallback;
}

export function calculateSpaceNotifications(spaces: Space[], user: any): AppNotification[] {
  if (!user || !Array.isArray(spaces)) return [];
  const dismissedAlerts: string[] = user.dismissedAlerts || [];

  // Deduplicate spaces by space.id to guarantee no space is evaluated twice
  const uniqueSpaces = Array.from(new Map(spaces.map(s => [s.id, s])).values());
  const notifs: AppNotification[] = [];

  uniqueSpaces.forEach(space => {
    const { myId: myActualId, isCreator } = resolveUserSpaceIdentity(space, user);
    const hasPartners = space.features?.includes('partners');

    // 1. Invoices (pending, missing, dispute)
    (space.invoices || []).forEach(inv => {
      if (inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') {
        if (isCreator || inv.payerId === user.id || (inv as any).uploaderId === user.id) {
          notifs.push({
            id: 'inv-' + inv.id,
            type: 'invoice',
            priority: inv.status === 'dispute' ? 'high' : 'medium',
            title: inv.status === 'dispute' ? 'התראת מחלוקת חשבון' : 'התראת חשבונית ממתינה לטיפול',
            text: 'חשבונית ע"ס ' + (inv.supplier || 'ספק לא ידוע') + ' בסך ₪' + (inv.amount || 0),
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: inv.date || space.createdAt || new Date().toISOString(),
            actionable: true
          });
        }
      }
    });

    if (hasPartners) {
      // 2. Member Alerts
      (space.members || []).forEach(member => {
        if (member.status === 'disputed' && member.disputeMessage && (isCreator || member.userId === user.id)) {
          notifs.push({
            id: 'disp-' + member.userId,
            type: 'dispute',
            priority: 'high',
            title: isCreator ? 'התראת שותף: ' + member.name : 'התראת שותפות במרחב',
            text: member.disputeMessage,
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: member.joinedAt || space.createdAt || new Date().toISOString(),
            actionable: true
          });
        }

        if (member.extensionMessage && isCreator) {
          notifs.push({
            id: 'ext-' + member.userId,
            type: 'extension',
            priority: 'medium',
            title: 'בקשת הערכה: ' + member.name,
            text: member.extensionMessage,
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: space.createdAt || new Date().toISOString(),
            actionable: true
          });
        }

        if (member.shareChangeRequest && (isCreator || member.userId === user.id)) {
          notifs.push({
            id: 'share-' + member.userId,
            type: 'share',
            priority: 'high',
            title: 'שינוי אחוזים דורש אישור',
            text: isCreator ? 'בקשה ממתינה לשינוי של ' + member.name : 'ממתין לאישור מנהל על שינוי אחוזים',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: space.createdAt || new Date().toISOString(),
            actionable: isCreator
          });
        }
      });

      // 3. Pending Invites (Strictly Deduplicated per Space)
      if (isCreator && Array.isArray(space.pendingInvites) && space.pendingInvites.length > 0) {
        // Filter out invites for people who already joined
        const activeInvites = space.pendingInvites.filter((inv: any) => {
          if (!inv || !inv.token) return false;
          const alreadyJoined = (space.members || []).some((m: any) => 
            (inv.targetUserId && m.userId === inv.targetUserId) || 
            (inv.name && inv.name !== 'שותף מוזמן' && m.name === inv.name)
          );
          return !alreadyJoined;
        });

        const namedInvites: any[] = [];
        const genericInvites: any[] = [];

        activeInvites.forEach((inv: any) => {
          const cleanName = inv.name?.trim();
          if (cleanName && cleanName !== 'שותף מוזמן') {
            if (!namedInvites.some(n => n.name.trim() === cleanName)) {
              namedInvites.push(inv);
            }
          } else {
            genericInvites.push(inv);
          }
        });

        // Add named invites (distinct per person)
        namedInvites.forEach(inv => {
          notifs.push({
            id: 'invt-' + (inv.targetUserId || inv.token),
            type: 'system',
            priority: 'low',
            title: 'הזמנה ממתינה',
            text: 'הזמנה ממתינה עבור ' + inv.name + ' - עדיין לא הצטרף/ה',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: inv.createdAt || space.createdAt || new Date().toISOString(),
            actionable: false,
            inviteToken: inv.token
          });
        });

        // Add consolidated generic invite if any exist (EXACTLY ONE notification per space!)
        if (genericInvites.length > 0) {
          const count = genericInvites.length;
          const latestInvite = genericInvites[genericInvites.length - 1];
          notifs.push({
            id: 'invt-space-' + space.id,
            type: 'system',
            priority: 'low',
            title: 'הזמנה ממתינה',
            text: count === 1 ? 'שותף הוזמן ועדיין לא הצטרף למרחב' : count + ' שותפים הוזמנו ועדיין לא הצטרפו למרחב',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: latestInvite.createdAt || space.createdAt || new Date().toISOString(),
            actionable: false,
            inviteToken: latestInvite.token
          });
        }
      }

      // 4. Pending Group Approval Requests
      (space.pendingGroupMembers || []).forEach((pending: any) => {
        notifs.push({
          id: 'grp-pend-' + pending.id,
          type: 'system',
          priority: 'high',
          title: 'בקשת הצטרפות לקבוצה',
          text: pending.name + ' ממתין/ה לאישורך להצטרף למרחב.',
          spaceId: space.id,
          spaceName: space.title || 'מרחב',
          createdAt: pending.requestedAt || space.createdAt || new Date().toISOString(),
          actionable: true
        });
      });
    }

    // 5. Chat Notifications (Group + P2P) - Single Source of Truth
    if (space.features?.includes('chat') && Array.isArray(space.conversations)) {
      space.conversations.forEach((convo: any) => {
        if (convo.id === 'group') {
          const unreadGroup = (convo.messages || []).filter((msg: any) => {
            if (msg.senderId === user?.id || (myActualId && msg.senderId === myActualId)) return false;
            const isRead = (user?.id && msg.readBy?.includes(user?.id)) || (myActualId && msg.readBy?.includes(myActualId));
            return !isRead;
          });

          if (unreadGroup.length > 0) {
            const latestMsg = unreadGroup[unreadGroup.length - 1];
            notifs.push({
              id: 'chat-group-' + space.id + '-' + latestMsg.id,
              type: 'chat',
              chatType: 'group',
              targetId: 'group',
              priority: 'low',
              title: 'שיחה קבוצתית',
              text: 'יש לך ' + unreadGroup.length + ' הודעות חדשות בקבוצת המרחב.',
              spaceId: space.id,
              spaceName: space.title || 'מרחב',
              createdAt: latestMsg.createdAt || space.createdAt || new Date().toISOString(),
              actionable: true
            });
          }
        } else {
          // P2P conversation
          const participants = convo.participants || (convo.id ? convo.id.split('_') : []);
          const isParticipant = participants.includes(myActualId) || (user?.id && participants.includes(user.id));
          if (!isParticipant) return;

          const unreadChatMessages = (convo.messages || []).filter((msg: any) => {
            if (msg.senderId === user?.id || (myActualId && msg.senderId === myActualId)) return false;
            const isRead = (user?.id && msg.readBy?.includes(user?.id)) || (myActualId && msg.readBy?.includes(myActualId));
            return !isRead;
          });

          if (unreadChatMessages.length > 0) {
            const otherId = participants.find((p) => p !== myActualId && p !== user?.id) || participants[0];
            const isOtherCreator = otherId === space.creatorId || otherId === space.createdBy || otherId === 'creator';
            let otherName = 'שותף במרחב';
            if (isOtherCreator) {
              otherName = (space as any).creatorName || (space.members?.find((m) => m.userId === space.creatorId)?.name) || space.createdBy || 'מנהל המרחב';
            } else {
              const partnerMember = (space.members || []).find((m) => m.userId === otherId);
              if (partnerMember) {
                otherName = partnerMember.name;
              } else {
                const invite = (space.pendingInvites || []).find((inv) => inv.token === otherId);
                if (invite) otherName = invite.name || 'שותף מוזמן';
              }
            }

            const latestMsg = unreadChatMessages[unreadChatMessages.length - 1];
            notifs.push({
              id: 'chat-' + space.id + '-' + otherId + '-' + latestMsg.id,
              type: 'chat',
              chatType: 'p2p',
              targetId: otherId,
              priority: 'low',
              title: 'הודעה חדשה בפרטי מאת ' + otherName,
              text: 'יש לך ' + unreadChatMessages.length + ' הודעות חדשות מאת ' + otherName + '.',
              spaceId: space.id,
              spaceName: space.title || 'מרחב',
              createdAt: latestMsg.createdAt || space.createdAt || new Date().toISOString(),
              actionable: true
            });
          }
        }
      });
    }

    // 6. Legacy fallback for old member messages
    if (space.features?.includes('chat')) {
      (space.members || []).forEach(member => {
        const legacyUnread = (member.messages || []).filter((msg: any) => {
          if (msg.readAt) return false;
          if (isCreator && msg.from === 'partner') return true;
          if (!isCreator && member.userId === user?.id && msg.from === 'creator') return true;
          return false;
        });
        if (legacyUnread.length > 0) {
          const latest = legacyUnread[legacyUnread.length - 1];
          const notifId = 'chat-' + space.id + '-' + member.userId + '-' + (latest.id || latest.date || 'legacy');
          notifs.push({
            id: notifId,
            type: 'chat',
            chatType: 'p2p',
            targetId: member.userId,
            priority: 'low',
            title: 'הודעה חדשה בפרטי',
            text: 'יש לך ' + legacyUnread.length + ' הודעות חדשות מאת ' + member.name + '.',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: latest.date || space.createdAt || new Date().toISOString(),
            actionable: true
          });
        }
      });
    }
  });

  // STRUCTURAL DEDUPLICATION & SANITIZATION GUARANTEE:
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  return notifs.map(n => ({
    ...n,
    title: sanitizeAlertText(n.title, 'התראת מערכת'),
    text: sanitizeAlertText(n.text, 'עדכון במרחב'),
    spaceName: sanitizeAlertText(n.spaceName, 'מרחב')
  })).filter(n => {
    if (dismissedAlerts.includes(n.id)) return false;
    if (n.type === 'system' && dismissedAlerts.includes('invt-space-' + n.spaceId)) return false;

    if (seenIds.has(n.id)) return false;

    const signature = (n.type + ':::' + n.spaceId + ':::' + n.title + ':::' + n.text).trim();
    if (seenSignatures.has(signature)) return false;

    seenIds.add(n.id);
    seenSignatures.add(signature);
    return true;
  });
}

export function getUnreadAlertsCount(spaces: Space[], user: any): number {
  return calculateSpaceNotifications(spaces, user).length;
}
