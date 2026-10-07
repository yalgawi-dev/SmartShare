const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

content = content.replace(
  "                           } else if (item.type === 'pending') {\n                              saveCurrentStateToTrays();",
  "                           } else if (item.type === 'pending') {\n                              saveCurrentStateToTrays();"
);

let replacement = `                       onItemDelete={(item) => {
                           if (item.type === 'scanned') {
                               setScannedPages(prev => prev.filter(p => p.id !== item.id));
                           } else if (item.type === 'pending') {
                               setPendingImports(prev => prev.filter(p => p.id !== item.id));
                           } else if (item.type === 'active') {
                               setRawSnapshot(null);
                               setActiveDocId(generateDocId());
                               if (step !== 'scanning') setStep('scanning');
                           }
                           setTrayOrder(prev => prev.filter(id => id !== item.id));
                       }}
                    />`;

content = content.replace(
  "                        }}\n                    />",
  "                        }}\n" + replacement
);

// Now for the "Import more" button in Multiple Import Mode:
let multipleImportModeOld = `                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '80%', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                    ישנם <b>{pendingImports.length}</b> מסמכים ממתינים בתור.<br/><br/>
                    בחר מסמך במגש ה"לא ערוכים" למטה כדי לחתוך אותו, או לחץ על הכפתור "אשר הכל" ⏩.
                  </p>
               </div>`;

let multipleImportModeNew = `                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '80%', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                    ישנם <b>{pendingImports.length}</b> מסמכים ממתינים בתור.<br/><br/>
                    בחר מסמך במגש ה"לא ערוכים" למטה כדי לחתוך אותו, או לחץ על הכפתור "אשר הכל" ⏩.
                  </p>
                  <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                    <button onClick={() => galleryInputRef.current?.click()} style={{ padding: '0.8rem 1.5rem', background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>➕</span> ייבא תמונות נוספות
                    </button>
                  </div>
               </div>`;

content = content.replace(multipleImportModeOld, multipleImportModeNew);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
