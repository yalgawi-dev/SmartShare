const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const targetStr = `                <button 
                  onClick={() => handleFilterSwitch('smart_color')} 
                  style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'smart_color' ? '#fff' : 'transparent', color: mode === 'smart_color' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                    חשבוניות
                  </button>`;

code = code.replace(targetStr, "");
code = code.replace(/ \\| 'smart_color'/g, "");
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Done");
