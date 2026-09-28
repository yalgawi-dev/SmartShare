const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const imports = `import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, linkWithPopup, signInWithRedirect } from 'firebase/auth';
`;
content = content.replace("import PhoneLoginFlow from './PhoneLoginFlow';", "import PhoneLoginFlow from './PhoneLoginFlow';\n" + imports);

const startStr = "const handleProviderLogin = (providerName: 'google' | 'facebook') => {";
const endStr = "  };\n\n  return (";
const start = content.indexOf(startStr);
const end = content.indexOf(endStr) + 4;

if (start !== -1 && end !== -1) {
  const newFunc = `const handleProviderLogin = (providerName: 'google' | 'facebook') => {
    // 1. 100% Native Synchronous Call - No React state delays!
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
    
    // Execute Firebase SDK natively in the exact millisecond of the click
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
    
    // 2. Now we can safely update UI
    setProviderLoading(providerName);
    setPopupBlocked(false);
    
    popupPromise.then(() => {
      if (onSuccess) onSuccess();
      onClose();
    }).catch((err: any) => {
      if (err?.code === 'auth/popup-blocked') {
        // ULTIMATE FALLBACK: If Samsung STILL blocks the popup, we do a redirect!
        // Redirects are NEVER blocked by popup blockers because they don't open a new window.
        signInWithRedirect(auth, provider).catch(e => {
          setPopupBlocked(true); // If even redirect fails, show the modal
        });
      } else {
        setPopupBlocked(true); // Or some other error state
      }
    }).finally(() => {
      setProviderLoading(null);
    });
  };`;
  
  content = content.substring(0, start) + newFunc + content.substring(end);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched successfully with ultimate fallback");
} else {
  console.log("Error finding block");
}
