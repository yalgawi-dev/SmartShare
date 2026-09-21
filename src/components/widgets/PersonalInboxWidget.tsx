'use client';
import { isDuplicateInvoice } from '../../utils/duplicateCheck';

import React, { useState, useEffect } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import PersonalInboxRoutingModal from './PersonalInboxRoutingModal';

export default function PersonalInboxWidget() {
  const { spaces, personalInbox, removeFromPersonalInbox, updatePersonalInboxItem } = useSpaces();
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [duplicateResolutionItem, setDuplicateResolutionItem] = useState<any>(null);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [zoomedDuplicate, setZoomedDuplicate] = useState<string | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  // Background OCR processing
  useEffect(() => {
    if (!personalInbox) return;
    const processQueue = async () => {
      const pendingItems = personalInbox.filter(i => (!i.ocrData && !i.ocrError) && !processingItems.has(i.id));
      if (pendingItems.length === 0) return;

      for (const item of pendingItems) {
        setProcessingItems(prev => new Set(prev).add(item.id));
        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: item.imageUrl })
          });
          const data = await response.json();
          if (!data.error && data.vendor !== undefined) {
            await updatePersonalInboxItem(item.id, { ocrData: data, ocrError: false });
          } else {
            await updatePersonalInboxItem(item.id, { ocrError: true, ocrErrorText: "Request failed" });
          }
        } catch (e) {
          console.error(e);
          await updatePersonalInboxItem(item.id, { ocrError: true, ocrErrorText: "Request failed" });
        } finally {
          setProcessingItems(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      }
    };
    processQueue();
  }, [personalInbox, processingItems, updatePersonalInboxItem]);

  if (!personalInbox || personalInbox.length === 0) return null;

  const getDuplicateWarning = (item: any) => {
    if (!item.ocrData) return null;
    
    const matches: any[] = [];
    for (const space of spaces) {
      if (space.status === 'pending_deletion') continue;
      
      let isVisible = false;
      if (user?.id && space.creatorId && space.creatorId === user.id) isVisible = true;
      const myMemberRecord = (space.members || []).find((m: any) => m.userId === user?.id);
      if (myMemberRecord && myMemberRecord.isActive !== false) isVisible = true;
      if (!isVisible) continue;
      
      const invMatches = space.invoices?.filter((inv: any) => isDuplicateInvoice(inv, item.ocrData)) || [];
      for (const m of invMatches) {
        matches.push({ spaceTitle: space.title, foundIn: 'invoices', doc: m });
      }
      
      const inboxMatches = (space.inbox || space.inboxItems)?.filter((i: any) => isDuplicateInvoice(i.ocrData || {}, item.ocrData)) || [];
      for (const m of inboxMatches) {
        matches.push({ spaceTitle: space.title, foundIn: 'inbox', doc: m });
      }
    }
    return matches.length > 0 ? matches : null;
  };

  return (
    <div style={{ marginBottom: '2rem', background: '#fff', border: '2px solid #4f46e5', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <h3 style={{ margin: 0, color: '#1e293b' }}>מחסן מיון אישי <span style={{fontSize:'0.7em', color:'#64748b'}}>(v2.1)</span></h3>
        <span style={{ background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{personalInbox.length}</span>
      </div>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
        רק אתה רואה את הפריטים כאן. המערכת סורקת אותם ברקע ומתריעה על כפילויות לפני השיוך.
      </p>

      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        {personalInbox.map((item, idx) => {
          const isProcessing = processingItems.has(item.id);
          const duplicate = getDuplicateWarning(item);
          
          return (
            <div key={item.id} style={{ 
              minWidth: '220px', width: '220px', background: '#f8fafc', border: duplicate ? '2px solid #ef4444' : '1px solid #cbd5e1', 
              borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' 
            }}>
              <div style={{ height: '140px', backgroundColor: '#e2e8f0', position: 'relative' }}>
                <img src={item.imageUrl} alt="Document" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setZoomedIndex(idx)} />
                {isProcessing && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    סורק ברקע...
                  </div>
                )}
              </div>
              
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {!item.ocrData && !item.ocrError && !isProcessing && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ממתין לסריקה...</div>
                )}
                {item.ocrError && !isProcessing && (
                  <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                     שגיאה בסריקה 
                     <button onClick={() => updatePersonalInboxItem(item.id, { ocrError: false })} style={{marginLeft:'5px', background:'none', border:'none', color:'#4f46e5', textDecoration:'underline', cursor:'pointer', padding: 0}}>נסה שוב</button>
                  </div>
                )}
                {item.ocrData && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(item.ocrData.vendor || item.ocrData.supplier) || 'ספק לא זוהה'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                      ₪{item.ocrData.amount || '0'} | מס': {item.ocrData.invoiceNumber || '---'}
                    </div>
                  </>
                )}
                
                {duplicate && duplicate.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem', color: '#b91c1c' }}>
                    <strong>⚠️ חשד לכפילות!</strong><br/>
                    נמצאו {duplicate.length} התאמות
                    <button 
                      onClick={() => setDuplicateResolutionItem({ item, duplicates: duplicate })}
                      style={{ display: 'block', marginTop: '0.25rem', background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold' }}
                    >
                      הצג השוואה והחלט
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => removeFromPersonalInbox(item.id)}
                    style={{ padding: '0.5rem', flex: 1, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    מחק
                  </button>
                  <button 
                    onClick={() => setSelectedItem(item)}
                    style={{ padding: '0.5rem', flex: 2, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    שייך לפרויקט
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <PersonalInboxRoutingModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
        />
      )}

      {zoomedDuplicate && (
        <div 
          onClick={() => setZoomedDuplicate(null)} 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}
        >
          <img src={zoomedDuplicate} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    
      {zoomedIndex !== null && personalInbox[zoomedIndex] && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
            onTouchEnd={e => {
              const touchEndX = e.changedTouches[0].screenX;
              if (touchStartX - touchEndX > 50 && zoomedIndex < personalInbox.length - 1) setZoomedIndex(zoomedIndex + 1);
              if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={personalInbox[zoomedIndex].imageUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              
              {zoomedIndex > 0 && (
                <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex - 1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  &gt;
                </div>
              )}
              
              {zoomedIndex < personalInbox.length - 1 && (
                <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex + 1); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  &lt;
                </div>
              )}
            </div>
            <div style={{ color: 'white', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold', direction: 'rtl' }}>
              {zoomedIndex + 1} מתוך {personalInbox.length}
            </div>
            <div 
              onClick={() => setZoomedIndex(null)}
              style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              סגור תצוגה
            </div>
          </div>
        )}
    </div>
  );
}