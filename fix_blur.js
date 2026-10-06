const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Fix getFinalCompressedUrl (disable smoothing, use 0.90 quality)
scanner = scanner.replace(
  /ctx\.imageSmoothingEnabled = true; ctx\.imageSmoothingQuality = 'high';\s+ctx\.drawImage\(img, 0, 0\);\s+res\(compressCanvas\(canvas, 0\.82\)\);/g,
  `ctx.imageSmoothingEnabled = false; // MUST BE FALSE for 1:1 copies to prevent edge blurring on text!
         ctx.drawImage(img, 0, 0);
         res(compressCanvas(canvas, 0.90)); // Increase to 0.90 for high-contrast crisp text`
);

// 2. Remove scroll_pdf option from the UI
let uiToRemoveRegex = /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.8rem', background: 'rgba\(255,255,255,0\.05\)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba\(255,255,255,0\.1\)' \}\}>\s+<div style=\{\{ fontSize: '0\.9rem', color: '#94a3b8', marginBottom: '0\.3rem', fontWeight: 'bold' \}\}>פורמט פלט:<\/div>\s+<label style=\{\{ display: 'flex', alignItems: 'center', gap: '0\.8rem', cursor: 'pointer' \}\}>\s+<input type="radio" checked=\{exportFormat === 'pdf'\} onChange=\{\(\) => setExportFormat\('pdf'\)\} style=\{\{ width: '22px', height: '22px', accentColor: '#10b981' \}\} \/>\s+<span style=\{\{ fontSize: '1rem' \}\}>PDF \(דפים נפרדים - ערמת קלפים\)<\/span>\s+<\/label>\s+<label style=\{\{ display: 'flex', alignItems: 'center', gap: '0\.8rem', cursor: 'pointer' \}\}>\s+<input type="radio" checked=\{exportFormat === 'scroll_pdf'\} onChange=\{\(\) => setExportFormat\('scroll_pdf'\)\} style=\{\{ width: '22px', height: '22px', accentColor: '#10b981' \}\} \/>\s+<span style=\{\{ fontSize: '1rem' \}\}>PDF כמגילה \(עמוד אחד ארוך\)<\/span>\s+<\/label>\s+<\/div>/g;

scanner = scanner.replace(uiToRemoveRegex, '');

// Also force exportFormat to be 'pdf'
scanner = scanner.replace(/const \[exportFormat, setExportFormat\] = useState<'pdf' \| 'scroll_pdf'>\('scroll_pdf'\);/g, "const [exportFormat, setExportFormat] = useState<'pdf' | 'scroll_pdf'>('pdf');");
scanner = scanner.replace(/const \[exportFormat, setExportFormat\] = useState<'pdf' \| 'scroll_pdf'>\('pdf'\);/g, "const [exportFormat, setExportFormat] = useState<'pdf' | 'scroll_pdf'>('pdf');");

// 3. Update pending items batch-crop fallback to use 0.90
scanner = scanner.replace(/const data = compressCanvas\(processedCanvas, 0\.82\);/g, 'const data = compressCanvas(processedCanvas, 0.90);');
scanner = scanner.replace(/const data = compressCanvas\(canvas, 0\.82\);/g, 'const data = compressCanvas(canvas, 0.90);');

// Update unedited logic fallback
scanner = scanner.replace(/let finalData = compressCanvas\(canvas, 0\.82\);/g, 'let finalData = compressCanvas(canvas, 0.90);');
scanner = scanner.replace(/finalData = compressCanvas\(processedCanvas, 0\.82\);/g, 'finalData = compressCanvas(processedCanvas, 0.90);');


// 4. Update versions
scanner = scanner.replace(/v19\.15/g, 'v19.16');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.73/g, 'v6.5.74');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Fixed image smoothing blur and removed scroll_pdf UI!");
