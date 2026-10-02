const fs = require('fs');
let txt = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

const sendMsgSearch = `      const updatedConvos = [...convos.filter(c => c.id !== conversationId), { ...convo, messages: [...convo.messages, newMsg] }];
      return { ...space, conversations: updatedConvos };
    });`;
const sendMsgReplace = `      const updatedConvos = [...convos.filter(c => c.id !== conversationId), { ...convo, messages: [...convo.messages, newMsg] }];
      
      setTimeout(() => {
        const title = conversationId === 'group' ? "הודעה חדשה בקבוצה: " + (space.title || 'מרחב') : "הודעה חדשה בפרטי: " + (space.title || 'מרחב');
        const senderName = senderId === space.creatorId ? (space.createdBy || 'מנהל') : (space.members?.find((m: any) => m.userId === senderId)?.name || 'שותף');
        const body = senderName + ": " + text.trim();
        let otherUserIds: string[] = [];
        if (conversationId === 'group') {
          otherUserIds = [space.creatorId, ...(space.members || []).map((m: any) => m.userId)].filter(id => id && id !== senderId);
        } else {
          otherUserIds = conversationId.split('_').filter(id => id && id !== senderId);
        }
        triggerPushNotification(otherUserIds, title, body, { url: '/space/' + spaceId });
      }, 0);

      return { ...space, conversations: updatedConvos };
    });`;

txt = txt.replace(sendMsgSearch, sendMsgReplace);

const inviteSearch = `          createdAt: new Date().toISOString(),
          targetUserId: inviteData.targetUserId
      };

      return {`;
const inviteReplace = `          createdAt: new Date().toISOString(),
          targetUserId: inviteData.targetUserId
      };

      if (inviteData.targetUserId) {
        setTimeout(() => {
          triggerPushNotification([inviteData.targetUserId as string], "הזמנה למרחב", (space.createdBy || 'מנהל') + " הזמין אותך לפרויקט " + (space.title || 'חדש'), { url: '/join/' + inviteData.token });
        }, 0);
      }

      return {`;

txt = txt.replace(inviteSearch, inviteReplace);

fs.writeFileSync('src/app/context/SpacesContext.tsx', txt);
console.log('Replaced Push Notifications triggers');
