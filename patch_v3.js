const fs = require('fs');

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

sm = sm.replace(
    'const [isClassifying, setIsClassifying] = useState(false);', 
    `const [isClassifying, setIsClassifying] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowDebug(localStorage.getItem('show_scanner_debug') === 'true');
    }
  }, []);`
);

sm = sm.replace('{timings && (', '{showDebug && timings && (');

const buttonRegex = /<button onClick=\{\(\) => handleFilterSwitch\('smart_plus'\)\}[^>]+>חשבונית\+<\/button>/g;
sm = sm.replace(buttonRegex, '');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

// Patch admin Users Page
let au = fs.readFileSync('src/app/admin/users/page.tsx', 'utf8');
const auTarget = `<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>`;
if (au.includes(auTarget) && !au.includes('show_scanner_debug')) {
    au = au.replace(
        auTarget,
        `${auTarget}
        <button 
          onClick={() => {
            const current = localStorage.getItem('show_scanner_debug') === 'true';
            localStorage.setItem('show_scanner_debug', current ? 'false' : 'true');
            alert(current ? 'נתוני סורק הוסתרו' : 'נתוני סורק יופיעו');
          }}
          style={{ 
            background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', 
            padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginRight: 'auto', fontWeight: 'bold' 
          }}
        >
          הצג נתוני סורק
        </button>`
    );
    fs.writeFileSync('src/app/admin/users/page.tsx', au);
}

// BUMP VERSION
sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.2[0-9]/g, 'v19.24');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.[0-9]+/g, 'v6.5.82');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Patched successfully v3!");
