'use client';

import { useState, useEffect } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { getRemainingTimeText } from '../../../utils/partnerUtils';

export default function PendingApprovalBanner({ spaceId, inviteToken }: { spaceId: string, inviteToken?: string | null }) {
  const { spaces, updateMemberStatus, migrateGuestToRealUser } = useSpaces() as any;
  const { user, loginWithGoogle } = useAuth();
  
  const space = spaces.find((s: any) => s.id === spaceId);
  if (!space) return null;

  // Creators never see the partner pending approval banner
  const isCreatorMe = Boolean(
    (user?.id && space.creatorId && user.id === space.creatorId) ||
    (space.createdBy && user?.realName && space.createdBy === user.realName)
  );
  if (isCreatorMe) return null;

  // Resolve partner's unique token from URL, user spaceKeys, or local storage
  const tokenFromUrl = inviteToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') : null);
  
  let myPartnerToken = tokenFromUrl;
  if (!myPartnerToken && user?.spaceKeys?.[spaceId]?.token) {
    myPartnerToken = user.spaceKeys[spaceId].token;
  }
  if (!myPartnerToken && typeof window !== 'undefined') {
    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      if (localKeys[spaceId]?.token) {
        myPartnerToken = localKeys[spaceId].token;
      }
    } catch (e) {}
  }
  if (!myPartnerToken && typeof window !== 'undefined') {
    try {
      const storedTokens = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      const matchingMember = space.members?.find((m: any) => storedTokens.includes(m.userId));
      if (matchingMember) myPartnerToken = matchingMember.userId;
    } catch (e) {}
  }

  // Find the partner member record in space.members
  const currentMember = space.members?.find((m: any) => 
    (myPartnerToken && m.userId === myPartnerToken) || 
    (user?.id && m.userId === user.id)
  );

  if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed' && currentMember.status !== 'extension_requested')) return null;

  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setIsMinimized(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('open-approval-banner', handleOpen);
    return () => window.removeEventListener('open-approval-banner', handleOpen);
  }, []);

  const remainingText = getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1);
  const isExpired = remainingText === 'הזמן פג' && currentMember.status !== 'extension_requested';

  const finalizeApproval = () => {
    if (currentMember) {
      updateMemberStatus(spaceId, currentMember.userId, 'active');
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        localKeys[spaceId] = { role: 'partner', token: currentMember.userId };
        localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
        const guestTokens: string[] = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
        if (!guestTokens.includes(currentMember.userId)) {
          guestTokens.push(currentMember.userId);
          localStorage.setItem('smartshare_guest_tokens', JSON.stringify(guestTokens));
        }
        window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
          detail: { spaceId, role: 'partner', token: currentMember.userId } 
        }));
      } catch (e) {}
    }
  };

  const handleApproveClick = () => {
    if (!user || !user.email) {
      // Guest user must register
      setShowRegisterPrompt(true);
    } else {
      finalizeApproval();
    }
  };

  const handleDispute = () => {
    if (!disputeText.trim()) return alert('אנא פרט את סיבת ההשגה');
    if (currentMember) {
      updateMemberStatus(spaceId, currentMember.userId, 'disputed', disputeText.trim());
      setIsDisputing(false);
    }
  };

  const handleRequestExtension = () => {
    if (currentMember) {
      updateMemberStatus(spaceId, currentMember.userId, 'extension_requested');
      alert('בקשתך להארכת זמן נשלחה למנהל המרחב.');
    }
  };

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          background: '#f59e0b',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '30px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 5000,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 'bold'
        }}
        title="אישור שותפות בהמתנה"
      >
        <span style={{ fontSize: '1.2rem' }}>⭐</span> שותפות
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: currentMember.status === 'disputed' ? '#fef3c7' : '#eff6ff', border: currentMember.status === 'disputed' ? '1px solid #f59e0b' : '1px solid #3b82f6', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <button onClick={() => setIsMinimized(true)} style={{ position: 'absolute', top: '10px', left: '10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="מזער">➖</button>      {currentMember.status === 'extension_requested' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fef3c7', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#92400e', border: '1px solid #fcd34d' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>ביקשת הארכת זמן - ממתין לאישור המזמין...</span>
        </div>
      ) : isExpired ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <span style={{ fontSize: '1.1rem' }}>❌</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>הזמן פג: פג תוקף ההזמנה לשותפות!</span>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#e0e7ff', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#3730a3', border: '1px solid #c7d2fe' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>זמן נותר לאישור השתתפות: {remainingText}</span>
        </div>
      )}
      
      <h3 style={{ margin: '0 0 0.5rem 0', color: currentMember.status === 'disputed' ? '#b45309' : '#1e40af', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {currentMember.status === 'disputed' ? 'הגשת השגה על ההתחשבנות במרחב (v3.6)' : 'ממתין לאישורך על חלוקת ההוצאות (v3.6)'}
      </h3>
      
      {currentMember.status === 'disputed' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
          סיבת ההשגה ({currentMember.disputeMessage}) נשלחה למנהל המרחב. כעת עליכם להגיע לעמק השווה. המנהל יוכל לתקן ולבקש שוב.
        </p>
      ) : currentMember.status === 'extension_requested' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
          המזמין יוכל לאשר לך זמן נוסף לבדיקת ההוצאות. תוכל תמיד להיכנס ולבדוק את הנתונים בינתיים.
        </p>
      ) : (
        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.9rem' }}>
          {space.invoices && space.invoices.length > 0 
            ? 'אנא עבור על ההוצאות במרחב. במידה והכל מדויק אנא אשר למטה' 
            : 'המרחב כרגע ריק מהוצאות. במידה והכל מוסכם עליך מבחינת אחוזים - אשר את השתתפותך'}
        </p>
      )}

      {currentMember.status !== 'extension_requested' && (
        isExpired ? (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button 
              onClick={handleRequestExtension}
              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
            >
              הזמן פג - בקש הארכת זמן מהמזמין
            </button>
          </div>
        ) : !isDisputing ? (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button 
              onClick={handleApproveClick}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
            >
              הכל מדויק, מאשר שותפות
            </button>
            <button 
              onClick={() => setIsDisputing(true)}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
            >
              יש לי השגה / טעות
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea 
              value={disputeText}
              onChange={e => setDisputeText(e.target.value)}
              placeholder="פרט מהי סיבת ההשגה (לדוגמא: אני אמרתי שאשלם רק 30%)"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', minHeight: '60px' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={handleDispute}
                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
              >
                שלח את ההשגה למנהל
              </button>
              <button 
                onClick={() => setIsDisputing(false)}
                style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}
              >
                ביטול
              </button>
            </div>
          </div>
        )
      )}

      {/* Register Prompt Modal */}
      {showRegisterPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', textAlign: 'center', animation: 'scaleIn 0.3s ease-out' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>מעולה! רק עוד צעד קטן</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: 1.5 }}>
              כדי לאשר סופית את השותפות, לשמור את הנתונים שלך ולהנות מכל הכלים במרחב, עליך להתחבר ולהירשם (בחינם).
            </p>
            <button 
              onClick={async () => {
                try {
                  await loginWithGoogle();
                  finalizeApproval();
                  setShowRegisterPrompt(false);
                } catch (e) {
                  // handle error if needed
                }
              }}
              style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginBottom: '1rem' }}
            >
              התחבר עם Google
            </button>
            <button 
              onClick={() => setShowRegisterPrompt(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



