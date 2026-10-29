import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SharesEditorModalProps { [key: string]: any;
  space: any;
  onClose: () => void;
  updateSharesBulk?: (spaceId: string, myShare: number, partnerShares: Record<string, number>, scope?: 'from_now_on' | 'retroactive') => void;
  updateSpaceSettings?: (spaceId: string, settings: any) => void;
  user: any;
  removeMember?: (spaceId: string, userId: string, performedBy: string, isReject?: boolean) => void;
}

export function SharesEditorModal({ space, onClose, updateSharesBulk, updateSpaceSettings, user, removeMember }: SharesEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [shareScope, setShareScope] = useState<'from_now_on' | 'retroactive'>('from_now_on');

  useEffect(() => { setMounted(true); }, []);

  const validMembers = (space.members || []).filter((m: any) => m.status !== 'rejected' && m.isActive !== false);
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

  const total = Number(myShare) + Number(Object.values(partnerShares).reduce((acc: number, val: any) => Number(acc) + Number(val), 0));

  const handleSave = () => {
    if (Math.abs(Number(total) - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות בדיוק 100% כדי להישמר.');
      return;
    }
    if (updateSharesBulk) {
      const pSharesNum: Record<string, number> = {};
      Object.keys(partnerShares).forEach(k => pSharesNum[k] = Number(partnerShares[k]));
      updateSharesBulk(space.id, Number(myShare), pSharesNum, shareScope);
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              style={{ background: showHistory ? 'var(--primary)' : 'var(--bg-main)', color: showHistory ? 'white' : 'var(--text-secondary)', border: '1px solid ' + (showHistory ? 'var(--primary)' : 'var(--border-light)'), padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
            >
              {showHistory ? 'חזור לעריכת אחוזים' : '📜 הצג היסטוריית שינויים'}
            </button>
          </div>

          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(!space.auditLogs || space.auditLogs.filter((l: any) => l.actionType === 'SHARES_UPDATED').length === 0) ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>לא נמצאו שינויי אחוזים בהיסטוריה.</div>
              ) : (
                space.auditLogs.filter((l: any) => l.actionType === 'SHARES_UPDATED').reverse().map((log: any) => (
                  <div key={log.id} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      {new Date(log.timestamp).toLocaleString('he-IL')}
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      {log.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: showHistory ? 'none' : 'block' }}>
          
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
            
            return (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={m.photoURL || '/default-avatar.png'} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  <span style={{ fontWeight: '500' }}>{m.name}</span>
                </div>
                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                      ⏳ ממתין
                    </span>
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

        {/* Share Scope Selector: From Now On vs Retroactive */}
        <div style={{ margin: '0 1.5rem 1rem 1.5rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
            🎯 תחולת שינוי האחוזים:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShareScope('from_now_on')}
              style={{
                padding: '0.55rem 0.6rem',
                borderRadius: '10px',
                border: shareScope === 'from_now_on' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: shareScope === 'from_now_on' ? '#eff6ff' : '#ffffff',
                color: shareScope === 'from_now_on' ? '#1d4ed8' : '#475569',
                fontWeight: shareScope === 'from_now_on' ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.3
              }}
            >
              📅 <strong>מעכשיו והלאה</strong>
              <div style={{ fontSize: '0.68rem', opacity: 0.8, marginTop: '2px' }}>הוצאות עבר נשמרות</div>
            </button>
            <button
              type="button"
              onClick={() => setShareScope('retroactive')}
              style={{
                padding: '0.55rem 0.6rem',
                borderRadius: '10px',
                border: shareScope === 'retroactive' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                background: shareScope === 'retroactive' ? '#fef2f2' : '#ffffff',
                color: shareScope === 'retroactive' ? '#b91c1c' : '#475569',
                fontWeight: shareScope === 'retroactive' ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.3
              }}
            >
              🛡️ <strong>תיקון רטרואקטיבי</strong>
              <div style={{ fontSize: '0.68rem', opacity: 0.8, marginTop: '2px' }}>מחשב מחדש כל העבר</div>
            </button>
          </div>
        </div>
        </div>

        <div style={{ display: showHistory ? 'none' : 'flex', justifyContent: 'center', padding: '0 1.5rem 1.5rem 1.5rem' }}>
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
