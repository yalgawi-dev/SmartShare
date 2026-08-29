const fs = require('fs');

let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

const oldUseEffect = `useEffect(() => {
      // 1. Firebase Auth Listener`;

const newUseEffect = `useEffect(() => {
      import('firebase/auth').then(({ getRedirectResult }) => {
        getRedirectResult(auth).then((result) => {
          if (result && result.user) {
            console.log("Successfully logged in via redirect", result.user);
          }
        }).catch((e) => {
          console.error("Redirect login error:", e);
          alert("שגיאת התחברות: " + (e.message || ""));
        });
      });

      // 1. Firebase Auth Listener`;

c = c.replace(oldUseEffect, newUseEffect);
fs.writeFileSync('src/app/context/AuthContext.tsx', c, 'utf8');

// Also update page version
let p = fs.readFileSync('src/app/page.tsx', 'utf8');
p = p.replace(/v4\.5\.12 - [^<]*/, 'v4.5.13 - ' + Buffer.from('16rXmden15XXnyDXltex15XXkdeo15XXqiAoe3ZlcnNpb24gM30p', 'base64').toString('utf8'));
fs.writeFileSync('src/app/page.tsx', p, 'utf8');
