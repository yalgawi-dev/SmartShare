const fs = require('fs');
let file = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Remove smart_plus from Advanced Filters
const oldAdvanced = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('smart_plus')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'smart_plus' ? '#10b981' : 'transparent', color: mode === 'smart_plus' ? '#fff' : '#10b981', border: '1px solid #10b981', fontSize: '0.8rem', cursor: 'pointer' }}>חשבונית+</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  <button onClick={() => handleFilterSwitch('original')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>מקור</button>
                </div>`;

const newAdvanced = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  <button onClick={() => handleFilterSwitch('original')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>מקור</button>
                </div>`;

file = file.replace(oldAdvanced, newAdvanced);

// Add showDebug state
const oldState = `const [classifyResult, setClassifyResult] = useState<any>(null);`;
const newState = `const [classifyResult, setClassifyResult] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowDebug(localStorage.getItem('show_scanner_debug') === 'true');
    }
  }, []);`;
file = file.replace(oldState, newState);

// Wrap timings debug overlay
const oldDebug = `{timings && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.85)', color: '#0f0', padding: '10px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>`;
const newDebug = `{showDebug && timings && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.85)', color: '#0f0', padding: '10px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>`;
file = file.replace(oldDebug, newDebug);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', file);
console.log("ScannerModal updated");
