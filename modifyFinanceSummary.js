const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const forEachRegex = /unifiedBalances\.get\(matchedId\)\!\.paid \+\= \(inv\.amount \|\| 0\);/m;
const forEachReplacement = `// If it's a store credit (negative amount), the payer didn't get cash back, so their out-of-pocket paid amount shouldn't decrease!
      if (inv.isStoreCredit && inv.amount < 0) {
        // Do nothing to paid
      } else {
        unifiedBalances.get(matchedId)!.paid += (inv.amount || 0);
      }`;

content = content.replace(forEachRegex, forEachReplacement);

const totalExpensesRegex = /const totalExpenses = expensesOnly\.reduce\(\(acc: number, inv: any\) => acc \+ \(inv\.amount \|\| 0\), 0\);/m;
const totalExpensesReplacement = `const totalExpenses = expensesOnly.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
    const totalStoreCredits = expensesOnly.filter((inv: any) => inv.isStoreCredit && inv.amount < 0).reduce((acc: number, inv: any) => acc + Math.abs(inv.amount || 0), 0);`;

content = content.replace(totalExpensesRegex, totalExpensesReplacement);

const summaryDisplayRegex = /<p style=\{\{ margin: '0 0.2rem 0 0', fontSize: '0.8rem', color: 'var\(--text-secondary\)' \}\}>,x\{totalExpenses\.toLocaleString\(undefined, \{maximumFractionDigits: 0\}\)\}<\/p>/m;
// Also find the big block
const bigBlockRegex = /<h3 style=\{\{ margin: '0\.5rem 0 0 0', fontSize: '1\.75rem', color: 'var\(--text-primary\)' \}\}>,x\{totalExpenses\.toLocaleString\(undefined, \{maximumFractionDigits: 0\}\)\}<\/h3>/m;

content = content.replace(
  bigBlockRegex,
  `<h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            {totalStoreCredits > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#fef2f2', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b91c1c' }}>יתרות זכות מספקים:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#991b1b' }}>₪{totalStoreCredits.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
            )}`
);

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
console.log("Updated FinanceSummary.tsx math and UI");
