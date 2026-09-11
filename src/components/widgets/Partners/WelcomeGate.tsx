'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

export default function WelcomeGate({ 
  spaceId, 
  inviteToken: propToken 
}: { 
  spaceId: string; 
  inviteToken?: string | null;
}) {
  const { spaces, finalizeGuestJoin, getRoleForSpace } = useSpaces() as any;
  const { user, updateProfile } = useAuth();
  const [showGate, setShowGate] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [mounted, setMounted] = useState(false);
  const submittedRef = useRef(false); // prevents re-open after submit

  useEffect(() => {
    setMounted(true);
  }, []);

  const space = spaces.find((s: any) => s.id === spaceId);
  const role = getRoleForSpace(spaceId);
  const isCreatorOfThisSpace = role === 'creator';

  // Deterministic token resolution chain:
  // 1. Prop token
  // 2. URL search params
  // 3. smartshare_keys in localStorage
  // 4. smartshare_guest_tokens in localStorage
  const resolvedToken = useMemo(() => {
    if (propToken) return propToken;
    if (typeof window !== 'undefined') {
      const urlToken = new URLSearchParams(window.location.search).get('invite');
      if (urlToken) return urlToken;

      try {
        const parsed = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        const localKeys = parsed || {};
        if (localKeys[spaceId]?.token) return localKeys[spaceId].token;
      } catch (e) {}

      try {
        const storedTokens: string[] = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
        const match = space?.members?.find((m: any) => storedTokens.includes(m.userId));
        if (match) return match.userId;
      } catch (e) {}
    }
    return null;
  }, [propToken, spaceId, space?.members]);

  const currentMember = space?.members?.find((m: any) => m.userId === resolvedToken);
  const isAlreadyWelcomedOrActive = Boolean(
    currentMember && (currentMember.status === 'active' || currentMember.welcomed === true)
  );

  useEffect(() => {
    if (isCreatorOfThisSpace || typeof window === 'undefined' || !resolvedToken) return;

    // Immediately cache in localStorage for cross-page persistence
    try {
      const parsedKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      const localKeys = parsedKeys || {};
      if (!localKeys[spaceId] || localKeys[spaceId].token !== resolvedToken) {
        localKeys[spaceId] = { role: 'partner', token: resolvedToken };
        localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
      }
      const guestTokens: string[] = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      if (!guestTokens.includes(resolvedToken)) {
        guestTokens.push(resolvedToken);
        localStorage.setItem('smartshare_guest_tokens', JSON.stringify(guestTokens));
      }
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
        detail: { spaceId, role: 'partner', token: resolvedToken } 
      }));
    } catch (e) {}

    const urlParams = new URLSearchParams(window.location.search);
    const nameParam = urlParams.get('name');
    if (nameParam && !guestName) {
      setGuestName(nameParam);
    }

    if (isAlreadyWelcomedOrActive || submittedRef.current) {
      setShowGate(false);
    } else {
      setShowGate(true);
    }
  }, [spaceId, isCreatorOfThisSpace, resolvedToken, isAlreadyWelcomedOrActive]);

  useEffect(() => {
    if (currentMember?.name && currentMember.name !== 'שותף מוזמן' && !guestName) {
      setGuestName(currentMember.name);
    }
  }, [currentMember?.name, guestName]);

  if (!mounted || !showGate || isCreatorOfThisSpace || isAlreadyWelcomedOrActive || !resolvedToken) return null;

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isRetroactive = urlParams.get('retro') === 'true';
  const displayShare = currentMember?.sharePercentage ?? (urlParams.get('share') ? Number(urlParams.get('share')) : undefined);

  const handleStart = () => {
    const finalName = guestName.trim() || (currentMember?.name !== 'שותף מוזמן' ? currentMember?.name : '');
    if (!finalName) {
      alert('אנא הזן את שמך כדי להמשיך');
      return;
    }

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
      resolvedToken, 
      shareParam ? Number(shareParam) : (currentMember?.sharePercentage ?? undefined),
      sharesPlan
    );

    // Save unique partner key directly into smartshare_keys (Single Source of Truth)
    try {
      const parsed = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      const localKeys = parsed || {};
      localKeys[spaceId] = { role: 'partner', token: resolvedToken };
      localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
    } catch (e) {}

    // Dispatch event so AuthContext immediately saves it to Firestore user document
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
        detail: { spaceId, role: 'partner', token: resolvedToken } 
      }));
    }

    if (finalName && (!user?.email || user.realName === 'אורח')) {
      try {
        updateProfile({ realName: finalName });
      } catch (e) {}
    }
    
    submittedRef.current = true;
    setShowGate(false);
  };

  return createPortal(
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
          ברוך הבא ל-SmartShare! (v3.8)
        </h2>
        
        <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.5' }}>
          הוזמנת להצטרף לפרויקט <strong>"{space?.title || 'המשותף'}"</strong>
          {displayShare ? ` עם חלק של ${displayShare}%.` : '.'}
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
    </div>,
    document.body
  );
}
