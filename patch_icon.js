const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const regex = /<button onClick=\{\(\) => setShowShareModal\(true\)\}[\s\S]*?<span>🎁<\/span><span>הזמן חבר<\/span>\s*<\/button>/;
const newBtn = `<button onClick={() => setShowShareModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all 0.2s', borderRadius: '50%' }} title="שתף אפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>`;

content = content.replace(regex, newBtn);
content = content.replace('v6.7.21', 'v6.7.22');
fs.writeFileSync('src/app/page.tsx', content);
