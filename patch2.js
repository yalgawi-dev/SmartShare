const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

c = c.replace(
  /<button onClick=\{\(\) => setShowShareModal\(true\)\}[^>]*>\s*[^<]*\s*<\/button>/,
  '<button onClick={() => setShowNotifications(true)} style={{ position: \'relative\', padding: \'0.4rem\', background: \'transparent\', border: \'none\', cursor: \'pointer\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: \'1.2rem\', transition: \'transform 0.2s\', borderRadius: \'50%\' }} title="התראות מערכת" onMouseEnter={e => e.currentTarget.style.background = \'var(--bg-hover)\'} onMouseLeave={e => e.currentTarget.style.background = \'transparent\'}>\n              🔔\n              <span style={{ position: \'absolute\', top: \'2px\', right: \'2px\', width: \'10px\', height: \'10px\', background: \'#ef4444\', borderRadius: \'50%\', border: \'2px solid var(--bg-card)\' }}></span>\n            </button>\n$&'
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');
