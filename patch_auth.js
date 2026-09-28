const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "const handleProviderLogin = (providerName: 'google' | 'facebook') => {";
const endStr = "  };\n\n  return (";
const start = content.indexOf(startStr);
const end = content.indexOf(endStr);

if (start === -1 || end === -1) {
  console.log("Could not find start or end index.");
  process.exit(1);
}

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

content = content.substring(0, start) + newFunc + content.substring(end + endStr.length - 12);
// wait, substring(end + endStr.length - 12) is error prone.
// Let's just do content.substring(end)
fs.writeFileSync(file, content.substring(0, start) + newFunc + "\n" + content.substring(end), 'utf8');
console.log("Patched successfully");
