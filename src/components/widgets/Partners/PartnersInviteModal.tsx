'use client';

import { useState, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createPortal } from 'react-dom';
import ContactSelector, { SelectedContact } from '../../common/ContactSelector';
import { useSpaces } from '../../../app/context/SpacesContext';

export function PartnersInviteModal({ 
  space, 
  onClose 
}: { 
  space: any; 
  onClose: () => void;
}) {
  const { createPendingInvite } = useSpaces();
  const [successData, setSuccessData] = useState<{name: string, phone: string, text: string} | null>(null);
  const [copied, setCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const partnerName = '';
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

  const handleGenerateLink = async (contactName?: string, targetUserId?: string) => {
    if (!isBalanced) {
      alert('סך כל האחוזים חייב להגיע בדיוק ל-100% לפני יצירת ההזמנה');
      return null;
    }

    const token = 'guest_' + Math.random().toString(36).substr(2, 9);
    
    // Build clean invite link
    const url = new URL('/space/' + space.id, window.location.origin);
    url.searchParams.set('invite', token);
    url.searchParams.set('retro', isRetroactive ? 'true' : 'false');
    url.searchParams.set('share', plannedGuestShare.toString());
    if (contactName) {
      url.searchParams.set('name', contactName.trim());
    }
    url.searchParams.set('plan', JSON.stringify({
      creator: plannedCreatorShare,
      partners: plannedPartnerShares
    }));
    const link = url.toString();

    await createPendingInvite(space.id, {
      token,
      name: contactName || '',
      isRetroactive,
      guestShare: plannedGuestShare,
      creatorShare: plannedCreatorShare,
      partnerShares: plannedPartnerShares, targetUserId
    });

    return { link, shareTitle: 'הזמנה לפרויקט ' + space.title, shareText: `היי! צירפתי אותך לפרויקט "${space.title}" עם חלק של ${plannedGuestShare}%. לחץ כאן כדי להיכנס:\n${link}` };
  };

  const handleContactSelect = async (contact: SelectedContact) => {
    setIsInviting(true);
    const data = await handleGenerateLink(contact.name, contact.userId);
    if (!data) {
      setIsInviting(false);
      return;
    }
    
    if (contact.isSystemPartner && contact.userId) {
      let realPhone = contact.phone;
      if (realPhone === 'משתמש פנימי') {
        try {
          const userDoc = await getDoc(doc(db, 'users', contact.userId));
          if (userDoc.exists() && userDoc.data().phone) {
            realPhone = userDoc.data().phone;
          }
        } catch (e) {
          console.error("Failed to fetch user phone", e);
        }
      }
      
      // In-app success state
      setSuccessData({
        name: contact.name,
        phone: realPhone,
        text: data.shareText
      });
      setIsInviting(false);
    } else {
      // External WhatsApp flow
      const whatsappUrl = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(data.shareText)}`;
      window.open(whatsappUrl, '_blank');
      onClose();
      setIsInviting(false);
    }
  };

  const handleNativeShare = async () => {
    const data = await handleGenerateLink();
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.shareTitle,
          text: data.shareText,
          url: data.link,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
    onClose();
  };

  const handleCopy = async () => {
    const data = await handleGenerateLink();
    if (!data) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1500);
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', padding: '1.75rem', borderRadius: '20px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {isInviting ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #f1f5f9', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
            <p style={{ color: '#64748b', fontWeight: 'bold' }}>שולח הזמנה...</p>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        ) : successData ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '60px', height: '60px', background: '#22c55e', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>הזמנה נשלחה בהצלחה!</h3>
            <p style={{ margin: '0 0 1rem', color: '#64748b' }}>ההזמנה נשלחה פנימית למשתמש <strong>{successData.name}</strong> והוא יקבל התראה באפליקציה מיד כשייכנס.</p>
            
            {successData.phone && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.75rem 0' }}>כתוספת (אופציונלי), תוכל לשלוח לו גם תזכורת אישית בווטסאפ:</p>
                <button onClick={() => {
                  const whatsappUrl = `https://wa.me/${successData.phone.replace(/\D/g, '')}?text=${encodeURIComponent(successData.text)}`;
                  window.open(whatsappUrl, '_blank');
                  onClose();
                }} style={{ width: '100%', padding: '0.75rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  שלח תזכורת (לא חובה)
                </button>
              </div>
            )}
            <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              הבנתי, סגור חלון
            </button>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
          {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 800 }}>
              הזמנת שותף חדש (v3.8)
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              הגדרת שותפות ואחוזים מראש
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        {space.features?.includes("finance") && (<>
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

        </>)}

        {/* Retroactive Expense Checkbox */}
        {space.features?.includes("finance") && space.invoices && space.invoices.length > 0 && (
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
        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
          <div style={{ marginBottom: '1.5rem', opacity: isBalanced ? 1 : 0.5, pointerEvents: isBalanced ? 'auto' : 'none' }}>
            <ContactSelector onSelect={handleContactSelect} title="בחר איש קשר להזמנה בווטסאפ:" />
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: isBalanced ? 1 : 0.5, pointerEvents: isBalanced ? 'auto' : 'none' }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>או שתף קישור כללי:</div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              { typeof navigator !== 'undefined' && 'share' in navigator && (
                <button onClick={handleNativeShare} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary, #3b82f6)', color: 'white', padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                  שתף
                </button>
              )}
              <button onClick={handleCopy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#f8fafc', color: '#0f172a', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                {copied ? '✓ הועתק!' : '🔗 העתק קישור'}
              </button>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}
