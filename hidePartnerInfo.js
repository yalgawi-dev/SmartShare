const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

// 1. Hide the pending and balance cubes
const pendingCubeStart = `        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}`;
const pendingCubeReplacement = `        {activePartnersCount > 0 && (
        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}`;

content = content.replace(pendingCubeStart, pendingCubeReplacement);

// The end of balance cube
const balanceCubeEnd = `        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>`;

const balanceCubeEndReplacement = `        </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>`;

content = content.replace(balanceCubeEnd, balanceCubeEndReplacement);

// 2. Hide the "מאזן" column header
const thString = `<th style={{ padding: '0.75rem' }}>מאזן</th>`;
const thReplacement = `{activePartnersCount > 0 && <th style={{ padding: '0.75rem' }}>מאזן</th>}`;
content = content.replace(thString, thReplacement);

// 3. Hide the "מאזן" column data
const tdStart = `<td style={{ padding: '0.75rem', fontWeight: 'bold', color: b.balance > 0 ? '#10b981' : b.balance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">`;
const tdReplacement = `{activePartnersCount > 0 && (
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: b.balance > 0 ? '#10b981' : b.balance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">`;

content = content.replace(tdStart, tdReplacement);

const tdEnd = `                      </td>
                    </tr>`;
const tdEndReplacement = `                      </td>
                      )}
                    </tr>`;

content = content.replace(tdEnd, tdEndReplacement);

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
console.log("Success modifying FinanceSummary");
