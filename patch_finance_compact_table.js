const fs = require('fs');
const content = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

const tableBlockStart = "<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '500px' }}>";

const newTableBlock = `<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right', position: 'sticky', top: '128px', zIndex: 30 }}>
                  <th style={{ padding: '0.6rem 0.4rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{typeFilter === 'transfer' ? 'מקור' : typeFilter === 'income' ? 'לקוח/מקור' : 'ספק/עסק'}</th>
                  <th style={{ padding: '0.6rem 0.4rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>תאריך</th>
                  <th style={{ padding: '0.6rem 0.4rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>📎</th>
                </tr>
              </thead>
              <tbody>
                {finallyFiltered.map((inv: any) => (
                  <React.Fragment key={inv.id}>
                    <tr 
                      onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                      style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: expandedInvoiceId === inv.id ? 'rgba(99,102,241,0.05)' : 'transparent', transition: 'background 0.2s' }}
                    >
                      <td style={{ padding: '0.8rem 0.4rem', fontWeight: 'bold', maxWidth: '110px' }} title={inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                          <div title={inv.status === 'approved' ? 'מאושר' : inv.status === 'pending' ? 'ממתין' : 'נדחה'} style={{ width: '8px', height: '8px', borderRadius: '50%', background: inv.status === 'approved' ? '#10b981' : inv.status === 'pending' ? '#f59e0b' : '#ef4444', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 0.4rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDisplayDate(inv.date)}</td>
                      <td style={{ padding: '0.8rem 0.4rem', fontWeight: 'bold', color: inv.type === 'income' ? '#10b981' : 'inherit', whiteSpace: 'nowrap' }}>₪{Number(inv.amount || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.8rem 0.4rem', textAlign: 'center' }}>
                        {inv.hasAttachment ? <span title="מצורפת חשבונית">📎</span> : <span style={{ color: '#ef4444' }} title="חסרה חשבונית">⚠️</span>}
                      </td>
                    </tr>
                    {expandedInvoiceId === inv.id && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0 }}>
                          <div style={{ borderBottom: '2px solid var(--primary)' }}>
                            {renderExpandedDetails(inv)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>`;

const startIdx = content.indexOf(tableBlockStart);
if (startIdx === -1) throw new Error("Could not find table block");
const endIdx = content.indexOf("</table>", startIdx);

const newContent = content.substring(0, startIdx) + newTableBlock + content.substring(endIdx + 8);

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', newContent);
