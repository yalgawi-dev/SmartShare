'use client';
import { isDuplicateInvoice } from '../../utils/duplicateCheck';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

export default function PersonalInboxRoutingModal({ item, onClose, preselectedSpaceId, isFromProjectInbox }: { item: any, onClose: () => void, preselectedSpaceId?: string, isFromProjectInbox?: boolean }) {
  const { spaces, addInboxItems, removeFromPersonalInbox, removeInboxItem, addInvoice, approveAndRouteInvoice } = useSpaces();
  const { user } = useAuth();
  
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(preselectedSpaceId || '');
  const [selectedPayerId, setSelectedPayerId] = useState<string>(item?.suggestedPayerId || '');
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
          const finalApprovedBy = user?.id ? [user.id] : [];
          const approvalsReceived = finalApprovedBy.length;
          const finalStatus = (expenseApprovalsNeeded === 0 || approvalsReceived >= expenseApprovalsNeeded) ? 'approved' : 'pending';

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
          approvalsReceived: expenseApprovalsNeeded > 0 ? approvalsReceived : 0,
          approvedBy: finalApprovedBy,
          source: 'inbox'
        };
                if (isFromProjectInbox) {
          const success = await approveAndRouteInvoice(selectedSpaceId, newInvoice as any, item.id);
          if (success) {
            alert('הפעולה בוצעה בהצלחה! ההוצאה הועברה לפרויקט והוסרה מהמחסן.');
          } else {
            throw new Error('השמירה בשרת נכשלה');
          }
        } else {
          await addInvoice(selectedSpaceId, newInvoice as any);
          await removeFromPersonalInbox(item.id);
          alert('הפעולה בוצעה בהצלחה! ההוצאה הועברה לפרויקט והוסרה מהמחסן.');
        }
      }
      
      if (mode === 'inbox') {
        if (isFromProjectInbox) { await removeInboxItem(selectedSpaceId, item.id); } else { await removeFromPersonalInbox(item.id); }
      }
      
      onClose();
    } catch (e) {
      alert('הייתה שגיאה בהעברת הפריט');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '500px', margin: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
            {isFromProjectInbox ? 'ערוך ואשר הוצאה' : 'שיוך לפרויקט'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <img src={item.imageUrl} alt="Preview" onClick={() => setZoomedImage(item.imageUrl)} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={editedSupplier} 
              onChange={e => setEditedSupplier(e.target.value)} 
              placeholder="שם ספק"
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'bold' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>₪</span>
                <input 
                  type="number" 
                  value={editedAmount} 
                  onChange={e => setEditedAmount(e.target.value)} 
                  style={{ width: '80px', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>מס':</span>
                <input 
                  type="text" 
                  value={editedInvoiceNumber} 
                  onChange={e => setEditedInvoiceNumber(e.target.value)} 
                  placeholder="ידנית"
                  style={{ width: '90px', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
            </div>
            {!editedInvoiceNumber && (
              <div style={{ fontSize: '0.75rem', color: '#d97706', lineHeight: 1.2 }}>
                * לא אותר מספר קבלה. מומלץ להזין.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            {!preselectedSpaceId && (<label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
              לאיזה פרויקט להעביר?
            </label>)}
            <select 
              style={{ display: preselectedSpaceId ? 'none' : 'block', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={selectedSpaceId} 
              onChange={e => {
                setSelectedSpaceId(e.target.value);
                setSelectedPayerId(''); // reset payer when space changes
              }}
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
          {!isFromProjectInbox && (<button 
            onClick={() => handleRoute('inbox')}
            disabled={!selectedSpaceId || !selectedPayerId || isProcessing}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #4f46e5', background: '#e0e7ff', color: '#4f46e5', fontWeight: 'bold', cursor: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 0.7 : 1 }}
          >
            למחסן
          </button>)}
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
