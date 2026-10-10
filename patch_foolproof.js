const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

const oldOnChange = `onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (file) {
                            const base64 = await compressImage(file, 256, 256, 0.85, 'image/webp');
                            const storageUrl = await uploadImageToStorage(base64, \`spaces/covers/logo_\${space.id}_\${Date.now()}\`);
                            updateSpaceLogo(space.id, storageUrl);
                          }
                        } catch(err) { console.error(err); }
                      }}`;

const newOnChange = `onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (file) {
                            // 1. INSTANT OPTIMISTIC UI!
                            const tempUrl = URL.createObjectURL(file);
                            updateSpaceLogo(space.id, tempUrl);
                            
                            // 2. Compress (use PNG for 100% compat & transparency)
                            const base64 = await compressImage(file, 256, 256, 0.85, 'image/png');
                            
                            // 3. Fallback to base64 if Firebase Storage fails
                            updateSpaceLogo(space.id, base64);
                            
                            try {
                              const storageUrl = await uploadImageToStorage(base64, \`spaces/covers/logo_\${space.id}_\${Date.now()}.png\`);
                              updateSpaceLogo(space.id, storageUrl);
                            } catch(uploadErr) {
                              console.warn("Storage fail, keeping base64", uploadErr);
                            }
                          }
                        } catch(err) { 
                          console.error(err); 
                          alert("שגיאה בעיבוד התמונה: " + String(err));
                        }
                      }}`;

tx = tx.split(oldOnChange).join(newOnChange);

fs.writeFileSync('src/app/page.tsx', tx);
console.log('Patched onChange to be foolproof');
