'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';

export function PartnersInviteModal({ 
  space, 
  onClose 
}: { 
  space: any; 
  onClose: () => void;
}) {
  const { createPendingInvite } = useSpaces();
  const [partnerName, setPartnerName] = useState('');
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'from_creator' | 'equal' | 'proportional' | 'custom'>('from_creator');
  const [customShare, setCustomShare] = useState('10');

  // Existing active partners (excluding creator)
  const validMembers = useMemo(() => {
    return (space.members || []).filter((m: any) => m.isActive !== false && m.userId !== space.creatorId);
  }, [space.members, space.creatorId]);

  const creatorName = space.createdBy || 'יוצר המרחב';
  const currentCreatorShare = space.settings?.mySharePercentage ?? (validMembers.length > 0 ? Number((100 / (validMembers.length + 1)).toFixed(1)) : 100);

  // Manual shares state for custom mode
  const [manualShares, setManualShares] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? Number((100 / (validMembers.length + 1)).toFixed(1));
    });
    return initial;
  });
  const [manualCreatorShare, setManualCreatorShare] = useState<number>(() => currentCreatorShare);
  const [manualGuestShare, setManualGuestShare] = useState<number>(10);

  // Calculate planned shares based on mode
  const { plannedGuestShare, plannedCreatorShare, plannedPartnerShares } = useMemo(() => {
    const totalCount = validMembers.length + 2; // existing partners + creator + new guest

    if (allocationMode === 'equal') {
      const totalPeople = validMembers.length + 2; // existing partners + creator + new guest
      const eachShare = Number((100 / totalPeople).toFixed(1));
      const pShares: Record<string, number> = {};
      let partnersSum = 0;
      validMembers.forEach((m: any) => {
        pShares[m.userId] = eachShare;
        partnersSum += eachShare;
      });
      const gShare = eachShare;
      const cShare = Number((100 - partnersSum - gShare).toFixed(1));
      return {
        plannedGuestShare: gShare,
        plannedCreatorShare: cShare,
        plannedPartnerShares: pShares
      };
    }

    if (allocationMode === 'proportional' && validMembers.length > 0) {
      const gShare = Math.min(99, Math.max(1, Number(customShare) || 10));
      const remaining = Math.max(0, 100 - gShare);
      
      let totalExisting = currentCreatorShare;
      validMembers.forEach((m: any) => {
        totalExisting += (m.sharePercentage ?? 0);
      });
      if (totalExisting <= 0) totalExisting = 100;

      const pShares: Record<string, number> = {};
      let partnersAssigned = 0;
      validMembers.forEach((m: any) => {
        const curr = m.sharePercentage ?? (100 / (validMembers.length + 1));
        const newP = Number(((curr / totalExisting) * remaining).toFixed(1));
        pShares[m.userId] = newP;
        partnersAssigned += newP;
      });

      const cShare = Number((100 - partnersAssigned - gShare).toFixed(1));
      return {
        plannedGuestShare: gShare,
        plannedCreatorShare: Math.max(0, cShare),
        plannedPartnerShares: pShares
      };
    }

    if (allocationMode === 'custom') {
      return {
        plannedGuestShare: manualGuestShare,
        plannedCreatorShare: manualCreatorShare,
        plannedPartnerShares: manualShares
      };
    }

    // Default: 'from_creator'
    const gShare = Math.min(100, Math.max(1, Number(customShare) || 10));
    const pShares: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      pShares[m.userId] = m.sharePercentage ?? Number((100 / (validMembers.length + 1)).toFixed(1));
    });
    const cShare = Number(Math.max(0, currentCreatorShare - gShare).toFixed(1));

    return {
      plannedGuestShare: gShare,
      plannedCreatorShare: cShare,
      plannedPartnerShares: pShares
    };
  }, [allocationMode, customShare, validMembers, currentCreatorShare, manualGuestShare, manualCreatorShare, manualShares]);

  const totalCalculated = useMemo(() => {
    let sum = plannedGuestShare + plannedCreatorShare;
    Object.values(plannedPartnerShares).forEach(v => { sum += v; });
    return Number(sum.toFixed(1));
  }, [plannedGuestShare, plannedCreatorShare, plannedPartnerShares]);

  const isBalanced = Math.abs(totalCalculated - 100) < 0.2;

  const handleCreateInvite = async () => {
    if (!isBalanced) {
      alert('סך כל האחוזים חייב להגיע בדיוק ל-100% לפני יצירת ההזמנה');
      return;
    }

    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    
    // 1. Immediately persist pending member to Firestore (Single Source of Truth)
    createPendingInvite(space.id, {
      shadowToken,
      name: partnerName.trim() || 'שותף מוזמן',
      isRetroactive,
      guestShare: plannedGuestShare,
      creatorShare: plannedCreatorShare,
      partnerShares: plannedPartnerShares
    });

    // 2. Build clean invite link
    const url = new URL('/space/' + space.id, window.location.origin);
    url.searchParams.set('invite', shadowToken);
    url.searchParams.set('retro', isRetroactive ? 'true' : 'false');
    url.searchParams.set('share', plannedGuestShare.toString());
    if (partnerName.trim()) {
      url.searchParams.set('name', partnerName.trim());
    }
    url.searchParams.set('plan', JSON.stringify({
      creator: plannedCreatorShare,
      partners: plannedPartnerShares
    }));
    const link = url.toString();

    onClose();

    const shareTitle = 'הזמנה לפרויקט ' + space.title;
    const shareText = `היי! צירפתי אותך לפרויקט "${space.title}" עם חלק של ${plannedGuestShare}%. לחץ כאן כדי להיכנס:`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: link,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(link);
      alert('הקישור הועתק ללוח! שתף אותו עם השותף.');
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', padding: '1.75rem', borderRadius: '20px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 800 }}>
              הזמנת שותף חדש (v3.6)
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              הגדרת שותפות ואחוזים מראש
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        {/* Partner Name (Optional) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '0.35rem' }}>
            שם השותף (אופציונלי):
          </label>
          <input 
            type="text" 
            placeholder="למשל: תומר, דנה, שותף 2..." 
            value={partnerName}
            onChange={e => setPartnerName(e.target.value)}
            onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
            onClick={e => (e.target as HTMLInputElement).select()}
            style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Allocation Modes */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '0.5rem' }}>
            איך לחשב את אחוזי ההשתתפות?
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setAllocationMode('from_creator')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '10px',
                border: allocationMode === 'from_creator' ? '2px solid var(--primary, #3b82f6)' : '1px solid #e2e8f0',
                background: allocationMode === 'from_creator' ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                color: allocationMode === 'from_creator' ? 'var(--primary, #3b82f6)' : '#475569',
                fontWeight: allocationMode === 'from_creator' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}
            >
              👑 מהיוצר בלבד
            </button>
            <button
              type="button"
              onClick={() => setAllocationMode('equal')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '10px',
                border: allocationMode === 'equal' ? '2px solid var(--primary, #3b82f6)' : '1px solid #e2e8f0',
                background: allocationMode === 'equal' ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                color: allocationMode === 'equal' ? 'var(--primary, #3b82f6)' : '#475569',
                fontWeight: allocationMode === 'equal' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}
            >
              ⚖️ שווה בשווה
            </button>
            {validMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setAllocationMode('proportional')}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: '10px',
                  border: allocationMode === 'proportional' ? '2px solid var(--primary, #3b82f6)' : '1px solid #e2e8f0',
                  background: allocationMode === 'proportional' ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                  color: allocationMode === 'proportional' ? 'var(--primary, #3b82f6)' : '#475569',
                  fontWeight: allocationMode === 'proportional' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textAlign: 'center'
                }}
              >
                📉 דילול יחסי (3+)
              </button>
            )}
            <button
              type="button"
              onClick={() => setAllocationMode('custom')}
              style={{
                padding: '0.6rem 0.5rem',
                borderRadius: '10px',
                border: allocationMode === 'custom' ? '2px solid var(--primary, #3b82f6)' : '1px solid #e2e8f0',
                background: allocationMode === 'custom' ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                color: allocationMode === 'custom' ? 'var(--primary, #3b82f6)' : '#475569',
                fontWeight: allocationMode === 'custom' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'center',
                gridColumn: validMembers.length === 0 ? 'span 2' : 'auto'
              }}
            >
              ✍️ התאמה ידנית
            </button>
          </div>
        </div>

        {/* Share input for from_creator and proportional */}
        {(allocationMode === 'from_creator' || allocationMode === 'proportional') && (
          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#334155' }}>
                אחוז לשותף החדש:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input 
                  type="number" 
                  min="1" 
                  max="99"
                  value={customShare}
                  onChange={e => setCustomShare(e.target.value)}
                  onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  style={{ width: '65px', padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                />
                <span style={{ fontWeight: 'bold', color: '#64748b' }}>%</span>
              </div>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              {allocationMode === 'from_creator' ? 
                'האחוזים יופחתו ישירות מחלקו של היוצר, שאר השותפים יישארו ללא שינוי.' :
                'האחוזים יקוזזו מכל השותפים והיוצר באופן יחסי למשקלם הנוכחי.'}
            </p>
          </div>
        )}

        {/* Custom manual editor */}
        {allocationMode === 'custom' && (
          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>👑 {creatorName} (יוצר):</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input 
                  type="number" 
                  value={manualCreatorShare} 
                  onChange={e => setManualCreatorShare(Number(e.target.value) || 0)}
                  onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  style={{ width: '60px', padding: '0.3rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                />
                <span>%</span>
              </div>
            </div>
            {validMembers.map((m: any) => (
              <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>👤 {m.name}:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input 
                    type="number" 
                    value={manualShares[m.userId] ?? 0} 
                    onChange={e => setManualShares({ ...manualShares, [m.userId]: Number(e.target.value) || 0 })}
                    onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                    onClick={e => (e.target as HTMLInputElement).select()}
                    style={{ width: '60px', padding: '0.3rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                  />
                  <span>%</span>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>🆕 {partnerName.trim() || 'שותף חדש'}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input 
                  type="number" 
                  value={manualGuestShare} 
                  onChange={e => setManualGuestShare(Number(e.target.value) || 0)}
                  onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  style={{ width: '60px', padding: '0.3rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                />
                <span>%</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Breakdown */}
        <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>
              תצוגה מקדימה: חלוקת האחוזים החדשה
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isBalanced ? '#10b981' : '#ef4444' }}>
              סה״כ: {totalCalculated}% {isBalanced ? '✓' : '(לא מאוזן)'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>👑 {creatorName}:</span>
              <span style={{ fontWeight: 'bold' }}>{plannedCreatorShare}%</span>
            </div>
            {validMembers.map((m: any) => (
              <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>👤 {m.name}:</span>
                <span style={{ fontWeight: 'bold' }}>{plannedPartnerShares[m.userId]}%</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary, #3b82f6)', fontWeight: 'bold' }}>
              <span>🆕 {partnerName.trim() || 'שותף מוזמן'}:</span>
              <span>{plannedGuestShare}%</span>
            </div>
          </div>
        </div>

        {/* Retroactive Expense Checkbox */}
        {space.invoices && space.invoices.length > 0 && (
          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isRetroactive} 
                onChange={e => setIsRetroactive(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary, #3b82f6)' }}
              />
              <div>
                <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.95rem' }}>חיוב רטרואקטיבי</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  {isRetroactive ? 
                    'השותף ישתתף בכל ההוצאות שהיו במרחב מיום פתיחתו.' : 
                    'ברירת מחדל: השותף פטור מהוצאות עבר ויחויב רק מהוצאות עתידיות והלאה.'}
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Submit / Share Button */}
        <button 
          onClick={handleCreateInvite}
          disabled={!isBalanced}
          style={{ 
            background: isBalanced ? 'var(--primary, #3b82f6)' : '#94a3b8', 
            color: 'white', 
            padding: '0.85rem', 
            borderRadius: '999px', 
            border: 'none', 
            fontWeight: 'bold', 
            fontSize: '1rem', 
            cursor: isBalanced ? 'pointer' : 'not-allowed', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '0.5rem', 
            boxShadow: isBalanced ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span>💬</span>
          צור הזמנה ושתף (WhatsApp)
        </button>
      </div>
    </div>,
    document.body
  );
}

