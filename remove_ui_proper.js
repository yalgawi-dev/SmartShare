const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// fix the types
code = code.replace(/'auto' \| 'bw' \| 'pure_color' \| 'smart_color' \| 'smart_plus' \| 'hybrid' \| 'original'/g, "'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'original'");

// remove the button block
const buttonStart = `                <button 
                onClick={() => handleFilterSwitch('smart_color')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'smart_color' ? '#fff' : 'transparent', color: mode === 'smart_color' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                  חשבוניות
                </button>`;

code = code.replace(buttonStart, "");

// also the old definition variables if present
code = code.replace(/const \[smartColorSnapshot, setSmartColorSnapshot\] = useState<string \| null>\(null\);\n/g, "");

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Done");
