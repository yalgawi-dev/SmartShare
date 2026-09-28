const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const start = content.indexOf('popupBlocked && (', content.indexOf('popupBlocked && (') + 10);
const searchEndStr = "פתח בכרום\n                </button>\n              </div>\n            )}";
const end = content.indexOf(searchEndStr, start);

if (start !== -1 && end !== -1) {
  const newUI = `popupBlocked && (
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
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1.4rem' }}>הדפדפן חסם את התחברות גוגל</h3>
                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '2rem', lineHeight: '1.5', maxWidth: '280px' }}>
                  הדפדפן שלך חוסם אוטומטית פופאפים בהגדרות שלו. אי אפשר להתחבר ככה. אנא המשך עם מספר טלפון (זה עובד 100%).
                </p>
                <button 
                  onClick={() => {
                    setPopupBlocked(false);
                    setMode('phone');
                  }}
                  style={{
                    background: '#3b82f6', color: 'white', border: 'none', padding: '1rem 1.5rem', 
                    borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)', width: '100%', maxWidth: '280px',
                    transition: 'transform 0.2s'
                  }}
                >
                  המשך עם מספר טלפון
                </button>
              </div>
            )}`;
  
  content = content.substring(0, start) + newUI + content.substring(end + searchEndStr.length);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched popup UI carefully");
} else {
  console.log("Could not find start or end bounds. Start:", start, "End:", end);
}
