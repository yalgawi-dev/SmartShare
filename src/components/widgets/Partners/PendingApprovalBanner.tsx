'use client';

import { useState } from 'react';
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

  if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed')) return null;

  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeText, setDisputeText] = useState('');

  const handleApprove = () => {
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

  const handleDispute = () => {
    if (!disputeText.trim()) return alert('אנא כתוב את ההשגה שלך');
    if (currentMember) {
      updateMemberStatus(spaceId, currentMember.userId, 'disputed', disputeText.trim());
      setIsDisputing(false);
    }
  };

  return (
    <div style={{ background: currentMember.status === 'disputed' ? '#fef3c7' : '#eff6ff', border: currentMember.status === 'disputed' ? '1px solid #f59e0b' : '1px solid #3b82f6', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            {getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#991b1b', border: '1px solid #fca5a5' }}>
          <span style={{ fontSize: '1.1rem' }}>❌</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>שים לב: ההזמנה שלך לשותפות פגה!</span>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#e0e7ff', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#3730a3', border: '1px solid #c7d2fe' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>שים לב: השותפות תפוג בעוד {getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1)}</span>
        </div>
      )}
      <h3 style={{ margin: '0 0 0.5rem 0', color: currentMember.status === 'disputed' ? '#b45309' : '#1e40af', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {currentMember.status === 'disputed' ? 'ההשגה שלך נשלחה למנהל הפרויקט (v3.4)' : 'ממתין לאישור השותפות שלך (v3.4)'}
      </h3>
      
      {currentMember.status === 'disputed' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
          ההודעה שלך ({currentMember.disputeMessage}) מופיעה אצל מנהל הפרויקט. נעדכן אותך ברגע שהיא תטופל. אם הכל סודר, תוכל לאשר.
        </p>
      ) : (
        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.9rem' }}>
          {space.invoices && space.invoices.length > 0 
            ? 'בחן את הוצאות הפרויקט. האם אתה מסכים לחישוב ולחלוקה הנוכחית?' 
            : 'הזמינו אותך להצטרף לפרויקט. האם אתה מאשר את חלוקת האחוזים והכניסה לשותפות?'}
        </p>
      )}

      {!isDisputing ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button 
            onClick={handleApprove}
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
            placeholder="מה לא מסתדר? (למשל: סוכם שאני משלם רק 30%)"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', minHeight: '60px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={handleDispute}
              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}
            >
              שלח הודעה למנהל
            </button>
            <button 
              onClick={() => setIsDisputing(false)}
              style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
