'use client';

import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect } from 'react';
import { isDuplicateInvoice } from '../../../utils/duplicateCheck';
import { useSpaces, InboxItem } from '../../../app/context/SpacesContext';
import PersonalInboxRoutingModal from '../PersonalInboxRoutingModal';

interface FinanceInboxProps {
  space: any;
  user: any;
  onReviewItem: (item: InboxItem) => void;
}

export function FinanceInbox({ space, user, onReviewItem }: FinanceInboxProps) {
  const { addInboxItems, removeInboxItem, updateInboxItem } = useSpaces();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [routingItem, setRoutingItem] = useState<any>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  const inboxItems: InboxItem[] = space.inboxItems || [];
  
  useEffect(() => {
    const processQueue = async () => {
      const pendingItems = inboxItems.filter((i: any) => i.status === 'processing' && !processingItems.has(i.id));
      if (pendingItems.length === 0) return;

      for (const item of pendingItems) {
        setProcessingItems(prev => new Set(prev).add(item.id));
        
        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: item.imageUrl, vatRate: space?.settings?.defaultVatRate || 17 })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.isIrrelevant || data.category === 'לא רלוונטי') {
              updateInboxItem(space.id, item.id, { status: 'irrelevant', ocrData: data });
            } else {
              let isDuplicate = false;
              if (data.invoiceNumber) {
                const existsInvoices = space.invoices?.find((inv: any) => isDuplicateInvoice(inv, data));
                
                const existsInbox = inboxItems.find((inv: any) => {
                  if (inv.id === item.id) return false;
                  return isDuplicateInvoice(inv.ocrData || {}, data);
                });
                
                if (existsInvoices || existsInbox) isDuplicate = true;
                
                if (isDuplicate) {
                  data._duplicateWarning = 'נמצא מסמך עם מספר ושם ספק זהים במערכת.';
                  data._duplicateInvoice = existsInvoices || existsInbox;
                }
              }
              
              updateInboxItem(space.id, item.id, { status: isDuplicate ? 'duplicate' : 'ready', ocrData: data });
            }
          } else {
            updateInboxItem(space.id, item.id, { status: 'error' });
          }
        } catch (e) {
          console.error("Failed to process inbox item:", e);
          updateInboxItem(space.id, item.id, { status: 'error' });
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
  }, [inboxItems, space.id, updateInboxItem, processingItems, space?.settings?.defaultVatRate]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    
    const newItems: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const url = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      newItems.push({
        imageUrl: url,
        status: 'processing',
        uploadedBy: user?.id || 'unknown'
      });
    }

    addInboxItems(space.id, newItems);
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'processing': return { background: '#fef3c7', color: '#d97706' };
      case 'ready': return { background: '#dcfce7', color: '#15803d' };
      case 'irrelevant': return { background: '#f3f4f6', color: '#4b5563' };
      case 'error': return { background: '#fee2e2', color: '#b91c1c' };
      case 'duplicate': return { background: '#fef08a', color: '#a16207' };
      default: return { background: '#e5e7eb', color: '#374151' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return '⏳ בתהליך...';
      case 'ready': return '✅ ממתין לאישור';
      case 'irrelevant': return '🚫 לא רלוונטי';
      case 'error': return '❌ שגיאה';
      default: return status;
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: '#e0e7ff', padding: '1rem', borderRadius: '12px', border: '1px solid #c7d2fe', marginBottom: '1.5rem', color: '#3730a3' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📥</span> מחסן מסמכים כללי (תחנת מעבר)
        </h4>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
          אזור זה פתוח לכל השותפים ומשמש כתחנת מעבר למסמכים וקבלות שטרם הוגדרו כהוצאה. זה המקום לזרוק אליו חשבוניות שהתקבלו בוואטסאפ או במייל כדי לטפל בהן ולבדוק אותן ביסודיות מאוחר יותר. <strong>כל שותף יכול לראות, לטפל, לערוך ולאשר</strong> מסמכים אלו ולהכניס אותם למאזן הפרויקט.
        </p>
      </div>
      <h4 style={{ margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>מסמכים ממתינים ({inboxItems.length})</h4>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
          >
            <option value="date_desc">תאריך הוספה (חדש קודם)</option>
            <option value="date_asc">תאריך הוספה (ישן קודם)</option>
            <option value="amount_desc">סכום: מהגבוה לנמוך</option>
            <option value="amount_asc">סכום: מהנמוך לגבוה</option>
          </select>
        </div>

        <button 
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'bold',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            opacity: isUploading ? 0.7 : 1
          }}
          disabled={isUploading}
        >
          {isUploading ? 'טוען...' : '➕ הוסף מסמך למחסן המשותף'}
        </button>
        <input 
          type="file" 
          multiple 
          accept="image/*,application/pdf" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileSelect} 
        />
      </div>

      {inboxItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-main)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📥</div>
          <h4>אין מסמכים ממתינים</h4>
          <p style={{ fontSize: '0.9rem' }}>המחסן ריק. אפשר להעלות לכאן קבלות שנסרקו או התקבלו כדי לטפל בהן במרוכז מאוחר יותר.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {[...inboxItems].sort((a, b) => {
            // Group irrelevant at the bottom ALWAYS
            if (a.status === 'irrelevant' && b.status !== 'irrelevant') return 1;
            if (a.status !== 'irrelevant' && b.status === 'irrelevant') return -1;
            
            if (sortOption === 'date_desc') {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else if (sortOption === 'date_asc') {
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else {
              const amountA = a.ocrData?.amount || 0;
              const amountB = b.ocrData?.amount || 0;
              return sortOption === 'amount_desc' ? amountB - amountA : amountA - amountB;
            }
          }).map((item: any, i: number) => (
            <div key={item.id} style={{ 
              minWidth: '220px', width: '220px', background: '#f8fafc', 
              border: item.status === 'duplicate' ? '2px solid #ef4444' : '1px solid #cbd5e1', 
              borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              opacity: item.status === 'irrelevant' ? 0.6 : 1
            }}>
              <div style={{ height: '140px', backgroundColor: '#e2e8f0', position: 'relative' }}>
                {item.imageUrl.startsWith('data:image') || item.imageUrl.startsWith('http') ? (
                  <img src={item.imageUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setZoomedIndex(i)} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>מסמך</div>
                )}
                {item.status === 'processing' && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    בתהליך...
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '0.2rem', left: '0.2rem', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '1rem', color: 'white' }}>🔍</div>
              </div>
              
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {(item.status === 'ready' || item.status === 'duplicate') && item.ocrData && (
                  <>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(item.ocrData.vendor || item.ocrData.supplier) || "לא זוהה ספק"}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                      ₪{item.ocrData.amount || '0'} | מס': {item.ocrData.invoiceNumber || '---'}
                    </div>
                  </>
                )}
                
                {item.status === 'duplicate' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem', color: '#b91c1c' }}>
                    <strong>חשד לכפילות!</strong>
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => removeInboxItem(space.id, item.id)}
                    style={{ padding: '0.5rem', flex: 1, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    מחק
                  </button>
                  {(item.status === 'ready' || item.status === 'duplicate') && (
                    <button 
                      onClick={() => setRoutingItem(item)}
                      style={{ padding: '0.5rem', flex: 2, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ערוך ואשר
                    </button>
                  )}
                </div>
              </div>
            </div>          ))}
        </div>
      )}

      
      {routingItem && (
        <PersonalInboxRoutingModal 
          item={routingItem} 
          onClose={() => setRoutingItem(null)} 
          preselectedSpaceId={space.id}
          isFromProjectInbox={true}
        />
      )}

      {zoomedIndex !== null && inboxItems[zoomedIndex] && typeof window !== 'undefined' && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
          onTouchEnd={e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50 && zoomedIndex < inboxItems.length - 1) setZoomedIndex(zoomedIndex + 1);
            if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
          }}
        >
          <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src={inboxItems[zoomedIndex].imageUrl} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} 
            />
            {zoomedIndex > 0 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex - 1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                &gt;
              </div>
            )}
            {zoomedIndex < inboxItems.length - 1 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex + 1); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                &lt;
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem' }}>
            <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', direction: 'rtl' }}>
              {zoomedIndex + 1} מתוך {inboxItems.length}
            </div>
            <div 
              onClick={() => setZoomedIndex(null)}
              style={{ marginTop: '0.75rem', padding: '0.5rem 2rem', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              סגור תצוגה
            </div>
          </div>
          
        </div>,
        document.body
      )}

    </div>
  );
}