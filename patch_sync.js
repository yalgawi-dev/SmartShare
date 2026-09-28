const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `  const handleProviderLogin = async (providerName: 'google' | 'facebook') => {
    setProviderLoading(providerName);
    setPopupBlocked(false);
    try {
      if (providerName === 'google') await loginWithGoogle();
      if (providerName === 'facebook') await loginWithFacebook();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      }
    } finally {
      setProviderLoading(null);
    }
  };`;

const newCode = `  const handleProviderLogin = (providerName: 'google' | 'facebook') => {
    // CRITICAL: Fire login synchronously BEFORE any React state updates to prevent popup blockers!
    const loginPromise = providerName === 'google' ? loginWithGoogle() : loginWithFacebook();
    
    setProviderLoading(providerName);
    setPopupBlocked(false);
    
    loginPromise.then(() => {
      onSuccess?.();
      onClose();
    }).catch((err: any) => {
      if (err?.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      }
    }).finally(() => {
      setProviderLoading(null);
    });
  };`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched AuthModal synchronously");
} else {
  // Try regex
  const regex = /const handleProviderLogin = async \([^)]+\) => \{[\s\S]*?finally \{\s*setProviderLoading\(null\);\s*\}\s*\};/;
  if (regex.test(content)) {
    content = content.replace(regex, newCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Patched AuthModal synchronously via regex");
  } else {
    console.log("Could not find handleProviderLogin block");
  }
}
