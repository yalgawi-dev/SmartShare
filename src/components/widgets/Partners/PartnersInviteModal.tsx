'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

export function PartnersInviteModal({ 
  space, 
  onClose 
}: { 
  space: any; 
  onClose: () => void;
}) {
  const [isRetroactive, setIsRetroactive] = useState(true);
  const [customShare, setCustomShare] = useState('');

  const handleCreateInvite = async () => {
    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    
    const url = new URL(window.location.href);
    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    url.searchParams.set('retro', isRetroactive ? 'true' : 'false');
    if (customShare && !isNaN(Number(customShare))) {
      url.searchParams.set('share', customShare);
    }
    const link = url.toString();

    onClose();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הזמנה לפרויקט ' + space.title,
          text: 'היי! צירפתי אותך עכשיו למרחב שותפות להוצאות. לחץ כאן כדי להיכנס:',
          url: link,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(link);
      alert('הקישור הועתק! שלח אותו לשותף.');
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem' }}>הזמנת שותף חדש</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        
        <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          אחוז השתתפות מותאם אישית (אופציונלי):
        </p>
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="number" 
            min="1" max="100"
            placeholder="למשל 10%" 
            value={customShare}
            onChange={e => setCustomShare(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
          />
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>אם תשאיר ריק, האחוזים יתאזנו שווה בשווה.</span>
        </div>

        {space.invoices && space.invoices.length > 0 && (
          <>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
              איך תרצה לחשב את ההוצאות של השותף החדש?
            </p>
                
            <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={isRetroactive} 
                  onChange={e => setIsRetroactive(e.target.checked)}
                  style={{ width: '22px', height: '22px', marginTop: '2px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1.05rem' }}>חיוב רטרואקטיבי</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem', lineHeight: '1.4' }}>
                    {isRetroactive ? 
                      'מומלץ: השותף ישתתף בכל ההוצאות שהיו בפרויקט מתחילתו.' : 
                      'מעכשיו והלאה: השותף פטור מתשלום על כל מה שהיה עד כה, ויחויב רק על הוצאות עתידיות.'}
                  </div>
                </div>
              </label>
            </div>
          </>
        )}

        <button 
          onClick={handleCreateInvite}
          style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '999px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(74, 91, 240, 0.2)' }}
        >
          שתף קישור הזמנה (WhatsApp)
        </button>
      </div>
    </div>,
    document.body
  );
}
