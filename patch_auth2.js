const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const start = content.indexOf('const handleProviderLogin =');
const end = content.indexOf('return (', start);

if (start !== -1 && end !== -1) {
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
        signInWithRedirect(auth, provider).catch(e => {
          setPopupBlocked(true);
        });
      } else {
        setPopupBlocked(true);
      }
    }).finally(() => {
      setProviderLoading(null);
    });
  };

  `;
  
  content = content.substring(0, start) + newFunc + content.substring(end);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched successfully via direct index");
} else {
  console.log("Error finding block");
}
