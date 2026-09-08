'use client';

import { useState, useEffect } from 'react';

export default function GlobalPWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      let isDismissed = false;
      try {
        isDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
      } catch (e) {}
      
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
      setShowInstructions(true);
    }
  };

  return (
    <>
      {showPrompt && (
        <button
          onClick={handleInstallClick}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 9000,
            background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '0.4rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(74,91,240,0.3)',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            animation: 'pulse 2s infinite'
          }}
          title="התקן אפליקציה"
        >
          <span style={{ fontSize: '1.1rem' }}>📱</span>
          <span>התקן</span>
        </button>
      )}

      {showInstructions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', textAlign: 'center', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button 
              onClick={() => setShowInstructions(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
            <div style={{ fontSize: '3rem', margin: '0 auto 1rem auto', width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📱</div>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', textAlign: 'center', fontSize: '1.25rem' }}>התקנת האפליקציה</h3>
            
            {isIOS ? (
              <div style={{ fontSize: '1.05rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>📤</span>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>1. לחץ על כפתור ה<strong>שיתוף</strong> בתחתית המסך</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>➕</span>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>2. בחר באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen)</p>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '1.05rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>⋮</span>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>1. לחץ על <strong>תפריט 3 הנקודות</strong> של הדפדפן (למעלה)</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>📱</span>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>2. בחר באפשרות <strong>"התקן אפליקציה"</strong> או "הוסף למסך הבית"</p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setShowInstructions(false)}
              style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', marginTop: '2rem', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(74,91,240,0.2)' }}
            >
              סגור חלון
            </button>
          </div>
        </div>
      )}
    </>
  );
}
