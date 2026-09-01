'use client';

import { useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

export default function PendingApprovalBanner({ spaceId, inviteToken }: { spaceId: string, inviteToken?: string | null }) {
  const { spaces, updateMemberStatus, migrateGuestToRealUser } = useSpaces() as any;
  const { user, loginWithGoogle } = useAuth();
  
  const space = spaces.find((s: any) => s.id === spaceId);
  if (!space) return null;

  const currentToken = user?.id || inviteToken;
  if (!currentToken) return null;

  const currentMember = space.members?.find((m: any) => m.userId === currentToken);
  if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed')) return null;

  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeText, setDisputeText] = useState('');

  const handleApprove = async () => {
    if (user?.id === currentToken) {
      updateMemberStatus(spaceId, user.id, 'active');
      return;
    }
    try {
      await loginWithGoogle();
      alert('אנא התחבר כדי להשלים את ההרשמה. לאחר ההתחברות, הפרויקט יעודכן.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispute = () => {
    if (!disputeText.trim()) return alert('אנא כתוב את ההשגה שלך');
    updateMemberStatus(spaceId, currentToken, 'disputed', disputeText);
    setIsDisputing(false);
  };

  return (
    <div style={{ background: currentMember.status === 'disputed' ? '#fef3c7' : '#eff6ff', border: currentMember.status === 'disputed' ? '1px solid #f59e0b' : '1px solid #3b82f6', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: currentMember.status === 'disputed' ? '#b45309' : '#1e40af', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {currentMember.status === 'disputed' ? 'ההשגה שלך נשלחה למנהל הפרויקט' : 'ממתין לאישור השותפות שלך'}
      </h3>
      
      {currentMember.status === 'disputed' ? (
        <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
          ההודעה שלך ({currentMember.disputeMessage}) מופיעה אצל מנהל הפרויקט. נעדכן אותך ברגע שהיא תטופל. אם הכל סודר, תוכל לאשר.
        </p>
      ) : (
        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.9rem' }}>
          בחן את הוצאות הפרויקט. האם אתה מסכים לחישוב ולחלוקה הנוכחית? 
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
