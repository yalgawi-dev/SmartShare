const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

// 1. Add formatDisplayDate helper
if (!content.includes('const formatDisplayDate')) {
  content = content.replace(
    "const [retroScanInvoice, setRetroScanInvoice] = useState<any>(null);",
    "const [retroScanInvoice, setRetroScanInvoice] = useState<any>(null);\n  const formatDisplayDate = (d: string) => { if (!d) return '---'; if (d.includes('-')) return d.split('-').reverse().join('.'); return d; };"
  );
}

// 2. Make Total Row sticky
content = content.replace(
  "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>",
  "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', position: 'sticky', top: '70px', zIndex: 40, background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '1rem', margin: '0 -0.5rem 1rem -0.5rem' }}>"
);

// 3. Make Table Header sticky
content = content.replace(
  "<tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '2px solid var(--border-light)', textAlign: 'right' }}>",
  "<tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-light)', textAlign: 'right', position: 'sticky', top: '125px', zIndex: 30 }}>"
);

// 4. Update Table Supplier TD (truncate)
content = content.replace(
  "<td style={{ padding: '0.8rem 1rem', fontWeight: 'bold' }}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}</td>",
  "<td style={{ padding: '0.8rem 1rem', fontWeight: 'bold', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || '---'}</td>"
);

// 5. Update dates in table
content = content.replace(
  "<td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{inv.date}</td>",
  "<td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDisplayDate(inv.date)}</td>"
);

// 6. Update dates in cards
content = content.replace(
  "<span style={{ whiteSpace: 'nowrap' }}>{inv.date}</span>",
  "<span style={{ whiteSpace: 'nowrap' }}>{formatDisplayDate(inv.date)}</span>"
);

// 7. Add Title to Expanded Details
const expandedStartStr = "<div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-main)' }}>\n                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>";
if (content.includes(expandedStartStr)) {
  content = content.replace(
    expandedStartStr,
    expandedStartStr + "\n                    <div style={{ flex: '1 1 100%', marginBottom: '-0.5rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || 'עסק/לקוח'}</h3></div>"
  );
}

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', content);
