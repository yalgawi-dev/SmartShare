import React, { useState, useRef, useEffect } from 'react';
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
              updateInboxItem(space.id, item.id, { status: 'ready', ocrData: data });
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>מסוף קליטה ({inboxItems.length})</h3>
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
            opacity: isUploading ? 0.7 : 1
          }}
          disabled={isUploading}
        >
          {isUploading ? 'טוען...' : '➕ העלה קבלות'}
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
          <h4>התיבה ריקה</h4>
          <p style={{ fontSize: '0.9rem' }}>כאן ינחתו חשבוניות שיועלו במרוכז או ישותפו ממקורות חיצוניים.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[...inboxItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item: any) => (
            <div key={item.id} style={{ 
              background: 'var(--bg-card)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-light)', 
              overflow: 'hidden',
              opacity: item.status === 'irrelevant' ? 0.6 : 1
            }}>
              <div style={{ height: '140px', overflow: 'hidden', background: '#f3f4f6', position: 'relative' }}>
                {item.imageUrl.startsWith('data:image') || item.imageUrl.startsWith('http') ? (
                  <img src={item.imageUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄 מסמך</div>
                )}
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  ...getStatusStyle(item.status)
                }}>
                  {getStatusText(item.status)}
                </div>
              </div>
              
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {new Date(item.createdAt).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                {item.status === 'ready' && item.ocrData && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{item.ocrData.supplier || 'ספק לא ידוע'}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₪{item.ocrData.amount || '0'}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {item.status === 'ready' && (
                    <button 
                      onClick={() => onReviewItem(item)}
                      style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      אשר
                    </button>
                  )}
                  <button 
                    onClick={() => removeInboxItem(space.id, item.id)}
                    style={{ flex: item.status === 'ready' ? 0 : 1, background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="מחק מתיבת הקליטה"
                  >
                    🗑️ {item.status !== 'ready' && 'מחק'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
