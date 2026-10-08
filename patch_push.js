const fs = require('fs');
let pageTx = fs.readFileSync('src/app/settings/page.tsx', 'utf8');

const oldPush = `        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🔔</span> התראות פוש</h3>
            <p style={{ margin: 0, color: '#15803d', fontSize: '0.9rem' }}>קבל התראות לטלפון על הודעות והוצאות חדשות.</p>
          </div>
          <button onClick={handleEnablePush} style={{ background: isPushEnabled ? '#86efac' : '#22c55e', color: isPushEnabled ? '#14532d' : 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPushEnabled ? 'פעיל ✔️ (לחץ לסנכרון מחדש)' : ((user?.fcmTokens?.length || 0) > 0 ? 'הפעל גם בדפדפן זה' : 'הפעל עכשיו')}
          </button>
        </div>`;

const newPush = `        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', overflow: 'hidden' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🔔</span> התראות פוש</h3>
            <p style={{ margin: 0, color: '#15803d', fontSize: '0.9rem' }}>קבל התראות לטלפון על הודעות והוצאות חדשות.</p>
          </div>
          
          {typeof window !== 'undefined' && window.Notification && Notification.permission === 'denied' ? (
            <div style={{ background: '#fee2e2', padding: '0.75rem', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', width: '100%' }}>
              <strong>ההתראות חסומות בדפדפן זה.</strong><br/>
              כדי לאפשר אותן, יש לגשת להגדרות הדפדפן (או הגדרות הטלפון -> אפליקציות -> דפדפן/SmartShare) ולאפשר התראות ידנית.
            </div>
          ) : (
            <button onClick={handleEnablePush} style={{ background: isPushEnabled ? '#86efac' : '#22c55e', color: isPushEnabled ? '#14532d' : 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' }}>
              {isPushEnabled ? 'פעיל ✔️ (לחץ לסנכרון מחדש)' : ((user?.fcmTokens?.length || 0) > 0 ? 'הפעל גם בדפדפן זה' : 'הפעל עכשיו')}
            </button>
          )}
        </div>`;

pageTx = pageTx.replace(oldPush, newPush);
fs.writeFileSync('src/app/settings/page.tsx', pageTx);
console.log("Patched push settings");
