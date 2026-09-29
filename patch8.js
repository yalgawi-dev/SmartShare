const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

c = "import NotificationCenterWidget from '../components/widgets/NotificationCenterWidget';\n" + c;

const showNotifCode = "  const [showNotifications, setShowNotifications] = useState(false);\n" +
"  const unreadMessagesCount = useMemo(() => {\n" +
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
"  }, [spaces, user]);\n";

c = c.replace(
  'const [showPersonalInbox, setShowPersonalInbox] = useState(false);',
  'const [showPersonalInbox, setShowPersonalInbox] = useState(false);\n' + showNotifCode
);

const svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';

c = c.replace(
  /<button onClick=\{\(\) => setShowShareModal\(true\)\}[^>]*>\s*[^<]*\s*<\/button>/,
  '<button onClick={() => setShowNotifications(true)} style={{ position: \'relative\', padding: \'0.4rem\', background: \'transparent\', border: \'none\', cursor: \'pointer\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', transition: \'transform 0.2s\', borderRadius: \'50%\' }} title="התראות מערכת" onMouseEnter={e => e.currentTarget.style.background = \'var(--bg-hover)\'} onMouseLeave={e => e.currentTarget.style.background = \'transparent\'}>\n              ' + svgIcon + '\n              {unreadMessagesCount > 0 && <span style={{ position: \'absolute\', top: \'0px\', right: \'0px\', minWidth: \'16px\', height: \'16px\', background: \'#ef4444\', color: \'white\', borderRadius: \'8px\', border: \'2px solid var(--bg-card)\', fontSize: \'0.6rem\', fontWeight: \'bold\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', padding: \'0 4px\' }}>{unreadMessagesCount}</span>}\n            </button>\n$&'
);

const renderNotifCode = "{showNotifications && typeof window !== 'undefined' && createPortal(<NotificationCenterWidget onClose={() => setShowNotifications(false)} />, document.body)}\n";

c = c.replace(
  '{showPersonalInbox && typeof window !== \'undefined\' && createPortal(',
  renderNotifCode + '        {showPersonalInbox && typeof window !== \'undefined\' && createPortal('
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
