const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

const injectionFunction = `
  const handleShareInvoice = async (inv: any) => {
    if (!inv.attachmentUrl) {
      alert('אין קובץ מצורף לשתף.');
      return;
    }
    try {
      const response = await fetch(inv.attachmentUrl);
      const blob = await response.blob();
      let fileToShare: File;
      
      if (blob.type === 'application/pdf' || inv.attachmentUrl.includes('.pdf')) {
        fileToShare = new File([blob], \`invoice_\${inv.supplier || 'general'}.pdf\`, { type: 'application/pdf' });
      } else {
        // Convert to PDF on the fly!
        const { jsPDF } = (await import('jspdf')).default ? await import('jspdf') : { jsPDF: (await import('jspdf')).jsPDF };
        const Doc = jsPDF || (await import('jspdf')).default;
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const orientation = img.width > img.height ? 'l' : 'p';
        const pdf = new Doc({ orientation, unit: 'px', format: [img.width, img.height] });
        pdf.addImage(img, 'JPEG', 0, 0, img.width, img.height);
        const pdfBlob = pdf.output('blob');
        fileToShare = new File([pdfBlob], \`invoice_\${inv.supplier || 'general'}.pdf\`, { type: 'application/pdf' });
      }

      if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          files: [fileToShare],
          title: 'שיתוף חשבונית',
          text: \`חשבונית מאת \${inv.supplier || 'ספק'} ע"ס ₪\${inv.amount}\`
        });
      } else {
        // Fallback to download
        const { saveAs } = await import('file-saver');
        saveAs(fileToShare);
      }
    } catch (e) {
      console.error('Share failed', e);
      alert('אירעה שגיאה בשיתוף החשבונית.');
    }
  };

  const getPendingApproversText = (inv: any) => {`;

tx = tx.replace(/  const getPendingApproversText = \(inv: any\) => \{/g, injectionFunction);

const injectionButton = `                    <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>חשבונית / קבלה סרוקה:</p>
                          <button onClick={() => handleShareInvoice(inv)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            📤 שתף (PDF)
                          </button>
                        </div>
                        <div 
                          onClick={() => {`;

tx = tx.replace(/                    <div style=\{\{ flex: '1 1 200px', maxWidth: '300px' \}\}>\r?\n\s+<p style=\{\{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold' \}\}>חשבונית \/ קבלה סרוקה:<\/p>\r?\n\s+<div \r?\n\s+onClick=\{\(\) => \{/m, injectionButton);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', tx);
