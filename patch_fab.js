const fs = require('fs');

let tx = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');

tx = tx.replace('const handleVaultOff = () => setIsVaultTab(false);', `const handleVaultOff = () => setIsVaultTab(false);
    const handleTriggerUpload = () => fileInputRef.current?.click();
    window.addEventListener('smartshare:trigger_file_upload', handleTriggerUpload);`);

tx = tx.replace('window.removeEventListener("smartshare:vault_tab_inactive", handleVaultOff);', `window.removeEventListener("smartshare:vault_tab_inactive", handleVaultOff);
      window.removeEventListener('smartshare:trigger_file_upload', handleTriggerUpload);`);

// Also fix the left side rendering for multi-feature:
// Replace the Chat and Partners with Vault buttons IF activeTab === 'documents'
const leftSideFalseBranch = `) : (
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

tx = tx.replace(/}\) : \(\s*<>\s*{hasChat && hasActivePartners && \(/, leftSideFalseBranch);

// Add activeTab !== 'documents' to partners button too:
tx = tx.replace(/{hasPartners && \(/, "{hasPartners && activeTab !== 'documents' && (");

fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', tx);
