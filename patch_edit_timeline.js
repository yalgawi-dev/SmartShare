const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

// 1. Add edit state
tx = tx.replace(
  "const [showAddModal, setShowAddModal] = useState(false);",
  "const [showAddModal, setShowAddModal] = useState(false);\n  const [editEventId, setEditEventId] = useState<string | null>(null);\n  const [editEventTitle, setEditEventTitle] = useState('');\n  const [editEventDesc, setEditEventDesc] = useState('');\n  const [editEventDate, setEditEventDate] = useState('');"
);

// 2. Add handleSaveEdit
const handleSaveEditCode = `
  const handleSaveEdit = () => {
    if (!editEventId || !editEventTitle.trim()) return alert('יש להזין כותרת');
    onUpdateEvent(editEventId, {
      title: editEventTitle.trim(),
      description: editEventDesc.trim(),
      eventDate: editEventDate
    });
    setEditEventId(null);
  };
`;
tx = tx.replace(
  "const handleAddEvent = () => {",
  handleSaveEditCode + "\n\n  const handleAddEvent = () => {"
);

// 3. Add Edit Button in the event header
// Search for: <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
const editBtn = `
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setEditEventId(event.id);
                          setEditEventTitle(event.title);
                          setEditEventDesc(event.description || '');
                          setEditEventDate(event.eventDate);
                        }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="ערוך תחנה">✏️</button>
`;
tx = tx.replace(
  /<div style=\{\{ display: 'flex', alignItems: 'center', gap: '0\.5rem' \}\}>/g,
  editBtn
);

// 4. Add the Edit Modal JSX
const editModalJsx = `
      {/* EDIT EVENT MODAL */}
      {editEventId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>עריכת אירוע</h2>
              <button onClick={() => setEditEventId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>כותרת האירוע / התחנה</label>
                <input type="text" value={editEventTitle} onChange={(e) => setEditEventTitle(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>תאריך האירוע</label>
                <input type="date" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>פירוט מה היה (אופציונלי)</label>
                <textarea value={editEventDesc} onChange={(e) => setEditEventDesc(e.target.value)} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}></textarea>
              </div>

              <button onClick={handleSaveEdit} style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                שמור שינויים
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
`;
tx = tx.replace("{showAddModal && (", editModalJsx);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
console.log('Patched edit mode!');
