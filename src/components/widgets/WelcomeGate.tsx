'use client';
import { useState, useEffect } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';

export default function WelcomeGate({ spaceId }: { spaceId: string }) {
  const { spaces } = useSpaces();
  const [showGate, setShowGate] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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

  const space = spaces.find(s => s.id === spaceId);
  const isRetroactive = space?.invoices?.some(inv => !(inv.excludedMembers || []).includes(inviteToken || ''));

  const handleStart = () => {
    localStorage.setItem(`welcomed_${spaceId}_${inviteToken}`, 'true');
    setShowGate(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="card glass-panel" style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '450px',
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
            <strong>לידיעתך:</strong> הוגדרת כשותף מלא מהיום הראשון, כלומר החלק שלך יחושב גם מתוך ההוצאות ההיסטוריות שהיו בפרויקט עד כה.
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
