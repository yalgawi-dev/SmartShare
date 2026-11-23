'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [guideMinimized, setGuideMinimized] = useState(false);
  const [iosStep, setIosStep] = useState<0 | 1 | 2 | 3>(0);
  const [visionAnswer, setVisionAnswer] = useState<string | null>(null);
  const [analyzingShot, setAnalyzingShot] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isSpeakingGuide, setIsSpeakingGuide] = useState(false);
  const [coachOffset, setCoachOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bubbleOffset, setBubbleOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [installing, setInstalling] = useState(false);
  const coachAudioRef = useRef<HTMLAudioElement | null>(null);
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
        // On Android inside WhatsApp / WebViews: NEVER show an automatic takeover popup!
        // All app features, reports, and file downloads work directly and smoothly inside WhatsApp.
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
        // Only fallback to guide on Apple iOS
        if (platform === 'ios-safari' || platform === 'ios-chrome') {
          setShowGuide(true);
        }
      }
    } else {
      if (platform === 'android-chrome') {
        dismiss();
        alert('האפליקציה זמינה להתקנה מתפריט הדפדפן, או שכבר מותקנת במכשירך.');
      } else if (platform === 'ios-safari' || platform === 'ios-chrome') {
        setShowGuide(true);
        setGuideMinimized(false);
        setIosStep(0);
        setVisionAnswer(null);
        // Warm conversational greeting (NOT dumping all 3 steps at once!)
        void speakCoachLine('שלום! אני הסוכן האישי שלך ואני אלווה אותך לאורך כל הדרך. האם תרצה שאעזור לך שלב אחרי שלב בהתקנה באייפון?');
      }
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

  const speakCoachLine = async (scriptText: string) => {
    // CRITICAL iOS SAFARI FIX: Create & unlock Audio element SYNCHRONOUSLY inside the tap gesture
    // BEFORE awaiting fetch(), otherwise iOS Safari blocks autoplay after the async boundary!
    if (typeof window === 'undefined') return;
    let audio = coachAudioRef.current;
    if (!audio) {
      audio = new Audio();
      (audio as any).playsInline = true;
      coachAudioRef.current = audio;
    }
    try {
      audio.pause();
      // Unlock audio playback within the synchronous user tap gesture on iOS Safari
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      await audio.play().catch(() => {});
      audio.pause();
    } catch {}

    setIsSpeakingGuide(true);
    window.dispatchEvent(new CustomEvent('smartshare:assistant_speaking', { detail: { speaking: true } }));

    const finishSpeaking = () => {
      setIsSpeakingGuide(false);
      window.dispatchEvent(new CustomEvent('smartshare:assistant_speaking', { detail: { speaking: false } }));
    };
    try {
      const res = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          finishSpeaking();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          finishSpeaking();
        };
        await audio.play();
        return;
      }
    } catch {
      // Silent fallback
    }
    finishSpeaking();
  };

  // Dedicated Install-Only Screenshot Analyzer right inside the compact Siri bar (ZERO giant drawer!)
  const handleCompactInstallScreenshot = async (file: File) => {
    if (!file || analyzingShot) return;
    setAnalyzingShot(true);
    setVisionAnswer('⏳ סורק את צילום המסך שלך...');
    try {
      const imgUrl = URL.createObjectURL(file);
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, 900 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('no ctx');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(imgUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.72));
          } catch (err) {
            URL.revokeObjectURL(imgUrl);
            reject(err);
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(imgUrl);
          reject(err);
        };
        img.src = imgUrl;
      });
      const res = await fetch('/api/assistant/install-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data?.answer || 'לא הצלחתי לזהות את המסך. נסה לצלם שוב או לחץ על המשך.';
      setVisionAnswer(reply);
      void speakCoachLine(reply);
    } catch {
      setVisionAnswer('שגיאה בטעינת התמונה. נסה שוב.');
    } finally {
      setAnalyzingShot(false);
    }
  };

  // ── iOS Safari / iOS Chrome: Compact 1-Row Siri-Style Interactive Step Coach + Minimized Bubble ──
  if ((platform === 'ios-safari' || platform === 'ios-chrome') && showGuide) {
    const isChromeIOS = platform === 'ios-chrome';

    const stepContent: Record<0 | 1 | 2 | 3, { badge: string; text: string; voice: string; nextLabel: string }> = {
      0: {
        badge: '🤖 הסוכן האישי',
        text: 'שלום! אני הסוכן האישי שלך ואלווה אותך לאורך כל הדרך. רוצה שאעזור לך להתקין באייפון?',
        voice: 'שלום! אני הסוכן האישי שלך ואני אלווה אותך לאורך כל הדרך. האם תרצה שאעזור לך שלב אחרי שלב בהתקנה באייפון?',
        nextLabel: '✅ כן, בוא נתחיל'
      },
      1: {
        badge: 'שלב 1 מתוך 3',
        text: isChromeIOS
          ? 'לחץ על סמל השיתוף ⬆️ למעלה בשורת הכתובת של Chrome. הצלחת?'
          : 'לחץ על סמל השיתוף הכחול ⬆️ למטה באמצע הסרגל של Safari. הצלחת?',
        voice: isChromeIOS
          ? 'שלב ראשון: לחץ על סמל השיתוף למעלה בשורת הכתובת. הצלחת? לחץ המשך, או שלח לי צילום מסך.'
          : 'שלב ראשון: לחץ על סמל השיתוף הכחול למטה באמצע המסך. הצלחת? לחץ המשך, ואם הסתבכת שלח לי צילום מסך.',
        nextLabel: '✅ לחצתי, המשך'
      },
      2: {
        badge: 'שלב 2 מתוך 3',
        text: 'שים אצבע על האייקונים הירוקים בחלונית הלבנה ומשוך למעלה ☝️ ← בחר ➕ "הוסף למסך הבית".',
        voice: 'מצוין! שלב שני: שים אצבע על האייקונים הירוקים בחלונית הלבנה ומשוך כלפי מעלה. תראה שורה בשם הוסף למסך הבית עם סימן פלוס — לחץ עליה!',
        nextLabel: '✅ מצאתי, מה הלאה?'
      },
      3: {
        badge: 'שלב 3 ואחרון',
        text: 'מעולה! במסך שנפתח לחץ על "הוסף" (Add) בפינה העליונה והאפליקציה על מסך הבית שלך! 🎉',
        voice: 'אתה בשלב האחרון! במסך שנפתח עכשיו, פשוט לחץ על הכפתור הכחול הוסף בפינה העליונה — והאפליקציה תופיע מיד על מסך הבית שלך!',
        nextLabel: '🎉 הותקן, תודה!'
      }
    };

    const currentStepObj = stepContent[iosStep];
    const goToNextStep = () => {
      setVisionAnswer(null);
      if (iosStep === 3) {
        dismiss();
        return;
      }
      const next = (iosStep + 1) as 1 | 2 | 3;
      setIosStep(next);
      void speakCoachLine(stepContent[next].voice);
    };

    const startDrag = (
      e: React.PointerEvent,
      currentOffset: { x: number; y: number },
      setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
      allowX = true
    ) => {
      if ((e.target as HTMLElement)?.closest('button, a, input')) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const initX = currentOffset.x;
      const initY = currentOffset.y;
      const maxY = Math.max(120, window.innerHeight - 160);
      const maxX = Math.max(80, window.innerWidth - 140);

      const onMove = (ev: PointerEvent) => {
        const dx = allowX ? Math.max(-maxX, Math.min(maxX, initX + (ev.clientX - startX))) : 0;
        const dy = Math.max(-40, Math.min(maxY, initY + (ev.clientY - startY)));
        setOffset({ x: dx, y: dy });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    // Minimized Floating Bubble (draggable + accompanies user until they tap it to expand or press ✕)
    if (guideMinimized) {
      return (
        <div
          onPointerDown={(e) => startDrag(e, bubbleOffset, setBubbleOffset, true)}
          style={{
            position: 'fixed',
            top: 'max(12px, env(safe-area-inset-top))',
            right: '12px',
            transform: `translate3d(${bubbleOffset.x}px, ${bubbleOffset.y}px, 0)`,
            touchAction: 'none',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '7px 10px 7px 12px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            direction: 'rtl',
            cursor: 'grab',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
          }}
        >
          <span style={{ opacity: 0.75, fontSize: '0.78rem', userSelect: 'none' }}>⋮⋮</span>
          <button
            type="button"
            onClick={() => setGuideMinimized(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
            }}
          >
            <span>📲</span>
            <span>המשך התקנה באייפון</span>
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="סגור מדריך התקנה"
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 900,
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <>
        <style>{`
          @keyframes pwaBounceDown {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(7px); }
          }
        `}</style>

        {/* Top-Anchored Compact Live Coach (draggable vertically so user can move it anywhere on screen!) */}
        <div
          style={{
            position: 'fixed',
            top: 'max(8px, env(safe-area-inset-top))',
            left: '10px',
            right: '10px',
            maxWidth: '430px',
            margin: '0 auto',
            transform: `translate3d(0, ${coachOffset.y}px, 0)`,
            zIndex: 9999999,
            background: '#ffffff',
            borderRadius: '20px',
            padding: '6px 12px 10px',
            boxShadow: '0 14px 38px rgba(15, 23, 42, 0.32)',
            border: '2px solid #2563eb',
            direction: 'rtl',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
          }}
        >
          {/* Compact Draggable Siri-Style Interactive Coach Bar (NEVER covers Safari Share Sheet!) */}
          <div
            onPointerDown={(e) => startDrag(e, coachOffset, setCoachOffset, false)}
            style={{ touchAction: 'none', cursor: 'grab' }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '999px', background: '#cbd5e1', margin: '0 auto 6px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  flexShrink: 0,
                  boxShadow: isSpeakingGuide ? '0 0 0 4px rgba(6, 182, 212, 0.35)' : 'none',
                  animation: isSpeakingGuide ? 'pwaBounceDown 0.8s infinite' : 'none',
                }}>
                  🤖
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#1e3a8a', background: '#eff6ff', padding: '2px 8px', borderRadius: '999px' }}>
                  {currentStepObj.badge}
                </span>
                {isSpeakingGuide && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7' }}>🔊 מדבר...</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => void speakCoachLine(visionAnswer || currentStepObj.voice)}
                  title="הקרא שוב"
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '999px',
                    padding: '3px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🔊
                </button>
                <button
                  type="button"
                  onClick={() => setGuideMinimized(true)}
                  title="מזער לבועה צפה"
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '999px',
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  מזער ⌄
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="סגור"
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    color: '#475569',
                    fontWeight: 900,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Single Clean Live Speech Line (current step OR AI screenshot vision reply) */}
          <div style={{
            background: visionAnswer ? '#fef3c7' : '#f8fafc',
            border: visionAnswer ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '8px 10px',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.4,
            marginBottom: '7px',
          }}>
            {visionAnswer || currentStepObj.text}
          </div>

          {/* 1-Row Interactive Action Bar: Next Step + Built-in Screenshot Vision (Zero Drawer!) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={goToNextStep}
              style={{
                flex: 1.4,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '7px 10px',
                fontSize: '0.78rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.28)',
              }}
            >
              {currentStepObj.nextLabel}
            </button>

            {iosStep === 0 ? (
              <button
                type="button"
                onClick={dismiss}
                style={{
                  flex: 0.9,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '7px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                אסתדר לבד
              </button>
            ) : (
              <label
                style={{
                  flex: 1,
                  background: analyzingShot ? '#cbd5e1' : '#eef2ff',
                  color: '#3730a3',
                  border: '1.5px solid #c7d2fe',
                  borderRadius: '10px',
                  padding: '7px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: analyzingShot ? 'wait' : 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
                title="צלם צילום מסך ושלח לסוכן לניתוח מיידי"
              >
                <span>{analyzingShot ? '⏳ סורק...' : '📸 צילום מסך'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={analyzingShot}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleCompactInstallScreenshot(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {/* Subtle Help Toggle */}
          <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setShowIosHelp((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showIosHelp ? 'הסתר ▴' : 'לא רואה סמל שיתוף?'}
            </button>
            {iosStep > 0 && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    style={{
                      width: iosStep === s ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '999px',
                      background: iosStep >= s ? '#2563eb' : '#cbd5e1',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {showIosHelp && (
            <div style={{ marginTop: '6px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '7px 9px', fontSize: '0.72rem', color: '#92400e', lineHeight: 1.4 }}>
              <div>• גע קלות בשורת הכתובת למטה אם הסרגל הוסתר בגלילה.</div>
              <div>• נכנסת מוואטסאפ? לחץ על <strong>🧭</strong> למטה או העתק ל-Safari:</div>
              <button
                type="button"
                onClick={copyCurrentUrl}
                style={{
                  marginTop: '5px',
                  width: '100%',
                  padding: '5px',
                  borderRadius: '8px',
                  border: '1px solid #f59e0b',
                  background: copiedLink ? '#16a34a' : '#ffffff',
                  color: copiedLink ? '#ffffff' : '#b45309',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                {copiedLink ? '✅ הועתק! הדבק ב-Safari' : '📋 העתק קישור ל-Safari'}
              </button>
            </div>
          )}
        </div>

        {/* Non-blocking Bouncing Bottom Pointer directly above Safari's Share Icon */}
        {!isChromeIOS && (
          <div
            style={{
              position: 'fixed',
              bottom: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999999,
              background: '#2563eb',
              color: '#ffffff',
              padding: '6px 15px',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(37,99,235,0.5)',
              whiteSpace: 'nowrap',
              direction: 'rtl',
              pointerEvents: 'none',
            }}
          >
            <span style={{ display: 'inline-block', animation: 'pwaBounceDown 1s infinite' }}>⬇️</span>
            <span>לחץ כאן למטה על סמל השיתוף ⬆️</span>
            <span style={{ display: 'inline-block', animation: 'pwaBounceDown 1s infinite' }}>⬇️</span>
          </div>
        )}
      </>
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
