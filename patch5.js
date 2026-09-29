const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

c = "import NotificationCenterWidget from '../components/widgets/NotificationCenterWidget';\n" + c;

const searchStr = "  const unreadMessagesCount = 0; // TODO: Calculate this dynamically";
const replaceStr =   const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    spaces.forEach(space => {
      const isCreator = space.creatorId === user.id;
      (space.members || []).forEach(member => {
        (member.messages || []).forEach(msg => {
          if (!msg.readAt) {
            if (isCreator && msg.from === 'partner') count++;
            else if (!isCreator && member.userId === user.id && msg.from === 'creator') count++;
          }
        });
      });
    });
    return count;
  }, [spaces, user]);;

c = c.replace(searchStr, replaceStr);

c = c.replace('✉️', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: \'#eab308\'}}><path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" /><rect x="3" y="5" width="18" height="14" rx="2" /></svg>');

c = c.replace(/\{showNotifications && typeof window !== 'undefined' && createPortal\([\s\S]*?document\.body\n\s*\)\}/, '{showNotifications && typeof window !== \'undefined\' && createPortal(<NotificationCenterWidget onClose={() => setShowNotifications(false)} />, document.body)}');

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
