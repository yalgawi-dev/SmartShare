const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFuncRegex = /const handleProviderLogin = \([^)]+\) => \{[\s\S]*?finally \{\s*setProviderLoading\(null\);\s*\}\s*\};/;

const newFunc = `const handleProviderLogin = (providerName: 'google' | 'facebook') => {
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
    
    let popupPromise;
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      popupPromise = linkWithPopup(auth.currentUser, provider).catch(err => {
        if (err.code === 'auth/credential-already-in-use') {
          return signInWithPopup(auth, provider);
        }
        throw err;
      });
    } else {
      popupPromise = signInWithPopup(auth, provider);
    }
    
    setProviderLoading(providerName);
    setPopupBlocked(false);
    
    popupPromise.then(() => {
      if (onSuccess) onSuccess();
      onClose();
    }).catch((err: any) => {
      if (err?.code === 'auth/popup-blocked') {
        // Redirect completely fails on Vercel due to ITP (Storage Partitioning).
        // Therefore, we MUST show the user that their browser is blocking it and suggest Phone auth.
        setPopupBlocked(true);
      } else {
        setPopupBlocked(true);
      }
    }).finally(() => {
      setProviderLoading(null);
    });
  };`;

content = content.replace(oldFuncRegex, newFunc);
fs.writeFileSync(file, content, 'utf8');
console.log("Reverted to popup block handling");
