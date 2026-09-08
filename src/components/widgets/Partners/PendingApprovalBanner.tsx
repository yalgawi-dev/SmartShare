'use client';

import { useState, useEffect } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { getRemainingTimeText } from '../../../utils/partnerUtils';
import AuthModal from '../../auth/AuthModal';

export default function PendingApprovalBanner({ spaceId, inviteToken }: { spaceId: string, inviteToken?: string | null }) {
  const { spaces, updateMemberStatus, migrateGuestToRealUser } = useSpaces() as any;
  const { user, loginWithGoogle, loginWithFacebook, loginWithApple } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [remainingText, setRemainingText] = useState('');

  const space = spaces.find((s: any) => s.id === spaceId);

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
      const matchingMember = space?.members?.find((m: any) => storedTokens.includes(m.userId));
      if (matchingMember) {
        myPartnerToken = matchingMember.userId;
      }
    } catch (e) {}
  }

  const currentMember = space?.members?.find((m: any) => m.userId === myPartnerToken);

  useEffect(() => {
    if (!currentMember || currentMember.status === 'active') return;
    const interval = setInterval(() => {
      setRemainingText(getRemainingTimeText(currentMember.joinedAt));
    }, 1000);
    setRemainingText(getRemainingTimeText(currentMember.joinedAt));
    return () => clearInterval(interval);
  }, [currentMember]);

  if (!space) return null;

  const isCreatorMe = Boolean(
    (user?.id && space.creatorId && user.id === space.creatorId) ||
    (space.createdBy && user?.realName && space.createdBy === user.realName)
  );
  if (isCreatorMe) return null;

  if (!currentMember || currentMember.status === 'active') return null;

  const isExpired = remainingText === 'פג תוקף';

  const finalizeApproval = () => {
    updateMemberStatus(spaceId, currentMember.userId, 'active');
  };

  const handleApproveClick = () => {
    if (user?.email) {
      finalizeApproval();
    } else {
      setShowRegisterPrompt(true);
    }
  };

  const handleDispute = () => {
    if (disputeText.trim()) {
      updateMemberStatus(spaceId, currentMember.userId, 'disputed', disputeText.trim());
      setIsDisputing(false);
    }
  };

  const handleRequestExtension = () => {
    if (currentMember) {
      updateMemberStatus(spaceId, currentMember.userId, 'extension_requested');
      alert('בקשה להארכת זמן נשלחה ליוצר המרחב.');
    }
  };

  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: currentMember.status === 'disputed' || currentMember.status === 'extension_requested' ? '#fef3c7' : 'linear-gradient(90deg, #eff6ff 0%, #e0e7ff 100%)', 
          border: currentMember.status === 'disputed' || currentMember.status === 'extension_requested' ? '1px solid #f59e0b' : '1px solid #c7d2fe', 
          padding: '1rem', 
          borderRadius: '12px', 
          marginBottom: '1.5rem', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out'
        }}
        title="לחץ להרחבה"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.3rem' }}>
            {currentMember.status === 'disputed' ? '⚠️' : currentMember.status === 'extension_requested' ? '⏳' : '🤝'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', color: currentMember.status === 'disputed' || currentMember.status === 'extension_requested' ? '#92400e' : '#1e3a8a', fontSize: '1rem' }}>
              {currentMember.status === 'disputed' ? 'מחלוקת על ההשתתפות' : currentMember.status === 'extension_requested' ? 'בקשת הארכה ממתינה' : 'אישור הצטרפות ממתין לך...'}
            </span>
            {!isExpired && currentMember.status !== 'extension_requested' && currentMember.status !== 'disputed' && (
              <span style={{ fontSize: '0.8rem', color: '#4338ca' }}>זמן נותר: {remainingText}</span>
            )}
          </div>
        </div>
        <button style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          ▾
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: currentMember.status === 'disputed' || currentMember.status === 'extension_requested' ? '#fef3c7' : '#eff6ff', border: currentMember.status === 'disputed' || currentMember.status === 'extension_requested' ? '1px solid #f59e0b' : '1px solid #3b82f6', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      
      <button 
        onClick={() => setIsExpanded(false)}
        style={{ position: 'absolute', top: '16px', left: '16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#64748b' }}
        title="מזער"
      >
        ▴
      </button>

      {currentMember.status === 'disputed' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fef3c7', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#92400e', border: '1px solid #fcd34d' }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>מוקפא - בהמתנה להחלטת המנהל</span>
        </div>
      ) : currentMember.status === 'extension_requested' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fef3c7', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#92400e', border: '1px solid #fcd34d' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>פג תוקף - ממתין לאישור מחדש...</span>
        </div>
      ) : isExpired ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <span style={{ fontSize: '1.1rem' }}>⏰</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>זמן פקע: פג תוקף!</span>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#e0e7ff', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#3730a3', border: '1px solid #c7d2fe' }}>
          <span style={{ fontSize: '1.1rem' }}>⏱️</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>זמן נותר לאישור: {remainingText}</span>
        </div>
      )}
      
      <h3 style={{ margin: '0 0 0.5rem 0', color: currentMember.status === 'disputed' ? '#b45309' : '#1e40af', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
        {currentMember.status === 'disputed' 
          ? '⚠️ סטטוס מוקפא: פנייה בבירור מול המנהל (v3.9)' 
          : currentMember.disputeResolved 
            ? '🤝 המנהל איפס את הסטטוס - אנא אשר שוב'
            : '🤝 אישור הצטרפות כשותף (v3.9)'}
      </h3>
      
      {currentMember.status === 'disputed' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.95rem', lineHeight: 1.5 }}>
          דיווחת על מחלוקת ({currentMember.disputeMessage}) וזה נשלח למנהל המרחב. כרגע החשבון מוקפא עד לבירור. ברגע שהמנהל יענה לבקשתך, תוכל להמשיך להשתמש באפליקציה כרגיל.
        </p>
      ) : currentMember.status === 'extension_requested' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.95rem', lineHeight: 1.5 }}>
          ביקשת הארכת זמן מכיוון שהזמן שלך פקע. מנהל המרחב יבדוק את בקשתך ויחליט האם לאשר מחדש.
        </p>
      ) : (
        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '40px' }}>
          {space.invoices && space.invoices.length > 0 
            ? 'הוזמנת להיות שותף במרחב זה. יש עכשיו חשבוניות פעילות שדורשות את ההתייחסות שלך. עליך לאשר את האחוזים שלך כדי להיכנס להוצאות.' 
            : 'הוזמנת להיות שותף במרחב זה. כדי להתחיל להשתתף בהוצאות ולראות את כל הנתונים - עליך לאשר את החלק שלך.'}
        </p>
      )}

      {currentMember.status !== 'extension_requested' && (
        isExpired ? (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button 
              onClick={handleRequestExtension}
              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', flex: 1, boxShadow: '0 2px 4px rgba(245,158,11,0.2)' }}
            >
              בקש הארכת זמן
            </button>
          </div>
        ) : !isDisputing ? (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button 
              onClick={handleApproveClick}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', flex: 1.5, boxShadow: '0 4px 12px rgba(74,91,240,0.2)' }}
            >
              {currentMember.status === 'disputed' ? 'התחרטתי, אני מאשר' : 'מסכים, אישור שותפות'}
            </button>
            {currentMember.status !== 'disputed' && (
              <button 
                onClick={() => setIsDisputing(true)}
                style={{ background: 'white', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.6rem 1rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', flex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              >
                יש לי מחלוקת
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <textarea 
              value={disputeText}
              onChange={e => setDisputeText(e.target.value)}
              placeholder="מה הבעיה? פרט כאן (לדוגמה: סיכמנו על 30% / לא מבין משהו)"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'none', minHeight: '80px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={handleDispute}
                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
              >
                דווח למנהל
              </button>
              <button 
                onClick={() => setIsDisputing(false)}
                style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ביטול
              </button>
            </div>
          </div>
        )
      )}

      {showRegisterPrompt && (
        <AuthModal 
          onClose={() => setShowRegisterPrompt(false)} 
          onSuccess={() => {
            finalizeApproval();
            setShowRegisterPrompt(false);
          }}
          title="ברוך הבא!"
        />
      )}
    </div>
  );
}
