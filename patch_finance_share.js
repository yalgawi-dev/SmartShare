const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

const helperStr = `
const shareDocument = async (url: string, title: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
    const ext = isPdf ? 'pdf' : 'jpg';
    const mime = isPdf ? 'application/pdf' : 'image/jpeg';
    const file = new File([blob], \`\${title || 'document'}.\${ext}\`, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || 'מסמך' });
    } else {
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = \`\${title || 'document'}.\${ext}\`;
      a.click();
      URL.revokeObjectURL(objUrl);
    }
  } catch (e) {
    console.error('Error sharing', e);
    alert('שגיאה בשיתוף מסמך');
  }
};
`;
tx = tx.replace('const handleProcessBatch', helperStr + '\n  const handleProcessBatch');

const imgRegex = /<img src=\{previewImage\} style=\{\{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' \}\} \/>/;
tx = tx.replace(imgRegex, `<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', width: '100%' }}>
                    <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '80%', objectFit: 'contain', margin: 'auto' }} />
                    <button onClick={(e) => { e.stopPropagation(); shareDocument(previewImage, 'חשבונית_סרוקה'); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 20002 }}>
                      <span>שתף מסמך 📤</span>
                    </button>
                  </div>`);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', tx);
