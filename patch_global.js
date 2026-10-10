const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Add activeLogoSpaceIdRef
if (!tx.includes('activeLogoSpaceIdRef')) {
  tx = tx.replace(
    'const [logoMenuOpenId, setLogoMenuOpenId] = useState<string | null>(null);',
    'const [logoMenuOpenId, setLogoMenuOpenId] = useState<string | null>(null);\n  const activeLogoSpaceIdRef = useRef<string | null>(null);'
  );
}

// 2. Remove the old inputs block
// We need to carefully remove the `<div style={{ display: 'none' }}> ... </div>` that holds the inputs.
// It starts with `{isExpanded && (` and ends with `</div>\n                )}`
// Let's replace the button clicks first, then remove the whole div.

// Button 1 (Camera)
tx = tx.replace(
  /setLogoMenuOpenId\(null\); setTimeout\(\(\) => document\.getElementById\(`logo-camera-\$\{space\.id\}`\)\?\.click\(\), 50\);/g,
  "setLogoMenuOpenId(null); activeLogoSpaceIdRef.current = space.id; setTimeout(() => document.getElementById('global-logo-camera')?.click(), 50);"
);

// Button 2 (Gallery)
tx = tx.replace(
  /setLogoMenuOpenId\(null\); setTimeout\(\(\) => document\.getElementById\(`logo-gallery-\$\{space\.id\}`\)\?\.click\(\), 50\);/g,
  "setLogoMenuOpenId(null); activeLogoSpaceIdRef.current = space.id; setTimeout(() => document.getElementById('global-logo-gallery')?.click(), 50);"
);

// 3. Remove the inline inputs completely
// It looks like:
/*
                {isExpanded && (
                  <div style={{ display: 'none' }}>
                    <input type="file" id={`logo-camera-${space.id}`} ... />
                    <input type="file" id={`logo-gallery-${space.id}`} ... />
                  </div>
                )}
*/
// I will just use regex to remove that block.
tx = tx.replace(/\{\s*isExpanded\s*&&\s*\(\s*<div style=\{\{\s*display:\s*'none'\s*\}\}>\s*<input[\s\S]*?<\/div>\s*\)\}/g, '');

// 4. Add the global inputs at the bottom
const globalInputs = `
      {/* Global hidden inputs for Logo Upload */}
      <div style={{ display: 'none' }}>
        <input 
          type="file" 
          id="global-logo-camera" 
          accept="image/*" 
          capture="environment"
          onChange={async (e) => {
            const spaceId = activeLogoSpaceIdRef.current;
            if (!spaceId) return;
            try {
              const file = e.target.files?.[0];
              if (file) {
                const tempUrl = URL.createObjectURL(file);
                updateSpaceLogo(spaceId, tempUrl);
                const base64 = await compressImage(file, 256, 256, 0.85, 'image/png');
                updateSpaceLogo(spaceId, base64);
                try {
                  const storageUrl = await uploadImageToStorage(base64, \`spaces/covers/logo_\${spaceId}_\${Date.now()}.png\`);
                  updateSpaceLogo(spaceId, storageUrl);
                } catch(uploadErr) {
                  console.warn("Storage fail", uploadErr);
                }
              }
            } catch(err) { 
              console.error(err); 
              alert("שגיאה בהעלאה: " + String(err));
            }
            e.target.value = ''; // Reset input
          }}
        />
        <input 
          type="file" 
          id="global-logo-gallery" 
          accept="image/*" 
          onChange={async (e) => {
            const spaceId = activeLogoSpaceIdRef.current;
            if (!spaceId) return;
            try {
              const file = e.target.files?.[0];
              if (file) {
                const tempUrl = URL.createObjectURL(file);
                updateSpaceLogo(spaceId, tempUrl);
                const base64 = await compressImage(file, 256, 256, 0.85, 'image/png');
                updateSpaceLogo(spaceId, base64);
                try {
                  const storageUrl = await uploadImageToStorage(base64, \`spaces/covers/logo_\${spaceId}_\${Date.now()}.png\`);
                  updateSpaceLogo(spaceId, storageUrl);
                } catch(uploadErr) {
                  console.warn("Storage fail", uploadErr);
                }
              }
            } catch(err) { 
              console.error(err); 
              alert("שגיאה בהעלאה: " + String(err));
            }
            e.target.value = ''; // Reset input
          }}
        />
      </div>
      {showAuthModal && (
`;

tx = tx.replace('{showAuthModal && (', globalInputs);

fs.writeFileSync('src/app/page.tsx', tx);
console.log('Patched global inputs!');
