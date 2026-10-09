const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

const injection = `
        // Chat Messages (Unread)
        (space.conversations || []).forEach((convo: any) => {
           const myUnread = (convo.messages || []).filter((m: any) => m.senderId !== myActualId && (!m.readBy || !m.readBy.includes(myActualId)));
           if (myUnread.length > 0) {
              const lastMsg = myUnread[myUnread.length - 1];
              notifs.push({
                id: 'chat-' + convo.id + '-' + lastMsg.id,
                type: 'chat',
                priority: 'medium',
                title: 'הודעה חדשה בצ\\'אט (' + myUnread.length + ')',
                text: lastMsg.text,
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: lastMsg.createdAt,
                actionable: true,
                actionUrl: '/space/' + space.id
              });
           }
        });
`;

if (!tx.includes('Chat Messages (Unread)')) {
    tx = tx.replace(
        "// 2. Pending Members",
        injection + "\n        // 2. Pending Members"
    );
    fs.writeFileSync('src/components/widgets/NotificationCenterWidget.tsx', tx);
    console.log("NotificationCenter patched!");
} else {
    console.log("Already patched.");
}
