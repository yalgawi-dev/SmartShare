const fs = require('fs');
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `              {auth.currentUser?.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com' || p.providerId === 'apple.com') ? (
                <div style={{ position: 'relative' }}>
                  <input type="email" value={email} disabled style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>מייל זה מסונכרן אוטומטית מחשבון ההתחברות שלך ומוגן משינויים.</span>
                </div>
              ) : (
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="הזן מייל לקבלת חשבוניות" style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              )}`;

const replacementStr = `              {auth.currentUser?.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com' || p.providerId === 'apple.com') ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="email" value={email} disabled style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>מאומת ✓</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>מייל זה מסונכרן מחשבון ההתחברות שלך ומוגן משינויים.</span>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="הזן מייל לקבלת חשבוניות" style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                    {email ? (
                      (auth.currentUser?.email === email && auth.currentUser?.emailVerified) ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>מאומת ✓</span>
                      ) : (
                        <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ממתין לאימות ⏳</span>
                      )
                    ) : null}
                  </div>
                  {email && !(auth.currentUser?.email === email && auth.currentUser?.emailVerified) && (
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!auth.currentUser) return;
                        try {
                          const { verifyBeforeUpdateEmail, sendEmailVerification } = await import('firebase/auth');
                          if (auth.currentUser.email === email) {
                            await sendEmailVerification(auth.currentUser);
                          } else {
                            await verifyBeforeUpdateEmail(auth.currentUser, email);
                          }
                          alert('נשלח לינק אימות לכתובת: ' + email + '\\nאנא בדוק את תיבת הדואר שלך (וגם בספאם).');
                        } catch (err: any) {
                          if (err.code === 'auth/requires-recent-login') {
                            alert('על מנת לאמת מייל זה, יש להתנתק מהמערכת ולהתחבר מחדש (מטעמי אבטחה).');
                          } else {
                            alert('שגיאה בשליחת אימות: ' + err.message);
                          }
                        }
                      }}
                      style={{ padding: '0.4rem 0.8rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', width: 'fit-content' }}
                    >
                      שלח לינק אימות למייל
                    </button>
                  )}
                </div>
              )}`;

if (content.includes("auth.currentUser?.providerData.some")) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched verification UI!");
} else {
  console.log("Target not found!");
}
