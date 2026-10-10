const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');

// Replace ייבוא חשבונית onClick
tx = tx.replace(
  `onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'transparent', border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                color: 'var(--text-secondary)', minWidth: '45px', transition: 'all 0.2s', flex: 1
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>ייבוא חשבונית</span>`,
  `onClick={() => onOpenScanner('upload', 'receipt')}
              style={{
                background: 'transparent', border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                color: 'var(--text-secondary)', minWidth: '45px', transition: 'all 0.2s', flex: 1
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>ייבוא חשבונית</span>`
);

// Replace העלאה onClick
tx = tx.replace(
  `onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'transparent', 
                  border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                  color: '#64748b',
                  minWidth: '45px', transition: 'all 0.2s', flex: 1
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📤</span>
                <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>העלאה</span>`,
  `onClick={() => onOpenScanner('upload', 'document')}
                style={{
                  background: 'transparent', 
                  border: 'none', padding: '0.5rem 0.1rem', borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                  color: '#64748b',
                  minWidth: '45px', transition: 'all 0.2s', flex: 1
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📤</span>
                <span style={{ fontSize: '0.6rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.1', whiteSpace: 'normal', maxWidth: '60px' }}>העלאה</span>`
);

fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', tx);
