// @ts-nocheck
import React, { useState, useRef } from 'react';
import ScannerModal from '../ScannerModal';
import { useSpaces } from '../../../app/context/SpacesContext';

export function FinanceTransferModal({
  user,
  validMembers,
  handleAddExpense,
  onClose,
  preselectedTargetId,
  preselectedAmount,
  spaceId
}: any) {
  const [tab, setTab] = useState<'transfer' | 'income'>('transfer');

  const { getTokenForSpace, getRoleForSpace, spaces } = useSpaces();
  const space = spaces.find(s => s.id === spaceId);
  const myRole = space ? getRoleForSpace(space.id) : 'none';
  const isCreatorMe = myRole === 'creator' || (space?.creatorId && user?.id === space.creatorId);
  const myEffectiveId = user?.id || 'me';
  const [payerId, setPayerId] = useState(myEffectiveId);
  const [targetId, setTargetId] = useState(preselectedTargetId || '');
  const [incomeHolderId, setIncomeHolderId] = useState(myEffectiveId);
  const [amount, setAmount] = useState(preselectedAmount ? String(preselectedAmount) : '');
  const [note, setNote] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let attachmentUrl = null;
      if (proofImage) {
        try {
          const { uploadImageToStorage } = await import('../../../lib/firebase');
          const { downscaleBase64 } = await import('../../../utils/imageOptimizer');
          const optimized = await downscaleBase64(proofImage, 1200, 0.8);
          const filename = `transfers/${spaceId}/${Date.now()}_proof.webp`;
          attachmentUrl = await uploadImageToStorage(optimized, filename);
        } catch (uploadErr) {
          console.error("Proof upload failed:", uploadErr);
        }
      }

      const formElement = document.createElement('form');
      
      const amountInput = document.createElement('input');
      amountInput.name = 'amount';
      amountInput.value = amount;
      formElement.appendChild(amountInput);

      const targetInput = document.createElement('input');
      targetInput.name = 'targetId';
      targetInput.value = tab === 'income' ? incomeHolderId : targetId;
      formElement.appendChild(targetInput);

      const noteInput = document.createElement('input');
      noteInput.name = 'note';
      noteInput.value = note;
      formElement.appendChild(noteInput);
      
      const fakeEvent = {
        preventDefault: () => {},
        currentTarget: formElement,
      } as unknown as React.FormEvent<HTMLFormElement>;

      if (tab === 'transfer') {
        await handleAddExpense(fakeEvent, { overrideCategory: 'העברה/קיזוז', customPayerId: payerId, attachmentUrl });
      } else {
        await handleAddExpense(fakeEvent, { overrideCategory: 'הכנסת עסק', customPayerId: 'virtual_treasury_member', attachmentUrl });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div 
        style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>רישום תנועה</h2>
          <button onClick={onClose} style={{ background: 'var(--bg-hover)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '0.25rem' }}>
          <button 
            type="button"
            onClick={() => setTab('transfer')}
            style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'transfer' ? 'white' : 'transparent', color: tab === 'transfer' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: tab === 'transfer' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            💸 העברה / הלוואה
          </button>
          <button 
            type="button"
            onClick={() => setTab('income')}
            style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'income' ? 'white' : 'transparent', color: tab === 'income' ? '#10b981' : 'var(--text-secondary)', boxShadow: tab === 'income' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            💰 קבלת הכנסה
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום (₪)</label>
            <input 
              type="number" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required 
              min="0.01" 
              step="0.01" 
              inputMode="decimal"
              placeholder="0.00" 
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid ' + (tab==='transfer' ? 'var(--primary)' : '#10b981'), fontSize: '1.5rem', background: '#fff', fontWeight: 'bold', color: tab==='transfer' ? 'var(--primary)' : '#10b981' }} 
            />
          </div>

          {tab === 'transfer' ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מאת (משלם)</label>
                <select 
                  required 
                  value={payerId}
                  onChange={e => setPayerId(e.target.value)}
                  style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
                >
                  <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
                  {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                    <option key={'from_'+m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>אל (מקבל)</label>
                <select 
                  required 
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
                >
                  <option value="" disabled>בחר מקבל</option>
                  <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
                  {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                    <option key={'to_'+m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מי קיבל את הכסף אליו?</label>
              <select 
                required 
                value={incomeHolderId}
                onChange={e => setIncomeHolderId(e.target.value)}
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
              >
                <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
                {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                  <option key={'held_'+m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>הערה (אופציונלי)</label>
            <input 
              type="text" 
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="למשל: סגירת חוב, תשלום מלקוח..." 
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }} 
            />
          </div>

          {/* Proof Attachment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.02)', padding: '0.875rem', borderRadius: '12px', border: '1px dashed var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                📎 הוכחת העברה / אסמכתא (אופציונלי)
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="פתח סורק מסמכים"
                >
                  <span>📷</span>
                  <span>סרוק מסמך</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="בחר מגלריה / קבצים"
                >
                  <span>📁</span>
                  <span>{proofImage ? 'החלף קובץ' : 'בחר קובץ'}</span>
                </button>
              </div>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
            />

            {proofImage && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={proofImage} alt="אסמכתא" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>✓ אסמכתא מצורפת</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProofImage(null)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem 0.5rem' }}
                  title="הסר צילום"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{ marginTop: '0.5rem', background: tab==='transfer' ? 'var(--primary)' : '#10b981', color: 'white', border: 'none', borderRadius: '16px', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, boxShadow: tab==='transfer' ? '0 4px 12px rgba(99,102,241,0.3)' : '0 4px 12px rgba(16,185,129,0.3)' }}
          >
            {isSubmitting ? 'מבצע ומעלה אסמכתא...' : 'אישור וביצוע'}
          </button>
        </form>
      </div>

      {isScanning && typeof document !== 'undefined' && (
        <ScannerModal
          hasFinance
          maxBytes={3000000}
          onClose={() => setIsScanning(false)}
          onComplete={(imgDataUrl) => {
            setProofImage(imgDataUrl);
            setIsScanning(false);
          }}
        />
      )}
    </div>
  );
}
