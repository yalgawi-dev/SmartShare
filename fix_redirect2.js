const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

const oldUseEffect = \useEffect(() => {
      // 1. Firebase Auth Listener\;

const newUseEffect = \useEffect(() => {
      import('firebase/auth').then(({ getRedirectResult }) => {
        getRedirectResult(auth).then((result) => {
          if (result && result.user) {
            console.log("Successfully logged in via redirect", result.user);
          }
        }).catch((e) => {
          console.error("Redirect login error:", e);
        });
      });

      // 1. Firebase Auth Listener\;

if(c.includes(oldUseEffect)) {
    c = c.replace(oldUseEffect, newUseEffect);
    fs.writeFileSync('src/app/context/AuthContext.tsx', c, 'utf8');
}

let p = fs.readFileSync('src/app/page.tsx', 'utf8');
const base64Hebrew = Buffer.from('תיקון התחברות גוגל (גרסה 3)').toString('base64');
p = p.replace(/v4\.5\.1[0-9] - [^<]*/, 'v4.5.13 - ' + Buffer.from(base64Hebrew, 'base64').toString('utf8'));
fs.writeFileSync('src/app/page.tsx', p, 'utf8');
