const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8').split('\n');

const start = lines.findIndex(l => l.includes('{finallyFiltered.length === 0 ? ('));
const toggleCode = `      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
          סך הכל: ₪{finallyFiltered.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0).toLocaleString()}
        </div>
        <button 
          onClick={() => setViewMode(prev => prev === 'cards' ? 'table' : 'cards')}
          style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontSize: '0.8rem' }}
        >
          {viewMode === 'cards' ? (
            <><span style={{ fontSize: '1rem' }}>📄</span> תצוגת טבלה</>
          ) : (
            <><span style={{ fontSize: '1rem' }}>🗂️</span> תצוגת קוביות</>
          )}
        </button>
      </div>`;

if (start !== -1) {
  lines.splice(start, 0, toggleCode);
}

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', lines.join('\n'));
