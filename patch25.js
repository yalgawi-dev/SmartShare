const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

const searchStr =         if (member.shareChangeRequest && (isCreator || member.userId === user.id)) {
          notifs.push({
            id: 'share-' + member.userId,
            type: 'share',
            priority: 'high',
            title: 'שינוי אחוזי שותפות',
            text: isCreator ? 'בקשה לאישור שינוי עבור ' + member.name : 'ממתין לאישור שינוי אחוזים',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: new Date().toISOString(),
            actionable: isCreator
          });
        }
      });;

const replaceStr =         if (member.shareChangeRequest && (isCreator || member.userId === user.id)) {
          notifs.push({
            id: 'share-' + member.userId,
            type: 'share',
            priority: 'high',
            title: 'שינוי אחוזי שותפות',
            text: isCreator ? 'בקשה לאישור שינוי עבור ' + member.name : 'ממתין לאישור שינוי אחוזים',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: new Date().toISOString(),
            actionable: isCreator
          });
        }
        
        // Chat Unread Summary
        const unreadChatMessages = (member.messages || []).filter((msg: any) => {
          if (msg.readAt) return false;
          if (isCreator && msg.from === 'partner') return true;
          if (!isCreator && member.userId === user.id && msg.from === 'creator') return true;
          return false;
        });

        if (unreadChatMessages.length > 0) {
          notifs.push({
            id: 'chat-' + member.userId,
            type: 'chat',
            priority: 'low',
            title: 'הודעות חדשות בצ\\'אט',
            text: 'יש לך ' + unreadChatMessages.length + ' הודעות שלא נקראו מ' + (isCreator ? member.name : 'מנהל המרחב') + '.',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: unreadChatMessages[unreadChatMessages.length - 1].createdAt || new Date().toISOString(),
            actionable: true
          });
        }
      });;

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
