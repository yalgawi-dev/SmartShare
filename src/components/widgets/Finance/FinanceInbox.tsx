'use client';

import React, { useState, useRef, useEffect } from 'react';
import { isDuplicateInvoice } from '../../../utils/duplicateCheck';
import { useSpaces, InboxItem } from '../../../app/context/SpacesContext';

interface FinanceInboxProps {
  space: any;
  user: any;
  onReviewItem: (item: InboxItem) => void;
}

export function FinanceInbox({ space, user, onReviewItem }: FinanceInboxProps) {
  const { addInboxItems, removeInboxItem, updateInboxItem } = useSpaces();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
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
              
          // Process item (using mock data for now)
          const mockOcrData = {
            amount: Math.floor(Math.random() * 500) + 50,
            date: new Date().toISOString().split('T')[0],
            vendor: 'ספק מזהה ' + Math.floor(Math.random() * 100),
            invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000)
          };
          
          await new Promise(r => setTimeout(r, 1500));
          
          let finalStatus = 'ready';
          if (mockOcrData.invoiceNumber && space.invoices && space.invoices.length > 0) {
             const exists = space.invoices.some((inv: any) => isDuplicateInvoice(inv, mockOcrData));
             if (exists) finalStatus = 'duplicate';
          }

          updateInboxItem(space.id, item.id, {
            status: finalStatus as any,
            ocrData: mockOcrData
          });
        } catch (e) {
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
  }, [inboxItems, space.invoices, space.id, updateInboxItem, processingItems]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    const newItems: Partial<InboxItem>[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      newItems.push({
        status: 'processing',
        imageUrl: fileData,
        uploadedBy: user?.id
      });
    }

    try {
      await addInboxItems(space.id, newItems);
    } catch (e) {
      alert('שגיאה בהעלאת קבצים');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'processing': return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
      case 'ready': return { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
      case 'irrelevant': return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
      case 'error': return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
      case 'duplicate': return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
      default: return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return '⏳ בסריקה...';
      case 'ready': return '✅ ממתין לאישור וניתוב';
      case 'irrelevant': return '🗑️ סומן כלא רלוונטי';
      case 'duplicate': return '⚠️ חשד לכפילות';
      case 'error': return '❌ שגיאת סריקה';
      default: return status;
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      
      <div style={{ background: '#e0e7ff', padding: '1rem', borderRadius: '12px', border: '1px solid #c7d2fe', marginBottom: '1.5rem', color: '#3730a3' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📥</span> מחסן מסמכים משותף (תחנת מעבר)
        </h4>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
          מחסן זה הוא אזור משותף ש<strong>כל השותפים בפרויקט יכולים לראות</strong>. מסמכים שיושבים כאן <strong>הם עדיין לא הוצאות בפועל</strong> ולא נכנסו למאזן הפרויקט. הם רק מחכים שמישהו מהשותפים יעבור עליהם, ימלא את הסכום והספק, ויאשר אותם סופית. אם ברצונך להכניס הוצאה ישירות, חזור למסך הקודם ולחץ על "הוסף הוצאה".
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
          {isUploading ? 'מעלה...' : '➕ הוסף מסמך למחסן המשותף'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[...inboxItems].sort((a, b) => {
            if (a.status === 'irrelevant' && b.status !== 'irrelevant') return 1;
            if (a.status !== 'irrelevant' && b.status === 'irrelevant') return -1;
            
            if (sortOption === 'date_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortOption === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            
            const amountA = a.ocrData?.amount || 0;
            const amountB = b.ocrData?.amount || 0;
            return sortOption === 'amount_desc' ? amountB - amountA : amountA - amountB;
          }).map((item: any, i: number) => (
            <div key={item.id} style={{ 
              background: 'var(--bg-card)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-light)', 
              padding: '1rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              opacity: item.status === 'irrelevant' ? 0.6 : 1
            }}>
              
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setZoomedIndex(i)}>
                {item.imageUrl.startsWith('data:image') || item.imageUrl.startsWith('http') ? (
                  <img src={item.imageUrl} alt="Receipt" style={{ width: '100px', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: '100px', height: '140px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>מסמך</div>
                )}
                <div style={{ position: 'absolute', bottom: '0.2rem', left: '0.2rem', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '1rem' }}>🔍</div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    ...getStatusStyle(item.status)
                  }}>
                    {getStatusText(item.status)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(item.createdAt).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  {item.status === 'processing' && (
                    <div style={{ color: '#d97706', fontSize: '0.9rem', marginTop: '1rem' }}>
                      המסמך נסרק כעת כדי לחלץ ספק וסכום, אנא המתן...
                    </div>
                  )}
                  {(item.status === 'ready' || item.status === 'duplicate') && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {(item.ocrData?.vendor || item.ocrData?.supplier) || 'לא זוהה ספק'}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', margin: '0.25rem 0' }}>
                        ₪{Number(item.ocrData?.amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        מס' חשבונית: {item.ocrData?.invoiceNumber || 'חסר'} | תאריך: {item.ocrData?.date || 'חסר'}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  {(item.status === 'ready' || item.status === 'duplicate') && (
                    <button 
                      onClick={() => onReviewItem(item)}
                      style={{ flex: 2, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                    >
                      📝 ערוך ואשר כהוצאה
                    </button>
                  )}
                  <button 
                    onClick={() => removeInboxItem(space.id, item.id)}
                    style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    🗑️ {item.status !== 'ready' ? 'מחק' : 'מחק/לא רלוונטי'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {zoomedIndex !== null && inboxItems[zoomedIndex] && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
          onTouchEnd={e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50 && zoomedIndex < inboxItems.length - 1) setZoomedIndex(zoomedIndex + 1);
            if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <div style={{ color: 'white', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold', direction: 'rtl' }}>
            {zoomedIndex + 1} מתוך {inboxItems.length}
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
