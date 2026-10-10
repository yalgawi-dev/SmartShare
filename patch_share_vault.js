const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

// 1. Add share helper
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
tx = tx.replace('const handleRenameShelf', helperStr + '\n  const handleRenameShelf');

// 2. Add share button for PDF
tx = tx.replace(
  `<button onClick={(e) => { e.stopPropagation(); window.open(previewState.docs[previewState.index].url, '_blank'); }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', zIndex: 20002 }}>
                 פתח מסמך בחלון חדש
               </button>`,
  `<div style={{ display: 'flex', gap: '1rem', zIndex: 20002 }}>
                 <button onClick={(e) => { e.stopPropagation(); window.open(previewState.docs[previewState.index].url, '_blank'); }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span>הורדה / צפייה</span>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); shareDocument(previewState.docs[previewState.index].url, previewState.docs[previewState.index].title); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span>שתף 📤</span>
                 </button>
               </div>`
);

// 3. Add share button for Image
const imgRegex = /<img src=\{previewState\.docs\[previewState\.index\]\.url\} style=\{\{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'all 0\.3s' \}\} alt="Preview" \/>/;
tx = tx.replace(imgRegex, `<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
              <img src={previewState.docs[previewState.index].url} style={{ maxWidth: '100%', maxHeight: '80%', objectFit: 'contain', transition: 'all 0.3s' }} alt="Preview" />
              <button onClick={(e) => { e.stopPropagation(); shareDocument(previewState.docs[previewState.index].url, previewState.docs[previewState.index].title); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 20002 }}>
                   <span>שתף מסמך 📤</span>
              </button>
            </div>`);

fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', tx);
