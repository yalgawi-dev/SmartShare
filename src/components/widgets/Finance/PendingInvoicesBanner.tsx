'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../app/context/AuthContext';
import { useSpaces } from '../../../app/context/SpacesContext';

export default function PendingInvoicesBanner({ space, onScrollToFinance }: { space: any, onScrollToFinance: () => void }) {
  const { user } = useAuth();
  const { getTokenForSpace, getRoleForSpace } = useSpaces();
  const [isSnoozed, setIsSnoozed] = useState(false);

  useEffect(() => {
    const snoozeTime = localStorage.getItem('pendingInvoicesSnooze_' + space?.id);
    if (snoozeTime) {
      if (Date.now() < parseInt(snoozeTime, 10)) {
        setIsSnoozed(true);
      } else {
        localStorage.removeItem('pendingInvoicesSnooze_' + space?.id);
      }
    }
  }, [space?.id]);

  if (!user || !user.id || !space?.invoices || isSnoozed) return null;

  const myRole = space ? getRoleForSpace(space.id) : 'none';
  const isCreatorMe = myRole === 'creator' || (space?.creatorId && user.id === space.creatorId);
  const myEffectiveId = user?.id || 'me';
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
    <>
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: `0 4px 15px ${hasRecentNudge ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.15)'}`,
      animation: hasRecentNudge ? 'urgentPulse 1.5s infinite' : 'pulseGlow 2.5s infinite',
      position: 'relative'
    }}>
      <div onClick={onScrollToFinance} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flex: 1 }}>
        <div style={{
          background: iconBg, color: 'white',
          width: '50px', height: '50px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 'bold',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          {hasRecentNudge ? '🔔' : pendingCount}
        </div>
        <div>
          <h3 style={{ margin: 0, color: titleColor, fontSize: '1.15rem', fontWeight: 800 }}>{titleText}</h3>
          <p style={{ margin: '0.25rem 0 0', color: descColor, fontSize: '0.9rem', lineHeight: 1.4 }}>
            יש לך {pendingCount} {pendingCount === 1 ? 'פעולה שממתינה' : 'פעולות שממתינות'} לאישור בפירוט ההוצאות.
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginRight: '1rem', zIndex: 10 }}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const twelveHours = Date.now() + 12 * 60 * 60 * 1000;
            localStorage.setItem('pendingInvoicesSnooze_' + space.id, twelveHours.toString());
            setIsSnoozed(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: descColor,
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '8px',
            textDecoration: 'underline',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          ⏰ הזכר לי בעוד 12 שעות
        </button>
      </div>
      <div style={{ fontSize: '1.5rem', animation: 'bounceDown 1.5s infinite', marginRight: '0.5rem', cursor: 'pointer' }} onClick={onScrollToFinance}>
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
          50% { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.5); transform: scale(1.02); }
          100% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.25); transform: scale(1); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
      `}</style>
    </div>
    </>
  );
}
