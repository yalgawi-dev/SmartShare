const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

const searchStr =   const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    spaces.forEach(space => {
      const isCreator = space.creatorId === user.id;
      (space.invoices || []).forEach(inv => {
        if ((inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') && (isCreator || inv.payerId === user.id || (inv as any).uploaderId === user.id)) count++;
      });
      (space.members || []).forEach(member => {
        if (member.disputeMessage && (isCreator || member.userId === user.id)) count++;
        if (member.extensionMessage && isCreator) count++;
        if (member.shareChangeRequest && (isCreator || member.userId === user.id)) count++;
      });
    });
    return count;
  }, [spaces, user]);;

const replaceStr =   const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    const dismissedAlerts = user.dismissedAlerts || [];
    let count = 0;
    spaces.forEach(space => {
      const isCreator = space.creatorId === user.id;
      (space.invoices || []).forEach(inv => {
        if (!dismissedAlerts.includes('inv-' + inv.id)) {
          if ((inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') && (isCreator || inv.payerId === user.id || (inv as any).uploaderId === user.id)) count++;
        }
      });
      (space.members || []).forEach(member => {
        if (member.disputeMessage && (isCreator || member.userId === user.id) && !dismissedAlerts.includes('disp-' + member.userId)) count++;
        if (member.extensionMessage && isCreator && !dismissedAlerts.includes('ext-' + member.userId)) count++;
        if (member.shareChangeRequest && (isCreator || member.userId === user.id) && !dismissedAlerts.includes('share-' + member.userId)) count++;
      });
      if (isCreator) {
        (space.pendingInvites || []).forEach((invite: any) => {
          if (!dismissedAlerts.includes('invt-' + invite.token)) count++;
        });
      }
    });
    return count;
  }, [spaces, user]);;

c = c.replace(searchStr, replaceStr);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
