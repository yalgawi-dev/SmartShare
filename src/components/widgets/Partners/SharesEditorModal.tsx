'use client';

import { useState } from 'react';

import { useSpaces } from '../../../app/context/SpacesContext';
export function SharesEditorModal({ 
  space, 
  user, 
  validMembers, 
  onClose, 
  updateSharesBulk 
}: { 
  space: any;
  user: any;
  validMembers: any[];
  onClose: () => void;
  updateSharesBulk?: any;
}) {
  const memberCount = validMembers.length + 1;
  const defaultShare = 100 / memberCount;
  
  const [myShare, setMyShare] = useState<number>(space.settings?.mySharePercentage ?? defaultShare);
  const [partnerShares, setPartnerShares] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? defaultShare;
    });
    return initial;
  });

  const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);
  const { updateSpaceSettings } = useSpaces();
  const [expHours, setExpHours] = useState(space.settings?.pendingExpirationHours || 1);

  const handleAutoBalance = () => {
    setMyShare(defaultShare);
    const newPartnerShares: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      newPartnerShares[m.userId] = defaultShare;
    });
    setPartnerShares(newPartnerShares);
  };

  const handleSave = () => {
    if (Math.abs(total - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות 100%');
      return;
    }
    
    if (updateSharesBulk) {
      updateSharesBulk(space.id, myShare, partnerShares);
      if (updateSpaceSettings) {
        updateSpaceSettings(space.id, { pendingExpirationHours: expHours });
      }
    }
    
    alert('האחוזים עודכנו בהצלחה!');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bottom-sheet-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
      <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>הגדרת חלוקת אחוזים</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>
        
        <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 'bold' }}>את/ה (ברירת מחדל)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                min="0" max="100" 
                value={Number(myShare).toFixed(1)} 
                onChange={e => setMyShare(Number(e.target.value))}
                style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
              />
              <span>%</span>
            </div>
          </div>
          
          {validMembers.map((m: any) => (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={m.photoURL || '/default-avatar.png'} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                <span>{m.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  min="0" max="100" 
                  value={Number(partnerShares[m.userId]).toFixed(1)} 
                  onChange={e => setPartnerShares({ ...partnerShares, [m.userId]: Number(e.target.value) })}
                  style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
                />
                <span>%</span>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>
          <span style={{ fontWeight: 'bold', color: Math.abs(total - 100) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>
            {total.toFixed(1)}%
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={handleAutoBalance}
            style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            איזון שווה
          </button>
          <button 
            onClick={handleSave}
            style={{ flex: 2, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', opacity: Math.abs(total - 100) > 0.1 ? 0.5 : 1 }}
          >
            שמור אחוזים
          </button>
        </div>
      </div>
    </div>
  );
}
