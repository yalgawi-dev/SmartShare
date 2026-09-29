const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add previewIndex state
if (!content.includes('const [previewIndex, setPreviewIndex]')) {
  content = content.replace("const [previewPage, setPreviewPage] = useState<ScannedPage | null>(null);", "const [previewIndex, setPreviewIndex] = useState<number | null>(null);\n  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);");
}

// 2. Change the main preview img src to use previewIndex
const imgRegex = /<img src=\{imageCache\[mode\]\} alt="Cropped" style=\{\{ width: '100%', height: '100%', objectFit: 'contain' \}\} \/>/;
const newImg = `<img src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} alt="Cropped" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />`;
content = content.replace(imgRegex, newImg);

// 3. Add drag events to scannedPages map
const thumbnailRowRegex = /\{scannedPages\.map\(\(page\) => \(\s*<div key=\{page\.id\} style=\{\{ position: 'relative', flexShrink: 0 \}\}>[\s\S]*?<\/div>\s*\)\)\}/g;
// Note: there are two places where thumbnail row is rendered (one in 'scanning' header, one in 'review' footer). Let's replace both carefully, or just the one in 'review'.
// Wait, the user specifically mentioned "בתוסף של הסריקה ברגע שמצלמים מס תמונות הוא ממספר אותן ומציג אותן בתחתית ממוספרים" -> "in the bottom they are numbered".
// So it's the one in `step === 'review'`.
