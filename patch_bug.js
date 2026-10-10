const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

const targetStr = `                {isExpanded && logoMenuOpenId === space.id && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', padding: '0.5rem', zIndex: 20, minWidth: '130px', border: '1px solid var(--border-light)' }}>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); setTimeout(() => document.getElementById(\`logo-camera-\${space.id}\`)?.click(), 50); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold' }}>
                      <span>📷</span> צלם לוגו
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); setTimeout(() => document.getElementById(\`logo-gallery-\${space.id}\`)?.click(), 50); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold', marginTop: '4px' }}>
                      <span>🖼️</span> ייבא תמונה
                    </button>
                  </div>
                )}
                {isExpanded && (
                  <>
                    <input 
                      type="file" 
                      id={\`logo-camera-\${space.id}\`} 
                      accept="image/*" 
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (file) {
                            const base64 = await resizeAndCompressImage(file);
                            updateSpaceLogo(space.id, base64);
                          }
                        } catch (err) { console.error(err); }
                      }}
                    />
                    <input 
                      type="file" 
                      id={\`logo-gallery-\${space.id}\`} 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (file) {
                            const base64 = await resizeAndCompressImage(file);
                            updateSpaceLogo(space.id, base64);
                          }
                        } catch (err) { console.error(err); }
                      }}
                    />
                  </>
                )}`;

// We need to replace the exact current content.
// Since I don't want to mess up the indentation or exact match, I will use regex or string indexing.

const startMarker = `{isExpanded && logoMenuOpenId === space.id && (`
const endMarker = `</button>
                    
                    <input `;

let startIndex = tx.indexOf(startMarker);
if (startIndex !== -1) {
  // Let's replace manually
}
