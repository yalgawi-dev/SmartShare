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

tx = tx.replace(/const \[batchQueue, setBatchQueue\] = useState<string\[\]>\(\[\]\);/, `const [batchQueue, setBatchQueue] = useState<string[]>([]);\n${helperStr}`);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', tx);
