const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const [previewIndex, setPreviewIndex]')) {
  content = content.replace("const [previewPage, setPreviewPage] = useState<ScannedPage | null>(null);", "const [previewIndex, setPreviewIndex] = useState<number | null>(null);\n  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);");
}

// Update the main image viewer in review mode
const mainImgRegex = /\{step === 'review' && \(\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' \}\}>\s*<div style=\{\{ flex: 1, position: 'relative', overflow: 'hidden' \}\}>\s*<TransformWrapper initialScale=\{1\} minScale=\{1\} maxScale=\{5\} centerOnInit=\{true\}>\s*<TransformComponent>\s*<img src=\{imageCache\[mode\]\} alt="Cropped" style=\{\{ width: '100%', height: '100%', objectFit: 'contain' \}\} \/>/;
const newMainImg = `{step === 'review' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
              <TransformComponent>
                <img src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} alt="Cropped" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />`;
content = content.replace(mainImgRegex, newMainImg);


// Replace the review thumbnail strip with DnD support and click to preview
const stripRegex = /\{scannedPages\.length > 0 && \(\s*<div style=\{\{ display: 'flex', gap: '0\.5rem', overflowX: 'auto', paddingBottom: '0\.25rem' \}\}>\s*\{scannedPages\.map\(\(page\) => \([\s\S]*?\{scannedPages\.length \+ 1\} \(\?\? \?>\?-\?T\)\s*<\/div>\s*<\/div>\s*\)\}/;

const newStrip = `{scannedPages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {scannedPages.map((page, idx) => (
                  <div 
                    key={page.id} 
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null || draggedIndex === idx) return;
                      const newPages = [...scannedPages];
                      const [draggedItem] = newPages.splice(draggedIndex, 1);
                      newPages.splice(idx, 0, draggedItem);
                      const renumbered = newPages.map((p, i) => ({...p, pageNum: i + 1}));
                      setScannedPages(renumbered);
                      setDraggedIndex(null);
                      if (previewIndex === draggedIndex) setPreviewIndex(idx);
                      else if (previewIndex !== null) setPreviewIndex(null);
                    }}
                    onClick={() => setPreviewIndex(idx)}
                    style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', border: previewIndex === idx ? '2px solid #10b981' : 'none', borderRadius: '4px' }}
                  >
                    <img src={page.imageUrl} style={{ width: '44px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: previewIndex === idx ? 'none' : '2px solid #FFD700', opacity: previewIndex === idx ? 1 : 0.8 }} alt={\`עמוד \${page.pageNum}\`} />
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.8)', color: '#FFD700', fontSize: '0.6rem', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold' }}>{page.pageNum}</span>
                  </div>
                ))}
                <div 
                  onClick={() => setPreviewIndex(null)}
                  style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: previewIndex === null ? 'rgba(16,185,129,0.2)' : 'rgba(255,215,0,0.1)', border: previewIndex === null ? '2px solid #10b981' : '1px solid #FFD700', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: previewIndex === null ? '#10b981' : '#FFD700', cursor: 'pointer' }}
                >
                  עמוד {scannedPages.length + 1} (הנוכחי)
                </div>
              </div>
            )}`;

content = content.replace(stripRegex, newStrip);
fs.writeFileSync(file, content, 'utf8');
console.log('patched thumbnails');
