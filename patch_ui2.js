const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Remove the large buttons section
const buttonsStart = `                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', marginTop: '0.5rem' }}>`;
const buttonsEnd = `                      reader.readAsDataURL(file);
                    }
                  }}
                />`;

const idxStart = tx.indexOf(buttonsStart);
const idxEnd = tx.indexOf(buttonsEnd, idxStart) + buttonsEnd.length;

if (idxStart !== -1 && idxEnd > idxStart) {
    tx = tx.slice(0, idxStart) + tx.slice(idxEnd);
}

// 2. Replace the icon div
const iconTarget = `<div 
                style={{ 
                  fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  width: '48px', height: '48px', 
                  background: space.logoUrl ? 'transparent' : 'var(--bg-body)', 
                  borderRadius: '16px', overflow: 'hidden', position: 'relative',
                  boxShadow: space.logoUrl ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  flexShrink: 0
                }}
              >
                {space.logoUrl ? (
                  <img src={space.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  space.icon
                )}
              </div>`;

const newIcon = `<div style={{ position: 'relative' }}>
                <div 
                  style={{ 
                    fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    width: '48px', height: '48px', 
                    background: space.logoUrl ? 'transparent' : 'var(--bg-body)', 
                    borderRadius: '16px', overflow: 'hidden', position: 'relative',
                    boxShadow: space.logoUrl ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    flexShrink: 0
                  }}
                >
                  {space.logoUrl ? (
                    <img src={space.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    space.icon
                  )}
                </div>
                {isExpanded && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(logoMenuOpenId === space.id ? null : space.id); }}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: '2px solid var(--bg-main)', zIndex: 10 }}
                  >
                    ✏️
                  </div>
                )}
                {isExpanded && logoMenuOpenId === space.id && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', padding: '0.5rem', zIndex: 20, minWidth: '130px', border: '1px solid var(--border-light)' }}>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); document.getElementById(\`logo-camera-\${space.id}\`)?.click(); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold' }}>
                      <span>📷</span> צלם לוגו
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); document.getElementById(\`logo-gallery-\${space.id}\`)?.click(); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold', marginTop: '4px' }}>
                      <span>🖼️</span> ייבא תמונה
                    </button>
                    
                    <input 
                      type="file" 
                      id={\`logo-camera-\${space.id}\`} 
                      accept="image/*" 
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await resizeAndCompressImage(file);
                          updateSpaceLogo(space.id, base64);
                        }
                      }}
                    />
                    <input 
                      type="file" 
                      id={\`logo-gallery-\${space.id}\`} 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await resizeAndCompressImage(file);
                          updateSpaceLogo(space.id, base64);
                        }
                      }}
                    />
                  </div>
                )}
              </div>`;

tx = tx.replace(iconTarget, newIcon);

fs.writeFileSync('src/app/page.tsx', tx);
console.log('UI patch applied');
