const fs = require('fs');
let code = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

const oldFunc = `const addShelfEventComment = (spaceId: string, eventId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelfEvents: (space.shelfEvents || []).map(e => {
        if (e.id === eventId) {
          const newComment: ShelfEventComment = {
            id: Math.random().toString(36).substring(2, 9),
            userId: user?.id || '',
            text,
            createdAt: new Date().toISOString()
          };
          return { ...e, comments: [...(e.comments || []), newComment] };
        }
        return e;
      })
    }));
  };`;

const newFunc = `const addShelfEventComment = (spaceId: string, eventId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => {
      let eventTitle = '';
      const newSpace = {
        ...space,
        shelfEvents: (space.shelfEvents || []).map(e => {
          if (e.id === eventId) {
            eventTitle = e.title;
            const newComment: ShelfEventComment = {
              id: Math.random().toString(36).substring(2, 9),
              userId: user?.id || '',
              text,
              createdAt: new Date().toISOString()
            };
            return { ...e, comments: [...(e.comments || []), newComment] };
          }
          return e;
        })
      };

      setTimeout(() => {
        const senderName = user?.realName || user?.displayName || 'שותף';
        const allIds = [space.creatorId, ...(space.members || []).map((m: any) => m.userId)];
        // Add anyone else who commented on this event (useful if guests don't have user.id)
        const event = space.shelfEvents?.find(e => e.id === eventId);
        if (event?.comments) {
           event.comments.forEach(c => allIds.push(c.userId));
        }
        
        const otherUserIds = Array.from(new Set(allIds)).filter(id => id && id !== user?.id);
        
        if (otherUserIds.length > 0) {
          const inboxItems = otherUserIds.map(uid => ({
            userId: uid,
            type: 'timeline_comment' as any,
            title: 'תגובה חדשה במסמכים',
            message: \`\${senderName} הגיב על "\${eventTitle}": \${text}\`,
            isRead: false,
            actionUrl: \`/space/\${spaceId}?tab=documents\`
          }));
          addInboxItems(spaceId, inboxItems);
        }
      }, 0);

      return newSpace;
    });
  };`;

if(code.includes(oldFunc)) {
  code = code.replace(oldFunc, newFunc);
  fs.writeFileSync('src/app/context/SpacesContext.tsx', code);
  console.log("SpacesContext Patched successfully!");
} else {
  console.log("Could not find the original function to replace.");
}
