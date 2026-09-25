'use client';

import { useState, useEffect } from 'react';

/**
 * GlobalPWAPrompt v3 — "Magic Install"
 * 
 * Android (Chrome/Samsung/Firefox/Edge): ONE-TAP native install → pure magic ✅
 * iOS Safari: 2-step guide (Apple's limitation, cannot bypass) ⚠️
 * WhatsApp WebView: Guide to open in Chrome first ⚠️
 * Already installed as PWA: Hidden completely ✅
 */
export default function GlobalPWAPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'webview' | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Hide if already a standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Hide if user already dismissed permanently
    try {
      if (localStorage.getItem('pwa_dismissed_v3') === 'true') return;
    } catch (e) {}

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isWhatsApp = ua.includes('WhatsApp');
    const isFBWebView = ua.includes('FBAN') || ua.includes('FBAV');

    if (!isIOS && !isAndroid) return; // Desktop — skip

    if (isWhatsApp || isFBWebView) {
      setPlatform('webview');
    } else if (isIOS) {
      setPlatform('ios');
    } else {
      setPlatform('android');
    }

    setShow(true);

    // Capture Chrome/Android native install prompt
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Support external trigger
    const onManualTrigger = () => { setShow(true); setShowGuide(false); };
    window.addEventListener('trigger-pwa-install', onManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('trigger-pwa-install', onManualTrigger);
    };
  }, []);

  const dismiss = (permanent = true) => {
    if (permanent) {
      try { localStorage.setItem('pwa_dismissed_v3', 'true'); } catch (e) {}
    }
    setShow(false);
    setShowGuide(false);
    setInstalling(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      // ✅ MAGIC: One tap → native Android install dialog
      setInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setInstalling(false);
      if (outcome === 'accepted') {
        dismiss(true);
      }
    } else {
      // Show manual guide (iOS / other browsers)
      setShowGuide(true);
    }
  };

  if (!show || !platform) return null;

  // ── iOS Guide ────────────────────────────────────────────────────────────────
  if (showGuide && platform === 'ios') {
    return (
      <Sheet onClose={() => setShowGuide(false)}>
        <CenterIcon>📤</CenterIcon>
        <h3 style={titleStyle}>הוסף למסך הבית</h3>
        <p style={subStyle}>מכיוון שמדובר ב-iPhone, נדרשים 2 שלבים קצרים:</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1.5rem' }}>
          <Step icon="📤" text={'לחץ על כפתור השיתוף ⬆️ בתחתית Safari'} />
          <Step icon="➕" text={'גלול ובחר "הוסף למסך הבית"'} />
          <Step icon="✅" text={'לחץ "הוסף" — האפליקציה מותקנת!'} />
        </div>
        <Btn onClick={() => dismiss(true)} primary>הבנתי!</Btn>
      </Sheet>
    );
  }

  // ── WhatsApp WebView Guide ───────────────────────────────────────────────────
  if (showGuide && platform === 'webview') {
    return (
      <Sheet onClose={() => setShowGuide(false)}>
        <CenterIcon>🌐</CenterIcon>
        <h3 style={titleStyle}>פתח ב-Chrome</h3>
        <p style={subStyle}>כדי להתקין, יש לפתוח את הקישור ב-Chrome (לא בדפדפן הפנימי של וואטסאפ):</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1.5rem' }}>
          <Step icon="⋮" text={'לחץ על 3 הנקודות למעלה בוואטסאפ'} />
          <Step icon="🌐" text={'"פתח בדפדפן" / "Open in Chrome"'} />
          <Step icon="⬇️" text={'לחץ "התקן" שיופיע בדף'} />
        </div>
        <Btn onClick={() => dismiss(true)} primary>הבנתי!</Btn>
      </Sheet>
    );
  }

  // ── Main Banner (Android native / iOS / WebView) ─────────────────────────────
  const canOneClick = platform === 'android' && !!deferredPrompt;

  return (
    <Sheet onClose={() => dismiss(true)}>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.25rem' }}>
        <img
          src="/icons/icon-192x192.png"
          alt="SmartShare"
          style={{ width:'60px', height:'60px', borderRadius:'16px', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', flexShrink:0 }}
        />
        <div>
          <div style={{ fontWeight:'800', fontSize:'1.15rem', color:'#0f172a', letterSpacing:'-0.02em' }}>SmartShare</div>
          <div style={{ fontSize:'0.82rem', color:'#64748b', marginTop:'2px', lineHeight:1.3 }}>
            {canOneClick
              ? 'לחץ "התקן" — זהו! ✨'
              : platform === 'ios'
              ? 'הוסף למסך הבית ב-2 שלבים'
              : 'פתח ב-Chrome להתקנה'}
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
        {['⚡ מהיר', '📵 ללא דפדפן', '🔔 התראות', '💾 אופליין'].map(f => (
          <span key={f} style={{ background:'#f1f5f9', borderRadius:'50px', padding:'0.25rem 0.65rem', fontSize:'0.78rem', color:'#475569', fontWeight:'600' }}>{f}</span>
        ))}
      </div>

      <div style={{ display:'flex', gap:'0.75rem' }}>
        <button
          onClick={() => dismiss(true)}
          style={{ flex:1, padding:'0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'14px', background:'white', color:'#64748b', fontWeight:'600', cursor:'pointer', fontSize:'0.9rem' }}
        >
          לא עכשיו
        </button>
        <button
          onClick={canOneClick ? handleInstall : () => setShowGuide(true)}
          disabled={installing}
          style={{ flex:2, padding:'0.85rem', border:'none', borderRadius:'14px', background: installing ? '#93c5fd' : 'linear-gradient(135deg, #4a5bf0 0%, #2563eb 100%)', color:'white', fontWeight:'800', cursor: installing ? 'default' : 'pointer', fontSize:'0.95rem', boxShadow:'0 4px 14px rgba(74,91,240,0.4)', letterSpacing:'-0.01em', transition:'all 0.2s' }}
        >
          {installing ? '⏳ מתקין...' : canOneClick ? '⬇️ התקן עכשיו' : '📱 איך מתקינים?'}
        </button>
      </div>
    </Sheet>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <style>{`
        @keyframes pwaUp { from { transform:translateY(110%); } to { transform:translateY(0); } }
        .pwa-sheet { animation: pwaUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
      <div className="pwa-sheet" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:99999,
        background:'#ffffff', borderRadius:'28px 28px 0 0',
        padding:'1.25rem 1.5rem 2.5rem',
        boxShadow:'0 -12px 48px rgba(0,0,0,0.18)',
        fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      }}>
        <div style={{ width:'36px', height:'4px', background:'#e2e8f0', borderRadius:'2px', margin:'0 auto 1.5rem' }} />
        {children}
      </div>
    </>
  );
}

function CenterIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width:'64px', height:'64px', borderRadius:'20px', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', margin:'0 auto 1rem', boxShadow:'0 4px 12px rgba(74,91,240,0.15)' }}>
      {children}
    </div>
  );
}

function Step({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'#f8fafc', padding:'0.85rem 1rem', borderRadius:'12px', border:'1px solid #f1f5f9' }}>
      <span style={{ fontSize:'1.3rem', width:'40px', height:'40px', background:'white', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.08)', flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:'0.9rem', color:'#334155', lineHeight:1.4 }}>{text}</span>
    </div>
  );
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{ width:'100%', padding:'1rem', border:'none', borderRadius:'16px', background: primary ? 'linear-gradient(135deg,#4a5bf0,#2563eb)' : '#f1f5f9', color: primary ? 'white' : '#475569', fontWeight:'700', fontSize:'1rem', cursor:'pointer', boxShadow: primary ? '0 4px 16px rgba(74,91,240,0.3)' : 'none' }}>
      {children}
    </button>
  );
}

const titleStyle: React.CSSProperties = { margin:'0 0 0.5rem', fontSize:'1.2rem', fontWeight:'800', color:'#0f172a', textAlign:'center' };
const subStyle: React.CSSProperties = { margin:'0 0 1.25rem', color:'#64748b', fontSize:'0.88rem', textAlign:'center', lineHeight:1.5 };
