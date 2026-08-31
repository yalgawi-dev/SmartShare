const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

const h4Regex = /<h4 style=\{\{ margin\: \'0 0 0\.25rem 0\', fontSize\: \'1rem\', display\: \'flex\', alignItems\: \'center\', gap\: \'0\.5rem\' \}\}>\s*\{inv\.supplier\}/;
const newH4 = `<h4 style={{ margin: '0 0 0.1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {inv.supplier}
                        {inv.clientName && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                            (עבור: {inv.clientName})
                          </span>
                        )}`;

content = content.replace(h4Regex, newH4);
fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
console.log("Updated FinanceTransactions.tsx to show clientName");
