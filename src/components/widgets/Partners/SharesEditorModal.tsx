import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SharesEditorModalProps {
  space: any;
  onClose: () => void;
  updateSharesBulk?: (spaceId: string, myShare: number, partnerShares: Record<string, number>) => void;
  updateSpaceSettings?: (spaceId: string, settings: any) => void;
  user: any;
  removeMember?: (spaceId: string, userId: string, performedBy: string, isReject?: boolean) => void;
  refreshMemberInvite?: (spaceId: string, memberId: string) => void;
}

export function SharesEditorModal({ space, onClose, updateSharesBulk, updateSpaceSettings, user, removeMember, refreshMemberInvite }: SharesEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const validMembers = (space.members || []).filter((m: any) => m.status !== 'rejected');
  const totalPartners = validMembers.length;
  const defaultShare = totalPartners > 0 ? Number((100 / (totalPartners + 1)).toFixed(1)) : 100;

  const [myShare, setMyShare] = useState<string | number>(space.settings?.mySharePercentage ?? defaultShare);
  const [partnerShares, setPartnerShares] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? defaultShare;
    });
    return initial;
  });

  const [expHours, setExpHours] = useState<string | number>(space.settings?.pendingExpirationHours ?? 48);

  useEffect(() => {
    const newPartnerShares: Record<string, string | number> = {};
    validMembers.forEach((m: any) => {
      newPartnerShares[m.userId] = m.sharePercentage ?? defaultShare;
    });
    setPartnerShares(prev => {
      const prevKeys = Object.keys(prev).sort().join(',');
      const newKeys = Object.keys(newPartnerShares).sort().join(',');
      if (prevKeys !== newKeys) {
        return newPartnerShares;
      }
      return prev;
    });
  }, [validMembers, defaultShare]);

  const total = Number(myShare) + Object.values(partnerShares).reduce((acc: number, val) => acc + Number(val), 0);

  const handleSave = () => {
    if (Math.abs(Number(total) - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות בדיוק 100% כדי להישמר.');
      return;
    }
    if (updateSharesBulk) {
      const pSharesNum: Record<string, number> = {};
      Object.keys(partnerShares).forEach(k => pSharesNum[k] = Number(partnerShares[k]));
      updateSharesBulk(space.id, Number(myShare), pSharesNum);
      
      if (updateSpaceSettings) {
        const parsedHours = parseFloat(expHours.toString());
        if (!isNaN(parsedHours) && parsedHours > 0) {
          updateSpaceSettings(space.id, { pendingExpirationHours: parsedHours });
        }
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    }
  };

  const handleAutoBalance = () => {
    const membersCount = validMembers.length + 1;
    const equalShare = Number((100 / membersCount).toFixed(1));
    const newPartnerShares: Record<string, number> = {};
    let sum = equalShare;
    validMembers.forEach((m: any, idx: number) => {
      if (idx === validMembers.length - 1) {
        newPartnerShares[m.userId] = Number((100 - sum).toFixed(1));
      } else {
        newPartnerShares[m.userId] = equalShare;
        sum += equalShare;
      }
    });
    setMyShare(equalShare);
    setPartnerShares(newPartnerShares);
  };

  const getRemainingTimeText = (joinedAtStr: string, limitHours: number) => {
    const joinedAt = new Date(joinedAtStr).getTime();
    const now = new Date().getTime();
    const diffHours = (now - joinedAt) / 3600000;
    const remainHours = limitHours - diffHours;
    if (remainHours <= 0) return 'פג תוקף';
    if (remainHours < 1) return 'פחות משעה';
    return `נותרו ${Math.floor(remainHours)} שעות`;
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 99998, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#ffffff', borderRadius: '24px', width: '90%', maxWidth: '450px', zIndex: 99999, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>עריכת אחוזים והגדרות</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '2px solid var(--primary)', borderRadius: '12px', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>👑</span>
              {space.createdBy || user?.realName || 'יוצר המרחב'} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>(אני)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="text" inputMode="decimal" value={myShare} onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setMyShare(val);
                }
              }} onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
              />
              <span>%</span>
            </div>
          </div>
          
          {validMembers.map((m: any) => {
            const isPending = m.status === 'pending';
            const isExpired = isPending && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
            
            return (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={m.photoURL || '/default-avatar.png'} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  <span style={{ fontWeight: '500' }}>{m.name}</span>
                </div>
                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: isExpired ? '#ef4444' : '#f59e0b', fontWeight: isExpired ? 'bold' : 'normal' }}>
                      {isExpired ? '⏳ פג תוקף' : '⏳ ממתין'}
                    </span>
                    {!isExpired && m.joinedAt && (
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {getRemainingTimeText(m.joinedAt, space.settings?.pendingExpirationHours || 1)}
                      </span>
                    )}
                    {isExpired && removeMember && refreshMemberInvite && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => removeMember(space.id, m.userId, user?.id || 'system', true)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>מחק</button>
                        <button type="button" onClick={() => refreshMemberInvite(space.id, m.userId)} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>חדש</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="text" inputMode="decimal" value={partnerShares[m.userId] ?? ''} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setPartnerShares({ ...partnerShares, [m.userId]: val });
                  }
                }} onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                  style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
                />
                <span>%</span>
              </div>
            </div>
          )})}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 1.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>
          <span style={{ fontWeight: 'bold', color: Math.abs(Number(total) - 100) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>
            {Number(total).toFixed(1)}%
          </span>
        </div>

        {Math.abs(Number(total) - 100) > 0.1 && (
          <div style={{ margin: '0 1.5rem 1rem 1.5rem', background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>שים לב:</strong> סך כל האחוזים חייב להיות בדיוק 100% כדי להישמר. יש לתקן את האחוזים.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1.5rem 1.5rem 1.5rem' }}>
          <button 
            onClick={handleSave}
            disabled={Math.abs(Number(total) - 100) > 0.1}
            style={{
              width: '100%',
              background: Math.abs(Number(total) - 100) > 0.1 ? '#94a3b8' : 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: Math.abs(Number(total) - 100) > 0.1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s'
            }}
          >
            {saved ? '✓ נשמר' : 'שמור אחוזים'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
