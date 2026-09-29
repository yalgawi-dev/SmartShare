const fs = require('fs');
let file = 'src/components/GlobalPWAPrompt.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update onTrigger to show the prompt again
const oldTrigger = \const onTrigger = () => { /* noop, keep hook alive */ };\;
const newTrigger = \const onTrigger = () => { 
      try { localStorage.removeItem('pwa_v5'); } catch (e) {}
      setShowGuide(false);
      
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isAndroid = /Android/.test(ua);
      const isWebView = ua.includes('WhatsApp') || ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('Instagram') || /wv\\)/.test(ua) || ua.includes('SamsungBrowser');
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

      if (isAndroid && isWebView)      setPlatform('android-webview');
      else if (isAndroid)              setPlatform('android-chrome');
      else if (isIOS && isWebView)     setPlatform('ios-webview');
      else if (isIOS && isSafari)      setPlatform('ios-safari');
      else                             setPlatform('other');
    };\;

content = content.replace(oldTrigger, newTrigger);
fs.writeFileSync(file, content, 'utf8');
