'use client';

import { useState, useEffect } from 'react';

export default function GlobalPWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
      
      if (!isStandalone && !isDismissed) {
        setShowPrompt(true);
      }

      const ua = window.navigator.userAgent;
      setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

      let savedPrompt: any = null;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        savedPrompt = e;
        setDeferredPrompt(e);
      });

      const manualTrigger = async () => {
        if (savedPrompt) {
          savedPrompt.prompt();
          const { outcome } = await savedPrompt.userChoice;
          if (outcome === 'accepted') {
            setShowPrompt(false);
          }
          savedPrompt = null;
          setDeferredPrompt(null);
        } else {
          setShowInstructions(true);
          setShowPrompt(false);
        }
      };
      
      window.addEventListener('trigger-pwa-install', manualTrigger);
      
      return () => {
        window.removeEventListener('trigger-pwa-install', manualTrigger);
      };
    }
  }, []);

  if (!showPrompt && !showInstructions) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Native prompt not available (e.g. iOS Safari), show instructions
      setShowInstructions(true);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <>
      {showPrompt && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 9999,
          border: '1px solid #e2e8f0',
          width: '90%',
          maxWidth: '400px'
        }}>
          <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
            התקן את חלל הפרויקט (מומלץ)
          </div>
          <button 
            onClick={handleInstallClick}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            התקן כעת
          </button>
          <button onClick={handleDismiss} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>
            ×
          </button>
        </div>
      )}

      {showInstructions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '2rem', boxSizing: 'border-box', animation: 'slideUp 0.3s ease-out' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', textAlign: 'center' }}>איך להתקין את האפליקציה?</h3>
            {isIOS ? (
              <div style={{ fontSize: '1.1rem', color: '#334155', textAlign: 'center', lineHeight: 1.6 }}>
                <p>1. לחץ על כפתור ה<strong>שיתוף</strong> (Share) בתחתית המסך <span>(ריבוע עם חץ למעלה)</span></p>
                <p>2. בחר באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen)</p>
                <p>3. אשר למעלה (Add)</p>
              </div>
            ) : (
              <div style={{ fontSize: '1.1rem', color: '#334155', textAlign: 'center', lineHeight: 1.6 }}>
                <p>1. לחץ על <strong>תפריט 3 הנקודות</strong> למעלה</p>
                <p>2. בחר באפשרות <strong>"התקן אפליקציה"</strong> או "הוסף למסך הבית"</p>
                <p>3. אשר את ההתקנה</p>
              </div>
            )}
            <button 
              onClick={() => setShowInstructions(false)}
              style={{ width: '100%', padding: '1rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '2rem', cursor: 'pointer', fontSize: '1rem' }}
            >
              הבנתי, סגור
            </button>
          </div>
        </div>
      )}
    </>
  );
}
