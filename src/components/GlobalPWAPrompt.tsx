'use client';

import { useState, useEffect } from 'react';

export default function GlobalPWAPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'android-chrome' | 'ios' | 'android-other' | 'desktop'>('desktop');
  const [step, setStep] = useState<'banner' | 'guide'>('banner');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    try {
      if (localStorage.getItem('pwa_installed_v2') === 'true') return;
    } catch (e) {}

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edg|OPR/.test(ua);

    if (isIOS) {
      setPlatform('ios');
    } else if (isAndroid && isChrome) {
      setPlatform('android-chrome');
    } else if (isAndroid) {
      setPlatform('android-other');
    } else {
      return;
    }

    setShow(true);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const manualTrigger = () => {
      setStep('guide');
      setShow(true);
    };
    window.addEventListener('trigger-pwa-install', manualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('trigger-pwa-install', manualTrigger);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('pwa_installed_v2', 'true'); } catch (e) {}
    setShow(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') dismiss();
      setDeferredPrompt(null);
    } else {
      setStep('guide');
    }
  };

  if (!show) return null;

  const stepsConfig = platform === 'ios'
    ? [
        { icon: '📤', title: 'שלב 1', text: 'לחץ על כפתור השיתוף (⬆️) בתחתית Safari' },
        { icon: '➕', title: 'שלב 2', text: 'גלול מטה ובחר "הוסף למסך הבית"' },
        { icon: '✅', title: 'שלב 3', text: 'לחץ "הוסף" — האפליקציה מותקנת!' },
      ]
    : platform === 'android-other'
    ? [
        { icon: '🌐', title: 'שלב 1', text: 'פתח את האתר ב-Chrome (לא בדפדפן הפנימי של וואטסאפ)' },
        { icon: '⋮', title: 'שלב 2', text: 'לחץ על 3 הנקודות למעלה מימין' },
        { icon: '📱', title: 'שלב 3', text: 'בחר "התקן אפליקציה" או "הוסף למסך הבית"' },
      ]
    : [
        { icon: '⋮', title: 'שלב 1', text: 'לחץ על 3 הנקודות למעלה ב-Chrome' },
        { icon: '📱', title: 'שלב 2', text: 'בחר "התקן אפליקציה" או "הוסף למסך הבית"' },
        { icon: '✅', title: 'שלב 3', text: 'לחץ "התקן" — בוצע!' },
      ];

  const slideStyle: React.CSSProperties = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
    background: 'white',
    borderRadius: '24px 24px 0 0',
    padding: step === 'banner' ? '1.25rem 1.5rem 2rem' : '2rem 1.5rem 2.5rem',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  return (
    <>
      <style>{`
        @keyframes pwaSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .pwa-sheet { animation: pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div className="pwa-sheet" style={slideStyle}>
        <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.5rem' }} />

        {step === 'banner' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <img src="/icons/icon-192x192.png" alt="SmartShare" style={{ width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>SmartShare</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  {platform === 'ios' ? 'הוסף למסך הבית לחוויה מלאה' : 'התקן כאפליקציה — חינם, ללא חנות, ללא APK'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {['⚡ מהיר יותר', '📵 ללא דפדפן', '🔔 התראות', '💾 עובד אופליין'].map(b => (
                <span key={b} style={{ background: '#f1f5f9', borderRadius: '50px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{b}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={dismiss} style={{ flex: 1, padding: '0.9rem', border: '1px solid #e5e7eb', borderRadius: '14px', background: 'white', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}>
                לא עכשיו
              </button>
              <button onClick={handleInstall} style={{ flex: 2, padding: '0.9rem', border: 'none', borderRadius: '14px', background: 'linear-gradient(135deg, #4a5bf0, #3b82f6)', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(74,91,240,0.35)' }}>
                {platform === 'android-chrome' ? '⬇️ התקן עכשיו' : '📱 איך מתקינים?'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <img src="/icons/icon-192x192.png" alt="SmartShare" style={{ width: '64px', height: '64px', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginBottom: '1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: '700', color: '#0f172a' }}>
                {platform === 'ios' ? 'הוסף למסך הבית' : 'התקן את SmartShare'}
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>ללא APK, ללא חנות אפליקציות — פשוט ומהיר</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.75rem' }}>
              {stepsConfig.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '1.4rem', width: '44px', height: '44px', background: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.4, textAlign: 'right' }}>
                    <strong style={{ color: '#1e293b', fontSize: '0.8rem', display: 'block', marginBottom: '2px' }}>{s.title}</strong>
                    {s.text}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={dismiss} style={{ width: '100%', padding: '1rem', border: 'none', borderRadius: '16px', background: 'linear-gradient(135deg, #4a5bf0, #3b82f6)', color: 'white', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,91,240,0.3)' }}>
              הבנתי, תודה!
            </button>
          </>
        )}
      </div>
    </>
  );
}
