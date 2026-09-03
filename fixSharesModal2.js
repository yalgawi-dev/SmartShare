const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf-8');

const targetStr = `        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>
          <span style={{ fontWeight: 'bold', color: Math.abs(total - 100) > 0.1 ? '#ef4444' : '#10b981' }}>{total.toFixed(1)}%</span>
        </div>`;

const replacementStr = `        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>
          <span style={{ fontWeight: 'bold', color: Math.abs(total - 100) > 0.1 ? '#ef4444' : '#10b981' }}>{total.toFixed(1)}%</span>
        </div>

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
        </div>`;

c = c.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', c);
console.log('Modified SharesEditorModal part 2');
