const fs = require('fs');

let content = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');
const lines = content.split('\n');
const uploadIdx = lines.findIndex(l => l.includes('העלאה'));
const addShelfIdx = lines.findIndex(l => l.includes('מדף חדש'));

if (uploadIdx !== -1 && addShelfIdx !== -1) {
  const newBlock = `        {!hasFinance && hasVault && (
          <>
            {isVaultTab && (
              <button 
                onClick={onOpenScanner}
                style={{
                  background: 'transparent', 
                  border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                  color: '#64748b',
                  minWidth: '45px', transition: 'all 0.2s', flex: 1
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📤</span>
                <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>העלאה</span>
              </button>
            )}
            {!isInShelf && (
              <button 
                onClick={() => { const e = new CustomEvent('smartshare:add_shelf'); window.dispatchEvent(e); }}
                style={{
                  background: 'transparent', 
                  border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                  color: '#64748b',
                  minWidth: '45px', transition: 'all 0.2s', flex: 1
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📁<span style={{ fontSize: '0.6rem', verticalAlign: 'super' }}>+</span></span>
                <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>מדף חדש</span>
              </button>
            )}
          </>
        )}`;
  
  const startIdx = uploadIdx - 14;
  const endIdx = addShelfIdx + 4;
  lines.splice(startIdx, endIdx - startIdx, newBlock);
  fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', lines.join('\n'));
} else {
  console.log('Could not find upload/addShelf buttons!');
}
