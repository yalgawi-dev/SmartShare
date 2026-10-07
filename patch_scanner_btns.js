const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Replace cropping buttons
const oldCropBtns = `<button onClick={pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg')) ? handleSkipCrop : handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              {(pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) ? 'בטל עריכה' : 'צלם שוב'}
            </button>`;
const newCropBtns = `<button onClick={() => handleDeleteActive()} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
              <span style={{ fontSize: '1.2rem' }}>🗑️</span>
              מחק עמוד
            </button>`;

content = content.replace(oldCropBtns, newCropBtns);

// Replace review step delete button
const oldReviewBtn = `<button onClick={() => { if (pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) { handleDeleteActive(); } else { handleRetake(); } }} style={{ flex: 1, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>🗑️</span>
                  {(pendingImports.length > 0 || (rawSnapshot && !rawSnapshot.startsWith('data:image/jpeg'))) ? 'מחק עמוד' : 'צלם שוב'}
                </button>`;
const newReviewBtn = `<button onClick={() => handleDeleteActive()} style={{ flex: 1, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem' }}>🗑️</span>
                  מחק עמוד
                </button>`;

content = content.replace(oldReviewBtn, newReviewBtn);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', content);
