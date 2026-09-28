const fs = require('fs');
const file = 'src/components/auth/PhoneLinkEnforcer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Bypass for admins
content = content.replace('if (user.phone || (user as any).isAnonymous) return null;', 'if (user.phone || (user as any).isAnonymous || user.isAdmin) return null;');

// Try-catch for RecaptchaVerifier
const originalUseEffect = `  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).recaptchaVerifierLink) {
      (window as any).recaptchaVerifierLink = new RecaptchaVerifier(auth, 'recaptcha-container-link', {
        size: 'invisible',
      });
    }
  }, []);`;

const safeUseEffect = `  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).recaptchaVerifierLink) {
      try {
        (window as any).recaptchaVerifierLink = new RecaptchaVerifier(auth, 'recaptcha-container-link', {
          size: 'invisible',
        });
      } catch (e) {
        console.error("Recaptcha error:", e);
      }
    }
  }, []);`;

content = content.replace(originalUseEffect, safeUseEffect);

fs.writeFileSync(file, content, 'utf8');
console.log("PhoneLinkEnforcer fixed");
