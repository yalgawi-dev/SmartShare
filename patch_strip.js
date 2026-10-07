const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const strip = `            {/* Pages thumbnail strip */}
            {scannedPages.length > 0 && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, background: 'rgba(0,0,0,0.7)', padding: '0.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                {scannedPages.map((page) => (
                  <div key={page.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={page.imageUrl} style={{ width: '50px', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #FFD700' }} alt={\`עמוד \${page.pageNum}\`} />
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>{page.pageNum}</span>
                    <button onClick={() => setScannedPages(prev => prev.filter(p => p.id !== page.id).map((p,i) => ({...p, pageNum: i+1})))}
                      style={{ position: 'absolute', top: '-6px', left: '-6px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', color: '#FFD700', fontSize: '0.8rem', fontWeight: 'bold', padding: '0 0.5rem' }}>
                  עמוד {scannedPages.length + 1} →
                </div>
              </div>
            )}`;

content = content.replace(strip, "");
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
