const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/reports/page.tsx', 'utf8');

// 1. Add imports
tx = tx.replace("import { useSpaces } from '../../../context/SpacesContext';", "import { useSpaces } from '../../../context/SpacesContext';\nimport { useAuth } from '../../../context/AuthContext';\nimport { FinanceTransactions } from '../../../components/widgets/Finance/FinanceTransactions';");

// 2. Add states
tx = tx.replace("const [isZipping, setIsZipping] = useState(false);", "const [isZipping, setIsZipping] = useState(false);\n  const { user } = useAuth();\n  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>('all');\n  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);\n  const [showExportModal, setShowExportModal] = useState(false);\n  const [exportFilename, setExportFilename] = useState('');\n  const [exportConvertToPdf, setExportConvertToPdf] = useState(true);");

// 3. Make Total Expenses sticky
tx = tx.replace(/<div className="card glass-panel" style={{ padding: '1\.5rem', background: 'var\(--bg-card\)' }}>\r?\n\s+<h3 style={{ margin: '0 0 1rem 0', color: 'var\(--text-secondary\)' }}>סך כל ההוצאות בפרויקט<\/h3>/, `<div className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', position: 'sticky', top: '75px', zIndex: 50, border: '2px solid var(--primary)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>סך כל ההוצאות בפרויקט</h3>`);

// 4. Update handleExportZIP for the custom modal
tx = tx.replace(/  const handleExportZIP = async \(\) => \{[\s\S]*?    setIsZipping\(true\);/, `  const handleExportZIP = async () => {
    const invoicesWithFiles = invoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    if (invoicesWithFiles.length === 0) {
      alert('אין חשבוניות עם מסמכים מצורפים להורדה.');
      return;
    }
    setExportFilename(space.title || 'MySpace');
    setShowExportModal(true);
  };

  const executeExportZIP = async () => {
    setShowExportModal(false);
    const invoicesWithFiles = invoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    const userFilename = exportFilename || 'MySpace';
    const convertToPdf = exportConvertToPdf;
    setIsZipping(true);`);
    
// 5. Update the loop inside executeExportZIP (we already have a patch for this, but I'll write it completely)
tx = tx.replace(/          let extension = 'jpg';\r?\n\s+if \(blob\.type === 'application\/pdf' \|\| inv\.attachmentUrl\?\.includes\('\.pdf'\)\) extension = 'pdf';\r?\n\s+else if \(blob\.type === 'image\/png' \|\| inv\.attachmentUrl\?\.includes\('\.png'\)\) extension = 'png';/g, `          let extension = 'jpg';
          if (blob.type === 'application/pdf' || inv.attachmentUrl?.includes('.pdf')) {
            extension = 'pdf';
          } else if (convertToPdf && (blob.type.includes('image') || inv.attachmentUrl?.match(/\\.(jpg|jpeg|png)$/i))) {
             try {
                 const { jsPDF } = (await import('jspdf')).default ? await import('jspdf') : { jsPDF: (await import('jspdf')).jsPDF };
                 const Doc = jsPDF || (await import('jspdf')).default;
                 const img = new Image();
                 img.src = URL.createObjectURL(blob);
                 await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
                 
                 const orientation = img.width > img.height ? 'l' : 'p';
                 const pdf = new Doc({ orientation, unit: 'px', format: [img.width, img.height] });
                 pdf.addImage(img, 'JPEG', 0, 0, img.width, img.height);
                 blob = pdf.output('blob');
                 extension = 'pdf';
             } catch (err) {
                 console.error('Failed to convert image to PDF', err);
                 if (blob.type === 'image/png' || inv.attachmentUrl?.includes('.png')) extension = 'png';
             }
          } else if (blob.type === 'image/png' || inv.attachmentUrl?.includes('.png')) {
            extension = 'png';
          }`);
          
// 6. Replace the table with FinanceTransactions
const tableStartIdx = tx.indexOf('{/* Table Row */}');
const previewIdx = tx.indexOf('{/* Full Screen Image Preview Modal */}');

if (tableStartIdx !== -1 && previewIdx !== -1) {
  const newTableCode = `{/* Table Row via FinanceTransactions Component */}
      <div className="card glass-panel" style={{ background: 'var(--bg-card)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', padding: '1.5rem 1.5rem 0', color: 'var(--text-primary)' }}>טבלת הוצאות מפורטת</h3>
        
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <FinanceTransactions 
            invoices={invoices}
            filteredInvoices={invoices}
            activePartnersCount={0}
            user={user}
            space={space}
            filter={filter}
            setFilter={setFilter}
            expandedInvoiceId={expandedInvoiceId}
            setExpandedInvoiceId={setExpandedInvoiceId}
            setPreviewImage={setPreviewImage}
          />
        </div>
      </div>\n\n      `;
  tx = tx.substring(0, tableStartIdx) + newTableCode + tx.substring(previewIdx);
}

// 7. Inject Custom Modal at the very end
const modalJsx = `
      {/* Custom ZIP Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card glass-panel" style={{ background: 'var(--bg-main)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>ייצוא קבצים (ZIP)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם קובץ ה-ZIP:</label>
                <input type="text" value={exportFilename} onChange={e => setExportFilename(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>פורמט הקבצים:</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setExportConvertToPdf(true)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: exportConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: exportConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}>📄 PDF</button>
                  <button onClick={() => setExportConvertToPdf(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: !exportConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: !exportConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}>🖼️ מקור</button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {exportConvertToPdf ? 'כל החשבוניות יומרו ויסודרו כקובצי PDF נקיים (מומלץ לרואה חשבון).' : 'החשבוניות יישמרו בפורמט המקורי שלהן (קובצי JPEG או PDF).'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setShowExportModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>ביטול</button>
                <button onClick={executeExportZIP} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>הורד עכשיו 📦</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
`;
tx = tx.replace(/    <\/div>\r?\n  \);\r?\n\}\r?\n$/g, modalJsx);

fs.writeFileSync('src/app/space/[id]/reports/page.tsx', tx);
