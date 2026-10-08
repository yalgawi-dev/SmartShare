const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/reports/page.tsx', 'utf8');

// 1. Add imports
tx = tx.replace("import { useSpaces } from '../../../context/SpacesContext';", "import { useSpaces } from '../../../context/SpacesContext';\nimport { useAuth } from '../../../context/AuthContext';\nimport { FinanceTransactions } from '../../../components/widgets/Finance/FinanceTransactions';");

// 2. Add state inside component
tx = tx.replace("const [isZipping, setIsZipping] = useState(false);", "const [isZipping, setIsZipping] = useState(false);\n  const { user } = useAuth();\n  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>('all');\n  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);");

// 3. Make Total Expenses card sticky
tx = tx.replace(/<div className="card glass-panel" style={{ padding: '1\.5rem', background: 'var\(--bg-card\)' }}>\r?\n\s+<h3 style={{ margin: '0 0 1rem 0', color: 'var\(--text-secondary\)' }}>סך כל ההוצאות בפרויקט<\/h3>/, `<div className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', position: 'sticky', top: '75px', zIndex: 50, border: '2px solid var(--primary)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>סך כל ההוצאות בפרויקט</h3>`);

// 4. Replace Table Row with FinanceTransactions
const tableStartIdx = tx.indexOf('{/* Table Row */}');
const tableEndStr = `</button>\n                      ) : '➖'}\n                    </td>\n                  </tr>\n                ))}\n              </tbody>\n            </table>\n          </div>\n        )}\n      </div>\n`;
const tableEndIdx = tx.indexOf(tableEndStr) + tableEndStr.length;

if (tableStartIdx !== -1 && tx.indexOf(tableEndStr) !== -1) {
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
      </div>
`;
  tx = tx.substring(0, tableStartIdx) + newTableCode + tx.substring(tableEndIdx);
} else {
  console.log("Could not find table bounds");
}

fs.writeFileSync('src/app/space/[id]/reports/page.tsx', tx);
