'use client';
import { isDuplicateInvoice } from '../../utils/duplicateCheck';

import React, { useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

export default function PersonalInboxRoutingModal({ item, onClose }: { item: any, onClose: () => void }) {
  const { spaces, addInboxItems, removeFromPersonalInbox, addInvoice } = useSpaces();
  const { user } = useAuth();
  
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedAmount, setEditedAmount] = useState(item.ocrData?.amount || '');
  const [editedSupplier, setEditedSupplier] = useState(item.ocrData?.vendor || item.ocrData?.supplier || '');
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState(item.ocrData?.invoiceNumber || '');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [forceDuplicateApproval, setForceDuplicateApproval] = useState(false);

  React.useEffect(() => {
    setDuplicateWarning(null);
    setForceDuplicateApproval(false);
    if (!selectedSpaceId) return;
    
    const space = spaces.find((s: any) => s.id === selectedSpaceId);
    if (!space) return;

    const mockData = {
      ...(item.ocrData || {}),
      invoiceNumber: editedInvoiceNumber,
      vendor: editedSupplier,
      amount: editedAmount ? Number(editedAmount) : 0
    };
    
    const existsInvoices = space.invoices?.find((inv: any) => isDuplicateInvoice(inv, mockData));

    if (existsInvoices) {
      setDuplicateWarning({ type: 'invoice', doc: existsInvoices });
      return;
    }

    const inboxItems = space.inbox || space.inboxItems || [];
    const existsInbox = inboxItems.find((inv: any) => {
      if (inv.id === item.id) return false;
      return isDuplicateInvoice(inv.ocrData || {}, mockData);
    });

    if (existsInbox) {
      setDuplicateWarning({ type: 'inbox', doc: existsInbox });
    }
  }, [selectedSpaceId, editedInvoiceNumber, editedSupplier, editedAmount, item, spaces]);

  const activeSpaces = spaces.filter((s: any) => {
    if (s.status === 'pending_deletion') return false;
    if (user?.id && s.creatorId && s.creatorId === user.id) return true;
    const myMemberRecord = (s.members || []).find((m: any) => m.userId === user?.id);
    if (myMemberRecord && myMemberRecord.isActive !== false) return true;
    return false;
  });
  const selectedSpace = spaces.find((s: any) => s.id === selectedSpaceId);

  const getSpaceMembers = (space: any) => {
    if (!space) return [];
    return space.members || [];
  };

  const handleRoute = async (mode: 'inbox' | 'direct') => {
    if (!selectedSpaceId) return alert('נא לבחור לאיזה פרויקט לשייך');
    if (!selectedPayerId) return alert('נא לבחור מי שילם בפועל!');

    setIsProcessing(true);
    try {
      if (mode === 'inbox') {
        const newItem = {
          imageUrl: item.imageUrl,
          ocrData: { ...(item.ocrData || {}), amount: editedAmount ? Number(editedAmount) : 0 },
          ocrError: item.ocrError,
          status: 'pending',
          suggestedPayerId: selectedPayerId
        };
        await addInboxItems(selectedSpaceId, [newItem as any]);
      } else {
        const payerName = getSpaceMembers(selectedSpace).find((m: any) => m.userId === selectedPayerId)?.name || user?.realName || 'אני (You)';
        
        const hasPartners = selectedSpace?.features?.includes('partners');
        const activePartnersCount = hasPartners ? (selectedSpace.members?.filter((m: any) => m.status !== 'removed').length || 0) : 0;
        const expenseApprovalsNeeded = activePartnersCount > 0 ? activePartnersCount + 1 : 0;
        const myApproval = 1;
        const finalStatus = expenseApprovalsNeeded === 0 ? 'approved' : (myApproval >= expenseApprovalsNeeded ? 'approved' : 'pending');
        const finalApprovedBy = user?.id ? [user.id] : [];

        const newInvoice = {
          amount: editedAmount ? Number(editedAmount) : 0,
          supplier: (item.ocrData?.vendor || item.ocrData?.supplier) || 'לא זוהה ספק',
          payerName: payerName,
          payerId: selectedPayerId,
          date: item.ocrData?.date || new Date().toISOString().split('T')[0],
          status: finalStatus as any,
          note: '',
          category: 'כללי',
          hasAttachment: true,
          attachmentUrl: item.imageUrl,
          vatRate: selectedSpace?.settings?.defaultVatRate || 17,
          vatNumber: item.ocrData?.vatNumber || '',
          invoiceNumber: item.ocrData?.invoiceNumber || '',
          documentType: item.ocrData?.documentType || '',
          approvalsNeeded: expenseApprovalsNeeded,
          approvalsReceived: expenseApprovalsNeeded > 0 ? myApproval : 0,
          approvedBy: finalApprovedBy,
          source: 'inbox'
        };
        await addInvoice(selectedSpaceId, newInvoice as any);
      }
      
      await removeFromPersonalInbox(item.id);
      onClose();
    } catch (e) {
      alert('הייתה שגיאה בהעברת הפריט');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>שיוך לפרויקט</h3>

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <img src={item.imageUrl} alt="Preview" onClick={() => setZoomedImage(item.imageUrl)} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <input 
                  type="text" 
                  value={editedSupplier} 
                  onChange={e => setEditedSupplier(e.target.value)} 
                  placeholder="שם ספק"
                  style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'bold' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>₪</span>
                  <input 
                    type="number" 
                    value={editedAmount} 
                    onChange={e => setEditedAmount(e.target.value)} 
                    style={{ width: '70px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>מס':</span>
                  <input 
                    type="text" 
                    value={editedInvoiceNumber} 
                    onChange={e => setEditedInvoiceNumber(e.target.value)} 
                    placeholder="הזן ידנית"
                    style={{ width: '90px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </span>
              </div>
              {!editedInvoiceNumber && (
                <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem' }}>
                  * ה-OCR לא זיהה מספר חשבונית. מומלץ להזין ידנית למניעת כפילויות.
                </div>
              )}
            </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
              לאיזה פרויקט להעביר?
            </label>
            <select 
              value={selectedSpaceId} 
              onChange={e => {
                setSelectedSpaceId(e.target.value);
                setSelectedPayerId(''); // reset payer when space changes
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="">-- בחר פרויקט --</option>
              {activeSpaces.map((s: any) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {selectedSpaceId && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                מי שילם בפועל? <span style={{ color: '#ef4444' }}>* (חובה)</span>
              </label>
              <select 
                value={selectedPayerId} 
                onChange={e => setSelectedPayerId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                <option value="">-- בחר מי שילם --</option>
                <option value={user?.id || 'me'}>{user?.realName || 'אני (You)'}</option>
                {getSpaceMembers(selectedSpace).filter((m: any) => m.userId !== user?.id).map((m: any) => (
                  <option key={m.userId} value={m.userId}>{m.name || 'שותף'}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={onClose}
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ביטול
          </button>
          <button 
            onClick={() => handleRoute('inbox')}
            disabled={!selectedSpaceId || !selectedPayerId || isProcessing}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #4f46e5', background: '#e0e7ff', color: '#4f46e5', fontWeight: 'bold', cursor: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 0.7 : 1 }}
          >
            למחסן
          </button>
          <button 
            onClick={() => handleRoute('direct')}
            disabled={!selectedSpaceId || !selectedPayerId || isProcessing}
            style={{ flex: 1.5, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 'bold', cursor: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 0.7 : 1 }}
          >
            {isProcessing ? 'מעבד...' : 'אשר והעבר להוצאות'}
          </button>
        </div>
      </div>

      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)} 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}
        >
          <img src={zoomedImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', bottom: '2rem', color: 'white', background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>סגור תצוגה</div>
        </div>
      )}

    </div>
  );
}
