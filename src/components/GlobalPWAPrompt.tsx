'use client';

import { useState, useEffect } from 'react';

/**
 * GlobalPWAPrompt v4
 * 
 * ✅ Android Chrome/Samsung/Firefox: 1-tap native install
 * ✅ Android WhatsApp WebView: Button that auto-opens Chrome (1 tap!)
 * ✅ iOS Safari: 2-step guide (Apple's limit — no workaround)
 * ✅ iOS WhatsApp: Button to open in Safari (1 tap)
 * ✅ Already installed as PWA: Hidden
 */
export default function GlobalPWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<
    'android-chrome' | 'android-webview' | 'ios-safari' | 'ios-webview' | 'other' | null
  >(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as standalone PWA — never show
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Already dismissed
    try {
      if (localStorage.getItem('pwa_v5') === 'done') return;
    } catch (e) {}

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isWebView = ua.includes('WhatsApp') || ua.includes('FBAN') || ua.includes('FBAV')
      || ua.includes('Instagram') || /wv\)/.test(ua) || ua.includes('SamsungBrowser');
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

    if (!isIOS && !isAndroid) return;

    if (isAndroid && isWebView)      setPlatform('android-webview');
    else if (isAndroid)              setPlatform('android-chrome');
    else if (isIOS && isWebView)     setPlatform('ios-webview');
    else if (isIOS && isSafari)      setPlatform('ios-safari');
    else                             setPlatform('other');

    // Grab Chrome's native install prompt
    const onPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onTrigger = () => { /* noop, keep hook alive */ };
    window.addEventListener('trigger-pwa-install', onTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('trigger-pwa-install', onTrigger);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('pwa_v5', 'done'); } catch (e) {}
    setPlatform(null);
  };

  // Open current page in Chrome (Android WebView → Chrome)
  

  // Open in Safari (iOS WebView → Safari)
  const openInSafari = () => {
    // On iOS, _blank inside WebView opens Safari
    window.open(window.location.href, '_blank');
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        setInstalling(true);
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setInstalling(false);
        if (outcome === 'accepted') dismiss();
      } catch (err) {
        console.error("Install prompt failed", err);
        setInstalling(false);
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  if (!platform) return null;

  // ── Android WebView (WhatsApp): Auto-open Chrome ─────────────────────────────
  if (platform === 'android-webview') {
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌐</div>
          <h3 style={titleStyle}>לחץ לפתיחה ב-Chrome</h3>
          <p style={subStyle}>
            כדי להתקין את SmartShare, צריך לפתוח אותה ב-Chrome.<br />
            <strong>לחץ על הכפתור הכחול — הכל יקרה אוטומטית!</strong>
          </p>
        </div>
        {typeof window !== 'undefined' && (
          <a
            href={`intent://${window.location.href.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`}
            style={{ ...primaryBtnStyle, display: 'block', textDecoration: 'none', boxSizing: 'border-box' }}
          >
            🌐 פתח ב-Chrome ← התקן
          </a>
        )}
        <button onClick={dismiss} style={dismissBtnStyle}>סגור</button>
      </Sheet>
    );
  }

  // ── iOS WebView (WhatsApp on iPhone): Open in Safari ─────────────────────────
  if (platform === 'ios-webview') {
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧭</div>
          <h3 style={titleStyle}>פתח ב-Safari</h3>
          <p style={subStyle}>
            כדי להתקין את SmartShare, לחץ על הכפתור — הוא יפתח Safari אוטומטית!
          </p>
        </div>
        <button onClick={openInSafari} style={primaryBtnStyle}>
          🧭 פתח ב-Safari ← התקן
        </button>
        <button onClick={dismiss} style={dismissBtnStyle}>סגור</button>
      </Sheet>
    );
  }

  // ── iOS Safari: 2-step guide (Apple's limitation) ────────────────────────────
  if (platform === 'ios-safari' && showGuide) {
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📱</div>
          <h3 style={titleStyle}>הוסף למסך הבית</h3>
          <p style={subStyle}>Apple מחייבת 2 שלבים — זה הכל!</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
          <Step icon="📤" text='לחץ על כפתור השיתוף ⬆️ בתחתית המסך' />
          <Step icon="➕" text='בחר "הוסף למסך הבית"' />
          <Step icon="✅" text='לחץ "הוסף" — מותקן!' />
        </div>
        <button onClick={dismiss} style={primaryBtnStyle}>הבנתי, תודה!</button>
      </Sheet>
    );
  }

  // ── Main banner (Android Chrome / iOS Safari) ─────────────────────────────────
  const isAndroidChrome = platform === 'android-chrome';
  const canOneTap = isAndroidChrome && !!deferredPrompt;

  return (
    <Sheet>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <img
          src="/icons/icon-192x192.png"
          alt="SmartShare"
          style={{ width: '58px', height: '58px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.14)', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0f172a' }}>SmartShare</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', lineHeight: 1.3 }}>
            {canOneTap ? 'לחיצה אחת והאפליקציה בטלפון!' : 'הוסף למסך הבית'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={dismiss} style={dismissBtnStyle}>לא עכשיו</button>
        <button
          onClick={canOneTap ? handleInstall : () => setShowGuide(true)}
          disabled={installing}
          style={{ ...primaryBtnStyle, flex: 2, opacity: installing ? 0.7 : 1 }}
        >
          {installing ? '⏳ מתקין...' : canOneTap ? '⬇️ התקן עכשיו' : '📱 איך מתקינים?'}
        </button>
      </div>
    </Sheet>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes pwaUp { from { transform:translateY(110%); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes pwaFade { from { opacity:0; } to { opacity:1; } }
        .pwa-sheet-v4 { animation: pwaUp 0.38s cubic-bezier(0.16,1,0.3,1) both; }
        .pwa-backdrop-v4 { animation: pwaFade 0.3s ease-out both; }
      `}</style>
      <div className="pwa-backdrop-v4" style={{
        position: 'fixed', inset: 0, zIndex: 9999998,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
      }} />
      <div className="pwa-sheet-v4" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999999,
        background: '#ffffff', borderRadius: '28px 28px 0 0',
        padding: '1.25rem 1.5rem 2.5rem',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.18)',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e2e8f0', borderRadius: '2px', margin: '0 auto 1.5rem' }} />
        {children}
      </div>
    </>
  );
}

function Step({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px' }}>
      <span style={{ fontSize: '1.3rem', width: '40px', height: '40px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', textAlign: 'center',
};
const subStyle: React.CSSProperties = {
  margin: 0, color: '#64748b', fontSize: '0.88rem', textAlign: 'center', lineHeight: 1.5,
};
const primaryBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '1rem', border: 'none', borderRadius: '16px',
  background: 'linear-gradient(135deg, #4a5bf0 0%, #2563eb 100%)',
  color: 'white', fontWeight: '800', fontSize: '1rem', cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(74,91,240,0.35)', marginBottom: '0.75rem', textAlign: 'center',
};
const dismissBtnStyle: React.CSSProperties = {
  flex: 1, padding: '0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '14px',
  background: 'white', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
};
