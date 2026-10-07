const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const regex = /<button onClick=\{\(\) => setShowShareModal\(true\)\}[\s\S]*?🔗\s*<\/button>/;
const newBtn = `<button onClick={() => setShowShareModal(true)} style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)', transition: 'transform 0.2s', borderRadius: '20px' }} title="הזמן לאפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span>🎁</span><span>הזמן חבר</span>
            </button>`;

content = content.replace(regex, newBtn);
fs.writeFileSync('src/app/page.tsx', content);
