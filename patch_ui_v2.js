const fs = require('fs');

// Patch ScannerModal.tsx
let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

if (!sm.includes('showDebug')) {
    sm = sm.replace(
        'const [classifyResult, setClassifyResult] = useState<any>(null);', 
        `const [classifyResult, setClassifyResult] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowDebug(localStorage.getItem('show_scanner_debug') === 'true');
    }
  }, []);`
    );
}

sm = sm.replace('{timings && (', '{showDebug && timings && (');

// Remove the smart_plus button from the row
const buttonRegex = /<button onClick=\{\(\) => handleFilterSwitch\('smart_plus'\)\}[^>]+>חשבונית\+<\/button>/g;
sm = sm.replace(buttonRegex, '');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

// Patch Admin Users Page
let au = fs.readFileSync('src/app/admin/users/page.tsx', 'utf8');

if (!au.includes('show_scanner_debug')) {
    au = au.replace(
        '<div style={{ display: \'flex\', alignItems: \'center\', gap: \'1rem\', marginBottom: \'2rem\' }}>',
        `<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => {
            const current = localStorage.getItem('show_scanner_debug') === 'true';
            localStorage.setItem('show_scanner_debug', current ? 'false' : 'true');
            alert(current ? 'Scanner Debug Hidden' : 'Scanner Debug Visible');
          }}
          style={{ 
            background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', 
            padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginRight: 'auto', fontWeight: 'bold' 
          }}
        >
          Toggle Scanner Debug
        </button>`
    );
}

fs.writeFileSync('src/app/admin/users/page.tsx', au);

console.log("Patched successfully!");
