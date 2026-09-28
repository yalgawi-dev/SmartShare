const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const originalWarning = `                {popupBlocked || providerLoading ? (
                    <span>
                      אם אתה גולש דרך דפדפן סמסונג (או מתוך אפליקציה), עליך להיכנס להגדרות: <strong>"אתרים והורדות -> חסום חלונות קופצים (Pop-ups)"</strong>.
                    </span>
                  ) : (
                    <span>
                      הדפדפן שלך חוסם חלונות קופצים (Pop-ups), לכן ייתכן שתצטרך לאפשר אותם כדי להתחבר באמצעות גוגל.
                    </span>
                  )}
                </div>
              </div>`;

const newWarning = `                {popupBlocked || providerLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <span>
                        הדפדפן הנוכחי (כנראה סמסונג או פנימי) חוסם את חלון ההתחברות.
                      </span>
                      {popupBlocked && (
                        <button 
                          onClick={() => {
                            const url = window.location.href.replace(/^https?:\\/\\//, '');
                            window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                          }}
                          style={{
                            background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1rem', 
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" y1="8" x2="12" y2="8"></line><line x1="3.95" y1="6.06" x2="8.54" y2="14"></line><line x1="10.88" y1="21.94" x2="15.46" y2="14"></line></svg>
                          פתח וסיים התחברות ב-Chrome
                        </button>
                      )}
                    </div>
                  ) : (
                    <span>
                      הדפדפן שלך חוסם חלונות קופצים (Pop-ups), לכן ייתכן שתצטרך לאפשר אותם כדי להתחבר באמצעות גוגל.
                    </span>
                  )}
                </div>
              </div>`;

// Note: Hebrew characters get messed up in powershell raw replace if they don't match exactly.
// I will use regex or careful matching.
