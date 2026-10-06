const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// In handleShare, we only apply getFinalCompressedUrl if we are generating a PDF (which means length > 1 usually, but wait, exportOptions handles PDF generation)
// Actually, let's keep it simple: 
// The user's point is brilliant. I will modify the explanation but make the patch.

// Find the loop in handleShare:
const oldLoop = `    for (const item of sortedTrayItems) {
      if (item.type === 'scanned' || item.type === 'active') {
        const compressed = await getFinalCompressedUrl(item.url);
        allPageUrls.push(compressed);
      } else if (item.type === 'pending') {`;

const newLoop = `    // If we only have 1 item and we are sharing as an image, giving 100% to WhatsApp avoids double compression!
    // But if we have multiple items, we will generate a PDF, which WhatsApp/Email DO NOT compress, so we MUST compress to 0.82!
    const needsCompression = sortedTrayItems.length > 1;

    for (const item of sortedTrayItems) {
      if (item.type === 'scanned' || item.type === 'active') {
        const urlToUse = needsCompression ? await getFinalCompressedUrl(item.url) : item.url;
        allPageUrls.push(urlToUse);
      } else if (item.type === 'pending') {`;

code = code.replaceAll(oldLoop, newLoop);
code = code.replace(/v19\.7/g, 'v19.8');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched handleShare for WhatsApp double-compression avoidance!");
