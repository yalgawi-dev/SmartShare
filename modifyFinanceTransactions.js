const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

const renderAmountRegex = /<h3 style=\{\{ margin: '0 0 0\.25rem 0', fontSize: '1\.1rem', color: 'var\(--text-primary\)' \}\}>\s*₪\{inv\.amount\?\.toLocaleString\(\)\}\s*<\/h3>/m;
const renderAmountReplacement = `
                      {inv.amount < 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#ef4444' }}>
                            -₪{Math.abs(inv.amount)?.toLocaleString()}
                          </h3>
                          <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: '#ef4444', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                            {inv.isStoreCredit ? 'מקדמה (נשאר בחנות)' : 'זיכוי'}
                          </span>
                        </div>
                      ) : (
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                          ₪{inv.amount?.toLocaleString()}
                        </h3>
                      )}
`;

content = content.replace(renderAmountRegex, renderAmountReplacement);

fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
console.log("Updated FinanceTransactions.tsx");
