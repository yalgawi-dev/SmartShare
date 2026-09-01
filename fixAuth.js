const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf-8');

c = c.replace(
  "const { signInWithPopup } = await import('firebase/auth');",
  "const { signInWithPopup, linkWithPopup } = await import('firebase/auth');"
);

c = c.replace(
  "const result = await signInWithPopup(auth, googleProvider);",
  `let result;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          result = await linkWithPopup(auth.currentUser, googleProvider);
        } catch (linkError) {
          if (linkError.code === 'auth/credential-already-in-use') {
            result = await signInWithPopup(auth, googleProvider);
          } else {
            throw linkError;
          }
        }
      } else {
        result = await signInWithPopup(auth, googleProvider);
      }`
);

fs.writeFileSync('src/app/context/AuthContext.tsx', c);
console.log('Fixed AuthContext');
