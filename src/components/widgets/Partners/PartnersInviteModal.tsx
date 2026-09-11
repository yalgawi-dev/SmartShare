'use client';

import { useState, useMemo } from 'react';
import ContactSelector, { SelectedContact } from '../../common/ContactSelector';
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
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(null);
  const partnerName = selectedContact ? selectedContact.name : '';
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'from_creator' | 'equal' | 'proportional' | 'custom'>('from_creator');
  const [customShare, setCustomShare] = useState('10');

  const validMembers = useMemo(() => {
    return (space.members || []).filter((m: any) => m.isActive !== false && m.userId !== space.creatorId);
  }, [space.members, space.creatorId]);

  const creatorName = space.createdBy || 'יוצר המרחב';
  const currentCreatorShare = space.settings?.mySharePercentage ?? (validMembers.length > 0 ? Number((100 / (validMembers.length + 1)).toFixed(1)) : 100);

  // Handle Calculations
  let plannedGuestShare = 0;
  let plannedCreatorShare = currentCreatorShare;
  let plannedPartnerShares: Record<string, number> = {};

  if (allocationMode === 'from_creator') {
    plannedGuestShare = Number(customShare) || 0;
    plannedCreatorShare = currentCreatorShare - plannedGuestShare;
    validMembers.forEach((m: any) => {
      plannedPartnerShares[m.userId] = m.shares || 0;
    });
  } else if (allocationMode === 'equal') {
    const totalPeople = validMembers.length + 2;
    const equalShare = Number((100 / totalPeople).toFixed(1));
    plannedGuestShare = equalShare;
    plannedCreatorShare = equalShare;
    validMembers.forEach((m: any) => {
      plannedPartnerShares[m.userId] = equalShare;
    });
  } else if (allocationMode === 'proportional') {
    plannedGuestShare = Number(customShare) || 0;
    const remaining = 100 - plannedGuestShare;
    plannedCreatorShare = Number((currentCreatorShare * (remaining / 100)).toFixed(1));
    validMembers.forEach((m: any) => {
      plannedPartnerShares[m.userId] = Number(((m.shares || 0) * (remaining / 100)).toFixed(1));
    });
  } else {
    // custom mode will just take whatever is in the inputs
    plannedGuestShare = Number(customShare) || 0;
    validMembers.forEach((m: any) => {
      plannedPartnerShares[m.userId] = m.shares || 0;
    });
  }

  let totalCalculated = plannedGuestShare + plannedCreatorShare;
  Object.values(plannedPartnerShares).forEach(v => {totalCalculated += v;});
  totalCalculated = Number(totalCalculated.toFixed(1));

  const isBalanced = totalCalculated === 100;

  const handleCreateInvite = async () => {
    if (!isBalanced || !selectedContact) {
      alert('שים לב שהאחוזים שיישארו ברווחים ובחובות לא מסתכמים ל-100% הדפוס יקרוס ויחזיר שגיאה באפליקציה, וודא שסך הכל יסתכם ל-100% !');
      return;
    }

    if (selectedContact.userId) {
      await createPendingInvite(space.id, {
        shadowToken: selectedContact.userId,
        name: selectedContact.name,
        isRetroactive,
        guestShare: plannedGuestShare,
        creatorShare: plannedCreatorShare,
        partnerShares: plannedPartnerShares
      });
      alert('ההזמנה נשלחה בהצלחה! השותף יראה אותה בהתראות שלו.');
      onClose();
      return;
    }

    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    const url = new URL('/space/' + space.id, window.location.origin);
    url.searchParams.set('invite', shadowToken);
    url.searchParams.set('retro', isRetroactive ? 'true' : 'false');
    url.searchParams.set('share', plannedGuestShare.toString());
    if (partnerName) url.searchParams.set('name', partnerName);
    
    url.searchParams.set('plan', JSON.stringify({
      creator: plannedCreatorShare,
      partners: plannedPartnerShares
    }));

    const link = url.toString();
    const shareText = 'היי ' + partnerName + ',\n' +
      (creatorName ? creatorName + ' מזמין אותך להצטרף כשותף ב-MySpace.\n\n' : 'הוזמנת להיות שותף במרחב ב-MySpace.\n\n') +
      'כדי להיכנס למרחב ולראות את כל הפרטים, לחץ\n' +
        'על הקישור הבא:\n' + link;

    await createPendingInvite(space.id, {
      shadowToken,
      name: partnerName,
      isRetroactive,
      guestShare: plannedGuestShare,
      creatorShare: plannedCreatorShare,
      partnerShares: plannedPartnerShares
    });

    const whatsappUrl = `https://wa.me/${selectedContact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', padding: '1.75rem', borderRadius: '20px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box' }}>
        
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-end' }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem' }}>הזמנת שותף חדש</h2>
          <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            הגדרת יחסי השותפות והחובות מראש.
          </p>
        </div>

        {!selectedContact ? (
          <ContactSelector onSelect={setSelectedContact} title="בחר שותף להזמנה:" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.2rem' }}>שותף מוזמן:</div>
                <div style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedContact.name} ({selectedContact.phone || 'ללא מספר'})</div>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: 'white', border: '1px solid #bfdbfe', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                שנה
              </button>
            </div>
  
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>
                איך לחשב את אחוזי השותפות?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button 
                  onClick={() => setAllocationMode('from_creator')}
                  style={{ padding: '0.8rem', borderRadius: '8px', border: allocationMode === 'from_creator' ? '2px solid var(--primary)' : '1px solid #e2e8f0', background: allocationMode === 'from_creator' ? '#eff6ff' : 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                  👑 רק מהיוצר
                </button>
                <button 
                  onClick={() => setAllocationMode('equal')}
                  style={{ padding: '0.8rem', borderRadius: '8px', border: allocationMode === 'equal' ? '2px solid var(--primary)' : '1px solid #e2e8f0', background: allocationMode === 'equal' ? '#eff6ff' : 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                  ⚖️ שווה בשווה
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input 
                  type="number"
                  value={customShare}
                  onChange={e => setCustomShare(e.target.value)}
                  placeholder="אחוז לשותף החדש"
                  style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
  
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setIsRetroactive(!isRetroactive)}>
              <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: isRetroactive ? 'none' : '2px solid #cbd5e1', background: isRetroactive ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                {isRetroactive && '✓'}
              </div>
              <div>
                <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.95rem' }}>חיוב רטרואקטיבי</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  {isRetroactive ? 
                    'שותף ישתתף בכל ההוצאות וההכנסות מתחילת הפרויקט.' : 
                    'ברירת מחדל: השותף יחל להיות מעורב רק בהוצאות ובהכנסות שייווצרו מהיום והלאה.'}
                </div>
              </div>
            </div>
  
            <button onClick={handleCreateInvite} style={{ width: '100%', padding: '1.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              צור הזמנה ושלח (WhatsApp)
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
