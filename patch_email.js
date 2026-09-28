const fs = require('fs');
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Check if auth is imported
if (!content.includes('import { auth }')) {
  content = content.replace('import { db } from', "import { auth, db } from");
}

const targetInput = `<input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="your@email.com" style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />`;

const replacementInput = `
              {auth.currentUser?.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com' || p.providerId === 'apple.com') ? (
                <div style={{ position: 'relative' }}>
                  <input type="email" value={email} disabled style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>מייל זה מסונכרן אוטומטית מחשבון ההתחברות שלך ומוגן משינויים.</span>
                </div>
              ) : (
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="הזן מייל לקבלת חשבוניות" style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              )}
`;

if (content.includes(targetInput)) {
  content = content.replace(targetInput, replacementInput);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched settings email field");
} else {
  console.log("Could not find target input");
}
