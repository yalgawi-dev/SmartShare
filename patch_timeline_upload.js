const fs = require('fs');

let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

const uploadBtn = `
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('smartshare:trigger_file_upload'));
                    }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                      <span style={{ fontSize: '1.2rem' }}>📤</span> העלה מסמך חדש
                    </button>
                  </div>
`;

// Insert the upload button just above the grid of documents
tx = tx.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(3, 1fr\)', gap: '0\.5rem'/g, uploadBtn + "\n                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem'");

// Also replace the empty text
const oldEmptyText = `המחסן ריק.<br />אנא הוסף מסמכים למדף קודם (באמצעות כפתור המצלמה הכחול).`;
const newEmptyText = `המחסן ריק. לחץ על הכפתור למעלה כדי להעלות מסמכים.`;
tx = tx.replace(oldEmptyText, newEmptyText);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
