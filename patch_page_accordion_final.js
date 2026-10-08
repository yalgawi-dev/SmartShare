const fs = require('fs');
let lines = fs.readFileSync('src/app/page.tsx', 'utf8').split('\n');

// Add state
const stateIdx = lines.findIndex(l => l.includes("const [searchQuery, setSearchQuery] = useState('');"));
if (stateIdx !== -1) {
  lines.splice(stateIdx + 1, 0, "  const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);");
}

const startIdx = lines.findIndex(l => l.includes('<div className={styles.grid}>'));
const mapEnd = lines.findLastIndex(l => l.trim() === '})}');

if (startIdx !== -1 && mapEnd !== -1) {
  const newBlock = `<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
          {searchedSpaces.length === 0 && visibleSpaces.length > 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              לא נמצאו מרחבים תואמים לחיפוש
            </div>
          )}

        {searchedSpaces.map((space, index) => {
          let showFirstSpaceTip = false;
          if (visibleSpaces.length === 1 && index === 0 && typeof window !== 'undefined') {
            try { showFirstSpaceTip = !localStorage.getItem('tutorial_enter_space'); } catch(e) {}
          }
          const isExpanded = expandedSpaceId === space.id;
          
          return (
          <div id={\`space-\${space.id}\`} key={space.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', border: isExpanded ? '2px solid var(--primary)' : '1px solid var(--border-light)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s ease', boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
            
            {/* Header / Accordion Toggle */}
            <div 
              onClick={() => setExpandedSpaceId(isExpanded ? null : space.id)}
              style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}
            >
              <div style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--bg-body)', borderRadius: '12px' }}>
                {space.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{space.title}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{space.features.length} פיצ'רים</span>
                  {(() => {
                    const totalUnread = (space.members || []).reduce((acc: number, m: any) => acc + ((m.messages || []).filter((msg: any) => msg.from === 'partner' && !msg.readAt).length), 0);
                    const hasExtension = (space.members || []).some((m: any) => m.status === 'extension_requested');
                    const count = totalUnread + (hasExtension ? 1 : 0);
                    return count > 0 ? (
                      <span style={{ background: '#ef4444', color: 'white', borderRadius: '12px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{count} עדכונים</span>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-light)' }}>
                {space.coverImage && (
                  <div style={{ height: '120px', width: 'calc(100% + 2rem)', margin: '0 -1rem 1rem -1rem', background: 'var(--border-light)', overflow: 'hidden' }}>
                    <img src={space.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                
                {editingSpaceId === space.id ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (editTitleValue.trim()) updateSpaceTitle(space.id, editTitleValue.trim());
                    setEditingSpaceId(null);
                  }} style={{ margin: '0 0 1rem 0' }}>
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={() => {
                        if (editTitleValue.trim()) updateSpaceTitle(space.id, editTitleValue.trim());
                        setEditingSpaceId(null);
                      }}
                      autoFocus
                      onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 50); }}
                      style={{
                        margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)',
                        border: '1px solid var(--primary)', borderRadius: '6px',
                        padding: '0.4rem', outline: 'none', background: 'var(--bg-main)', width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </form>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', flex: 1 }}>{space.description}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditTitleValue(space.title); setEditingSpaceId(space.id); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
                      title="שנה שם"
                    >
                      ✏️
                    </button>
                  </div>
                )}

                <div className={styles.badges} style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {space.features.slice(0, 5).map(fId => {
                    const feature = getFeatureById(fId);
                    return feature ? <span key={fId} className={styles.badge}>{feature.name}</span> : null;
                  })}
                  {space.features.length > 5 && (
                    <span className={styles.badge}>+{space.features.length - 5}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={\`/space/\${space.id}\`} 
                    onClick={() => {
                      try { 
                        sessionStorage.setItem('lastSpaceVisited', space.id); 
                        const currentVisits = parseInt(localStorage.getItem(\`space_visits_\${space.id}\`) || '0', 10);
                        localStorage.setItem(\`space_visits_\${space.id}\`, (currentVisits + 1).toString());
                      } catch(e){}
                      if (showFirstSpaceTip) {
                        try { localStorage.setItem('tutorial_enter_space', '1'); } catch(e){}
                      }
                    }}
                    style={{ flex: 1, background: 'var(--primary)', color: 'white', textDecoration: 'none', textAlign: 'center', padding: '0.8rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    כניסה למרחב <span>→</span>
                  </Link>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm('למחוק את המרחב "' + space.title + '"? הפעולה תעביר אותו לארכיון המחיקה.')) {
                        deleteSpace(space.id);
                      }
                    }}
                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.8rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="מחק מרחב"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            )}
          </div>
        );
        })}
      </div>`;

  lines.splice(startIdx, mapEnd - startIdx + 2, newBlock);
  fs.writeFileSync('src/app/page.tsx', lines.join('\n'));
} else {
  console.log("Could not find start or end index.");
}
