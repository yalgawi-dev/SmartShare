const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = '<div className={popupBlocked ?';
const endStr = '          </>\n        )}';

const start = content.indexOf(startStr);
const end = content.indexOf(endStr, start);

if (start !== -1 && end !== -1) {
  const newBlock = `
            {providerLoading && !popupBlocked && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569', textAlign: 'center', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                פותח חלון התחברות... ({providerLoading})
              </div>
            )}
            
            {popupBlocked && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(5px)',
                zIndex: 50, display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', padding: '2rem',
                textAlign: 'center', borderRadius: '24px',
                animation: 'popUpGlowAlert 0.4s ease-out forwards'
              }}>
                <button 
                  onClick={() => setPopupBlocked(false)} 
                  style={{ position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  &times;
                </button>
                <div style={{ width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '1rem', animation: 'popUpIconWiggle 2s infinite', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)' }}>
                  !
                </div>
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1.4rem' }}>הדפדפן חסם את ההתחברות</h3>
                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '2rem', lineHeight: '1.5', maxWidth: '280px' }}>
                  במכשירי אנדרואיד או סמסונג, מומלץ לפתוח את האפליקציה ישירות בכרום כדי להמשיך בצורה חלקה:
                </p>
                <button 
                  onClick={() => {
                    const url = window.location.href.replace(/^https?:\\/\\//, '');
                    window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                  }}
                  style={{
                    background: '#10b981', color: 'white', border: 'none', padding: '1rem 1.5rem', 
                    borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)', width: '100%', maxWidth: '280px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" y1="8" x2="12" y2="8"></line><line x1="3.95" y1="6.06" x2="8.54" y2="14"></line><line x1="10.88" y1="21.94" x2="15.46" y2="14"></line></svg>
                  פתח ב-Chrome
                </button>
                <button 
                  onClick={() => setPopupBlocked(false)}
                  style={{ marginTop: '1.5rem', background: 'transparent', border: 'none', color: '#64748b', fontSize: '1rem', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  ביטול והתחברות בדרך אחרת
                </button>
              </div>
            )}
`;
  content = content.substring(0, start) + newBlock + content.substring(end);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched overlay successfully");
} else {
  console.log("Could not find boundaries");
}
