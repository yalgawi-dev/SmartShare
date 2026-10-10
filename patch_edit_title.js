const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

// Replace prompt
const promptClickRegex = /onClick=\{\(\) => \{\s*if \(\!isRestricted\) \{\s*const newTitle = prompt\('ערוך שם למרחב:', space\.title\);\s*if \(newTitle && newTitle\.trim\(\)\) updateSpaceTitle\(id, newTitle\.trim\(\)\);\s*\}\s*\}\}/;

tx = tx.replace(promptClickRegex, `onClick={() => {
              if (!isRestricted) {
                setEditTitleValue(space.title);
                setEditingSpaceId(id);
              }
            }}`);

// Ensure editingSpaceId and editTitleValue exist
if (!tx.includes('setEditingSpaceId')) {
  // Add them if missing
  const stateRegex = /const \[showInviteModal, setShowInviteModal\] = useState\(false\);/;
  tx = tx.replace(stateRegex, `const [showInviteModal, setShowInviteModal] = useState(false);\n  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);\n  const [editTitleValue, setEditTitleValue] = useState('');`);
}

// Add Modal
const modalJSX = `
      {editingSpaceId && (
        <div onClick={() => setEditingSpaceId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '1rem', backdropFilter: 'blur(4px)' }}>
           <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-main)', borderRadius: '24px', padding: '1.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', textAlign: 'center' }}>ערוך שם למרחב</h3>
              <input 
                autoFocus
                type="text" 
                value={editTitleValue} 
                onChange={e => setEditTitleValue(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '1rem', fontSize: '1rem', textAlign: 'right' }} 
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setEditingSpaceId(null)} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-secondary)' }}>ביטול</button>
                <button onClick={() => { 
                  if (editTitleValue.trim()) {
                    updateSpaceTitle(id, editTitleValue.trim());
                    setEditingSpaceId(null);
                  }
                }} style={{ flex: 1, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>שמור שינויים</button>
              </div>
           </div>
        </div>
      )}
`;

const globalModalsRegex = /\{\/\* Global Modals \*\/\}/;
tx = tx.replace(globalModalsRegex, modalJSX + '\n      {/* Global Modals */}');

fs.writeFileSync('src/app/space/[id]/page.tsx', tx);
