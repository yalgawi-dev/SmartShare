'use client';

import { useAuth } from '../../../app/context/AuthContext';
import { useSpaces } from '../../../app/context/SpacesContext';

export default function PendingInvoicesBanner({ space, onScrollToFinance }: { space: any, onScrollToFinance: () => void }) {
  const { user } = useAuth();
  const { getTokenForSpace, getRoleForSpace } = useSpaces();
  
  if (!user || !user.id || !space?.invoices) return null;

  const myRole = space ? getRoleForSpace(space.id) : 'none';
  const isCreatorMe = myRole === 'creator' || (space?.creatorId && user.id === space.creatorId);
  const myEffectiveId = isCreatorMe ? (user.id || 'me') : (getTokenForSpace(space.id) || user.id || 'me');

  const pendingInvoices = space.invoices.filter((inv: any) => {
    if (inv.status !== 'pending' || inv.isActive === false) return false;
    if (inv.type === 'transfer') {
      return inv.targetId === myEffectiveId;
    }
    const approvedBy = inv.approvedBy || [];
    const excluded = inv.excludedMembers || [];
    return inv.payerId !== myEffectiveId && inv.payerId !== 'me' && !approvedBy.includes(myEffectiveId) && !excluded.includes(myEffectiveId);
  });

  const pendingCount = pendingInvoices.length;
  if (pendingCount === 0) return null;

  const hasRecentNudge = pendingInvoices.some((inv: any) => inv.nudgedAt && Date.now() - inv.nudgedAt < 24 * 60 * 60 * 1000);

  const bgColor = hasRecentNudge ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
  const borderColor = hasRecentNudge ? '#ef4444' : '#f59e0b';
  const iconBg = hasRecentNudge ? '#ef4444' : '#f59e0b';
  const titleColor = hasRecentNudge ? '#7f1d1d' : '#92400e';
  const descColor = hasRecentNudge ? '#b91c1c' : '#b45309';
  const titleText = hasRecentNudge ? 'תזכורת דחופה מהשותפים!' : 'ממתין לאישורך!';

  return (
    <div onClick={onScrollToFinance} style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      boxShadow: `0 4px 15px ${hasRecentNudge ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.15)'}`,
      animation: hasRecentNudge ? 'urgentPulse 1.5s infinite' : 'pulseGlow 2.5s infinite'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          background: iconBg, color: 'white',
          width: '40px', height: '40px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', fontWeight: 'bold'
        }}>
          {hasRecentNudge ? '🔔' : pendingCount}
        </div>
        <div>
          <h3 style={{ margin: '0 0 0.2rem 0', color: titleColor, fontSize: '1.1rem' }}>{titleText}</h3>
          <p style={{ margin: 0, color: descColor, fontSize: '0.9rem' }}>
            יש לך {pendingCount} {pendingCount === 1 ? 'פעולה שממתינה' : 'פעולות שממתינות'} לאישור בפירוט ההוצאות.
          </p>
        </div>
      </div>
      <div style={{ color: descColor, fontSize: '1.5rem', animation: 'bounceDown 1s infinite' }}>
        👇
      </div>
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15); }
          50% { box-shadow: 0 4px 25px rgba(245, 158, 11, 0.4); }
          100% { box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15); }
        }
        @keyframes urgentPulse {
          0% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.25); transform: scale(1); }
          50% { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.6); transform: scale(1.02); }
          100% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.25); transform: scale(1); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
      `}</style>
    </div>
  );
}
