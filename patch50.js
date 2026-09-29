const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

const regex = /\/\/ Chat Unread Summary[\s\S]*?actionable: true\n          \}\);\n        \}\n/g;

const newChatLogic = // Chat Unread Summary
        const p2pConvoId = [user.id, member.userId].sort().join('_');
        const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
        let unreadChatMessages = convo?.messages?.filter((msg: any) => !msg.readBy?.includes(user.id)) || [];
        
        // Legacy fallback
        if (unreadChatMessages.length === 0) {
          unreadChatMessages = (member.messages || []).filter((msg: any) => {
            if (msg.readAt) return false;
            if (isCreator && msg.from === 'partner') return true;
            if (!isCreator && member.userId === user.id && msg.from === 'creator') return true;
            return false;
          });
        }

        if (unreadChatMessages.length > 0) {
          notifs.push({
            id: 'chat-' + member.userId,
            type: 'chat',
            priority: 'low',
            title: "הודעות חדשות בצ'אט",
            text: 'יש לך ' + unreadChatMessages.length + ' הודעות שלא נקראו מ' + (isCreator ? member.name : 'מנהל המרחב') + '.',
            spaceId: space.id,
            spaceName: space.title || 'מרחב',
            createdAt: unreadChatMessages[unreadChatMessages.length - 1].createdAt || new Date().toISOString(),
            actionable: true
          });
        }
;

c = c.replace(regex, newChatLogic);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
