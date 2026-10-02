const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
txt = txt.replace(/<React\.Fragment key=\{b\.userId \|\| b\.name\}>\s*<tr\s*onClick/g, "<React.Fragment key={b.userId || b.name}>\n                        <tr id={`partner-row-${b.userId}`} onClick");
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', txt);
console.log('Replaced');
