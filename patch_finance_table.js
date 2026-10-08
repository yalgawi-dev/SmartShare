const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8').split('\n');

const start = lines.findIndex(l => l.includes('<div style={{ display: \\'flex\\', flexDirection: \\'column\\', gap: \\'1rem\\' }}>'));

if (start !== -1) {
  const tableCode = `        viewMode === 'table' ? (
          <div style={{ overflowX: 'auto', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '2px solid var(--border-light)', textAlign: 'right' }}>
                  <th style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{typeFilter === 'transfer' ? 'מקור' : typeFilter === 'income' ? 'לקוח/מקור' : 'ספק/עסק'}</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>תאריך</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>משלם</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סטטוס</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>📎</th>
                </tr>
              </thead>
              <tbody>
                {finallyFiltered.map((inv: any) => (
                  <React.Fragment key={inv.id}>
                    <tr 
                      onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                      style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: expandedInvoiceId === inv.id ? 'rgba(99,102,241,0.05)' : 'transparent', transition: 'background 0.2s' }}
                    >
                      <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold' }}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}</td>
                      <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{inv.date}</td>
                      <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', color: inv.type === 'income' ? '#10b981' : 'inherit' }}>₪{Number(inv.amount || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)' }}>{allUsers.find(u => u.id === inv.payerId)?.name || inv.payerName || '---'}</td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2', color: inv.status === 'approved' ? '#065f46' : inv.status === 'pending' ? '#92400e' : '#991b1b', fontWeight: 'bold' }}>
                          {inv.status === 'approved' ? '✓ מאושר' : inv.status === 'pending' ? '⏳ ממתין' : '❌ נדחה'}
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                        {inv.hasAttachment ? <span title="מצורפת חשבונית">📎</span> : <span style={{ color: '#ef4444' }}>⚠️</span>}
                      </td>
                    </tr>
                    {expandedInvoiceId === inv.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={{ borderBottom: '2px solid var(--primary)' }}>
                            {renderExpandedDetails(inv)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (`;
  
  lines.splice(start, 0, tableCode);
  
  // Now we need to add the closing `)` for the `viewMode === 'table' ? (...) : (...)`
  const end = lines.findIndex((l, i) => i > start && l.trim() === '</div>' && lines[i+1]?.trim() === ')}');
  if (end !== -1) {
    lines[end] = '        </div>\n        )';
  }
}

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', lines.join('\n'));
