const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf-8').split('\n');

const insertIdx = lines.findIndex(l => l.includes("display: 'flex', gap: '0.75rem'"));

if (insertIdx > -1) {
  lines.splice(insertIdx, 0, `
        <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.95rem' }}>זמן פג תוקף להמתנה</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>שותף שלא אישר יימחק אוטומטית</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                min="1" max="72" 
                value={expHours} 
                onChange={e => setExpHours(Number(e.target.value))}
                style={{ width: '60px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.9rem' }}>שעות</span>
            </div>
          </div>
        </div>`);
  fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', lines.join('\n'));
  console.log('Successfully added expiration UI');
} else {
  console.log('Failed to find insertion point');
}
