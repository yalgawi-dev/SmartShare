const fs = require('fs');
let file = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add states
const stateTarget = "const [mode, setMode] = useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'original'>('smart_plus');";
const statesToAdd = `const [mode, setMode] = useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original'>('smart_plus');
  const [defaultBatchEngine, setDefaultBatchEngine] = useState<'smart_plus'|'experimental'>('smart_plus');
  const [showEngineModal, setShowEngineModal] = useState(false);
`;
file = file.replace(stateTarget, statesToAdd);

// 2. Change handleFilterSwitch signature
file = file.replace(
  /const handleFilterSwitch = \(targetMode: 'auto' \| 'bw' \| 'pure_color' \| 'smart_plus' \| 'hybrid' \| 'original'\) => {/,
  "const handleFilterSwitch = (targetMode: 'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original') => {"
);

// 3. Update handleGalleryImport to handleGalleryImportWithEngine
file = file.replace(
  "const handleGalleryImport = (e: React.ChangeEvent<HTMLInputElement>) => {",
  `const handleGalleryImport = (e: React.ChangeEvent<HTMLInputElement>) => handleGalleryImportWithEngine('smart_plus')(e);
  const handleGalleryImportWithEngine = (engine: 'smart_plus'|'experimental') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultBatchEngine(engine);
    setShowEngineModal(false);`
);

// 4. Update the gallery button to show modal
const oldGalleryBtn = `<label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'white', width: '60px' }}>
                 <input type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImport} style={{ display: 'none' }} />
                 <span style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                 </span>
                 <span style={{ fontSize: '0.65rem', marginTop: '0.3rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ייבוא לסורק</span>
               </label>`;

const newGalleryBtn = `<button onClick={() => setShowEngineModal(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'white', width: '60px' }}>
                 <span style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                 </span>
                 <span style={{ fontSize: '0.65rem', marginTop: '0.3rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ייבוא לסורק</span>
               </button>`;
file = file.replace(oldGalleryBtn, newGalleryBtn);

// 5. Render the EngineModal inside the camera view
const cameraViewEnd = `</div>

           </div>
        )}

        {step === 'cropping' && (`;

const engineModalUI = `
             {showEngineModal && (
               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
                 <h3 style={{ color: 'white', textAlign: 'center', margin: 0 }}>בחירת מנוע עיבוד</h3>
                 <p style={{ color: '#aaa', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>בחר באיזה מנוע תרצה להשתמש לסריקה הנוכחית. המנוע יופעל על כל הקבצים שייבחרו.</p>
                 
                 <label style={{ width: '100%', background: '#10b981', color: 'white', padding: '1rem', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' }}>
                   <input type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImportWithEngine('smart_plus')} style={{ display: 'none' }} />
                   מנוע חשבונית+ (קיים)
                 </label>
                 
                 <label style={{ width: '100%', background: '#3b82f6', color: 'white', padding: '1rem', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' }}>
                   <input type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImportWithEngine('experimental')} style={{ display: 'none' }} />
                   מנוע ניסיוני (חדש)
                 </label>
                 
                 <button onClick={() => setShowEngineModal(false)} style={{ background: 'transparent', color: '#fff', border: '1px solid #555', padding: '0.75rem', borderRadius: '12px', marginTop: '1rem', width: '100%' }}>ביטול</button>
               </div>
             )}
             </div>

           </div>
        )}

        {step === 'cropping' && (`

file = file.replace(cameraViewEnd, engineModalUI);

// 6. Fix handleDone to use defaultBatchEngine
file = file.replace(
  /const result = await applyPerspectiveAndFilters\(snapshotUrl, pts, 'smart_plus'\);/g,
  "const result = await applyPerspectiveAndFilters(snapshotUrl, pts, defaultBatchEngine);"
);

// 7. Add filter buttons to step === 'review'
const oldButtons = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  <button onClick={() => handleFilterSwitch('original')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>מקור</button>
                </div>`;

const newButtons = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('smart_plus')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'smart_plus' ? '#10b981' : 'transparent', color: mode === 'smart_plus' ? '#fff' : '#10b981', border: '1px solid #10b981', fontSize: '0.8rem', cursor: 'pointer' }}>חשבונית+</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  <button onClick={() => handleFilterSwitch('original')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>מקור</button>
                </div>`;
file = file.replace(oldButtons, newButtons);

// 8. Update Version
file = file.replace(/v19\.18/g, 'v19.19');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', file);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.76/g, 'v6.5.77');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Updated ScannerModal.tsx!");
