const fs = require('fs');

const content = "use client";

import React, { useState, useEffect } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';

export function SharesEditorModal({ space, user, onClose }: { space: any, user: any, onClose: () => void }) {
  const validMembers = (space.members || []).filter((m: any) => m.isActive !== false);
  const defaultShare = validMembers.length > 0 ? (100 / (validMembers.length + 1)) : 100;

  const [myShare, setMyShare] = useState(space.settings?.mySharePercentage ?? defaultShare);
  const [partnerShares, setPartnerShares] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? defaultShare;
    });
    return initial;
  });

  // Sync local state when external members list changes (e.g. after a deletion)
  useEffect(() => {
    const activeIds = new Set(validMembers.map((m: any) => m.userId));
    setPartnerShares(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(id => {
        if (!activeIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [space.members]);

  // When partnerShares shrinks (e.g. someone deleted), auto-rebalance the remaining to 100%
  // if we are the only one left!
  useEffect(() => {
    if (validMembers.length === 0 && myShare !== 100) {
      setMyShare(100);
    }
  }, [validMembers.length]);


  const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);
  const { updateSpaceSettings, removeMember, refreshMemberInvite, updateSharesBulk } = useSpaces();
  
  const [expHours, setExpHours] = useState((space.settings?.pendingExpirationHours || 1).toString());
  const [saved, setSaved] = useState(false);

  const handleAutoBalance = () => {
    setMyShare(defaultShare);
    const newPartnerShares: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      newPartnerShares[m.userId] = defaultShare;
    });
    setPartnerShares(newPartnerShares);
  };

  useEffect(() => {
    if (Math.abs(total - 100) < 0.1) {
      if (updateSharesBulk) {
        updateSharesBulk(space.id, myShare, partnerShares);
        if (updateSpaceSettings) {
          const parsedHours = parseFloat(expHours);
          if (!isNaN(parsedHours) && parsedHours > 0) {
            updateSpaceSettings(space.id, { pendingExpirationHours: parsedHours });
          }
        }
        setSaved(true);
        const t = setTimeout(() => setSaved(false), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [myShare, partnerShares, expHours, total, space.id, updateSharesBulk, updateSpaceSettings]);

  const getRemainingTimeText = (joinedAt: string | undefined, expH: number) => {
    if (!joinedAt) return 'לא ידוע';
    const diff = new Date().getTime() - new Date(joinedAt).getTime();
    const remainingMs = (expH * 3600000) - diff;
    if (remainingMs <= 0) return 'פג תוקף';
    const hrs = Math.floor(remainingMs / 3600000);
    const mins = Math.floor((remainingMs % 3600000) / 60000);
    if (hrs > 0) return \\ שעות ו-\ דקות\;
    return \\ דקות\;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bottom-sheet-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
      <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', marginBottom: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>הגדרת חלוקת אחוזים (v1.6)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 'bold' }}>{user?.name || 'אני'} (ברירת מחדל)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="text" inputMode="decimal" value={myShare} onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\\d*\\.?\\d*$/.test(val)) setMyShare(val as unknown as number);
              }} onFocus={e => e.target.select()}
                style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
              />
              <span>%</span>
            </div>
          </div>
          
          {validMembers.map((m: any) => {
            const isPending = m.status === 'pending';
            const isExpired = isPending && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
            
            return (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={m.photoURL || '/default-avatar.png'} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  <span>{m.name}</span>
                </div>
                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: isExpired ? '#ef4444' : '#f59e0b', fontWeight: isExpired ? 'bold' : 'normal' }}>
                      {isExpired ? '❌ פג תוקף' : '⏳ ממתין'}
                    </span>
                    {!isExpired && m.joinedAt && (
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {getRemainingTimeText(m.joinedAt, space.settings?.pendingExpirationHours || 1)}
                      </span>
                    )}
                    {isExpired && removeMember && refreshMemberInvite && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => removeMember(space.id, m.userId, user?.id || 'system', true)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>🗑️ הסר</button>
                        <button type="button" onClick={() => refreshMemberInvite(space.id, m.userId)} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>🔄 חדש</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="text" inputMode="decimal" value={partnerShares[m.userId] ?? ''} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\\d*\\.?\\d*$/.test(val)) setPartnerShares({ ...partnerShares, [m.userId]: val as unknown as number });
                }} onFocus={e => e.target.select()}
                  style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
                />
                <span>%</span>
              </div>
            </div>
          )})}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>
          <span style={{ fontWeight: 'bold', color: Math.abs(Number(total) - 100) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>
            {Number(total).toFixed(1)}%
          </span>
        </div>
        

        <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.95rem' }}>זמן פג תוקף להמתנה</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>שותף שלא אישר יימחק אוטומטית</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="text" inputMode="decimal" value={expHours} onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\\d*\\.?\\d*$/.test(val)) setExpHours(val);
              }} onFocus={e => {
                 setTimeout(() => e.target.select(), 10);
              }}
                style={{ width: '60px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.9rem' }}>שעות</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
          <button 
            onClick={handleAutoBalance}
            style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            איזון שווה
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', color: Math.abs(Number(total) - 100) > 0.1 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
            {Math.abs(Number(total) - 100) > 0.1 ? 'חובה להגיע ל-100%' : (saved ? '✓ נשמר אוטומטית' : 'מאוזן 100%')}
          </div>
        </div>
      </div>
    </div>
  );
}
;

fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', content, 'utf8');
console.log('Done SharesEditorModal.tsx');
