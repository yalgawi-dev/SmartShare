const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

const regex = /const loginWithGoogle = async \(\) => \{[\s\S]*?catch \(e\) \{\s*console\.error\("Google login failed", e\);\s*\}\s*\};/m;

const newLoginWithGoogle = `const loginWithGoogle = async () => {
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { googleProvider } = await import('@/lib/firebase');
      
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google login success', result.user);
    } catch (e) {
      console.error('Google login failed', e);
      alert('שגיאת התחברות (' + (e.code || 'כללי') + '):\\n' + (e.message || 'לא ידוע'));
    }
  };`;

c = c.replace(regex, newLoginWithGoogle);

let p = fs.readFileSync('src/app/page.tsx', 'utf8');
const base64Hebrew = Buffer.from('תיקון התחברות גוגל (גרסה 4 - חלון חכם)').toString('base64');
p = p.replace(/v4\.5\.1[0-9] - [^<]*/, 'v4.5.14 - ' + Buffer.from(base64Hebrew, 'base64').toString('utf8'));
fs.writeFileSync('src/app/page.tsx', p, 'utf8');

fs.writeFileSync('src/app/context/AuthContext.tsx', c, 'utf8');
