const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

// The modal UI currently in FinanceWidget.tsx
const oldModalStart = '{showInviteModal && (';
const oldModalEnd = ')}';

// Find the modal block
const startIndex = content.indexOf(oldModalStart);
if (startIndex !== -1) {
  // Just use regex to replace the entire modal UI block
  const replacementModalUI = `{showInviteModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem' }}>הזמנת שותף חדש</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
              איך תרצה לחשב את ההוצאות של השותף החדש?
            </p>
                
            <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
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

            <button 
              onClick={handleCreateInvite}
              style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '999px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(74, 91, 240, 0.2)' }}
            >
              שתף קישור הזמנה (WhatsApp)
            </button>
          </div>
        </div>,
        document.body
      )}`;
  
  // Need to replace the whole `{showInviteModal && ... )}` block.
  // It's safer to use regex that captures everything until the closing of the modal.
  content = content.replace(/\{showInviteModal && \([\s\S]*?\}\)\}/, replacementModalUI);
}

// 2. Change handleCreateInvite logic
const oldHandleCreate = /const handleCreateInvite = \(\) => \{[\s\S]*?\};/m;
const newHandleCreate = `const handleCreateInvite = async () => {
    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    addGuestPartner(space.id, 'אורח/ת', isRetroactive, shadowToken);
    
    const url = new URL(window.location.href);
    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    const link = url.toString();

    setShowInviteModal(false);

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
  };`;

content = content.replace(oldHandleCreate, newHandleCreate);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf-8');
console.log('FinanceWidget UI updated for modal portal and native share');
