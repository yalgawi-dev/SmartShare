const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/reports/page.tsx', 'utf8');

// Add states
tx = tx.replace("const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);", "const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);\n  const [showExportModal, setShowExportModal] = useState(false);\n  const [exportFilename, setExportFilename] = useState('');\n  const [exportConvertToPdf, setExportConvertToPdf] = useState(true);");

// Replace handleExportZIP body with setting states
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

// Inject Modal JSX at the end before </div>
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

tx = tx.replace(/    <\/div>\r?\n\s+<style jsx global>/g, "    </div>\n    <style jsx global>"); // just in case
tx = tx.replace(/    <\/div>\r?\n\s*\}\);\r?\n\s*\}\r?\n\s*$/g, modalJsx); // fallbacks
tx = tx.replace(/    <\/div>\r?\n  \);\r?\n\}\r?\n$/g, modalJsx);

fs.writeFileSync('src/app/space/[id]/reports/page.tsx', tx);
