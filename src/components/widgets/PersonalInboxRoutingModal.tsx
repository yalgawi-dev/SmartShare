'use client';

import React, { useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

export default function PersonalInboxRoutingModal({ item, onClose }: { item: any, onClose: () => void }) {
  const { spaces, addInboxItems, removeFromPersonalInbox } = useSpaces();
  const { user } = useAuth();
  
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedAmount, setEditedAmount] = useState<string>(item.ocrData?.amount?.toString() || "");

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

  const handleRoute = async () => {
    if (!selectedSpaceId) return alert('חובה לבחור פרויקט');
    if (!selectedPayerId) return alert('חובה לבחור מי שילם!');

    setIsProcessing(true);
    try {
      // Create new inbox item in the selected space
      const newItem = {
        imageUrl: item.imageUrl,
        ocrData: { ...(item.ocrData || {}), amount: editedAmount ? Number(editedAmount) : 0 },
        ocrError: item.ocrError,
        status: 'pending',
        suggestedPayerId: selectedPayerId // We tag it with the payer
      };
      
      await addInboxItems(selectedSpaceId, [newItem as any]);
      await removeFromPersonalInbox(item.id);
      
      onClose();
    } catch (e) {
      console.error(e);
      alert('שגיאה בהעברה לפרויקט');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '1.5rem',
        width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>שיוך חשבונית לפרויקט</h3>
        
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <img src={item.imageUrl} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
          <div>
            <div style={{ fontWeight: 'bold' }}>{(item.ocrData?.vendor || item.ocrData?.supplier) || 'לא זוהה ספק'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              <span>₪</span>
              <input 
                type="number" 
                value={editedAmount} 
                onChange={e => setEditedAmount(e.target.value)} 
                style={{ width: '80px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
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

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ביטול
          </button>
          <button 
            onClick={handleRoute}
            disabled={!selectedSpaceId || !selectedPayerId || isProcessing}
            style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 'bold', cursor: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!selectedSpaceId || !selectedPayerId || isProcessing) ? 0.7 : 1 }}
          >
            {isProcessing ? 'מעביר...' : 'העבר למחסן הפרויקט'}
          </button>
        </div>
      </div>
    </div>
  );
}
