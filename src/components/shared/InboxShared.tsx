import React, { useState } from 'react';

export function InboxZoomModal({ items, initialIndex, onClose }: { items: any[], initialIndex: number, onClose: () => void }) {
  const [zoomedIndex, setZoomedIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState(0);

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
      onTouchEnd={e => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50 && zoomedIndex < items.length - 1) setZoomedIndex(zoomedIndex + 1);
        if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
      }}
    >
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 100001 }}>
        <button 
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          ×
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', flex: 1, maxHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img 
          src={items[zoomedIndex]?.imageUrl} 
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} 
        />
        
        {zoomedIndex > 0 && (
          <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex - 1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            &gt;
          </div>
        )}
        
        {zoomedIndex < items.length - 1 && (
          <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex + 1); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            &lt;
          </div>
        )}
      </div>
      <div style={{ color: 'white', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold', direction: 'rtl' }}>
        {zoomedIndex + 1} מתוך {items.length}
      </div>
    </div>
  );
}

export function InboxItemCard({ 
  item, 
  index, 
  onZoom, 
  isProcessing, 
  duplicateWarning, 
  onResolveDuplicate,
  primaryAction,
  secondaryAction 
}: any) {
  return (
    <div style={{ 
      minWidth: '220px', width: '220px', background: '#f8fafc', 
      border: duplicateWarning ? '2px solid #ef4444' : '1px solid #cbd5e1', 
      borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' 
    }}>
      <div style={{ height: '140px', backgroundColor: '#e2e8f0', position: 'relative' }}>
        <img src={item.imageUrl} alt="Document" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => onZoom(index)} />
        {isProcessing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem' }}>
            בתהליך חילוץ...
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '0.2rem', left: '0.2rem', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '1rem', color: 'white' }}>🔍</div>
      </div>
      
      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {!item.ocrData && !item.ocrError && !isProcessing && (
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ממתין לחילוץ...</div>
        )}
        {item.ocrError && !isProcessing && (
          <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>
             החילוץ נכשל 
          </div>
        )}
        {item.ocrData && (
          <>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(item.ocrData.vendor || item.ocrData.supplier) || "לא זוהה ספק"}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              ₪{item.ocrData.amount || '0'} | מס': {item.ocrData.invoiceNumber || '---'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              תאריך: {item.ocrData.date || '---'}
            </div>
          </>
        )}
        
        {duplicateWarning && duplicateWarning.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem', color: '#b91c1c' }}>
            <strong>חשד לכפילות!</strong><br/>
            זוהו {duplicateWarning.length} מסמכים דומים
            {onResolveDuplicate && (
              <button 
                onClick={() => onResolveDuplicate(item, duplicateWarning)}
                style={{ display: 'block', marginTop: '0.25rem', background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold' }}
              >
                הצג השוואה והחלט
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
          {secondaryAction && (
            <button 
              onClick={secondaryAction.onClick}
              style={{ padding: '0.5rem', flex: 1, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button 
              onClick={primaryAction.onClick}
              style={{ padding: '0.5rem', flex: 2, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}