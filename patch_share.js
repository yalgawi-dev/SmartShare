const fs = require('fs');

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// FIX 1: GAP = 0 and remove dark gray background
sm = sm.replace('const GAP = 4;', 'const GAP = 0;');
sm = sm.replace(/pdf\.setFillColor\(50, 50, 50\);\s*pdf\.rect\(0, 0, finalFormatWidth, finalFormatHeight, 'F'\);/g, '');

// FIX 2: Restore the radio buttons in the modal
const formatOptionsStr = `<div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
               <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 'bold' }}>פורמט יצוא</span>
               <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                 <input type="radio" name="exportFmt" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} />
                 <span style={{ fontSize: '1rem' }}>מסמך רגיל (דפים נפרדים)</span>
               </label>
               <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                 <input type="radio" name="exportFmt" checked={exportFormat === 'scroll_pdf'} onChange={() => setExportFormat('scroll_pdf')} style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} />
                 <span style={{ fontSize: '1rem' }}>מגילה (רצף אחד ארוך)</span>
               </label>
             </div>`;

if (!sm.includes('פורמט יצוא')) {
    sm = sm.replace(
        '<label style={{ display: \'flex\', alignItems: \'center\', gap: \'0.8rem\', cursor: \'pointer\', background: \'rgba(255,255,255,0.05)\', padding: \'1rem\', borderRadius: \'8px\', border: \'1px solid rgba(255,255,255,0.1)\' }}>',
        formatOptionsStr + '\n\n             <label style={{ display: \'flex\', alignItems: \'center\', gap: \'0.8rem\', cursor: \'pointer\', background: \'rgba(255,255,255,0.05)\', padding: \'1rem\', borderRadius: \'8px\', border: \'1px solid rgba(255,255,255,0.1)\' }}>'
    );
}

sm = sm.replace(/v19\.35/g, 'v19.36');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.93/g, 'v6.5.94');
fs.writeFileSync('src/app/page.tsx', page);
console.log('Fixed export settings and gap');
