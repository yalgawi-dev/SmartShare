const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

content = content.replace("import ScannerModal from '../ScannerModal';", "import ScannerModal from '../ScannerModal';\nimport { isDuplicateInvoice } from '../../../utils/duplicateCheck';");

const stateToInsert = `  const [retroScanWarning, setRetroScanWarning] = useState<any>(null);\n`;
content = content.replace("const [retroScanInvoice, setRetroScanInvoice] = useState<any>(null);", "const [retroScanInvoice, setRetroScanInvoice] = useState<any>(null);\n" + stateToInsert);

const newHandleRetro = `  const handleRetroScanComplete = async (url: string, singleImg?: string, allPages?: string[]) => {
    const inv = retroScanInvoice;
    setRetroScanInvoice(null);
    if (!inv || !space) return;
    setUploadingRetroId(inv.id);
    try {
      const { uploadImageToStorage } = await import('../../../lib/firebase');
      const { compressToBudget } = await import('../../../utils/imageOptimizer');
      const isMulti = !!allPages && allPages.length > 1;
      const dataUrl = isMulti || !singleImg ? url : await compressToBudget(singleImg);
      const isPdf = dataUrl.startsWith('data:application/pdf');
      const filename = \`invoices/\${space.id}/retro_\${Date.now()}.\${isPdf ? 'pdf' : 'jpg'}\`;
      const finalUrl = await uploadImageToStorage(dataUrl, filename);

      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
      });
      
      let ocrAmt = 0;
      let isDup = false;
      let dupMsg = '';
      
      if (ocrRes.ok) {
        const ocrData = await ocrRes.json();
        if (ocrData && ocrData.data) {
          ocrAmt = Number(ocrData.data.amount) || 0;
          const exists = finallyFiltered.find((e: any) => e.id !== inv.id && isDuplicateInvoice(e, ocrData.data));
          if (exists) {
            isDup = true;
            dupMsg = \`נראה שחשבונית זו הועלתה כבר בעבר (₪\${exists.amount}).\`;
          }
        }
      }

      const currentAmt = Number(inv.amount || 0);
      const isMismatch = ocrAmt > 0 && Math.abs(ocrAmt - currentAmt) > 0.05;

      if (isDup || isMismatch) {
        setRetroScanWarning({
          invId: inv.id,
          finalUrl,
          ocrAmount: ocrAmt,
          isDuplicate: isDup,
          duplicateMsg: dupMsg,
          currentAmount: currentAmt
        });
        setUploadingRetroId(null);
        return;
      }

      updateInvoice?.(space.id, inv.id, { attachmentUrl: finalUrl, hasAttachment: true }, user?.id, 'retroactive_attachment');
    } catch (error) {
      console.error("Failed to upload retroactive attachment", error);
      alert("שגיאה בהעלאת הקובץ.");
    } finally {
      setUploadingRetroId(null);
    }
  };`;

const startIndex = content.indexOf('const handleRetroScanComplete = async (url: string');
const endIndex = content.indexOf('const showIncome = space?.features?.includes(\'income\');');
content = content.substring(0, startIndex) + newHandleRetro + '\n\n  ' + content.substring(endIndex);

const modalCode = `      {retroScanWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>⚠️</span> סריקה דורשת תשומת לב</h3>
            
            {retroScanWarning.isDuplicate && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong>חשד לכפילות:</strong><br/>
                {retroScanWarning.duplicateMsg}
              </div>
            )}

            {retroScanWarning.ocrAmount > 0 && retroScanWarning.ocrAmount !== retroScanWarning.currentAmount && (
              <div style={{ background: '#fffbeb', color: '#b45309', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong>אי התאמה בסכום:</strong><br/>
                הזנת ידנית סכום של ₪{retroScanWarning.currentAmount}, אך בסריקה זוהה סכום של ₪{retroScanWarning.ocrAmount}.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {retroScanWarning.ocrAmount > 0 && retroScanWarning.ocrAmount !== retroScanWarning.currentAmount && (
                <button onClick={() => {
                  updateInvoice?.(space.id, retroScanWarning.invId, { 
                    attachmentUrl: retroScanWarning.finalUrl, 
                    hasAttachment: true,
                    amount: retroScanWarning.ocrAmount 
                  }, user?.id, 'retroactive_attachment_and_fix');
                  setRetroScanWarning(null);
                }} style={{ padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  עדכן סכום ל-₪{retroScanWarning.ocrAmount} וצרף
                </button>
              )}
              
              <button onClick={() => {
                  updateInvoice?.(space.id, retroScanWarning.invId, { 
                    attachmentUrl: retroScanWarning.finalUrl, 
                    hasAttachment: true 
                  }, user?.id, 'retroactive_attachment');
                  setRetroScanWarning(null);
              }} style={{ padding: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                התעלם וצרף חשבונית בכל זאת
              </button>

              <button onClick={() => {
                  setRetroScanWarning(null);
              }} style={{ padding: '0.75rem', background: 'transparent', color: '#ef4444', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>
                בטל פעולה (אל תצרף)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

content = content.replace("    </div>\n  );\n}", modalCode);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', content);
