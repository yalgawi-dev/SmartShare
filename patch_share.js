const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

const oldShareBtn = `<button onClick={() => setShowShareModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all 0.2s', borderRadius: '50%' }} title="שתף אפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>`;

const newShareBtn = `<button onClick={() => setShowShareModal(true)} style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--text-secondary)', transition: 'all 0.2s', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }} title="שתף אפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              <span>הזמן חברים</span>
            </button>`;

tx = tx.replace(oldShareBtn, newShareBtn);
tx = tx.replace(/v6\.7\.52/g, 'v6.7.53');

fs.writeFileSync('src/app/page.tsx', tx);
console.log("Patched SpacePage share button");
