const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<h3 style=\{\{ margin: '0 0 0\.75rem 0', color: '#0f172a', fontSize: '1\.4rem' \}\}>.*?<\/svg>\s+פתח ב-Chrome\s+<\/button>/s;

const newUI = `<h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1.4rem' }}>התחברות גוגל נחסמה</h3>
                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '2rem', lineHeight: '1.5', maxWidth: '280px' }}>
                  הדפדפן שלך חוסם אוטומטית כניסה דרך גוגל בגלל הגדרות פרטיות. אנא המשך עם מספר הטלפון שלך.
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
                </button>`;

if (regex.test(content)) {
  content = content.replace(regex, newUI);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched successfully");
} else {
  console.log("Failed to match regex");
}
