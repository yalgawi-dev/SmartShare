const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/reports/page.tsx', 'utf8');

const replacement = `
    const defaultName = space.title || 'MySpace';
    const userFilename = window.prompt('בחר שם לקובץ ה-ZIP:', defaultName);
    if (!userFilename) {
      return; // User cancelled
    }
    
    const convertToPdf = window.confirm("האם תרצה להמיר את כל תמונות החשבוניות לקבצי PDF בתוך ה-ZIP?\\n\\n- אישור (OK): כל התמונות יומרו ל-PDF מסודר.\\n- ביטול (Cancel): התמונות ישמרו בפורמט התמונה המקורי (JPEG).");

    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      const folder = zip.folder(userFilename);

      let count = 1;
      for (const inv of invoicesWithFiles) {
        try {
          const response = await fetch(inv.attachmentUrl!);
          let blob = await response.blob();
          
          let extension = 'jpg';
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
          }
`;

tx = tx.replace(/    const defaultName = space\.title \|\| 'MySpace';[\s\S]*?          else if \(blob\.type === 'image\/png' \|\| inv\.attachmentUrl\?\.includes\('\.png'\)\) extension = 'png';/m, replacement.trim());

fs.writeFileSync('src/app/space/[id]/reports/page.tsx', tx);
