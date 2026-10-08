const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/reports/page.tsx', 'utf8');

const tableStartIdx = tx.indexOf('{/* Table Row */}');
const tableEndStr = '        )}\n      </div>';
const tableEndIdx = tx.indexOf(tableEndStr, tableStartIdx) + tableEndStr.length;

if (tableStartIdx !== -1 && tableEndIdx !== -1) {
  const newTableCode = `{/* Table Row via FinanceTransactions Component */}
      <div className="card glass-panel" style={{ background: 'var(--bg-card)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', padding: '1.5rem 1.5rem 0', color: 'var(--text-primary)' }}>טבלת הוצאות מפורטת</h3>
        
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <FinanceTransactions 
            invoices={invoices}
            filteredInvoices={invoices}
            activePartnersCount={0}
            user={user}
            space={space}
            filter={filter}
            setFilter={setFilter}
            expandedInvoiceId={expandedInvoiceId}
            setExpandedInvoiceId={setExpandedInvoiceId}
            setPreviewImage={setPreviewImage}
          />
        </div>
      </div>`;
  tx = tx.substring(0, tableStartIdx) + newTableCode + tx.substring(tableEndIdx);
  fs.writeFileSync('src/app/space/[id]/reports/page.tsx', tx);
  console.log("Patched correctly!");
} else {
  console.log("Could not find table bounds again!");
}
