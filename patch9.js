const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

const searchStr = "  const unreadMessagesCount = useMemo(() => {\n" +
"    if (!user) return 0;\n" +
"    let count = 0;\n" +
"    spaces.forEach(space => {\n" +
"      const isCreator = space.creatorId === user.id;\n" +
"      (space.members || []).forEach(member => {\n" +
"        (member.messages || []).forEach(msg => {\n" +
"          if (!msg.readAt) {\n" +
"            if (isCreator && msg.from === 'partner') count++;\n" +
"            else if (!isCreator && member.userId === user.id && msg.from === 'creator') count++;\n" +
"          }\n" +
"        });\n" +
"      });\n" +
"    });\n" +
"    return count;\n" +
"  }, [spaces, user]);";

const replaceStr =   const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    spaces.forEach(space => {
      const isCreator = space.creatorId === user.id;
      (space.invoices || []).forEach(inv => {
        if ((inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') && (isCreator || inv.payerId === user.id || inv.uploaderId === user.id)) count++;
      });
      (space.members || []).forEach(member => {
        if (member.disputeMessage && (isCreator || member.userId === user.id)) count++;
        if (member.extensionMessage && isCreator) count++;
        if (member.shareChangeRequest && (isCreator || member.userId === user.id)) count++;
      });
    });
    return count;
  }, [spaces, user]);;

c = c.replace(searchStr, replaceStr);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
