'use client';

import { useState, useEffect } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import AuthModal from '../../auth/AuthModal';

export default function PendingApprovalBanner({ spaceId, inviteToken }: { spaceId: string, inviteToken?: string | null }) {
  const { spaces, updateMemberStatus } = useSpaces() as any;
  const { user } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

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
    if (user?.email && typeof window !== 'undefined') {
      const pendingSpace = sessionStorage.getItem('pending_approval_space');
      if (pendingSpace === spaceId && currentMember?.status === 'pending') {
        sessionStorage.removeItem('pending_approval_space');
        updateMemberStatus(spaceId, currentMember.userId, 'active');
      }
    }
  }, [user?.email, currentMember?.status, spaceId, updateMemberStatus]);

  if (!space) return null;

  const isCreatorMe = Boolean(
    (user?.id && space.creatorId && user.id === space.creatorId) ||
    (space.createdBy && user?.realName && space.createdBy === user.realName)
  );
  if (isCreatorMe) return null;

  if (!currentMember || currentMember.status === 'active') return null;

  const finalizeApproval = () => {
    updateMemberStatus(spaceId, currentMember.userId, 'active');
  };

  const handleApproveClick = () => {
    if (user?.email) {
      finalizeApproval();
    } else {
      sessionStorage.setItem("pending_approval_space", spaceId);
      setShowRegisterPrompt(true);
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
          background: 'linear-gradient(90deg, #eff6ff 0%, #e0e7ff 100%)', 
          border: '1px solid #c7d2fe', 
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
          <span style={{ fontSize: '1.3rem' }}>🤝</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '1rem' }}>
              אישור הצטרפות ממתין לך...
            </span>
          </div>
        </div>
        <button style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          ▾
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: '#eff6ff', border: '1px solid #3b82f6', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      
      <button 
        onClick={() => setIsExpanded(false)}
        style={{ position: 'absolute', top: '16px', left: '16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#64748b' }}
        title="מזער"
      >
        ▴
      </button>

      <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
        🤝 אישור הצטרפות כשותף
      </h3>
      
      <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.95rem', lineHeight: 1.5, paddingRight: '40px' }}>
        {space.invoices && space.invoices.length > 0 
          ? 'הוזמנת להיות שותף במרחב זה. יש עכשיו חשבוניות פעילות שדורשות את ההתייחסות שלך. עליך לאשר את האחוזים שלך כדי להיכנס להוצאות.' 
          : 'הוזמנת להיות שותף במרחב זה. כדי להתחיל להשתתף בהוצאות ולראות את כל הנתונים - עליך לאשר את החלק שלך.'}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button 
          onClick={handleApproveClick}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', width: '100%', boxShadow: '0 4px 12px rgba(74,91,240,0.2)' }}
        >
          מסכים, אישור שותפות
        </button>
      </div>

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
