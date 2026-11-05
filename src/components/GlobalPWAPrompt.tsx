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
    'android-chrome' | 'android-webview' | 'ios-safari' | 'ios-chrome' | 'ios-webview' | 'other' | null
  >(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as standalone PWA — never show
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const detectPlatform = (): 'android-chrome' | 'android-webview' | 'ios-safari' | 'ios-chrome' | 'ios-webview' | 'other' | null => {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isAndroid = /Android/.test(ua);
      const isWebView = ua.includes('WhatsApp') || ua.includes('FBAN') || ua.includes('FBAV')
        || ua.includes('Instagram') || /wv\)/.test(ua);
      const isCriOS = /CriOS/.test(ua);
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !isCriOS;

      if (isAndroid && isWebView)      return 'android-webview';
      if (isAndroid)                   return 'android-chrome';
      if (isIOS && isWebView)          return 'ios-webview';
      if (isIOS && isCriOS)            return 'ios-chrome';
      if (isIOS && isSafari)           return 'ios-safari';
      if (isIOS)                       return 'ios-safari';
      return 'other';
    };

    // Grab Chrome's / Galaxy native install prompt
    const onPrompt = (e: any) => { 
      e.preventDefault(); 
      setDeferredPrompt(e); 
      (window as any).deferredPWAInstallPrompt = e;
      setPlatform('android-chrome'); 
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // If early listener on window already caught beforeinstallprompt:
    if (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      setPlatform('android-chrome');
    }

    const onTrigger = () => { 
      try { localStorage.removeItem('pwa_dismissed_at'); } catch (e) {}
      setMenuOpened(false);
      setCopiedLink(false);
      const promptEvent = deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt);
      const detected = detectPlatform() || 'android-chrome';

      // On Android (Galaxy), if promptEvent is ready, trigger native 1-tap install directly!
      if (detected === 'android-chrome' && promptEvent) {
        setPlatform('android-chrome');
        setShowGuide(false);
        try {
          promptEvent.prompt();
          promptEvent.userChoice.then(({ outcome }: any) => {
            setDeferredPrompt(null);
            if (typeof window !== 'undefined') (window as any).deferredPWAInstallPrompt = null;
            if (outcome === 'accepted') dismiss();
          });
        } catch (err) {
          console.error("Direct trigger install failed", err);
        }
        return;
      }

      setPlatform(detected);
      // Scroll to top so mobile browsers (especially iOS Safari) expand and reveal their bottom toolbar!
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      // ONLY on Apple (iOS Safari / iOS Chrome), open the visual iPhone guide immediately:
      if (detected === 'ios-safari' || detected === 'ios-chrome') {
        setShowGuide(true);
      } else {
        setShowGuide(false);
      }
    };
    window.addEventListener('trigger-pwa-install', onTrigger);

    // Cooldown check for automatic popup only (remind every 3 days if dismissed)
    let isOnCooldown = false;
    try {
      const dismissedAt = localStorage.getItem('pwa_dismissed_at');
      if (dismissedAt) {
        const days = (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 3600 * 24);
        if (days < 3) isOnCooldown = true;
      }
    } catch (e) {}

    if (!isOnCooldown) {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isAndroid = /Android/.test(ua);
      const isWebView = ua.includes('WhatsApp') || ua.includes('FBAN') || ua.includes('FBAV')
        || ua.includes('Instagram') || ua.includes('wv)');

      if (isAndroid && isWebView) {
        // Android inside WhatsApp/Social webview
        setPlatform('android-webview');
      } else if (isIOS) {
        // Apple iOS devices: show iOS-specific flow
        setPlatform(detectPlatform());
      }
      // CRITICAL FOR GALAXY / ANDROID CHROME:
      // We do NOT setPlatform('android-chrome') immediately on mount if deferredPrompt is null!
      // Instead, we wait for beforeinstallprompt (onPrompt), which sets deferredPrompt AND sets platform.
      // That guarantees when the banner appears on Galaxy, deferredPrompt is 100% ready,
      // showing "⬇️ התקן עכשיו" and installing natively in 1 tap without ever showing manual steps!
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('trigger-pwa-install', onTrigger);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('pwa_dismissed_at', new Date().toISOString()); } catch (e) {}
    setPlatform(null);
  };

  // Open current page in Chrome (Android WebView → Chrome)
  

  // Open in Safari (iOS WebView → Safari)
  const openInSafari = () => {
    // On iOS, _blank inside WebView opens Safari
    window.open(window.location.href, '_blank');
  };

  const handleInstall = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt);
    if (promptEvent) {
      try {
        setInstalling(true);
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') (window as any).deferredPWAInstallPrompt = null;
        setInstalling(false);
        if (outcome === 'accepted') dismiss();
      } catch (err) {
        console.error("Install prompt failed", err);
        setInstalling(false);
        // Only fallback to guide if native prompt fails
        if (platform === 'ios-safari' || platform === 'ios-chrome') {
          setShowGuide(true);
        }
      }
    } else {
      setShowGuide(true);
    }
  };

  if (!platform) return null;

  // ── Android WebView (WhatsApp): Auto-open Chrome ─────────────────────────────
  if (platform === 'android-webview') {
    return (
      <>
        {menuOpened && (
          <div style={{
            position: 'fixed', top: '12px', left: '16px', right: '16px', zIndex: 999999999,
            background: '#fef3c7', padding: '0.6rem', borderRadius: '10px',
            border: '2px solid #f59e0b', textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            animation: 'pwaPulseBtn 1.5s infinite',
            display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center'
          }}>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#b45309' }}>
              👇 בחר ב-Chrome מהתפריט 👇
            </div>
            <div style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '700' }}>
              (ואז לחץ על "אפשר תמיד")
            </div>
          </div>
        )}
        <Sheet>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌐</div>
            <h3 style={titleStyle}>המשך אל Chrome</h3>
            <p style={subStyle}>
              לחץ על הכפתור כדי לסיים את ההתקנה בצורה מהירה ובטוחה.
            </p>
          </div>
          {menuOpened ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontWeight: '700', background: '#f8fafc', borderRadius: '12px', marginBottom: '1rem' }}>
              ⏳ מחכה שתבחר בתפריט...
            </div>
          ) : (
            <button
              className="pulse-btn-v1"
              onClick={() => {
                setMenuOpened(true);
                setTimeout(() => {
                  const url = window.location.href.replace(/^https?:\/\//, '');
                  window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
                }, 100);
              }}
              style={primaryBtnStyle}
            >
              פתח ב-<span style={{ color: '#fef08a', fontWeight: '900', fontSize: '1.15em', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>Chrome</span> ← התקן
            </button>
          )}
          <button onClick={dismiss} style={dismissBtnStyle}>סגור</button>
        </Sheet>
      </>
    );
  }

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 4000);
    } catch (e) {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 4000);
    }
  };

  // ── iOS WebView (WhatsApp/Instagram on iPhone): Open in Safari or Copy Link ──
  if (platform === 'ios-webview') {
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: '1rem', direction: 'rtl' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '0.35rem' }}>🧭</div>
          <h3 style={titleStyle}>פתיחה והתקנה באייפון</h3>
          <p style={subStyle}>
            נכנסת מתוך וואטסאפ ולכן סרגל ההתקנה של האייפון מוסתר. כדי להתקין בקלות:
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem', direction: 'rtl' }}>
          <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '14px', padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#1e3a8a', lineHeight: 1.45 }}>
            <strong>אפשרות א׳ (הכי מהירה):</strong> לחץ על סמל המצפן <strong>🧭 (Safari)</strong> שנמצא בפינה התחתונה של המסך כדי לפתוח בדפדפן הרגיל.
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#334155', lineHeight: 1.45 }}>
            <strong>אפשרות ב׳:</strong> העתק את הקישור בלחיצה כאן, פתח את דפדפן <strong>Safari</strong> באייפון והדבק בשורת הכתובת:
            <button
              onClick={copyCurrentUrl}
              style={{
                marginTop: '0.6rem',
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: copiedLink ? '#16a34a' : '#2563eb',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              {copiedLink ? '✅ הקישור הועתק! כעת פתח את Safari והדבק' : '📋 העתק קישור להדבקה ב-Safari'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} style={{ ...dismissBtnStyle, width: '100%' }}>סגור</button>
      </Sheet>
    );
  }

  // ── iOS Safari / iOS Chrome: Visual Step-by-Step Guide with Live Pointer ─────
  if ((platform === 'ios-safari' || platform === 'ios-chrome') && showGuide) {
    const isChromeIOS = platform === 'ios-chrome';
    return (
      <>
        <style>{`
          @keyframes pwaBounceDown {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(7px); }
          }
          @keyframes pwaBounceUp {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
        `}</style>
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999998,
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)'
          }}
        />
        {/* Floating Guide Card positioned to leave the browser toolbar visible */}
        <div
          style={{
            position: 'fixed',
            bottom: isChromeIOS ? '16px' : '68px',
            left: '12px',
            right: '12px',
            maxWidth: '430px',
            margin: '0 auto',
            maxHeight: 'calc(100vh - 96px)',
            overflowY: 'auto',
            zIndex: 9999999,
            background: '#ffffff',
            borderRadius: '24px',
            padding: '1.15rem 1.15rem 1.25rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            direction: 'rtl',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src="/icons/icon-192x192.png" alt="MySpace" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>התקנת MySpace באייפון</h3>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>3 לחיצות פשוטות והאפליקציה על מסך הבית שלך</p>
              </div>
            </div>
            <button onClick={dismiss} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '0.95rem', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '0.85rem' }}>
            {/* STEP 1: Real Apple Share Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', padding: '0.7rem 0.85rem', borderRadius: '14px' }}>
              <div style={{ width: '44px', height: '44px', background: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.15)', flexShrink: 0, border: '1px solid #dbeafe' }}>
                {/* Exact Apple iOS Share SVG (Square with arrow pointing UP) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  1. לחץ על כפתור השיתוף {isChromeIOS ? 'למעלה בשורת הכתובת' : 'בתחתית המסך'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#334155', marginTop: '2px', lineHeight: 1.35 }}>
                  חפש את הסמל הכחול של <strong>ריבוע עם חץ עולה למעלה</strong> {isChromeIOS ? 'בצד העליון של הדפדפן' : 'באמצע הסרגל התחתון של הדפדפן'}.
                </div>
              </div>
            </div>

            {/* STEP 2: Scroll Down + Add to Home Screen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.7rem 0.85rem', borderRadius: '14px' }}>
              <div style={{ width: '44px', height: '44px', background: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                {/* Exact Apple Add to Home Screen SVG (Rounded square with +) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  2. גלול למטה בתפריט ובחר &quot;הוסף למסך הבית&quot;
                </div>
                <div style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '3px 7px', borderRadius: '6px', marginTop: '4px', fontWeight: 700, display: 'inline-block' }}>
                  ⚠️ חשוב: יש לגלול את התפריט שנפתח כלפי מטה כדי לראות זאת!
                </div>
              </div>
            </div>

            {/* STEP 3: Tap Add in Top Corner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.7rem 0.85rem', borderRadius: '14px' }}>
              <div style={{ width: '44px', height: '44px', background: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#007AFF', fontWeight: 900, fontSize: '0.85rem' }}>הוסף</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  3. לחץ על &quot;הוסף&quot; (Add) בפינה העליונה
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                  האפליקציה תופיע מיד על מסך הבית של האייפון שלך! 🎉
                </div>
              </div>
            </div>
          </div>

          {/* Troubleshooting Box for users who don't see the browser toolbar or opened from WhatsApp */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '0.7rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.76rem', color: '#92400e', lineHeight: 1.4 }}>
            <div style={{ fontWeight: 800, marginBottom: '3px', color: '#78350f' }}>💡 לא רואה את סרגל הדפדפן או כפתור השיתוף?</div>
            <div>• <strong>הסרגל הוסתר בגלילה:</strong> גע קלות בקצה התחתון של המסך (בשורת הכתובת) והכפתורים יופיעו.</div>
            <div style={{ marginTop: '2px' }}>• <strong>נכנסת דרך וואטסאפ?</strong> לחץ על סמל המצפן <strong>🧭</strong> למטה בפינה, או העתק את הקישור והדבק ב-Safari:</div>
            <button
              type="button"
              onClick={copyCurrentUrl}
              style={{
                marginTop: '0.45rem',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '10px',
                border: '1px solid #f59e0b',
                background: copiedLink ? '#16a34a' : '#ffffff',
                color: copiedLink ? '#ffffff' : '#b45309',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              {copiedLink ? '✅ הקישור הועתק! פתח את דפדפן Safari והדבק' : '📋 העתק קישור (לפתיחה ב-Safari)'}
            </button>
          </div>

          <button onClick={dismiss} style={{ ...primaryBtnStyle, marginBottom: 0, padding: '0.8rem' }}>הבנתי, תודה!</button>
        </div>

        {/* Live Animated Pointer pointing directly to the iPhone Safari Bottom Share Button */}
        {!isChromeIOS && (
          <div
            onClick={dismiss}
            style={{
              position: 'fixed',
              bottom: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999999,
              background: '#2563eb',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(37,99,235,0.5)',
              whiteSpace: 'nowrap',
              direction: 'rtl'
            }}
          >
            <span style={{ display: 'inline-block', animation: 'pwaBounceDown 1s infinite' }}>⬇️</span>
            <span>כפתור השיתוף נמצא ממש כאן למטה בדפדפן</span>
            <span style={{ display: 'inline-block', animation: 'pwaBounceDown 1s infinite' }}>⬇️</span>
          </div>
        )}
      </>
    );
  }

    // ── Android Chrome / Desktop: Manual guide (if One-Tap fails or Incognito) ────────────────────────────
  if ((platform === 'android-chrome' || platform === 'other') && showGuide) {
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📱</div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem 0' }}>הוסף למסך הבית</h3>
          <p style={{ fontSize: '0.95rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>התקנה מהירה ופשוטה</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
          <Step icon="⋮" text='לחץ על תפריט ה-3 נקודות למעלה בדפדפן' />
          <Step icon="➕" text='בחר "התקנת אפליקציה" או "הוסף למסך הבית"' />
          <Step icon="✅" text='לחץ "התקן" / "הוסף" — וזהו!' />
        </div>
        <button onClick={dismiss} style={{ background: '#3b82f6', color: 'white', width: '100%', padding: '0.85rem', borderRadius: '14px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>הבנתי, תודה!</button>
      </Sheet>
    );
  }

// ── Main banner (Android Chrome / iOS Safari) ─────────────────────────────────
  const isAndroidChrome = platform === 'android-chrome';
  const effectivePrompt = deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt);
  const canOneTap = isAndroidChrome && !!effectivePrompt;

  return (
    <Sheet>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <img
          src="/icons/icon-192x192.png"
          alt="MySpace"
          style={{ width: '58px', height: '58px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.14)', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0f172a' }}>MySpace</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', lineHeight: 1.3 }}>
            {canOneTap ? 'לחיצה אחת והאפליקציה בטלפון!' : 'הוסף למסך הבית'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={dismiss} style={dismissBtnStyle}>לא עכשיו</button>
        <button
          className={!installing ? "pulse-btn-v1" : ""}
          onClick={handleInstall}
          disabled={installing}
          style={{ ...primaryBtnStyle, flex: 2, opacity: installing ? 0.7 : 1 }}
        >
          {installing ? '⏳ מתקין...' : (canOneTap || isAndroidChrome) ? '⬇️ התקן עכשיו' : '📱 התקן אפליקציה'}
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
        @keyframes pwaPulseBtn { 
          0% { transform: scale(1); box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4); } 
          50% { transform: scale(1.03); box-shadow: 0 8px 24px rgba(59, 130, 246, 0.6); } 
          100% { transform: scale(1); box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4); } 
        }
        .pulse-btn-v1 { animation: pwaPulseBtn 2s infinite; }
        .pwa-sheet-v4, .pwa-sheet-v4 * {
          color-scheme: light only !important;
        }
      `}</style>
      <div className="pwa-backdrop-v4" style={{
        position: 'fixed', inset: 0, zIndex: 9999998,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
      }} />
      <div className="pwa-sheet-v4" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999999,
        background: '#ffffff',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        colorScheme: 'light only',
        borderRadius: '28px 28px 0 0',
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
  background: '#ffffff', backgroundColor: '#ffffff', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
};
