const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

const unreadVar = "  const unreadMessagesCount = 0; // TODO: Calculate this dynamically";

c = c.replace(
  'const [showNotifications, setShowNotifications] = useState(false);',
  'const [showNotifications, setShowNotifications] = useState(false);\n' + unreadVar
);

c = c.replace(
  '<button onClick={() => setShowNotifications(true)} style={{ position: \'relative\', padding: \'0.4rem\', background: \'transparent\', border: \'none\', cursor: \'pointer\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: \'1.2rem\', transition: \'transform 0.2s\', borderRadius: \'50%\' }} title="התראות מערכת" onMouseEnter={e => e.currentTarget.style.background = \'var(--bg-hover)\'} onMouseLeave={e => e.currentTarget.style.background = \'transparent\'}>\n              🔔\n              <span style={{ position: \'absolute\', top: \'2px\', right: \'2px\', width: \'10px\', height: \'10px\', background: \'#ef4444\', borderRadius: \'50%\', border: \'2px solid var(--bg-card)\' }}></span>\n            </button>',
  '<button onClick={() => setShowNotifications(true)} style={{ position: \'relative\', padding: \'0.4rem\', background: \'transparent\', border: \'none\', cursor: \'pointer\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: \'1.2rem\', transition: \'transform 0.2s\', borderRadius: \'50%\' }} title="תיבת הודעות" onMouseEnter={e => e.currentTarget.style.background = \'var(--bg-hover)\'} onMouseLeave={e => e.currentTarget.style.background = \'transparent\'}>\n              ✉️\n              {unreadMessagesCount > 0 && (\n                <span style={{ position: \'absolute\', top: \'0px\', right: \'0px\', minWidth: \'16px\', height: \'16px\', background: \'#ef4444\', color: \'white\', borderRadius: \'8px\', border: \'2px solid var(--bg-card)\', fontSize: \'0.6rem\', fontWeight: \'bold\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', padding: \'0 4px\' }}>{unreadMessagesCount}</span>\n              )}\n            </button>'
);

c = c.replace(
  '        {showPersonalInbox && typeof window !== \'undefined\' && createPortal(',
  '        {showNotifications && typeof window !== \'undefined\' && createPortal(\n          <div \n            style={{ position: \'fixed\', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: \'rgba(0,0,0,0.6)\', zIndex: 99999, display: \'flex\', alignItems: \'center\', justifyContent: \'center\' }} \n            onClick={() => setShowNotifications(false)}\n          >\n            <div \n              style={{ background: \'var(--bg-main)\', borderRadius: \'24px\', padding: \'1.5rem\', width: \'90%\', maxWidth: \'400px\', maxHeight: \'85vh\', overflowY: \'auto\' }} \n              onClick={e => e.stopPropagation()}\n            >\n              <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', marginBottom: \'1rem\' }}>\n                <h3 style={{ margin: 0, color: \'var(--text-primary)\' }}>תיבת הודעות והתראות</h3>\n                <button onClick={() => setShowNotifications(false)} style={{ background: \'var(--bg-card)\', border: \'none\', borderRadius: \'50%\', width: \'36px\', height: \'36px\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', cursor: \'pointer\', color: \'var(--text-primary)\', fontSize: \'1.2rem\', boxShadow: \'0 2px 5px rgba(0,0,0,0.1)\' }}>✕</button>\n              </div>\n              <div style={{ textAlign: \'center\', padding: \'2rem 0\', color: \'var(--text-secondary)\' }}>\n                <p style={{ fontSize: \'2rem\', margin: \'0 0 0.5rem 0\' }}>📭</p>\n                <p>אין לך הודעות חדשות כרגע.</p>\n              </div>\n            </div>\n          </div>,\n          document.body\n        )}\n\n        {showPersonalInbox && typeof window !== \'undefined\' && createPortal('
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
