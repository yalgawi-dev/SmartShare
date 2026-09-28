const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Firebase imports
const imports = `import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, linkWithPopup, signInWithRedirect } from 'firebase/auth';
`;

content = content.replace("import PhoneLoginFlow from './PhoneLoginFlow';", "import PhoneLoginFlow from './PhoneLoginFlow';\n" + imports);

// 2. Replace handleProviderLogin
const oldFuncRegex = /const handleProviderLogin = \([^)]+\) => \{[\s\S]*?finally \{\s*setProviderLoading\(null\);\s*\}\s*\};/;

const newFunc = `const handleProviderLogin = (providerName: 'google' | 'facebook') => {
    // 100% Native Synchronous Call - No React state delays!
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
    
    // Now we can safely update UI
    setProviderLoading(providerName);
    setPopupBlocked(false);
    
    popupPromise.then(() => {
      onSuccess?.();
      onClose();
    }).catch((err: any) => {
      if (err?.code === 'auth/popup-blocked') {
        // ULTIMATE FALLBACK: If Samsung STILL blocks the popup, we do a redirect!
        // Redirects are never blocked.
        signInWithRedirect(auth, provider).catch(e => {
          setPopupBlocked(true); // If even redirect fails, show the modal
        });
      } else {
        setPopupBlocked(true);
      }
    }).finally(() => {
      setProviderLoading(null);
    });
  };`;

if (oldFuncRegex.test(content)) {
  content = content.replace(oldFuncRegex, newFunc);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched handleProviderLogin with Ultimate Fallback");
} else {
  console.log("Could not find handleProviderLogin");
}
