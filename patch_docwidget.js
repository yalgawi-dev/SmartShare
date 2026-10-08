const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

const oldHeaderStr = `<div style={{ padding: '1rem 0', paddingBottom: '6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setActiveShelfId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.8rem', color: '#3b82f6', marginLeft: '0.5rem' }}>v2.3</span> <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>✏️</span>
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>נוצר: {new Date(activeShelf.createdAt).toLocaleDateString('he-IL')}</div>
          </div>
          <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
            🎨 עיצוב
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', padding: '0 1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'timeline' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'timeline' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
            ציר זמן (הסיפור)
          </button>
          <button onClick={() => setActiveTab('vault')} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'vault' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'vault' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
            מחסן מסמכים (חומר גלם)
          </button>
        </div>`;

const newHeaderStr = `<div style={{ padding: '0', paddingBottom: '6rem' }}>
        <div style={{ position: 'sticky', top: '56px', zIndex: 100, background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid #e2e8f0', margin: '0 -1rem 1rem -1rem', padding: '0.5rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setActiveShelfId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b', padding: '0' }}>
              ←
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.2rem' }}>v2.3</span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>✏️</span>
              </h2>
            </div>
            <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: 'transparent', border: 'none', padding: '0', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
              🎨 עיצוב
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'timeline' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'timeline' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
              ציר זמן (הסיפור)
            </button>
            <button onClick={() => setActiveTab('vault')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'vault' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'vault' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
              מחסן מסמכים
            </button>
          </div>
        </div>`;

tx = tx.replace(oldHeaderStr, newHeaderStr);

fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', tx);
console.log("Patched DocumentsWidget Header");
