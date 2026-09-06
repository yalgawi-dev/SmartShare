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
          position: 'relative',
          width: '100%',
          background: 'linear-gradient(90deg, #eff6ff 0%, #e0e7ff 100%)',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #c7d2fe',
          boxSizing: 'border-box',
          zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }}>
              ✦
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e3a8a', lineHeight: 1.2 }}>SmartShare</span>
              <span style={{ fontSize: '0.75rem', color: '#3b82f6', lineHeight: 1.2 }}>אפליקציה לחוויה מהירה</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={handleInstallClick}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
            >
              התקן
            </button>
            <button onClick={handleDismiss} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="סגור">
              ✕
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '2rem', boxSizing: 'border-box', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '4px', margin: '0 auto 1.5rem auto' }} />
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', textAlign: 'center', fontSize: '1.25rem' }}>איך להתקין את האפליקציה?</h3>
            
            {isIOS ? (
              <div style={{ fontSize: '1.05rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>📤</span>
                  <p style={{ margin: 0 }}>1. לחץ על כפתור ה<strong>שיתוף</strong> בתחתית המסך</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>➕</span>
                  <p style={{ margin: 0 }}>2. בחר באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen)</p>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '1.05rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>⋮</span>
                  <p style={{ margin: 0 }}>1. לחץ על <strong>תפריט 3 הנקודות</strong> של הדפדפן</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '1.5rem', background: 'white', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>📱</span>
                  <p style={{ margin: 0 }}>2. בחר באפשרות <strong>"התקן אפליקציה"</strong> או "הוסף למסך הבית"</p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setShowInstructions(false)}
              style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', marginTop: '2rem', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(74,91,240,0.2)' }}
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
