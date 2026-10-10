const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');

const leftSideFalseBranch = `          </>
        ) : (
          <>
            {hasVault && activeTab === 'documents' && (
              <>
                {!isInShelf && (
                  <button onClick={() => { const e = new CustomEvent('smartshare:add_shelf'); window.dispatchEvent(e); }} style={{ background: 'transparent', border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: '#64748b', minWidth: '45px', transition: 'all 0.2s', flex: 1 }}>
                    <span style={{ fontSize: '1.2rem' }}>📁<span style={{ fontSize: '0.6rem', verticalAlign: 'super' }}>+</span></span>
                    <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>מדף חדש</span>
                  </button>
                )}
                {isInShelf && (
                  <button onClick={() => { const e = new CustomEvent('smartshare:add_station'); window.dispatchEvent(e); }} style={{ background: 'transparent', border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', color: '#10b981', minWidth: '45px', transition: 'all 0.2s', flex: 1 }}>
                    <span style={{ fontSize: '1.2rem' }}>📍</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>הוסף תחנה</span>
                  </button>
                )}
              </>
            )}
            {hasChat && hasActivePartners && activeTab !== 'documents' && (`;

tx = tx.replace(/<\/>\s*\)\s*:\s*\(\s*<>\s*{hasChat && hasActivePartners && \(/, leftSideFalseBranch);

// Since I already ran `tx = tx.replace(/{hasPartners && \(/, "{hasPartners && activeTab !== 'documents' && (");` in the previous patch, it probably DID apply! Let's check.
fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', tx);
