'use client';
import { useState, useEffect } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';

export default function WelcomeGate({ spaceId }: { spaceId: string }) {
  const { spaces, finalizeGuestJoin } = useSpaces() as any;
  const [showGate, setShowGate] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite');
    if (token) {
      const hasSeenGate = localStorage.getItem(`welcomed_${spaceId}_${token}`);
      if (!hasSeenGate) {
        setShowGate(true);
        setInviteToken(token);
      }
    }
  }, [spaceId]);

  if (!showGate) return null;

  const space = spaces.find((s: any) => s.id === spaceId);
  const isRetroactive = new URLSearchParams(window.location.search).get('retro') === 'true';
  const currentMember = space?.members?.find((m: any) => m.userId === inviteToken);
  const needsName = !currentMember || !currentMember.name || currentMember.name === 'שותף מוזמן';

  const handleStart = () => {
    const finalName = guestName.trim() || (currentMember?.name !== 'שותף מוזמן' ? currentMember?.name : '');
    if (!finalName) {
      alert('אנא הזן את שמך כדי להמשיך');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isRetroParam = urlParams.get('retro') === 'true';
    const shareParam = urlParams.get('share');
    const planParam = urlParams.get('plan');

    let sharesPlan: { creator: number; partners?: Record<string, number> } | undefined;
    if (planParam) {
      try {
        sharesPlan = JSON.parse(decodeURIComponent(planParam));
      } catch (e) {
        try {
          sharesPlan = JSON.parse(planParam);
        } catch (e2) {
          console.error('Error parsing planParam', e2);
        }
      }
    }
    
    finalizeGuestJoin(
      spaceId, 
      finalName, 
      isRetroParam, 
      inviteToken, 
      shareParam ? Number(shareParam) : undefined,
      sharesPlan
    );

    localStorage.setItem(`welcomed_${spaceId}_${inviteToken}`, 'true');
    
    // Save unique partner key directly into smartshare_keys (Single Source of Truth)
    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      localKeys[spaceId] = { role: 'partner', token: inviteToken };
      localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
    } catch (e) {}

    // Dispatch event so AuthContext immediately saves it to Firestore user document
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
        detail: { spaceId, role: 'partner', token: inviteToken } 
      }));
    }

    // Keep guest in this space: clean the invite query params from the URL so modal doesn't pop up again
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 100000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem', overflowY: 'auto',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="card glass-panel" style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '450px',
        margin: 'auto',
        color: '#1e293b',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
        
        <h2 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '0.5rem', fontWeight: 800 }}>
          ברוך הבא ל-SmartShare!
        </h2>
        
        <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.5' }}>
          הוזמנת להצטרף לפרויקט <strong>"{space?.title || 'המשותף'}"</strong>.
        </p>
        
        <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', textAlign: 'right', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#334155' }}>🎯 מה אנחנו עושים פה?</h3>
          <ul style={{ margin: 0, paddingRight: '1.2rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
            <li><strong>סורקים חשבוניות בשנייה</strong> בעזרת בינה מלאכותית.</li>
            <li><strong>רואים בדיוק מי חייב למי</strong> בלי חישובים מסובכים.</li>
            <li><strong>שקיפות מלאה</strong> לכל הוצאות הפרויקט.</li>
          </ul>
        </div>

        {isRetroactive && (
          <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '0.9rem' }}>
            <strong>לידיעתך:</strong> הוגדרת כשותף מלא מהיום הראשון (חישוב רטרואקטיבי). אל דאגה, גם לאחר האישור תוכל תמיד לערוך אחוזים, לפתוח דיון או לשנות חשבוניות.
          </div>
        )}

        {needsName && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>איך קוראים לך?</label>
            <input 
              type="text" 
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="הכנס שם מלא או כינוי"
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1.1rem', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <button 
          onClick={handleStart}
          style={{ 
            background: 'var(--primary)', color: 'white', border: 'none', 
            padding: '1rem 2rem', borderRadius: '999px', fontWeight: 'bold', 
            fontSize: '1.1rem', cursor: 'pointer', width: '100%',
            boxShadow: '0 4px 14px rgba(74, 91, 240, 0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          בוא נתחיל!
        </button>
      </div>
    </div>
  );
}