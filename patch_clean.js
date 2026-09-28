const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const imports = `import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, linkWithPopup, signInWithRedirect } from 'firebase/auth';
`;
content = content.replace("import PhoneLoginFlow from './PhoneLoginFlow';", "import PhoneLoginFlow from './PhoneLoginFlow';\n" + imports);

const oldFuncRegex = /const handleProviderLogin = \([^)]+\) => \{[\s\S]*?finally \{\s*setProviderLoading\(null\);\s*\}\s*\};\s*/;

const newFunc = `const handleProviderLogin = (providerName: 'google' | 'facebook') => {
    // 1. 100% Native Synchronous Call - No React state delays!
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
    
    // 2. Now update UI
    setProviderLoading(providerName);
    setPopupBlocked(false);
    
    popupPromise.then(() => {
      if (onSuccess) onSuccess();
      onClose();
    }).catch((err: any) => {
      if (err?.code === 'auth/popup-blocked') {
        // ULTIMATE FALLBACK: Redirect directly instead of showing popup-blocked warning
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

content = content.replace(oldFuncRegex, newFunc);
fs.writeFileSync(file, content, 'utf8');
console.log("Patched clean");
