const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

const target = `<div style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--bg-body)', borderRadius: '12px' }}>
                {space.icon}
              </div>`;

const replacement = `<div 
                onClick={(e) => {
                  if (isExpanded) {
                    e.stopPropagation();
                    document.getElementById(\`logo-upload-\${space.id}\`)?.click();
                  }
                }}
                style={{ 
                  fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  width: '48px', height: '48px', 
                  background: space.logoUrl ? 'transparent' : 'var(--bg-body)', 
                  borderRadius: '16px', overflow: 'hidden', position: 'relative',
                  cursor: isExpanded ? 'pointer' : 'inherit',
                  boxShadow: space.logoUrl ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  flexShrink: 0
                }}
              >
                {space.logoUrl ? (
                  <img src={space.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  space.icon
                )}
                {isExpanded && (
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                    <span style={{ fontSize: '10px' }}>📷</span>
                  </div>
                )}
              </div>
              {isExpanded && (
                <input 
                  type="file" 
                  id={\`logo-upload-\${space.id}\`} 
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        updateSpaceLogo(space.id, ev.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              )}`;

tx = tx.replace(target, replacement);

fs.writeFileSync('src/app/page.tsx', tx);
console.log('page.tsx patched');
